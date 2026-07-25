"""Pydantic schemas mirroring the DB models + API shapes from CONTRACTS.md."""
from __future__ import annotations

import datetime as dt
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict


class Sample(BaseModel):
    input: str
    output: str


# ---------------------------------------------------------------- Problems --

class ProblemListItem(BaseModel):
    id: int
    title: str
    tags: list[str]
    rating: Optional[int] = None
    solved: bool = False


class ProblemDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    external_id: str
    source: str
    title: str
    statement_md: str
    tags: list[str]
    rating: Optional[int] = None
    time_limit_ms: int
    memory_limit_mb: int
    editorial_md: Optional[str] = None
    samples: list[Sample]


class ProblemMeta(BaseModel):
    """Safe-to-show-before-you-commit subset of a problem: no statement,
    samples, editorial, or tags (tags are a technique spoiler in CP).
    Used by the solve pre-flight screen, before a session — and therefore
    the full statement — exists."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    rating: Optional[int] = None
    time_limit_ms: int
    memory_limit_mb: int


# ---------------------------------------------------------------- Sessions --

class SessionCreate(BaseModel):
    problem_id: int
    language: str
    # Pre-flight choice: did the user opt into voice capture? Defaults to
    # False so existing/older clients that don't send it behave as "silent".
    record_voice: bool = False


class SessionCreated(BaseModel):
    id: int
    # The full statement is only ever handed over once a session exists —
    # this is the one place the gated pre-flight flow receives it.
    problem: ProblemDetail


class SessionPatch(BaseModel):
    """Partial update for a session row — currently just `language`, so the
    dashboard reflects the language the user actually solved in after a
    mid-session switch (the session row is created once on mount)."""

    language: Optional[str] = None


class EventIn(BaseModel):
    t_ms: int
    kind: str
    payload: dict[str, Any] = {}


class EventsBatchIn(BaseModel):
    events: list[EventIn]


class EventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    t_ms: int
    kind: str
    payload: dict[str, Any]


class SessionListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    problem_id: int
    language: str
    started_at: dt.datetime
    ended_at: Optional[dt.datetime] = None
    status: str
    record_voice: bool = False


class SessionDetail(SessionListItem):
    events: list[EventOut] = []


# -------------------------------------------------------------- Run/Submit --

class RunRequest(BaseModel):
    problem_id: int
    language: str
    code: str


class RunResult(BaseModel):
    verdict: str
    time_ms: int
    stdout: str
    expected: str
    compile_error: Optional[str] = None


class CustomRunRequest(BaseModel):
    problem_id: int
    language: str
    code: str
    stdin: str
    # Optional: when omitted there is nothing to be "wrong" against, so the
    # run is graded OK/RE/TLE/CE rather than AC/WA.
    expected: Optional[str] = None


class CustomRunResult(BaseModel):
    verdict: str
    time_ms: int
    stdout: str
    stderr: str
    expected: Optional[str] = None
    compile_error: Optional[str] = None
    exit_code: Optional[int] = None


class SubmitRequest(BaseModel):
    problem_id: int
    language: str
    code: str
    session_id: Optional[int] = None


class SubmitResult(BaseModel):
    verdict: str
    per_test: list[dict[str, Any]]
    time_ms: int


# ------------------------------------------------------------ Recommendations

class Recommendation(BaseModel):
    problem: ProblemListItem
    score: float
    why: list[str]


# ----------------------------------------------------------------- Analysis --

class Phase(BaseModel):
    label: str
    startSec: int
    endSec: int
    note: str = ""


class Marker(BaseModel):
    kind: str
    atSec: int
    quote: str = ""
    note: str = ""


class Drill(BaseModel):
    title: str
    why: str


class EditorialGap(BaseModel):
    missedInsight: str = ""
    fasterPath: str = ""
    profileAdvice: str = ""


class AnalysisResult(BaseModel):
    summary: str
    phases: list[Phase]
    markers: list[Marker]
    ahaMomentSec: Optional[int] = None
    firstCorrectCodeSec: Optional[int] = None
    ahaGapSeconds: Optional[int] = None
    bottleneck: str
    strengths: list[str]
    drills: list[Drill]
    editorialGap: EditorialGap


# ------------------------------------------------------------------ Profile --

class ProfileOut(BaseModel):
    data: dict[str, Any]


class SessionAnalysisOut(BaseModel):
    result: AnalysisResult
    created_at: dt.datetime


# ----------------------------------------------------------------- Settings --

class SettingsOut(BaseModel):
    provider: str  # api|plan|mock
    model: str
    api_key_masked: Optional[str] = None
    oauth_token_masked: Optional[str] = None
    status: str


class SettingsUpdate(BaseModel):
    provider: Optional[str] = None
    api_key: Optional[str] = None
    oauth_token: Optional[str] = None
    model: Optional[str] = None


class SettingsTestResult(BaseModel):
    ok: bool
    provider: str
    model: Optional[str] = None
    error: Optional[str] = None
