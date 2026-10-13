"""Read local OpenAPI parameter definitions without fetching external references."""

from typing import Any

from app.schemas.api import PreviewParameter


def _resolve(value: Any, document: dict[str, Any], depth: int = 0) -> dict[str, Any]:
    if not isinstance(value, dict) or depth > 6:
        return {}
    ref = value.get("$ref")
    if ref is None:
        return {
            key: _resolve(item, document, depth + 1)
            if isinstance(item, dict)
            else [_resolve(v, document, depth + 1) if isinstance(v, dict) else v for v in item]
            if isinstance(item, list)
            else item
            for key, item in value.items()
        }
    if not isinstance(ref, str) or not ref.startswith("#/components/"):
        return {}
    target: Any = document
    for part in ref[2:].split("/"):
        target = (
            target.get(part.replace("~1", "/").replace("~0", "~"))
            if isinstance(target, dict)
            else None
        )
    return _resolve(target, document, depth + 1)


def operation_parameters(
    document: dict[str, Any], routes: dict[str, Any], operation: dict[str, Any]
) -> list[PreviewParameter]:
    merged: dict[tuple[str, str], PreviewParameter] = {}
    for source in (routes, operation):
        parameters = source.get("parameters")
        if not isinstance(parameters, list):
            continue
        for raw in parameters:
            parameter = _resolve(raw, document)
            name, location = parameter.get("name"), parameter.get("in")
            if not isinstance(name, str) or not name or location not in ("path", "query"):
                continue
            merged[name, location] = PreviewParameter(
                name=name,
                location=location,
                required=location == "path" or parameter.get("required") is True,
                description=parameter.get("description")
                if isinstance(parameter.get("description"), str)
                else "",
                schema=parameter.get("schema") if isinstance(parameter.get("schema"), dict) else {},
            )
    return list(merged.values())
