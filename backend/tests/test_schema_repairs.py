"""Leniency rules on agent schemas.

Every rule here exists because a free-tier model broke a real run in exactly this way.
They are tested so nobody "cleans up" a repair and silently reintroduces the failure.
"""

import pytest
from pydantic import ValidationError

from app.schemas.agents import (
    CodeOutput,
    Collection,
    Design,
    Endpoint,
    FileSpec,
    Finding,
    GeneratedFile,
    Requirements,
    ReviewResult,
    SingleFileOutput,
)

# --------------------------------------------------------------------------- #
# Source wrapped in the content field — 5 of 10 generated trees failed on this
# --------------------------------------------------------------------------- #


def test_filename_banner_is_stripped():
    """`'''database.py` opens a string that is never closed, so the file fails to parse
    at line 1 even though the code below it is fine."""
    out = SingleFileOutput(path="database.py", content="'''database.py\nimport os\n\nX = 1\n")
    assert out.content.startswith("import os")


def test_markdown_fences_are_stripped():
    out = SingleFileOutput(path="main.py", content="```python\nimport os\nY = 2\n```")
    assert out.content.startswith("import os")
    assert "```" not in out.content


def test_valid_source_is_never_touched():
    """A repair is applied only when it turns unparseable source into parseable source,
    so a correct file with a real docstring must survive untouched."""
    source = '"""A real module docstring."""\n\nZ = 3\n'
    assert SingleFileOutput(path="ok.py", content=source).content == source


def test_unparseable_python_is_rejected_at_generation_time():
    """Strict where it can still be fixed: raising makes Instructor re-ask the model with
    the syntax error attached, and failing that the chain drops to a rung with a bigger
    token budget — which is what a truncated file needs."""
    with pytest.raises(ValidationError):
        SingleFileOutput(path="bad.py", content="def f(:\n    pass\n")


def test_stored_broken_files_remain_loadable():
    """Lenient where nothing can be fixed: a tree already in the database must still load,
    or analysis, replay and the files endpoint would all break on historic runs."""
    broken = "def f(:\n    pass\n"
    assert GeneratedFile(path="bad.py", content=broken).content == broken


def test_non_python_files_are_not_parsed():
    """A README or JSON fixture must not be judged as Python."""
    assert SingleFileOutput(path="notes.md", content="# not python {").content.startswith("#")


def test_test_module_without_tests_is_rejected():
    """The silent half of truncation: a suite cut off after its imports still parses, and
    pytest then collects zero tests — which reads downstream as failing tests rather than
    as a Tester that wrote nothing. Observed live 2026-08-19, when a test_main.py of
    exactly this shape produced "no tests ran in 0.09s"."""
    with pytest.raises(ValidationError):
        SingleFileOutput(path="test_main.py", content="from fastapi.testclient import TestClient\n")


def test_test_module_with_a_test_is_accepted():
    source = "from main import app\n\n\ndef test_health():\n    assert app is not None\n"
    assert SingleFileOutput(path="test_main.py", content=source).content == source


def test_test_class_methods_count_as_tests():
    """Walking the tree, not scanning text, so a suite grouped into a TestFoo class is
    still recognised."""
    source = "class TestBooks:\n    def test_create(self):\n        assert True\n"
    assert SingleFileOutput(path="test_main.py", content=source).content == source


def test_conftest_may_define_no_tests():
    """conftest.py is support code; requiring tests there would reject a valid file."""
    source = "import pytest\n\n\n@pytest.fixture\ndef client():\n    return None\n"
    assert SingleFileOutput(path="conftest.py", content=source).content == source


def test_a_test_named_in_a_comment_does_not_count():
    """Text scanning would pass this; an AST walk correctly rejects it."""
    with pytest.raises(ValidationError):
        SingleFileOutput(path="test_main.py", content="# def test_create() goes here\nX = 1\n")


# --------------------------------------------------------------------------- #
# Shape leniency
# --------------------------------------------------------------------------- #


def test_stringified_json_list_is_decoded():
    review = ReviewResult.model_validate(
        {"findings": '[{"severity":"nit","file":"a.py","issue":"i","fix_hint":"f"}]'}
    )
    assert len(review.findings) == 1


def test_bare_string_becomes_a_single_item_list():
    """Cost a whole generation: a model wrote a bare string where a list was declared.

    Exercised on `CodeOutput.changelog` because the coercion lives on `AgentSchema` and
    applies to every list field. It used to be exercised on `SingleFileOutput.notes`,
    which no longer exists — see that class's docstring for why.
    """
    out = CodeOutput.model_validate(
        {"files": [{"path": "m.py", "content": "X = 1"}], "changelog": "just one entry"}
    )
    assert out.changelog == ["just one entry"]


def test_name_is_recovered_as_path():
    assert FileSpec.model_validate({"name": "main.py", "purpose": "app"}).path == "main.py"


def test_fix_is_recovered_as_fix_hint():
    finding = Finding.model_validate(
        {"severity": "blocking", "file": "main.py", "issue": "bad", "fix": "use str"}
    )
    assert finding.fix_hint == "use str"


def test_collections_are_flat():
    """Nested collection fields were the most common cause of a rejected Design, because
    providers validate tool arguments server-side before Pydantic ever runs."""
    collection = Collection(name="books", fields=["title", "author"], indexes=["title"])
    assert collection.fields == ["title", "author"]
    assert "EntityField" not in str(Design.model_json_schema()["$defs"].keys())


# --------------------------------------------------------------------------- #
# Rules that must NOT be relaxed
# --------------------------------------------------------------------------- #


def test_204_may_omit_a_response_model():
    assert Endpoint(method="DELETE", path="/books/{id}", status_code=204).response_model is None


def test_200_must_declare_a_response_model():
    with pytest.raises(ValidationError):
        Endpoint(method="GET", path="/books", status_code=200)


def test_three_entities_are_rejected():
    entity = {"name": "Book", "fields": [{"name": "title", "type": "str"}]}
    with pytest.raises(ValidationError):
        Requirements(project_name="x", summary="y", entities=[entity] * 3, operations=["create"])
