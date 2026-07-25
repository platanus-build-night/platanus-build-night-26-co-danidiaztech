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


# ---------------------------------------------------------------- Sessions --

class SessionCreate(BaseModel):
    problem_id: int
    language: str


class SessionCreated(BaseModel):
    id: int


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
