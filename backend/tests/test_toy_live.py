"""Live integration test for the two-agent toy — the Phase 3 Definition of Done.

Skipped by default: it makes real LLM calls, so it costs free-tier quota, takes tens of
seconds, and fails when a provider is down. None of that belongs in the normal suite.

Run deliberately:

    RUN_LIVE_LLM=1 pytest tests/test_toy_live.py -v

The pipeline runs **once** for the whole module and every response is captured up front.
A per-test fixture would re-run PM and Coder for each assertion — five generations to
check five properties of one output, which wastes the quota this project is built around.

Assertions are about shape and rules, never exact wording: the models are
non-deterministic, and pinning their prose would fail for no useful reason.
"""

import ast
import os

import pytest
from fastapi.testclient import TestClient

from app.main import app

pytestmark = pytest.mark.skipif(
    not os.getenv("RUN_LIVE_LLM"),
    reason="live LLM test; set RUN_LIVE_LLM=1 to run",
)

BOOKS_PROMPT = (
    "I want an API to manage my personal book collection. Each book has a title, "
    "an author, the year it was published, and a list of genres."
)


@pytest.fixture(scope="module")
def live_run():
    """Drive one complete toy run and capture every response.

    Module-scoped and self-contained: it builds its own client because the per-test
    `clean_database` fixture empties the collections between tests, which would delete
    the run document before the later assertions could read it.
    """
    with TestClient(app) as client:
        register = client.post(
            "/auth/register",
            json={"email": "live-toy@example.com", "password": "secret12345"},
        )
        assert register.status_code == 201, register.text
        headers = {"Authorization": f"Bearer {register.json()['access_token']}"}

        project = client.post("/projects", json={"name": "Live Toy"}, headers=headers)
        assert project.status_code == 201, project.text
        project_id = project.json()["id"]

        toy = client.post(
            "/toy/run",
            json={"project_id": project_id, "prompt": BOOKS_PROMPT},
            headers=headers,
            timeout=400,
        )
        assert toy.status_code == 200, toy.text
        result = toy.json()
        run_id = result["run_id"]

        captured = {
            "toy": result,
            "run": client.get(f"/runs/{run_id}", headers=headers).json(),
            "files": client.get(f"/runs/{run_id}/files", headers=headers).json(),
        }

    yield captured

    # The module made its own data, so it cleans up its own data.
    from pymongo import MongoClient

    from app.config import settings

    with MongoClient(settings.mongo_uri) as mongo:
        db = mongo[settings.mongo_db]
        for name in ("users", "projects", "runs"):
            db[name].delete_many({})


def test_pm_extracts_requirements_within_scope(live_run):
    requirements = live_run["toy"]["requirements"]
    entities = requirements["entities"]

    assert 1 <= len(entities) <= 2, "scope rule: at most two entities"
    assert requirements["project_name"]

    allowed = {"str", "int", "float", "bool", "datetime", "list[str]"}
    for entity in entities:
        assert entity["fields"], "an entity with no fields is useless downstream"
        for field in entity["fields"]:
            assert field["type"] in allowed, f"illegal field type {field['type']}"


def test_coder_returns_one_parseable_file(live_run):
    files = live_run["toy"]["files"]
    assert len(files) == 1
    assert files[0]["path"].endswith(".py")

    # Acceptance level L2 (docs/ACCEPTANCE.md): the file must actually parse.
    ast.parse(files[0]["content"])


def test_generated_code_obeys_the_hard_rules(live_run):
    code = live_run["toy"]["files"][0]["content"]

    assert "motor" not in code.lower(), "Beanie 2.x dropped motor; it is not installed"
    assert "response_model" in code, "raw Documents leak a non-serialisable ObjectId"
    assert "mongodb://localhost:27017" in code, "mongod runs inside the sandbox"
    assert "init_beanie" in code, "Beanie must be initialised on startup"
    assert "404" in code, "missing documents must 404"
    assert "TODO" not in code, "generated code must be complete as written"


def test_run_is_persisted_with_prompt_versions(live_run):
    """Prompt changes move the metrics, so the report needs to know which version
    produced which numbers."""
    run = live_run["run"]

    assert run["status"] == "succeeded"
    assert run["state"]["prompt_versions"]["pm"]
    assert run["state"]["prompt_versions"]["coder"]
    assert len(run["state"]["files"]) == 1


def test_files_endpoint_serves_the_generated_tree(live_run):
    served = [f["path"] for f in live_run["files"]["files"]]
    generated = [f["path"] for f in live_run["toy"]["files"]]
    assert served == generated


def test_fallbacks_are_counted(live_run):
    """Free-tier 429s are normal, so the count must be recorded rather than hidden — it
    becomes RunMetrics.provider_fallbacks."""
    assert live_run["toy"]["provider_fallbacks"] >= 0
    assert live_run["toy"]["models_used"]["pm"]
    assert live_run["toy"]["models_used"]["coder"]
