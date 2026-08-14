# GENERATED_APP.md — What the Coder Agent Must Produce

The fixed shape of every application CodeForge generates. The Architect targets this
structure, the Coder fills it in, the Reviewer checks against it, the sandbox image is built
for it, and the RAG example library holds snippets of it. One structure, five consumers —
so it is specified once, here.

Scope is `docs/SRS.md` §4: a CRUD REST API over one or two entities. Nothing else.

---

## 1. File structure

Exactly five files. No packages, no nested directories — a flat tree keeps generation
reliable and the code viewer readable.

| File | Responsibility |
|---|---|
| `database.py` | Mongo client + Beanie initialisation |
| `models.py` | Beanie `Document` classes — the persisted shape |
| `schemas.py` | Pydantic request/response models — the API shape |
| `main.py` | FastAPI app, lifespan startup, routes |
| `test_main.py` | pytest + httpx suite (written by the Tester, not the Coder) |

`models.py` and `schemas.py` are deliberately separate. Collapsing them is what leads to a
`Document` being returned directly from a route, which is the failure this project predicts
most often.

---

## 2. Hard rules

These appear in the Architect prompt template and again on the Reviewer checklist.

1. **Never return a Beanie `Document` from a route.** Every route declares an explicit
   `response_model` drawn from `schemas.py`. Mongo's `_id` is an `ObjectId` and is not
   JSON-serialisable.
2. **Expose `id` as `str`.** Convert with `str(doc.id)` when building a response model.
3. **The Mongo URI is always `mongodb://localhost:27017`.** `mongod` runs inside the sandbox
   container. No environment variables, no configuration files.
4. **No network calls.** The container runs with networking disabled; any outbound request
   fails by construction.
5. **No authentication.** Out of scope for generated apps (SRS §4).
6. **Complete code only.** No `TODO`, no `...`, no "rest of the code unchanged". Every file
   must run exactly as written.
7. **Async throughout.** `async def` routes, `await` on every Beanie call.
8. **Beanie is initialised on startup** via FastAPI's lifespan, with every `Document`
   registered.

---

## 3. Route conventions

For an entity `Book`, collection `books`:

| Method | Path | Success | Notes |
|---|---|---|---|
| `POST` | `/books` | `201` | Body is the create schema; returns the response schema |
| `GET` | `/books` | `200` | Returns a list of response schemas |
| `GET` | `/books/{book_id}` | `200` | `404` when absent |
| `PUT` | `/books/{book_id}` | `200` | `404` when absent |
| `DELETE` | `/books/{book_id}` | `204` | `404` when absent; empty body |

Paths are plural and lowercase. Two-entity apps expose each entity at its own top-level
path; the relationship is carried as a `str` id field on the dependent entity, not as a
nested route.

---

## 4. Reference shape

Illustrative, not a literal template — the Coder generates against the Design.

**`database.py`**
```python
from beanie import init_beanie
from pymongo import AsyncMongoClient

from models import Book


async def init_db() -> None:
    client = AsyncMongoClient("mongodb://localhost:27017")
    await init_beanie(database=client.appdb, document_models=[Book])
```

**`models.py`**
```python
from beanie import Document


class Book(Document):
    title: str
    author: str
    year: int

    class Settings:
        name = "books"
```

**`schemas.py`**
```python
from pydantic import BaseModel


class BookCreate(BaseModel):
    title: str
    author: str
    year: int


class BookResponse(BaseModel):
    id: str          # str, never ObjectId
    title: str
    author: str
    year: int
```

**`main.py`**
```python
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException

from database import init_db
from models import Book
from schemas import BookCreate, BookResponse


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(lifespan=lifespan)


@app.post("/books", response_model=BookResponse, status_code=201)
async def create_book(payload: BookCreate) -> BookResponse:
    book = Book(**payload.model_dump())
    await book.insert()
    return BookResponse(id=str(book.id), **payload.model_dump())


@app.get("/books/{book_id}", response_model=BookResponse)
async def get_book(book_id: str) -> BookResponse:
    book = await Book.get(book_id)
    if book is None:
        raise HTTPException(status_code=404, detail="Book not found")
    return BookResponse(
        id=str(book.id), title=book.title, author=book.author, year=book.year
    )
```

**`test_main.py`**

> `TestClient` **must** be used as a context manager. Entering the `with` block is what runs
> the app's lifespan, and the lifespan is what initialises Beanie. Calling
> `TestClient(app).get(...)` without the `with` raises `CollectionWasNotInitialized` on the
> first database access — an error that looks like broken application code but is not.

```python
from fastapi.testclient import TestClient

from main import app


def test_create_and_get_book():
    with TestClient(app) as client:
        created = client.post(
            "/books", json={"title": "Dune", "author": "Herbert", "year": 1965}
        )
        assert created.status_code == 201
        book_id = created.json()["id"]

        fetched = client.get(f"/books/{book_id}")
        assert fetched.status_code == 200
        assert fetched.json()["title"] == "Dune"

        client.delete(f"/books/{book_id}")  # tests clean up after themselves


def test_get_missing_book_returns_404():
    with TestClient(app) as client:
        response = client.get("/books/000000000000000000000000")
        assert response.status_code == 404
```

---

## 5. Test requirements

- One test per endpoint, minimum.
- A `404` test for get, update and delete.
- Self-contained: each test creates the data it asserts on and removes it afterwards.
- No network, no external fixtures, no sleeping.
- `TestClient` as a context manager, always — the app is exercised in-process, never over a
  real socket, and the `with` block is what runs the lifespan.
- Tests are **synchronous**. The application is async throughout; its tests are not. This is
  deliberate: it removes the event-loop and missing-initialisation failure modes that async
  test code introduces, and it is the single most common way generated suites break.

---

## 6. Sandbox image contents

The image is pre-built with everything below, because `network_mode="none"` means nothing can
be installed at run time.

Built from `sandbox/Dockerfile`: **`mongo:8`** (Ubuntu 24.04, official `mongod`) plus
Python 3.12 and `fastapi`, `uvicorn`, `beanie`, `pymongo`, `pytest`, `httpx`,
`email-validator` (pydantic's `EmailStr` needs it; generated contact apps use it).

The base was originally specified as `python:3.11-slim`. That is not buildable: MongoDB
publishes no arm64 `mongodb-org-server` for Debian, so the image cannot run `mongod` on
Apple Silicon at all — and its 7.0 apt repo is signed with SHA1, which Debian's crypto
policy has rejected since 2026-02-01. Starting from MongoDB's own image avoids both, at
the cost of Python 3.12 rather than 3.11. Generated CRUD code runs identically on either.

`pytest-asyncio` is deliberately **not** included: generated tests are synchronous (§5), and
leaving the package out means a generated async test fails loudly at collection instead of
appearing to pass while silently skipping.
