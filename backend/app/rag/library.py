"""Curated example library for retrieval.

Not a general knowledge base (CLAUDE.md §3): a small, hand-written set of the patterns
generated apps actually get wrong. Every snippet here was written against a failure
observed in a real run — the acceptance-level baseline measured on 2026-08-14 was
L2 1/10, L3 5/10, L4 4/10, L5 0/10, and these target those specific causes.

Snippets are deliberately short. The Coder receives 3-5 of them, and a long example eats
the token budget the generated file itself needs.
"""

from pydantic import BaseModel


class Snippet(BaseModel):
    id: str
    title: str
    # What this teaches, in the words a Coder prompt would use. This is what retrieval
    # matches against, so it is phrased as a problem, not a label.
    about: str
    code: str


SNIPPETS: list[Snippet] = [
    Snippet(
        id="response_model_str_id",
        title="Return a response model, never a Document",
        about=(
            "returning data from an endpoint, converting ObjectId to a string, "
            "avoiding 'Object of type ObjectId is not JSON serializable'"
        ),
        code="""from beanie import Document
from pydantic import BaseModel


class Book(Document):
    title: str

    class Settings:
        name = "books"


class BookResponse(BaseModel):
    id: str          # a string, never ObjectId
    title: str


def to_response(book: Book) -> BookResponse:
    return BookResponse(id=str(book.id), title=book.title)
""",
    ),
    Snippet(
        id="lifespan_startup",
        title="Initialise Beanie with a lifespan context manager",
        about=(
            "starting the app, connecting to MongoDB, initialising Beanie, "
            "avoiding CollectionWasNotInitialized, FastAPI has no attribute lifespan"
        ),
        code="""from contextlib import asynccontextmanager

from beanie import init_beanie
from fastapi import FastAPI
from pymongo import AsyncMongoClient

from models import Book


@asynccontextmanager
async def lifespan(app: FastAPI):
    client = AsyncMongoClient("mongodb://localhost:27017")
    await init_beanie(database=client.appdb, document_models=[Book])
    yield


# lifespan is passed to the constructor; it is not an attribute of FastAPI
app = FastAPI(lifespan=lifespan)
""",
    ),
    Snippet(
        id="pymongo_not_motor",
        title="Use pymongo's AsyncMongoClient, not motor",
        about="creating the MongoDB client, async database connection, motor is not installed",
        code="""# Beanie 2.x uses pymongo's async client. motor is NOT installed in the sandbox.
from pymongo import AsyncMongoClient

client = AsyncMongoClient("mongodb://localhost:27017")
database = client.appdb
""",
    ),
    Snippet(
        id="crud_create",
        title="Create endpoint returning 201",
        about="creating a document, POST endpoint, 201 status code, insert",
        code="""from fastapi import FastAPI, status

app = FastAPI()


@app.post("/books", response_model=BookResponse, status_code=status.HTTP_201_CREATED)
async def create_book(payload: BookCreate) -> BookResponse:
    book = Book(**payload.model_dump())
    await book.insert()
    return BookResponse(id=str(book.id), **payload.model_dump())
""",
    ),
    Snippet(
        id="crud_get_404",
        title="Get one document, 404 when missing",
        about="fetching by id, handling a missing document, raising 404, invalid ObjectId",
        code="""from fastapi import HTTPException, status


@app.get("/books/{book_id}", response_model=BookResponse)
async def get_book(book_id: str) -> BookResponse:
    # A malformed id must 404, not raise: Beanie.get() rejects non-ObjectId strings.
    try:
        book = await Book.get(book_id)
    except Exception:
        book = None
    if book is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")
    return BookResponse(id=str(book.id), title=book.title)
""",
    ),
    Snippet(
        id="crud_list",
        title="List documents",
        about="listing all documents, returning a list, find_all",
        code="""@app.get("/books", response_model=list[BookResponse])
async def list_books() -> list[BookResponse]:
    books = await Book.find_all().to_list()
    return [BookResponse(id=str(b.id), title=b.title) for b in books]
""",
    ),
    Snippet(
        id="crud_update",
        title="Partial update with an optional-field schema",
        about="updating a document, PUT endpoint, partial update, exclude_unset",
        code="""class BookUpdate(BaseModel):
    title: str | None = None


@app.put("/books/{book_id}", response_model=BookResponse)
async def update_book(book_id: str, payload: BookUpdate) -> BookResponse:
    book = await Book.get(book_id)
    if book is None:
        raise HTTPException(status_code=404, detail="Book not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(book, field, value)
    await book.save()
    return BookResponse(id=str(book.id), title=book.title)
""",
    ),
    Snippet(
        id="crud_delete_204",
        title="Delete returning 204 with no body",
        about="deleting a document, DELETE endpoint, 204 no content, empty response",
        code="""@app.delete("/books/{book_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_book(book_id: str) -> None:
    book = await Book.get(book_id)
    if book is None:
        raise HTTPException(status_code=404, detail="Book not found")
    await book.delete()
    # 204 means no body: return None, and declare no response_model.
""",
    ),
    Snippet(
        id="two_entity_relationship",
        title="Relate two entities by string id",
        about="two entities, relationship between documents, foreign key, parent id field",
        code="""class Post(Document):
    title: str

    class Settings:
        name = "posts"


class Comment(Document):
    post_id: str      # the relationship is a plain string id, not a nested route
    body: str

    class Settings:
        name = "comments"


@app.get("/comments", response_model=list[CommentResponse])
async def list_comments(post_id: str | None = None) -> list[CommentResponse]:
    query = Comment.find(Comment.post_id == post_id) if post_id else Comment.find_all()
    rows = await query.to_list()
    return [CommentResponse(id=str(c.id), post_id=c.post_id, body=c.body) for c in rows]
""",
    ),
    Snippet(
        id="test_client_context_manager",
        title="TestClient must be a context manager",
        about=(
            "writing tests, pytest, TestClient, CollectionWasNotInitialized in tests, "
            "running the app lifespan during tests"
        ),
        code="""from fastapi.testclient import TestClient

from main import app


def test_create_and_get():
    # The with-block runs the lifespan, which is what initialises Beanie.
    # Without it, the first database call raises CollectionWasNotInitialized.
    with TestClient(app) as client:
        created = client.post("/books", json={"title": "Dune"})
        assert created.status_code == 201
        book_id = created.json()["id"]

        fetched = client.get(f"/books/{book_id}")
        assert fetched.status_code == 200
""",
    ),
    Snippet(
        id="test_404_path",
        title="Test the not-found path",
        about="testing a missing document, 404 test, invalid id in tests",
        code="""def test_missing_returns_404():
    with TestClient(app) as client:
        # a well-formed but absent 24-character ObjectId
        assert client.get("/books/000000000000000000000000").status_code == 404
""",
    ),
    Snippet(
        id="tests_are_synchronous",
        title="Tests are synchronous, never async",
        about="async tests, pytest.mark.asyncio, pytest-asyncio not installed, event loop errors",
        code="""# pytest-asyncio is NOT installed in the sandbox.
# An async test errors at collection.
# Write plain synchronous tests; TestClient drives the async app for you.

def test_ping():
    with TestClient(app) as client:
        assert client.get("/books").status_code == 200
""",
    ),
    Snippet(
        id="self_contained_tests",
        title="Each test creates and removes its own data",
        about="test isolation, cleaning up after a test, shared state between tests",
        code="""def test_list_contains_created_item():
    with TestClient(app) as client:
        created = client.post("/books", json={"title": "Dune"})
        book_id = created.json()["id"]
        try:
            titles = [b["title"] for b in client.get("/books").json()]
            assert "Dune" in titles
        finally:
            client.delete(f"/books/{book_id}")   # leave the database as we found it
""",
    ),
    Snippet(
        id="module_exports_match_imports",
        title="Export the names other files import",
        about=(
            "ImportError cannot import name, cross-file imports, database module, "
            "module does not define the symbol another file expects"
        ),
        code="""# database.py — if main.py does `from database import init_db`, this module must
# define exactly that name. Mismatched names are a common cross-file failure.
from beanie import init_beanie
from pymongo import AsyncMongoClient

from models import Book


async def init_db() -> None:
    client = AsyncMongoClient("mongodb://localhost:27017")
    await init_beanie(database=client.appdb, document_models=[Book])
""",
    ),
    Snippet(
        id="await_only_in_async",
        title="await belongs inside an async function",
        about="SyntaxError await outside async function, calling async code from sync code",
        code="""# Every route that awaits must itself be `async def`.
@app.get("/books", response_model=list[BookResponse])
async def list_books() -> list[BookResponse]:      # async, because it awaits below
    books = await Book.find_all().to_list()
    return [BookResponse(id=str(b.id), title=b.title) for b in books]
""",
    ),
    Snippet(
        id="email_field",
        title="Email fields use EmailStr",
        about="storing an email address, validating email, contact and attendee entities",
        code="""from pydantic import BaseModel, EmailStr


class ContactCreate(BaseModel):
    name: str
    email: EmailStr          # email-validator is installed in the sandbox


class Contact(Document):
    name: str
    email: str               # stored as a plain string on the Document

    class Settings:
        name = "contacts"
""",
    ),
    Snippet(
        id="datetime_field",
        title="Timestamps default with a factory",
        about="created_at field, datetime default, timestamps on a document",
        code="""from datetime import datetime

from beanie import Document
from pydantic import Field


class Note(Document):
    body: str
    created_at: datetime = Field(default_factory=datetime.now)

    class Settings:
        name = "notes"
""",
    ),
    Snippet(
        id="list_field",
        title="List-of-string fields",
        about="tags, genres, list of strings field, array field on a document",
        code="""from beanie import Document
from pydantic import Field


class Note(Document):
    body: str
    tags: list[str] = Field(default_factory=list)   # never a mutable default

    class Settings:
        name = "notes"
""",
    ),
]


def snippet_by_id(snippet_id: str) -> Snippet | None:
    return next((s for s in SNIPPETS if s.id == snippet_id), None)
