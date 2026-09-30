import asyncio

from fastapi import FastAPI

from app.config import settings
from app.core import monitoring


def test_current_alerts_flags_high_failure_rate(monkeypatch):
    class Runs:
        async def count_documents(self, query):
            return 2 if "status" in query else 5

    class Database:
        async def command(self, name):
            assert name == "ping"

        def __getitem__(self, name):
            assert name == "runs"
            return Runs()

    monkeypatch.setattr(monitoring, "get_database", lambda: Database())
    monkeypatch.setattr(settings, "redis_url", "")
    monkeypatch.setattr(settings, "admin_failure_alert_min_runs", 5)
    monkeypatch.setattr(settings, "admin_failure_alert_percent", 25.0)

    alerts = asyncio.run(monitoring.current_alerts(FastAPI()))
    assert "2 of 5 runs failed" in alerts["run_failure_rate"]
