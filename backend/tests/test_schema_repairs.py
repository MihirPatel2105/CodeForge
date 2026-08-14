"""Leniency rules on agent schemas.

Every rule here exists because a free-tier model broke a real run in exactly this way.
They are tested so nobody "cleans up" a repair and silently reintroduces the failure.
"""

import pytest
from pydantic import ValidationError

from app.schemas.agents import (
    Collection,
    Design,
    Endpoint,
    FileSpec,
    Finding,
    GeneratedFile,
    Requirements,
    ReviewResult,
    SingleFileOutput,
)

# --------------------------------------------------------------------------- #
# Source wrapped in the content field — 5 of 10 generated trees failed on this
# --------------------------------------------------------------------------- #


def test_filename_banner_is_stripped():
    """`'''database.py` opens a string that is never closed, so the file fails to parse
    at line 1 even though the code below it is fine."""
    out = SingleFileOutput(path="database.py", content="'''database.py\nimport os\n\nX = 1\n")
    assert out.content.startswith("import os")


def test_markdown_fences_are_stripped():
    out = SingleFileOutput(path="main.py", content="```python\nimport os\nY = 2\n```")
    assert out.content.startswith("import os")
    assert "```" not in out.content


def test_valid_source_is_never_touched():
    """A repair is applied only when it turns unparseable source into parseable source,
    so a correct file with a real docstring must survive untouched."""
    source = '"""A real module docstring."""\n\nZ = 3\n'
    assert SingleFileOutput(path="ok.py", content=source).content == source


def test_unparseable_python_is_rejected_at_generation_time():
    """Strict where it can still be fixed: raising makes Instructor re-ask the model with
    the syntax error attached, and failing that the chain drops to a rung with a bigger
    token budget — which is what a truncated file needs."""
    with pytest.raises(ValidationError):
        SingleFileOutput(path="bad.py", content="def f(:\n    pass\n")


def test_stored_broken_files_remain_loadable():
    """Lenient where nothing can be fixed: a tree already in the database must still load,
    or analysis, replay and the files endpoint would all break on historic runs."""
    broken = "def f(:\n    pass\n"
    assert GeneratedFile(path="bad.py", content=broken).content == broken


def test_non_python_files_are_not_parsed():
    """A README or JSON fixture must not be judged as Python."""
    assert SingleFileOutput(path="notes.md", content="# not python {").content.startswith("#")


# --------------------------------------------------------------------------- #
# Shape leniency
# --------------------------------------------------------------------------- #


def test_stringified_json_list_is_decoded():
    review = ReviewResult.model_validate(
        {"findings": '[{"severity":"nit","file":"a.py","issue":"i","fix_hint":"f"}]'}
    )
    assert len(review.findings) == 1


def test_bare_string_becomes_a_single_item_list():
    """Cost a whole generation: a model wrote "notes": "text" instead of ["text"]."""
    out = SingleFileOutput(path="m.py", content="X = 1", notes="just one note")
    assert out.notes == ["just one note"]


def test_name_is_recovered_as_path():
    assert FileSpec.model_validate({"name": "main.py", "purpose": "app"}).path == "main.py"


def test_fix_is_recovered_as_fix_hint():
    finding = Finding.model_validate(
        {"severity": "blocking", "file": "main.py", "issue": "bad", "fix": "use str"}
    )
    assert finding.fix_hint == "use str"


def test_collections_are_flat():
    """Nested collection fields were the most common cause of a rejected Design, because
    providers validate tool arguments server-side before Pydantic ever runs."""
    collection = Collection(name="books", fields=["title", "author"], indexes=["title"])
    assert collection.fields == ["title", "author"]
    assert "EntityField" not in str(Design.model_json_schema()["$defs"].keys())


# --------------------------------------------------------------------------- #
# Rules that must NOT be relaxed
# --------------------------------------------------------------------------- #


def test_204_may_omit_a_response_model():
    assert Endpoint(method="DELETE", path="/books/{id}", status_code=204).response_model is None


def test_200_must_declare_a_response_model():
    with pytest.raises(ValidationError):
        Endpoint(method="GET", path="/books", status_code=200)


def test_three_entities_are_rejected():
    entity = {"name": "Book", "fields": [{"name": "title", "type": "str"}]}
    with pytest.raises(ValidationError):
        Requirements(project_name="x", summary="y", entities=[entity] * 3, operations=["create"])
