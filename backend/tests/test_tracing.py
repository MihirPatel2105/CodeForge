import asyncio
from datetime import UTC, datetime
from unittest.mock import Mock

from app.llm.tracing import LangfuseV2Logger


def test_v2_bridge_preserves_run_and_agent_metadata():
    client = Mock()
    callback = LangfuseV2Logger(client)
    at = datetime.now(UTC)
    kwargs = {
        "model": "model",
        "messages": [],
        "litellm_params": {
            "metadata": {
                "run_id": "run-42",
                "generation_name": "pm-agent",
                "agent": "pm",
                "iteration": 2,
            }
        },
    }
    asyncio.run(
        callback.async_log_success_event(
            kwargs, {"usage": {"prompt_tokens": 10, "completion_tokens": 5}}, at, at
        )
    )
    assert client.trace.call_args.kwargs["id"] == "run-42"
    generation = client.trace.return_value.generation.call_args.kwargs
    assert generation["name"] == "pm-agent"
    assert generation["metadata"]["iteration"] == 2
    assert generation["usage"] == {"input": 10, "output": 5}


def test_tracing_failure_does_not_escape_callback():
    client = Mock()
    client.trace.side_effect = RuntimeError("Tracing offline")
    callback = LangfuseV2Logger(client)
    at = datetime.now(UTC)
    asyncio.run(callback.async_log_success_event({}, {}, at, at))
    asyncio.run(callback.async_log_failure_event({}, {}, at, at))
