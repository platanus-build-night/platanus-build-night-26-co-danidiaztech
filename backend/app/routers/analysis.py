"""/sessions/{id}/analyze and /profile.

The analyze flow (features -> provider -> validate -> persist -> profile hook)
lives in app.analysis.service; this router is the thin HTTP edge.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.analysis.service import SessionNotFound, run_analysis
from app.db import get_db
from app.engine.profile import get_or_create_profile
from app.models import Analysis
from app.schemas import AnalysisResult, ProfileOut, SessionAnalysisOut

router = APIRouter(tags=["analysis"])


@router.post("/sessions/{session_id}/analyze", response_model=AnalysisResult)
def analyze(session_id: int, db: Session = Depends(get_db)) -> dict:
    try:
        return run_analysis(db, session_id)
    except SessionNotFound:
        raise HTTPException(status_code=404, detail="session not found") from None


@router.get("/sessions/{session_id}/analysis", response_model=SessionAnalysisOut)
def get_persisted_analysis(session_id: int, db: Session = Depends(get_db)) -> dict:
    """Rehydration endpoint: returns the already-persisted `analyses` row for
    a session (no Claude call), so the Review page can render immediately on
    load without forcing a re-analyze. 404 when the session hasn't been
    analyzed yet."""
    row = db.query(Analysis).filter(Analysis.session_id == session_id).one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="analysis not found")
    return {"result": row.result, "created_at": row.created_at}


@router.get("/profile", response_model=ProfileOut)
def profile(db: Session = Depends(get_db)) -> dict:
    p = get_or_create_profile(db)
    return {"data": p.data}
