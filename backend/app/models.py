"""SQLAlchemy 2 models — mirrors the DB schema in CONTRACTS.md exactly.

No alembic: tables are created via Base.metadata.create_all(engine) on
app startup (see app/main.py).
"""
from __future__ import annotations

import datetime as dt
from typing import Any, Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class Problem(Base):
    __tablename__ = "problems"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    external_id: Mapped[str] = mapped_column(String, unique=True, index=True)
    source: Mapped[str] = mapped_column(String)
    title: Mapped[str] = mapped_column(String)
    statement_md: Mapped[str] = mapped_column(Text)
    tags: Mapped[list[str]] = mapped_column(JSONB, default=list)
    rating: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    time_limit_ms: Mapped[int] = mapped_column(Integer, default=2000)
    memory_limit_mb: Mapped[int] = mapped_column(Integer, default=256)
    editorial_md: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    samples: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, default=list)

    testcases: Mapped[list["TestCase"]] = relationship(
        back_populates="problem", cascade="all, delete-orphan"
    )
    sessions: Mapped[list["SessionModel"]] = relationship(back_populates="problem")
    submissions: Mapped[list["Submission"]] = relationship(back_populates="problem")


class TestCase(Base):
    __tablename__ = "testcases"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    problem_id: Mapped[int] = mapped_column(ForeignKey("problems.id"))
    input: Mapped[str] = mapped_column(Text)
    expected: Mapped[str] = mapped_column(Text)
    is_sample: Mapped[bool] = mapped_column(Boolean, default=False)

    problem: Mapped["Problem"] = relationship(back_populates="testcases")


class SessionModel(Base):
    __tablename__ = "sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    problem_id: Mapped[int] = mapped_column(ForeignKey("problems.id"))
    language: Mapped[str] = mapped_column(String)
    started_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: dt.datetime.now(dt.timezone.utc)
    )
    ended_at: Mapped[Optional[dt.datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    status: Mapped[str] = mapped_column(String, default="active")  # active|finished
    # User's pre-flight choice, captured at session creation: did they opt
    # into voice capture? False also means "deliberately silent" for
    # downstream analysis, distinct from "mic failed silently".
    record_voice: Mapped[bool] = mapped_column(Boolean, default=False)

    problem: Mapped["Problem"] = relationship(back_populates="sessions")
    events: Mapped[list["Event"]] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )
    submissions: Mapped[list["Submission"]] = relationship(back_populates="session")
    analysis: Mapped[Optional["Analysis"]] = relationship(
        back_populates="session", uselist=False, cascade="all, delete-orphan"
    )


class Event(Base):
    __tablename__ = "events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("sessions.id"))
    t_ms: Mapped[int] = mapped_column(Integer)
    kind: Mapped[str] = mapped_column(String)
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)

    session: Mapped["SessionModel"] = relationship(back_populates="events")


class Submission(Base):
    __tablename__ = "submissions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    session_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("sessions.id"), nullable=True
    )
    problem_id: Mapped[int] = mapped_column(ForeignKey("problems.id"))
    language: Mapped[str] = mapped_column(String)
    code: Mapped[str] = mapped_column(Text)
    verdict: Mapped[str] = mapped_column(String)
    time_ms: Mapped[int] = mapped_column(Integer, default=0)
    per_test: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, default=list)
    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: dt.datetime.now(dt.timezone.utc)
    )

    session: Mapped[Optional["SessionModel"]] = relationship(back_populates="submissions")
    problem: Mapped["Problem"] = relationship(back_populates="submissions")


class Analysis(Base):
    __tablename__ = "analyses"
    __table_args__ = (UniqueConstraint("session_id", name="uq_analyses_session_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("sessions.id"))
    features: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    result: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: dt.datetime.now(dt.timezone.utc)
    )

    session: Mapped["SessionModel"] = relationship(back_populates="analysis")


class Profile(Base):
    __tablename__ = "profile"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    data: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)


class Settings(Base):
    """Singleton (id=1) AI provider settings.

    data = {provider: "api"|"plan"|"mock", api_key?, oauth_token?, model}.
    Plaintext is acceptable here (single-user, no-auth, local DB); credentials
    are never returned in full by the API — see app/routers/settings.py.
    """

    __tablename__ = "settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    data: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
