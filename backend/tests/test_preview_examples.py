"""Example requests should be useful without editing every field first."""

from app.api.preview import _example


def test_contact_example_uses_valid_readable_values():
    schema = {
        "type": "object",
        "properties": {
            "name": {"type": "string"},
            "phone_number": {"type": "string"},
            "email": {"anyOf": [{"type": "string", "format": "email"}, {"type": "null"}]},
            "is_favorite": {"type": "boolean"},
        },
    }
    assert _example(schema, {}) == {
        "name": "Alex",
        "phone_number": "9876543210",
        "email": "alex@example.com",
        "is_favorite": False,
    }
