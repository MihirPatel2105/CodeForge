"""Conservative OpenAPI comparisons: accept old inputs, preserve output guarantees."""

import json
import math
from typing import Any

from app.schemas.api import CompatibilityChange, CompatibilityReport

METHODS = {"get", "post", "put", "patch", "delete", "head", "options", "trace"}
ANNOTATIONS = {"title", "description", "default", "example", "examples", "deprecated", "$schema"}
LOWER_BOUNDS = {"minimum", "minLength", "minItems"}
UPPER_BOUNDS = {"maximum", "maxLength", "maxItems"}
SCHEMA_KEYS = (
    ANNOTATIONS
    | LOWER_BOUNDS
    | UPPER_BOUNDS
    | {
        "$ref",
        "type",
        "nullable",
        "properties",
        "required",
        "items",
        "enum",
        "anyOf",
    }
)


class IncompleteContract(ValueError):
    pass


def _mapping(value: Any) -> dict:
    if not isinstance(value, dict):
        raise IncompleteContract
    return value


def _resolve(value: Any, doc: dict, depth: int = 0) -> dict:
    value = _mapping(value)
    if depth > 16:
        raise IncompleteContract
    ref = value.get("$ref")
    if ref is None:
        return value
    if not isinstance(ref, str) or not ref.startswith("#/"):
        raise IncompleteContract
    target: Any = doc
    for key in ref[2:].split("/"):
        target = _mapping(target).get(key.replace("~1", "/").replace("~0", "~"))
    if set(value) - {"$ref"} - ANNOTATIONS:
        # Reference siblings need an intersection, not a weakening dictionary merge.
        raise IncompleteContract
    return _resolve(target, doc, depth + 1)


def _schema(value: Any, doc: dict, depth: int = 0) -> dict:
    if depth > 16:
        raise IncompleteContract
    schema = dict(_resolve(value, doc))
    if set(schema) - SCHEMA_KEYS:
        raise IncompleteContract
    variants = schema.pop("anyOf", None)
    if variants is not None:
        if not isinstance(variants, list) or not 2 <= len(variants) <= 8:
            raise IncompleteContract
        resolved = [_resolve(item, doc) for item in variants]
        others = [item for item in resolved if item != {"type": "null"}]
        if set(schema) - ANNOTATIONS:
            raise IncompleteContract
        if len(resolved) == 2 and len(others) == 1:
            schema = _schema(others[0], doc, depth + 1)
            schema["nullable"] = True
        elif all(
            not set(item) - ANNOTATIONS - {"type"}
            and item.get("type") in {"string", "integer", "number", "boolean", "null"}
            for item in resolved
        ):
            # FastAPI's standard validation errors use string/integer location
            # items. A plain scalar union is exactly a set of accepted types.
            schema = {"type": sorted({item["type"] for item in resolved})}
        else:
            raise IncompleteContract
    if "type" not in schema and "properties" in schema:
        schema["type"] = "object"
    if "required" in schema and (
        not isinstance(schema["required"], list)
        or not all(isinstance(item, str) for item in schema["required"])
        or not set(schema["required"]) <= _mapping(schema.get("properties", {})).keys()
    ):
        raise IncompleteContract
    if "enum" in schema and (not isinstance(schema["enum"], list) or not schema["enum"]):
        raise IncompleteContract
    if "nullable" in schema and not isinstance(schema["nullable"], bool):
        raise IncompleteContract
    for key in LOWER_BOUNDS | UPPER_BOUNDS:
        if key in schema and (
            isinstance(schema[key], bool)
            or not isinstance(schema[key], (int, float))
            or not math.isfinite(schema[key])
            or key not in {"minimum", "maximum"}
            and (not isinstance(schema[key], int) or schema[key] < 0)
        ):
            raise IncompleteContract
    return schema


def _types(schema: dict) -> set[str]:
    kind = schema.get("type")
    kinds = {kind} if isinstance(kind, str) else set(kind) if isinstance(kind, list) else set()
    if not kinds or not kinds <= {
        "string",
        "integer",
        "number",
        "object",
        "array",
        "boolean",
        "null",
    }:
        raise IncompleteContract
    if "number" in kinds:
        kinds.add("integer")
    if schema.get("nullable") is True:
        kinds.add("null")
    return kinds


