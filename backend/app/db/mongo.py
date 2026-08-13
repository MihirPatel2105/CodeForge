"""Mongo connection, Beanie initialisation, and the GridFS artifact bucket.

The only module that opens a database connection. Agents and routes go through Beanie
documents or `get_bucket()`; nothing else constructs a client.
"""

from pymongo import AsyncMongoClient
from pymongo.asynchronous.database import AsyncDatabase

from app.config import settings
from app.models import DOCUMENT_MODELS
from app.schemas.artifacts import ARTIFACT_BUCKET

_client: AsyncMongoClient | None = None
_database: AsyncDatabase | None = None


async def connect() -> None:
    """Open the client and register every Beanie Document. Called once on startup."""
    global _client, _database

    if _client is not None:
        return

    from beanie import init_beanie

    _client = AsyncMongoClient(settings.mongo_uri)
    _database = _client[settings.mongo_db]
    await init_beanie(database=_database, document_models=DOCUMENT_MODELS)


async def disconnect() -> None:
    global _client, _database

    if _client is not None:
        await _client.close()
        _client = None
        _database = None


def get_database() -> AsyncDatabase:
    if _database is None:
        raise RuntimeError("Database not initialised - connect() must run on startup")
    return _database


def get_bucket():
    """GridFS bucket for run artifacts (docs/STATE_AND_API.md §2)."""
    from gridfs.asynchronous import AsyncGridFSBucket

    return AsyncGridFSBucket(get_database(), bucket_name=ARTIFACT_BUCKET)
