def test_health(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    assert len(response.headers["X-Request-ID"]) == 32


def test_ready_reports_connected_dependencies(client):
    response = client.get("/ready")
    assert response.status_code == 200
    assert response.json()["checks"]["mongodb"] == "ok"


def test_ready_fails_when_database_is_unavailable(client, monkeypatch):
    from app.api import health

    class BrokenDatabase:
        async def command(self, name):
            raise RuntimeError("offline")

    monkeypatch.setattr(health, "get_database", lambda: BrokenDatabase())
    response = client.get("/ready")
    assert response.status_code == 503
    assert response.json()["checks"]["mongodb"] == "unavailable"
