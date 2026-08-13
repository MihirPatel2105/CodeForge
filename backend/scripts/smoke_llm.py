"""Phase 0 DoD check: one LiteLLM completion, traced to Langfuse.

Throwaway script. The real client — model registry, retries, 429 provider
fallback — lands in Phase 3 as `app/llm/client.py`.

Run from the backend/ directory (it reads .env from the cwd):

    PYTHONPATH=. python scripts/smoke_llm.py
"""

import os
import sys

from app.config import settings


def main() -> int:
    if not settings.groq_api_key:
        print("GROQ_API_KEY is empty in backend/.env")
        return 1

    os.environ["GROQ_API_KEY"] = settings.groq_api_key

    langfuse_on = bool(settings.langfuse_public_key and settings.langfuse_secret_key)
    if langfuse_on:
        os.environ["LANGFUSE_PUBLIC_KEY"] = settings.langfuse_public_key
        os.environ["LANGFUSE_SECRET_KEY"] = settings.langfuse_secret_key
        os.environ["LANGFUSE_HOST"] = settings.langfuse_host

    import litellm

    if langfuse_on:
        litellm.success_callback = ["langfuse"]

    response = litellm.completion(
        model="groq/llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": "Reply with exactly: CodeForge online"}],
        max_tokens=16,
    )

    print("response:", response.choices[0].message.content)
    print("tokens  :", response.usage.total_tokens)

    if langfuse_on:
        litellm.flush()  # traces are batched; force the send before exit
        print("langfuse: trace sent to", settings.langfuse_host)
    else:
        print("langfuse: SKIPPED - keys not set yet (get them from localhost:3000)")

    return 0


if __name__ == "__main__":
    sys.exit(main())
