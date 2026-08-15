"""ChromaDB index over the curated example library.

Retrieval is deliberately narrow (CLAUDE.md §3): 18 hand-written snippets, not a general
knowledge base. The Coder gets 3-5 of them as reference patterns.

Everything here is behind a flag. `rag_enabled` is per-run so the with/without
success-rate delta — the project's headline reportable metric — can actually be measured
rather than asserted.
"""

from functools import lru_cache

from app.rag.library import SNIPPETS, Snippet

COLLECTION_NAME = "codeforge_examples"
DEFAULT_TOP_K = 4


class RetrievalUnavailableError(RuntimeError):
    """The index could not be built or queried.

    Never fatal: a run without retrieval is a valid run, and is in fact exactly what the
    RAG-off arm of the experiment does.
    """


@lru_cache(maxsize=1)
def _collection():
    """Build the in-memory index once per process.

    In-memory rather than persisted: 18 short snippets index in well under a second, and
    a persisted store would need invalidating whenever the library changes — a stale
    index that silently serves old patterns is worse than rebuilding.
    """
    try:
        import chromadb
    except ImportError as exc:  # pragma: no cover - dependency is declared
        raise RetrievalUnavailableError("chromadb is not installed") from exc

    client = chromadb.EphemeralClient()
    collection = client.get_or_create_collection(name=COLLECTION_NAME)

    collection.add(
        ids=[s.id for s in SNIPPETS],
        # Indexed on `about`, not on the code: the Coder's query is a description of what
        # it is building, which matches an intent phrase far better than source text.
        documents=[f"{s.title}. {s.about}" for s in SNIPPETS],
        metadatas=[{"title": s.title} for s in SNIPPETS],
    )
    return collection


def retrieve(query: str, *, top_k: int = DEFAULT_TOP_K) -> list[Snippet]:
    """Return the snippets most relevant to `query`, best first."""
    if not query.strip():
        return []

    try:
        result = _collection().query(query_texts=[query], n_results=min(top_k, len(SNIPPETS)))
    except RetrievalUnavailableError:
        raise
    except Exception as exc:  # noqa: BLE001 - any backend failure degrades to no RAG
        raise RetrievalUnavailableError(str(exc)) from exc

    ids = (result.get("ids") or [[]])[0]
    by_id = {s.id: s for s in SNIPPETS}
    return [by_id[i] for i in ids if i in by_id]


def render_snippets(snippets: list[Snippet]) -> str:
    """Format snippets for injection into a prompt."""
    if not snippets:
        return ""
    blocks = [f"### {s.title}\n```python\n{s.code.strip()}\n```" for s in snippets]
    return (
        "Reference patterns from a curated library. Follow these conventions; they are "
        "known to work in this runtime.\n\n" + "\n\n".join(blocks)
    )


def context_for(query: str, *, enabled: bool, top_k: int = DEFAULT_TOP_K) -> str:
    """The Coder's entry point: retrieved context, or an empty string.

    Returns empty rather than raising when retrieval is off or broken, so a RAG failure
    degrades the run instead of ending it.
    """
    if not enabled:
        return ""
    try:
        return render_snippets(retrieve(query, top_k=top_k))
    except RetrievalUnavailableError:
        return ""


def warm_index() -> int:
    """Build the index eagerly and report its size. Called at startup so the first run
    does not pay for it."""
    return _collection().count()
