"""Reject reuse of containers created before the sandbox security policy."""

from typing import Any


def is_hardened(container: Any) -> bool:
    host = container.attrs.get("HostConfig", {})
    return (
        host.get("NetworkMode") == "none"
        and host.get("ReadonlyRootfs") is True
        and "ALL" in (host.get("CapDrop") or [])
        and "no-new-privileges:true" in (host.get("SecurityOpt") or [])
        and container.attrs.get("Config", {}).get("User") == "mongodb"
    )
