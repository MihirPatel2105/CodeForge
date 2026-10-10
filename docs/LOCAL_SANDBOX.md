# Local sandbox setup

Use the opt-in `compose.local-sandbox.yml` override for local development on Docker
Desktop. It runs a separate Docker daemon with mutual TLS on an internal network.
No Docker API port is published and the backend has no host Docker socket mount.
Client certificates and daemon data persist in named volumes; certificate keys are
never written into this repository.

The daemon container requires privileged mode and shares Docker Desktop's Linux VM
kernel. This is a development convenience, not the dedicated host boundary required
for production. Production continues to use `compose.deploy.yml` and a dedicated
sandbox host as described in `DEPLOYMENT.md`.

From the repository root:

```bash
# Start the daemon and wait until it is healthy.
docker compose -f docker-compose.yml -f compose.local-sandbox.yml up -d --wait redis sandbox-docker

# Build or update the image on the main daemon, then copy it into the private daemon.
docker build -t codeforge-sandbox:latest ./sandbox
docker image save codeforge-sandbox:latest | docker compose -f docker-compose.yml -f compose.local-sandbox.yml exec -T sandbox-docker docker image load

# Apply the TLS connection and certificate mount to the backend.
# Finish or cancel active runs first: this may recreate the backend container.
docker compose -f docker-compose.yml -f compose.local-sandbox.yml up -d --no-deps backend

# Check access from the backend itself.
docker compose -f docker-compose.yml -f compose.local-sandbox.yml exec backend python -c 'import docker; c=docker.from_env(); print(c.ping()); print(c.images.get("codeforge-sandbox:latest").id)'
```

Use both Compose files on subsequent starts, or the backend's sandbox configuration
will revert to the default remote-host settings. Reload the sandbox image after
changing its Dockerfile or entrypoint files.

Stop the local stack with both files. Do not add `--volumes` unless you intend to
delete its databases, sandbox images, certificates, and published API volumes.
Existing containers on the main daemon are not automatically migrated to this daemon.
