"""Execute generated code inside an isolated container.

The only module that touches Docker. Agents pass a file tree in and get a
`SandboxResult` back; they never see a container (CLAUDE.md §4).

Safety rules, all non-negotiable (NFR-2, NFR-8):
  * `network_mode="none"` — always, no exception. Generated code is untrusted.
  * Memory and CPU are capped, so a runaway app cannot take the host down.
  * A hard timeout kills the container; an infinite loop must not hang a run.
  * The container is force-removed in `finally`, on every path including timeout and
    exception. A leaked container survives the demo machine's patience.
"""

import asyncio
import tarfile
import tempfile
import time
from io import BytesIO
from pathlib import Path

from app.schemas.agents import GeneratedFile
from app.schemas.sandbox import SandboxRequest, SandboxResult

SANDBOX_IMAGE = "codeforge-sandbox:latest"

MEM_LIMIT = "512m"
NANO_CPUS = 1_000_000_000  # 1.0 CPU
PIDS_LIMIT = 256  # a fork bomb should hit this, not the host


class SandboxUnavailableError(RuntimeError):
    """Docker itself is missing or unreachable — infrastructure, not a run failure.

    docs/ACCEPTANCE.md §3 excludes these from the metrics: they measure the host, not
    CodeForge.
    """


def _tar_bytes(files: list[GeneratedFile]) -> bytes:
    """Pack the file tree for `put_archive`.

    Copying in beats a bind mount: no host path is exposed to the container at all, and
    it works identically when the backend is itself containerised.
    """
    buffer = BytesIO()
    with tarfile.open(fileobj=buffer, mode="w") as archive:
        for generated in files:
            # Flatten any directory component: the generated app is a flat tree, and a
            # path like "../../etc/passwd" must not escape /app.
            name = Path(generated.path).name
            data = generated.content.encode()
            info = tarfile.TarInfo(name=name)
            info.size = len(data)
            info.mode = 0o644
            archive.addfile(info, BytesIO(data))
    return buffer.getvalue()


def _run_blocking(request: SandboxRequest) -> SandboxResult:
    """Synchronous Docker work, run in a worker thread by `run_in_sandbox`."""
    try:
        import docker
        from docker.errors import DockerException
    except ImportError as exc:  # pragma: no cover - dependency is declared
        raise SandboxUnavailableError("docker SDK is not installed") from exc

    try:
        client = docker.from_env()
        client.ping()
    except DockerException as exc:
        raise SandboxUnavailableError(f"Docker is not reachable: {exc}") from exc

    started = time.monotonic()
    container = None

    try:
        container = client.containers.create(
            SANDBOX_IMAGE,
            network_mode="none",  # never relax this
            mem_limit=MEM_LIMIT,
            nano_cpus=NANO_CPUS,
            pids_limit=PIDS_LIMIT,
            working_dir="/app",
            detach=True,
        )
        container.put_archive("/app", _tar_bytes(request.files))
        container.start()

        timed_out = False
        try:
            status = container.wait(timeout=request.timeout_s)
            exit_code = int(status.get("StatusCode", 1))
        except Exception:
            # Covers the SDK's read timeout: the suite is still running past its budget.
            timed_out = True
            exit_code = 124  # conventional timeout status
            try:
                container.kill()
            except Exception:
                pass

        stdout = container.logs(stdout=True, stderr=False).decode(errors="replace")
        stderr = container.logs(stdout=False, stderr=True).decode(errors="replace")

        return SandboxResult(
            exit_code=exit_code,
            stdout=stdout,
            stderr=stderr,
            pytest_report=None,  # parsed by the caller from stdout
            timed_out=timed_out,
            duration_ms=int((time.monotonic() - started) * 1000),
        )

    finally:
        if container is not None:
            try:
                container.remove(force=True)
            except Exception:
                # Never let cleanup mask the real result; a leak here is logged by the
                # caller's own checks rather than raised.
                pass


async def run_in_sandbox(request: SandboxRequest) -> SandboxResult:
    """Run a file tree and return what happened.

    The Docker SDK is synchronous, so it goes to a worker thread — blocking the event
    loop for the length of a test suite would stall every other request (CLAUDE.md §6).
    """
    return await asyncio.to_thread(_run_blocking, request)


def write_tree_to(directory: Path, files: list[GeneratedFile]) -> None:
    """Materialise a file tree on disk. Used for artifacts and debugging, not execution."""
    directory.mkdir(parents=True, exist_ok=True)
    for generated in files:
        (directory / Path(generated.path).name).write_text(generated.content)


def temp_tree(files: list[GeneratedFile]) -> tempfile.TemporaryDirectory:
    """A self-deleting directory containing the tree."""
    handle = tempfile.TemporaryDirectory(prefix="codeforge-run-")
    write_tree_to(Path(handle.name), files)
    return handle
