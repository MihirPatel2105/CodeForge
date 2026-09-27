"""A second account cannot use another account's resource identifiers."""

import pytest


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("GET", "/projects/{project_id}"),
        ("DELETE", "/projects/{project_id}"),
        ("GET", "/projects/{project_id}/runs"),
        ("GET", "/runs/{run_id}"),
        ("GET", "/runs/{run_id}/files"),
        ("GET", "/runs/{run_id}/file-history"),
        ("GET", "/runs/{run_id}/stream"),
        ("GET", "/runs/{run_id}/artifacts"),
        ("GET", "/runs/{run_id}/artifacts/507f1f77bcf86cd799439099"),
        ("GET", "/runs/{run_id}/preview"),
        ("DELETE", "/runs/{run_id}/preview"),
        ("GET", "/runs/{run_id}/deployment"),
        ("DELETE", "/runs/{run_id}/deployment"),
        ("POST", "/runs/{run_id}/deployment"),
        ("POST", "/runs/{run_id}/deployment/rotate-key"),
        ("POST", "/runs/{run_id}/cancel"),
        ("POST", "/runs/{run_id}/approve"),
    ],
)
def test_foreign_resource_id_is_not_accessible(client, method: str, path: str) -> None:
    def register(email: str) -> dict[str, str]:
        response = client.post(
            "/auth/register",
            json={"first_name": "Test", "email": email, "password": "Secret12345"},
        )
        assert response.status_code == 201
        return {"Authorization": f"Bearer {response.json()['access_token']}"}

    owner = register("owner@example.com")
    other = register("other@example.com")
    project = client.post("/projects", json={"name": "Private"}, headers=owner).json()
    run = client.post(
        "/runs", json={"project_id": project["id"], "prompt": "private api"}, headers=owner
    ).json()
    assert client.get(f"/projects/{project['id']}", headers=owner).status_code == 200
    assert client.get(f"/runs/{run['run_id']}", headers=owner).status_code == 200

    target = path.format(project_id=project["id"], run_id=run["run_id"])
    payload = {"phase": "pm", "approved": True} if target.endswith("/approve") else None
    response = client.request(method, target, headers=other, json=payload)
    assert response.status_code == 404
    assert client.get(f"/projects/{project['id']}", headers=owner).status_code == 200
