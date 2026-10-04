"""Contract compatibility must respect the direction of requests and responses."""

from copy import deepcopy

import pytest

from app.core import api_compatibility


@pytest.fixture(autouse=True)
def clean_database():
    # These pure comparisons do not open Mongo or create platform records.
    yield


def document(schema=None, *, response=False):
    schema = schema or {"type": "object", "properties": {"title": {"type": "string"}}}
    operation = {"responses": {"200": {"description": "OK"}}}
    target = operation["responses"]["200"] if response else operation.setdefault("requestBody", {})
    target["content"] = {"application/json": {"schema": schema}}
    return {
        "openapi": "3.1.0",
        "info": {"title": "Books", "version": "1"},
        "paths": {"/books": {"post": operation}},
    }


def compare(before, after):
    assert hasattr(api_compatibility, "compare_openapi"), (
        "OpenAPI compatibility comparator is missing"
    )
    return api_compatibility.compare_openapi(before, after)


def test_removed_route_is_breaking_and_new_route_is_compatible():
    before = document()
    after = deepcopy(before)
    after["paths"] = {"/tasks": after["paths"].pop("/books")}
    report = compare(before, after)
    assert report.status == "breaking"
    assert {(c.code, c.operation, c.severity) for c in report.changes} == {
        ("operation_removed", "POST /books", "breaking"),
        ("operation_added", "POST /tasks", "compatible"),
    }


def test_new_required_request_field_breaks_existing_create_calls():
    before = document()
    after = deepcopy(before)
    schema = after["paths"]["/books"]["post"]["requestBody"]["content"]["application/json"][
        "schema"
    ]
    schema["properties"]["due_date"] = {"type": "string"}
    schema["required"] = ["due_date"]
    report = compare(before, after)
    assert report.status == "breaking"
    assert any(
        c.code == "required_added" and c.location.endswith("due_date") for c in report.changes
    )


def test_optional_request_field_is_compatible():
    before = document()
    after = deepcopy(before)
    after["paths"]["/books"]["post"]["requestBody"]["content"]["application/json"]["schema"][
        "properties"
    ]["due_date"] = {"type": "string"}
    report = compare(before, after)
    assert report.status == "compatible"
    assert any(c.code == "field_added" for c in report.changes)


def test_removed_response_field_and_weakened_guarantee_are_breaking():
    before = document(
        {
            "type": "object",
            "properties": {"id": {"type": "string"}, "title": {"type": "string"}},
            "required": ["id", "title"],
        },
        response=True,
    )
    after = document({"type": "object", "properties": {"id": {"type": "string"}}}, response=True)
    report = compare(before, after)
    assert report.status == "breaking"
    assert {c.code for c in report.changes} >= {"field_removed", "required_removed"}


@pytest.mark.parametrize(
    "response,old,new,status",
    [
        (False, "integer", "number", "compatible"),
        (False, "number", "integer", "breaking"),
        (True, "integer", "number", "breaking"),
        (True, "number", "integer", "compatible"),
        (True, "string", "integer", "breaking"),
    ],
)
def test_type_changes_are_directional(response, old, new, status):
    report = compare(
        document({"type": old}, response=response), document({"type": new}, response=response)
    )
    assert report.status == status
    assert report.changes[0].code == "type_changed"


@pytest.mark.parametrize("response,status", [(False, "compatible"), (True, "breaking")])
def test_enum_expansion_is_directional(response, status):
    report = compare(
        document({"type": "string", "enum": ["open"]}, response=response),
        document({"type": "string", "enum": ["open", "closed"]}, response=response),
    )
    assert report.status == status


@pytest.mark.parametrize("response,status", [(False, "compatible"), (True, "breaking")])
def test_nullable_anyof_is_directional(response, status):
    report = compare(
        document({"type": "string"}, response=response),
        document({"anyOf": [{"type": "string"}, {"type": "null"}]}, response=response),
    )
    assert report.status == status


def test_references_and_nested_array_fields_are_compared_without_mutation():
    before = document(
        {"type": "array", "items": {"$ref": "#/components/schemas/Book"}}, response=True
    )
    before["components"] = {
        "schemas": {"Book": {"type": "object", "properties": {"id": {"type": "string"}}}}
    }
    after = deepcopy(before)
    after["components"]["schemas"]["Book"]["properties"]["id"] = {"type": "integer"}
    original = deepcopy(before)
    report = compare(before, after)
    assert report.status == "breaking"
    assert any(c.location.endswith("[].id") for c in report.changes)
    assert before == original


