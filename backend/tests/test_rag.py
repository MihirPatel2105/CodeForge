"""Retrieval over the curated example library.

The on/off flag is what makes the with-RAG vs without-RAG delta measurable, so it is
tested as carefully as the retrieval itself: a flag that silently leaks context would
invalidate the headline metric.
"""

import pytest

from app.rag import SNIPPETS, context_for, retrieve
from app.rag.retriever import render_snippets


def test_library_is_the_documented_size():
    """CLAUDE.md §3 specifies a curated library of 15-20 snippets, not a knowledge base."""
    assert 15 <= len(SNIPPETS) <= 20


def test_snippet_ids_are_unique():
    assert len({s.id for s in SNIPPETS}) == len(SNIPPETS)


def test_every_snippet_is_valid_python():
    """A snippet that does not compile would teach the Coder to write broken code."""
    import ast

    for snippet in SNIPPETS:
        try:
            ast.parse(snippet.code)
        except SyntaxError as exc:  # pragma: no cover - fails loudly if it happens
            pytest.fail(f"{snippet.id} is not valid Python: {exc}")


def test_no_snippet_imports_motor():
    """motor is not installed in the sandbox, so a snippet importing it would teach the
    Coder to write code that cannot run.

    Mentioning motor in a comment is fine and in fact desirable — one snippet exists
    specifically to warn against it — so this checks import statements, not prose.
    """
    for snippet in SNIPPETS:
        for line in snippet.code.splitlines():
            stripped = line.strip()
            assert not stripped.startswith(("import motor", "from motor")), snippet.id


# --------------------------------------------------------------------------- #
# Retrieval
# --------------------------------------------------------------------------- #


@pytest.mark.parametrize(
    ("query", "expected"),
    [
        ("delete an item and return 204 with no body", "crud_delete_204"),
        ("initialise beanie and connect to mongodb on startup", "lifespan_startup"),
        ("write the pytest suite for these endpoints", "tests_are_synchronous"),
    ],
)
def test_relevant_snippet_is_retrieved(query, expected):
    assert expected in {s.id for s in retrieve(query, top_k=3)}


def test_retrieval_respects_top_k():
    assert len(retrieve("create a document", top_k=2)) == 2


def test_empty_query_retrieves_nothing():
    assert retrieve("   ") == []


# --------------------------------------------------------------------------- #
# The flag — this is what the RAG-delta metric depends on
# --------------------------------------------------------------------------- #


def test_disabled_returns_no_context():
    """If this ever leaks context, the RAG-off arm of the experiment is contaminated and
    the headline delta is meaningless."""
    assert context_for("delete an item", enabled=False) == ""


def test_enabled_returns_context():
    context = context_for("delete an item and return 204", enabled=True)
    assert context
    assert "```python" in context


def test_rendering_nothing_is_empty():
    assert render_snippets([]) == ""