class _Comparison:
    def __init__(self, before: dict, after: dict) -> None:
        self.before, self.after = before, after
        self.changes: list[CompatibilityChange] = []
        self.checked = 0

    def add(self, severity: str, code: str, op: str, loc: str, message: str) -> None:
        if len(self.changes) >= 200:
            raise IncompleteContract
        self.changes.append(
            CompatibilityChange(
                severity=severity, code=code, operation=op, location=loc, message=message
            )
        )

    def review(self, op: str, loc: str) -> None:
        self.add(
            "needs_review",
            "unsupported_contract",
            op,
            loc,
            "This part of the API contract needs manual review.",
        )

    def schema(self, old: Any, new: Any, op: str, loc: str, response: bool, depth: int = 0) -> None:
        try:
            if depth > 16:
                raise IncompleteContract
            old, new = _schema(old, self.before), _schema(new, self.after)
            old_types, new_types = _types(old), _types(new)
        except (IncompleteContract, TypeError):
            self.review(op, loc)
            return
        if old_types != new_types:
            safe = new_types <= old_types if response else old_types <= new_types
            self.add(
                "compatible" if safe else "breaking",
                "type_changed",
                op,
                loc,
                "Allowed value types changed. "
                + (
                    "Existing callers can keep their current types."
                    if safe
                    else "Update callers to use the new value types."
                ),
            )
        old_enum, new_enum = old.get("enum"), new.get("enum")
        if old_enum != new_enum:
            old_values = {json.dumps(v, sort_keys=True) for v in old_enum} if old_enum else None
            new_values = {json.dumps(v, sort_keys=True) for v in new_enum} if new_enum else None
            source, target = (new_values, old_values) if response else (old_values, new_values)
            safe = target is None or source is not None and source <= target
            self.add(
                "compatible" if safe else "breaking",
                "enum_changed",
                op,
                loc,
                "Allowed choices changed. "
                + (
                    "Existing callers can keep their current choices."
                    if safe
                    else "Update callers to handle the new allowed choices."
                ),
            )
        for key in sorted(LOWER_BOUNDS | UPPER_BOUNDS):
            a, b = old.get(key), new.get(key)
            if a == b:
                continue
            fallback = float("-inf") if key in LOWER_BOUNDS else float("inf")
            a, b = fallback if a is None else a, fallback if b is None else b
            tighter = b >= a if key in LOWER_BOUNDS else b <= a
            safe = tighter if response else not tighter
            self.add(
                "compatible" if safe else "breaking",
                "constraint_changed",
                op,
                loc,
                f"The {key} constraint changed. Check callers against the new limits.",
            )
        if "object" in old_types and "object" in new_types:
            try:
                old_props, new_props = (
                    _mapping(old.get("properties", {})),
                    _mapping(new.get("properties", {})),
                )
            except IncompleteContract:
                self.review(op, loc)
                return
            old_req, new_req = set(old.get("required", [])), set(new.get("required", []))
            for name in sorted(new_req - old_req):
                self.add(
                    "compatible" if response else "breaking",
                    "required_added",
                    op,
                    f"{loc}.{name}",
                    "This field is now guaranteed in responses."
                    if response
                    else "Send this field in existing requests; it is now required.",
                )
            for name in sorted(old_req - new_req):
                self.add(
                    "breaking" if response else "compatible",
                    "required_removed",
                    op,
                    f"{loc}.{name}",
                    "Handle responses that omit this previously required field."
                    if response
                    else "Requests may now omit this field.",
                )
            for name in sorted(old_props.keys() - new_props.keys()):
                self.add(
                    "breaking" if response else "needs_review",
                    "field_removed",
                    op,
                    f"{loc}.{name}",
                    "Update callers that read this removed response field."
                    if response
                    else "This input field was removed. Check whether callers rely on it.",
                )
            for name in sorted(new_props.keys() - old_props.keys()):
                self.add("compatible", "field_added", op, f"{loc}.{name}", "A field was added.")
            for name in sorted(old_props.keys() | new_props.keys()):
                a, b = old_props.get(name), new_props.get(name)
                # Check added/removed fields too: unsupported nested schemas need review.
                self.schema(
                    b if a is None else a,
                    a if b is None else b,
                    op,
                    f"{loc}.{name}",
                    response,
                    depth + 1,
                )
        if "array" in old_types and "array" in new_types:
            self.schema(old.get("items"), new.get("items"), op, f"{loc}[]", response, depth + 1)

    def content(self, old: dict, new: dict, op: str, loc: str, response: bool) -> None:
        supported = (
            {"content", "description"} if response else {"content", "description", "required"}
        )
        if set(old) - supported or set(new) - supported:
            self.review(op, loc)
        if not response and any(
            "required" in body and not isinstance(body["required"], bool) for body in (old, new)
        ):
            self.review(op, loc)
        a, b = _mapping(old.get("content", {})), _mapping(new.get("content", {}))
        for media in sorted(a.keys() | b.keys()):
            if media != "application/json" or media not in a or media not in b:
                self.review(op, f"{loc} ({media})")
            else:
                if set(_mapping(a[media])) - {"schema", "example", "examples"} or set(
                    _mapping(b[media])
                ) - {"schema", "example", "examples"}:
                    self.review(op, f"{loc} ({media})")
                self.schema(
                    _mapping(a[media]).get("schema"),
                    _mapping(b[media]).get("schema"),
                    op,
                    loc,
                    response,
                )

    def parameters(self, item: dict, operation: dict, doc: dict) -> dict:
        result = {}
        for values in (item.get("parameters", []), operation.get("parameters", [])):
            if not isinstance(values, list):
                raise IncompleteContract
            for value in values:
                value = _resolve(value, doc)
                key = (value.get("in"), value.get("name"))
                if key[0] not in {"path", "query", "header", "cookie"} or not isinstance(
                    key[1], str
                ):
                    raise IncompleteContract
                if set(value) - {
                    "name",
                    "in",
                    "required",
                    "schema",
                    "description",
                    "deprecated",
                    "example",
                    "examples",
                }:
                    raise IncompleteContract
                result[key] = value
        return result

    def operation(self, path: str, method: str, old_item: dict, new_item: dict) -> None:
        op = f"{method.upper()} {path}"
        old, new = old_item[method], new_item[method]
        self.checked += 1
        if old.get("security", self.before.get("security", [])) or new.get(
            "security", self.after.get("security", [])
        ):
            self.review(op, "Authentication")
        for key in {"servers", "callbacks"}:
            if key in old or key in new or key in old_item or key in new_item:
                self.review(op, key)
        a, b = (
            self.parameters(old_item, old, self.before),
            self.parameters(new_item, new, self.after),
        )
        for key in sorted(a.keys() | b.keys()):
            loc = f"{key[0]} parameter {key[1]}"
            if key not in a:
                self.add(
                    "breaking" if b[key].get("required") else "compatible",
                    "parameter_added",
                    op,
                    loc,
                    "Send this new required parameter."
                    if b[key].get("required")
                    else "An optional parameter was added.",
                )
                self.schema(b[key].get("schema"), b[key].get("schema"), op, loc, False)
            elif key not in b:
                self.review(op, loc)
            else:
                if a[key].get("required", False) != b[key].get("required", False):
                    self.add(
                        "breaking" if b[key].get("required") else "compatible",
                        "parameter_required",
                        op,
                        loc,
                        "This parameter's required status changed. Update existing requests.",
                    )
                self.schema(a[key].get("schema"), b[key].get("schema"), op, loc, False)
        a_body, b_body = (
            _resolve(old.get("requestBody", {}), self.before),
            _resolve(new.get("requestBody", {}), self.after),
        )
        if not a_body.get("required", False) and b_body.get("required", False):
            self.add(
                "breaking",
                "body_required",
                op,
                "Request body",
                "Send a request body; it is now required.",
            )
        self.content(a_body, b_body, op, "Request body", False)
        a_responses, b_responses = _mapping(old["responses"]), _mapping(new["responses"])
        for status in sorted(a_responses.keys() | b_responses.keys()):
            if status not in b_responses:
                self.add(
                    "breaking",
                    "response_removed",
                    op,
                    f"Response {status}",
                    "This response status was removed. Update callers that expect it.",
                )
            elif status not in a_responses:
                self.review(op, f"Response {status}")
            else:
                self.content(
                    _resolve(a_responses[status], self.before),
                    _resolve(b_responses[status], self.after),
                    op,
                    f"Response {status}",
                    True,
                )


