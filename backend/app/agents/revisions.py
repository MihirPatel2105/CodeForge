"""User-directed revisions, kept separate from autonomous repair-loop feedback."""

import json


def revision_guidance(state: dict, phase: str) -> str:
    parts = []
    context = state.get("revision_context") or {}
    if context:
        parts.append(
            "Revise this existing CRUD API. Preserve its behavior except for the requested change."
            "\nPrevious requirements: "
            + json.dumps(context.get("requirements"))
            + "\nRequested change: "
            + context["change_request"]
        )
    for revision in state.get("checkpoint_revisions") or []:
        if revision["phase"] == phase:
            parts.append("Requested checkpoint change: " + revision["note"])
    return "\n\n".join(parts)