@pytest.mark.parametrize(
    "schema",
    [
        {"$ref": "#/components/schemas/Missing"},
        {"oneOf": [{"type": "string"}, {"type": "integer"}]},
        {"type": "string", "pattern": "[a-z]+"},
        {"type": "object", "additionalProperties": {"type": "string"}},
    ],
)
def test_unsupported_shapes_never_claim_compatibility_even_when_unchanged(schema):
    report = compare(document(schema), document(schema))
    assert report.status == "needs_review"
    assert any(c.severity == "needs_review" for c in report.changes)


@pytest.mark.parametrize(
    "invalid",
    [
        None,
        [],
        {},
        {"openapi": "2.0", "paths": {}},
        {"openapi": "3.1.0", "paths": []},
        {"openapi": "3.1.0", "paths": {"/books": {"post": {}}}},
    ],
)
def test_invalid_or_empty_documents_require_review(invalid):
    assert compare(document(), invalid).status == "needs_review"


def test_required_query_parameter_is_breaking_and_path_level_parameters_are_inherited():
    before = document()
    before["paths"]["/books"]["parameters"] = [
        {"in": "query", "name": "limit", "schema": {"type": "integer"}}
    ]
    after = deepcopy(before)
    after["paths"]["/books"]["parameters"][0]["required"] = True
    assert compare(before, after).status == "breaking"


def test_removed_success_status_is_breaking():
    before = document(response=True)
    after = deepcopy(before)
    after["paths"]["/books"]["post"]["responses"]["201"] = after["paths"]["/books"]["post"][
        "responses"
    ].pop("200")
    assert compare(before, after).status == "breaking"


def test_changed_security_requires_review():
    before = document()
    after = deepcopy(before)
    after["security"] = [{"key": []}]
    assert compare(before, after).status == "needs_review"


def test_identical_supported_contract_has_no_findings():
    report = compare(document(), document())
    assert report.status == "compatible"
    assert report.checked_operations == 1
    assert report.changes == []


def test_recursive_schema_requires_review_instead_of_recursing_forever():
    before = document({"$ref": "#/components/schemas/Node"})
    before["components"] = {
        "schemas": {
            "Node": {
                "type": "object",
                "properties": {"next": {"$ref": "#/components/schemas/Node"}},
            }
        }
    }
    assert compare(before, deepcopy(before)).status == "needs_review"


@pytest.mark.parametrize("response,status", [(False, "breaking"), (True, "compatible")])
def test_tightened_numeric_bounds_are_directional(response, status):
    assert (
        compare(
            document({"type": "integer", "minimum": 0}, response=response),
            document({"type": "integer", "minimum": 1}, response=response),
        ).status
        == status
    )


def test_recursive_nullable_reference_requires_review():
    before = document({"$ref": "#/components/schemas/Node"})
    before["components"] = {
        "schemas": {"Node": {"anyOf": [{"$ref": "#/components/schemas/Node"}, {"type": "null"}]}}
    }
    assert compare(before, deepcopy(before)).status == "needs_review"


def test_response_headers_require_review():
    before = document(response=True)
    after = deepcopy(before)
    after["paths"]["/books"]["post"]["responses"]["200"]["headers"] = {
        "X-Count": {"schema": {"type": "integer"}}
    }
    assert compare(before, after).status == "needs_review"


def test_changed_servers_require_review():
    before = document()
    after = deepcopy(before)
    after["servers"] = [{"url": "/v2"}]
    assert compare(before, after).status == "needs_review"


@pytest.mark.parametrize(
    "schema",
    [
        {"type": "string", "nullable": "yes"},
        {"type": "integer", "minimum": float("nan")},
        {"type": "string", "minLength": -1},
    ],
)
def test_invalid_schema_constraints_require_review(schema):
    assert compare(document(schema), document(schema)).status == "needs_review"


@pytest.mark.parametrize("response,status", [(False, "compatible"), (True, "breaking")])
def test_simple_scalar_anyof_expansion_is_directional(response, status):
    before = document({"type": "string"}, response=response)
    after = document({"anyOf": [{"type": "string"}, {"type": "integer"}]}, response=response)
    assert compare(before, after).status == status


def test_fastapi_validation_error_scalar_union_does_not_force_manual_review():
    doc = document(
        {"type": "array", "items": {"anyOf": [{"type": "string"}, {"type": "integer"}]}},
        response=True,
    )
    assert compare(doc, deepcopy(doc)).status == "compatible"