def _operations(doc: Any) -> dict[tuple[str, str], dict]:
    doc = _mapping(doc)
    if not isinstance(doc.get("openapi"), str) or not doc["openapi"].startswith(("3.0.", "3.1.")):
        raise IncompleteContract
    result = {}
    for path, item in _mapping(doc.get("paths")).items():
        if not isinstance(path, str) or not path.startswith("/"):
            raise IncompleteContract
        item = _mapping(item)
        if "$ref" in item or set(item) - METHODS - {
            "parameters",
            "summary",
            "description",
            "servers",
        }:
            raise IncompleteContract
        for method in sorted(METHODS & item.keys()):
            if not _mapping(_mapping(item[method]).get("responses")):
                raise IncompleteContract
            result[path, method] = item
    if not result or len(result) > 100:
        raise IncompleteContract
    return result


def compare_openapi(before: Any, after: Any) -> CompatibilityReport:
    comparison = _Comparison(before, after)
    try:
        old, new = _operations(before), _operations(after)
        if before.get("servers", []) != after.get("servers", []):
            comparison.review("API", "Server addresses")
        for path, method in sorted(old.keys() | new.keys()):
            op = f"{method.upper()} {path}"
            if (path, method) not in new:
                comparison.add(
                    "breaking",
                    "operation_removed",
                    op,
                    "Endpoint",
                    "This endpoint was removed. Update callers that use it.",
                )
            elif (path, method) not in old:
                comparison.add(
                    "compatible", "operation_added", op, "Endpoint", "A new endpoint was added."
                )
            else:
                try:
                    comparison.operation(path, method, old[path, method], new[path, method])
                except (IncompleteContract, TypeError, KeyError):
                    comparison.review(op, "API contract")
    except (IncompleteContract, TypeError, KeyError):
        comparison.changes.append(
            CompatibilityChange(
                severity="needs_review",
                code="incomplete_contract",
                operation="API",
                location="API contract",
                message=(
                    "A complete supported contract could not be compared. "
                    "Review both versions manually."
                ),
            )
        )
    status = (
        "breaking"
        if any(c.severity == "breaking" for c in comparison.changes)
        else (
            "needs_review"
            if any(c.severity == "needs_review" for c in comparison.changes)
            else "compatible"
        )
    )
    return CompatibilityReport(
        status=status, checked_operations=comparison.checked, changes=comparison.changes
    )
