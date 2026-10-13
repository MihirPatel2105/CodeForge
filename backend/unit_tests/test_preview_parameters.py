from app.core.preview_parameters import operation_parameters


def test_inheritance_override_and_local_references():
    document = {
        "components": {
            "parameters": {
                "Limit": {
                    "name": "limit",
                    "in": "query",
                    "schema": {"type": "integer", "default": 20},
                },
                "Cycle": {"$ref": "#/components/parameters/Cycle"},
            }
        }
    }
    routes = {
        "parameters": [
            {"$ref": "#/components/parameters/Limit"},
            {"name": "id", "in": "path", "schema": {"type": "string"}},
        ]
    }
    operation = {
        "parameters": [
            {
                "name": "limit",
                "in": "query",
                "required": True,
                "schema": {"type": "integer", "maximum": 50},
            },
            {"$ref": "#/components/parameters/Cycle"},
            {"$ref": "https://example.com/parameter.json"},
            {"name": "authorization", "in": "header", "schema": {"type": "string"}},
        ]
    }
    result = operation_parameters(document, routes, operation)
    assert [(p.name, p.location, p.required) for p in result] == [
        ("limit", "query", True),
        ("id", "path", True),
    ]
    assert result[0].schema_ == {"type": "integer", "maximum": 50}


def test_schema_reference_and_false_default_are_preserved():
    document = {"components": {"schemas": {"Flag": {"type": "boolean", "default": False}}}}
    result = operation_parameters(
        document,
        {},
        {
            "parameters": [
                {
                    "name": "active",
                    "in": "query",
                    "description": "Only active records",
                    "schema": {"$ref": "#/components/schemas/Flag"},
                },
            ]
        },
    )
    assert result[0].model_dump(by_alias=True)["schema"] == {"type": "boolean", "default": False}
    assert result[0].description == "Only active records"


def test_missing_or_malformed_parameters_are_ignored():
    assert (
        operation_parameters(
            {}, {"parameters": None}, {"parameters": [None, {}, {"name": 42, "in": "query"}]}
        )
        == []
    )
