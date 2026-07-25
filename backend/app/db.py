"""Database engine/session setup for the trainer backend.

Reads DATABASE_URL from the environment (backend/.env). SQLAlchemy 2.x style,
no alembic — models are created via Base.metadata.create_all on startup
(see app/main.py).
"""
from __future__ import annotations

import os
from collections.abc import Generator

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

load_dotenv()

def normalize_database_url(url: str) -> str:
    """Pin the URL to the psycopg 3 driver.

    Hosted Postgres providers hand out a bare `postgresql://` (Render) or the
    legacy `postgres://` (Heroku lineage). SQLAlchemy maps both to the
    **psycopg2** dialect, which we don't install — we ship psycopg 3 — so an
    unmodified provider URL dies at import with
    `ModuleNotFoundError: No module named 'psycopg2'` and takes the whole
    service down on boot.

    Rewriting the scheme here means DATABASE_URL can be pasted from any
    provider verbatim. URLs that already name a driver (`postgresql+psycopg://`,
    or someone deliberately choosing another) are left untouched.
    """
    if url.startswith("postgres://"):
        return "postgresql+psycopg://" + url[len("postgres://") :]
    if url.startswith("postgresql://"):
        return "postgresql+psycopg://" + url[len("postgresql://") :]
    return url


DATABASE_URL = normalize_database_url(
    os.getenv("DATABASE_URL", "postgresql+psycopg://trainer:trainer@localhost:5433/trainer")
)

engine = create_engine(DATABASE_URL, pool_pre_ping=True, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency yielding a DB session, closed after the request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
