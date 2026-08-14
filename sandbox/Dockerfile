# Sandbox image for executing generated applications.
#
# Everything a generated app needs is installed HERE, at build time. Containers run with
# networking disabled (`network_mode="none"`), so nothing can be fetched at run time —
# a missing package is an unrecoverable failure, not a slow start.
#
# Contents mirror docs/GENERATED_APP.md §6. Keep the two in step.
#
#   docker build -t codeforge-sandbox:latest sandbox/
#
# Why MongoDB's image is the base rather than python:3.11-slim, as originally specified:
# MongoDB publishes no arm64 `mongodb-org-server` for Debian, so the documented base
# cannot run mongod on Apple Silicon at all. (Its 7.0 apt repo is also signed with SHA1,
# which Debian's crypto policy has rejected since 2026-02-01.) Building on the official
# image sidesteps both, at the cost of Python 3.12 instead of 3.11 — generated CRUD code
# runs identically on either.

FROM mongo:8

# python3-venv gives us pip via a virtualenv: Ubuntu 24.04 marks its system Python as
# externally managed, and installing into it with --break-system-packages would be a
# worse habit than making an explicit venv.
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-venv \
    && rm -rf /var/lib/apt/lists/*

ENV VIRTUAL_ENV=/opt/venv
RUN python3 -m venv "$VIRTUAL_ENV"
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

# Pinned so a generated app behaves the same today and on demo day. pytest-asyncio is
# deliberately absent: generated tests are synchronous (docs/GENERATED_APP.md §5), and
# leaving it out makes an async test fail loudly at collection instead of silently
# appearing to pass.
RUN pip install --no-cache-dir \
    fastapi==0.115.6 \
    uvicorn==0.34.0 \
    beanie==2.2.0 \
    pymongo==4.16.0 \
    pytest==8.3.4 \
    httpx==0.28.1

# Unprivileged: generated code is untrusted (NFR-2). The mongo image already ships a
# `mongodb` user; reuse it rather than inventing another.
RUN mkdir -p /data/db /app && chown -R mongodb:mongodb /data/db /app

COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

USER mongodb
WORKDIR /app

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
