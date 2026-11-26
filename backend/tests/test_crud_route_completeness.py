"""Every collection with an item route also exposes its list route.

Observed live: a contacts design carried POST /contacts plus GET/PUT/DELETE
/contacts/{contact_id} but no GET /contacts. The Coder implements exactly the design's
endpoints, the Tester covers exactly those, and the run passed 7/7 tests — yet the
downloaded admin UI found no collections, because it discovers them from list routes.
"""

import pytest
from pydantic import ValidationError

from app.schemas.agents import Design, Endpoint, FileSpec, SingleFileOutput

_FILES = [FileSpec(path="main.py")]
_COLLECTIONS = [{"name": "contacts", "fields": ["name", "email"]}]


def _design(*endpoints: Endpoint) -> Design:
    return Design(collections=_COLLECTIONS, endpoints=list(endpoints), files=_FILES)


def _contact_routes_without_list() -> list[Endpoint]:
    return [
        Endpoint(
            method="POST",
            path="/contacts",
            request_model="ContactCreate",
            response_model="ContactRead",
            status_code=201,
        ),
        Endpoint(
            method="GET",
            path="/contacts/{contact_id}",
            response_model="ContactRead",
            status_code=200,
        ),
        Endpoint(
            method="PUT",
            path="/contacts/{contact_id}",
            request_model="ContactUpdate",
            response_model="ContactRead",
            status_code=200,
        ),
        Endpoint(method="DELETE", path="/contacts/{contact_id}", status_code=204),
    ]


def _list_routes(design: Design) -> list[Endpoint]:
    return [e for e in design.endpoints if e.method == "GET" and "{" not in e.path]


# --------------------------------------------------------------------------- #
# Design: the missing list route is added, not left for the Coder to skip
# --------------------------------------------------------------------------- #


def test_design_missing_list_route_gains_one():
    design = _design(*_contact_routes_without_list())

    [added] = _list_routes(design)
    assert added.path == "/contacts"
    assert added.status_code == 200
    assert added.request_model is None


def test_added_list_route_returns_a_list_of_the_item_response_model():
    design = _design(*_contact_routes_without_list())

    [added] = _list_routes(design)
    assert added.response_model == "list[ContactRead]"


def test_added_list_route_sits_beside_its_collection():
    design = _design(*_contact_routes_without_list())

    paths = [(e.method, e.path) for e in design.endpoints]
    assert paths.index(("GET", "/contacts")) == paths.index(("POST", "/contacts")) + 1


def test_design_with_list_route_is_left_unchanged():
    routes = _contact_routes_without_list()
    listing = Endpoint(
        method="GET", path="/contacts/", response_model="list[ContactRead]", status_code=200
    )
    design = _design(*routes, listing)

    assert len(design.endpoints) == len(routes) + 1
    assert _list_routes(design) == [listing]


def test_each_of_two_collections_gets_its_own_list_route():
    authors = [
        Endpoint(
            method="GET", path="/authors/{author_id}", response_model="AuthorRead", status_code=200
        ),
        Endpoint(method="DELETE", path="/authors/{author_id}", status_code=204),
    ]
    design = _design(*_contact_routes_without_list(), *authors)

    assert {(e.path, e.response_model) for e in _list_routes(design)} == {
        ("/contacts", "list[ContactRead]"),
        ("/authors", "list[AuthorRead]"),
    }


def test_list_model_falls_back_to_the_create_response_when_there_is_no_item_get():
    design = _design(
        Endpoint(
            method="POST",
            path="/contacts",
            request_model="ContactCreate",
            response_model="ContactRead",
            status_code=201,
        ),
        Endpoint(method="DELETE", path="/contacts/{contact_id}", status_code=204),
    )

    [added] = _list_routes(design)
    assert added.response_model == "list[ContactRead]"


def test_list_route_with_a_single_record_model_is_made_a_list():
    """The admin UI discovers a collection only when its list route returns an array."""
    listing = Endpoint(
        method="GET", path="/contacts", response_model="ContactRead", status_code=200
    )
    design = _design(*_contact_routes_without_list(), listing)

    [fixed] = _list_routes(design)
    assert fixed.response_model == "list[ContactRead]"


def test_list_route_already_returning_a_list_keeps_its_model():
    listing = Endpoint(
        method="GET", path="/contacts", response_model="List[ContactRead]", status_code=200
    )
    design = _design(*_contact_routes_without_list(), listing)

    assert _list_routes(design)[0].response_model == "List[ContactRead]"


def test_delete_message_model_is_never_used_as_the_list_model():
    with pytest.raises(ValidationError, match="GET /contacts"):
        _design(
            Endpoint(
                method="DELETE",
                path="/contacts/{contact_id}",
                response_model="MessageResponse",
                status_code=200,
            )
        )


def test_collection_with_no_response_model_anywhere_is_rejected():
    with pytest.raises(ValidationError, match="GET /contacts"):
        _design(Endpoint(method="DELETE", path="/contacts/{contact_id}", status_code=204))


# --------------------------------------------------------------------------- #
# Generated code: a backstop for a Coder that drops the route anyway
# --------------------------------------------------------------------------- #

_MAIN_WITHOUT_LIST = """
from fastapi import FastAPI

app = FastAPI()


@app.post("/contacts", status_code=201)
async def create_contact(): ...


@app.get("/contacts/{contact_id}")
async def get_contact(contact_id: str): ...


@app.delete("/contacts/{contact_id}", status_code=204)
async def delete_contact(contact_id: str): ...
"""


def test_routes_without_a_list_route_are_rejected_at_generation_time():
    with pytest.raises(ValidationError, match="GET /contacts"):
        SingleFileOutput(path="main.py", content=_MAIN_WITHOUT_LIST)


@pytest.mark.parametrize("list_path", ["/contacts", "/contacts/"])
def test_routes_with_a_list_route_are_accepted(list_path):
    source = _MAIN_WITHOUT_LIST + f'\n\n@app.get("{list_path}")\nasync def list_contacts(): ...\n'

    assert SingleFileOutput(path="main.py", content=source).path == "main.py"


def test_router_prefix_is_applied_when_matching_list_routes():
    source = """
from fastapi import APIRouter

router = APIRouter(prefix="/contacts")


@router.get("/")
async def list_contacts(): ...


@router.get("/{contact_id}")
async def get_contact(contact_id: str): ...
"""
    assert SingleFileOutput(path="main.py", content=source).path == "main.py"


def test_router_prefix_is_applied_when_the_list_route_is_missing():
    source = """
from fastapi import APIRouter

router = APIRouter(prefix="/contacts")


@router.get("/{contact_id}")
async def get_contact(contact_id: str): ...
"""
    with pytest.raises(ValidationError, match="GET /contacts"):
        SingleFileOutput(path="main.py", content=source)


def test_files_without_routes_are_not_checked():
    source = "from beanie import Document\n\n\nclass Contact(Document):\n    name: str\n"

    assert SingleFileOutput(path="models.py", content=source).path == "models.py"


def test_test_client_calls_are_not_mistaken_for_routes():
    source = """
def test_get_contact(client):
    client.get("/contacts/abc")
"""
    assert SingleFileOutput(path="test_main.py", content=source).path == "test_main.py"
