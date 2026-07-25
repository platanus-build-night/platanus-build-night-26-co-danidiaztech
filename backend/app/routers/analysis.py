"""/sessions/{id}/analyze and /profile — delegate to app.features (Agent E),
app.analysis (Agent F), and app.engine.profile (Agent E). Persists the
Analysis row and recomputes the rolling profile.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.analysis.analyze import analyze_session
from app.db import get_db
from app.engine.profile import get_or_create_profile, recompute_profile
from app.features.extract import extract_features
from app.models import Analysis, Event, SessionModel
from app.schemas import AnalysisResult, ProfileOut

router = APIRouter(tags=["analysis"])


@router.post("/sessions/{session_id}/analyze", response_model=AnalysisResult)
def analyze(session_id: int, db: Session = Depends(get_db)) -> dict:
    session = db.get(SessionModel, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="session not found")

    events = [
        {"t_ms": e.t_ms, "kind": e.kind, "payload": e.payload} for e in session.events
    ]
    features = extract_features(events)
    profile = get_or_create_profile(db)
    result = analyze_session(session, events, session.problem, features, profile.data)

    existing = db.query(Analysis).filter(Analysis.session_id == session_id).one_or_none()
    if existing is None:
        db.add(Analysis(session_id=session_id, features=features, result=result))
    else:
        existing.features = features
        existing.result = result
    db.commit()

    recompute_profile(db, session, result)

    return result


@router.get("/profile", response_model=ProfileOut)
def profile(db: Session = Depends(get_db)) -> dict:
    p = get_or_create_profile(db)
    return {"data": p.data}
