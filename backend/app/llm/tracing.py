"""Bridge LiteLLM callbacks to the project's Langfuse v2 server and SDK."""

import logging

from litellm.integrations.custom_logger import CustomLogger

logger = logging.getLogger(__name__)


class LangfuseV2Logger(CustomLogger):
    def __init__(self, client):
        super().__init__()
        self.client = client

    def _record(self, kwargs, response_obj, start_time, end_time, failed=False):
        try:
            meta = kwargs.get("litellm_params", {}).get("metadata", {}) or {}
            trace = self.client.trace(
                id=meta.get("run_id"),
                name="codeforge-run",
                metadata=meta,
                tags=meta.get("tags", []),
            )
            response = (
                response_obj.model_dump() if hasattr(response_obj, "model_dump") else response_obj
            )
            usage = response.get("usage", {}) if isinstance(response, dict) else {}
            trace.generation(
                name=meta.get("generation_name", "agent"),
                model=kwargs.get("model"),
                input=kwargs.get("messages"),
                output=None if failed else response,
                metadata=meta,
                start_time=start_time,
                end_time=end_time,
                level="ERROR" if failed else "DEFAULT",
                status_message="Provider attempt failed" if failed else None,
                usage={
                    "input": usage.get("prompt_tokens", 0),
                    "output": usage.get("completion_tokens", 0),
                },
            )
        except Exception:  # noqa: BLE001 — tracing must never break an agent call
            logger.warning("Could not record an agent trace; inference remains available")

    def log_success_event(self, kwargs, response_obj, start_time, end_time):
        self._record(kwargs, response_obj, start_time, end_time)

    def log_failure_event(self, kwargs, response_obj, start_time, end_time):
        self._record(kwargs, response_obj, start_time, end_time, failed=True)

    async def async_log_success_event(self, kwargs, response_obj, start_time, end_time):
        self._record(kwargs, response_obj, start_time, end_time)

    async def async_log_failure_event(self, kwargs, response_obj, start_time, end_time):
        self._record(kwargs, response_obj, start_time, end_time, failed=True)
