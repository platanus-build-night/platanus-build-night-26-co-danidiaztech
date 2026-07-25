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
    SessionCreate,
    SessionCreated,
    SessionDetail,
    SessionListItem,
)

router = APIRouter(tags=["sessions"])


@router.post("/sessions", response_model=SessionCreated)
def create_session(payload: SessionCreate, db: Session = Depends(get_db)) -> SessionCreated:
    if db.get(Problem, payload.problem_id) is None:
        raise HTTPException(status_code=404, detail="problem not found")
    session = SessionModel(problem_id=payload.problem_id, language=payload.language, status="active")
    db.add(session)
    db.commit()
    db.refresh(session)
    return SessionCreated(id=session.id)


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
