"""Graph assembly.

Linear for now — `pm → architect → coder → reviewer → tester → finalise`. The
conditional review ↔ test cycle is Phase 6; the nodes and state it needs already exist,
so adding it is an edge change rather than a rewrite.

Approval interrupts are wired here too: `interrupt_before` pauses the graph after PM and
after Architect, and the API resumes it with the stored thread id (FR-28, FR-29).
"""

from functools import lru_cache

from langgraph.checkpoint.mongodb import MongoDBSaver
from langgraph.checkpoint.serde.jsonplus import JsonPlusSerializer
from langgraph.graph import END, START, StateGraph
from pymongo import MongoClient

from app.config import settings
from app.graph.nodes import (
    architect_node,
    coder_node,
    finalise_node,
    pm_node,
    reviewer_node,
    tester_node,
)
from app.graph.state import RunState

CHECKPOINT_DB = "codeforge_checkpoints"


def build_graph() -> StateGraph:
    graph = StateGraph(RunState)

    graph.add_node("pm", pm_node)
    graph.add_node("architect", architect_node)
    graph.add_node("coder", coder_node)
    graph.add_node("reviewer", reviewer_node)
    graph.add_node("tester", tester_node)
    graph.add_node("finalise", finalise_node)

    graph.add_edge(START, "pm")
    graph.add_edge("pm", "architect")
    graph.add_edge("architect", "coder")
    graph.add_edge("coder", "reviewer")
    graph.add_edge("reviewer", "tester")
    graph.add_edge("tester", "finalise")
    graph.add_edge("finalise", END)

    return graph


@lru_cache(maxsize=1)
def _checkpointer() -> MongoDBSaver:
    # MongoDBSaver takes a *sync* client even though its async methods are what the graph
    # calls; it is cached so every run shares one connection pool.
    #
    # The serializer must be told which modules it may deserialise. Our agent schemas and
    # state models go into every checkpoint, and LangGraph warns that unregistered types
    # "will be blocked in a future version" — which would make every existing checkpoint
    # unreadable after an upgrade, silently killing resumability.
    return MongoDBSaver(
        MongoClient(settings.mongo_uri),
        db_name=CHECKPOINT_DB,
        serde=JsonPlusSerializer(allowed_msgpack_modules=_checkpointed_types()),
    )


def _checkpointed_types() -> list[type]:
    """Every model that can appear in RunState, collected from the modules themselves.

    Enumerated rather than listed by hand: a model added to `schemas.agents` and forgotten
    here would only fail when a real run tried to resume.
    """
    import inspect

    from pydantic import BaseModel

    import app.schemas.agents as agents_module
    import app.schemas.sandbox as sandbox_module
    from app.graph.state import ApprovalRecord, LoopRecord, RunError, RunMetrics

    collected: list[type] = [ApprovalRecord, LoopRecord, RunError, RunMetrics]
    for module in (agents_module, sandbox_module):
        for _, obj in inspect.getmembers(module, inspect.isclass):
            if issubclass(obj, BaseModel) and obj.__module__ == module.__name__:
                collected.append(obj)
    return collected


def compile_graph(*, with_approvals: bool = True):
    """Compile the graph with the checkpointer attached.

    `with_approvals=False` is for the evaluation harness, which runs unattended and would
    otherwise stall forever at the first interrupt (docs/ACCEPTANCE.md §3).
    """
    interrupts = ["architect", "coder"] if with_approvals else []
    return build_graph().compile(
        checkpointer=_checkpointer(),
        interrupt_before=interrupts,
    )


def thread_config(thread_id: str) -> dict:
    return {"configurable": {"thread_id": thread_id}}
