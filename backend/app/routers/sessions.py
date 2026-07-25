"""Sessions + events CRUD — fully functional against the DB (Agent A)."""
from __future__ import annotations

import datetime as dt

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Event, Problem, SessionModel
from app.schemas import (
    EventsBatchIn,
    ProblemDetail,
    SessionCreate,
    SessionCreated,
    SessionDetail,
    SessionListItem,
    SessionPatch,
)

router = APIRouter(tags=["sessions"])


@router.post("/sessions", response_model=SessionCreated)
def create_session(payload: SessionCreate, db: Session = Depends(get_db)) -> SessionCreated:
    problem = db.get(Problem, payload.problem_id)
    if problem is None:
        raise HTTPException(status_code=404, detail="problem not found")
    session = SessionModel(
        problem_id=payload.problem_id,
        language=payload.language,
        status="active",
        record_voice=payload.record_voice,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    # The full statement is handed over here, and only here (or via the
    # pre-existing /problems/{id} used post-session by review) — the
    # pre-flight screen never has it before this call.
    return SessionCreated(id=session.id, problem=ProblemDetail.model_validate(problem))


@router.patch("/sessions/{session_id}", response_model=SessionListItem)
def patch_session(session_id: int, payload: SessionPatch, db: Session = Depends(get_db)) -> SessionModel:
    """Partial update — currently only `language`. Used when the user
    switches language mid-session so the session row (and thus the
    dashboard's "Recent sessions" list) reflects the language actually
    used instead of whatever was selected when the session was created."""
    session = db.get(SessionModel, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="session not found")
    if payload.language is not None:
        session.language = payload.language
    db.commit()
    db.refresh(session)
    return session


@router.post("/sessions/{session_id}/events")
def post_events(session_id: int, payload: EventsBatchIn, db: Session = Depends(get_db)) -> dict:
    session = db.get(SessionModel, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="session not found")
    for e in payload.events:
        db.add(Event(session_id=session_id, t_ms=e.t_ms, kind=e.kind, payload=e.payload))
    db.commit()
    return {"ok": True, "count": len(payload.events)}


@router.post("/sessions/{session_id}/finish")
def finish_session(session_id: int, db: Session = Depends(get_db)) -> dict:
    session = db.get(SessionModel, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="session not found")
    session.status = "finished"
    session.ended_at = dt.datetime.now(dt.timezone.utc)
    db.commit()
    return {"ok": True}


@router.get("/sessions", response_model=list[SessionListItem])
def list_sessions(db: Session = Depends(get_db)) -> list[SessionModel]:
    return db.execute(select(SessionModel)).scalars().all()


@router.get("/sessions/{session_id}", response_model=SessionDetail)
def get_session(session_id: int, db: Session = Depends(get_db)) -> SessionModel:
    session = db.get(SessionModel, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="session not found")
    return session
