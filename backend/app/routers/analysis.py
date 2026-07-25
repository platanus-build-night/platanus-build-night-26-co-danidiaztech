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
from app.schemas import AnalysisResult, ProfileOut

router = APIRouter(tags=["analysis"])


@router.post("/sessions/{session_id}/analyze", response_model=AnalysisResult)
def analyze(session_id: int, db: Session = Depends(get_db)) -> dict:
    try:
        return run_analysis(db, session_id)
    except SessionNotFound:
        raise HTTPException(status_code=404, detail="session not found") from None


@router.get("/profile", response_model=ProfileOut)
def profile(db: Session = Depends(get_db)) -> dict:
    p = get_or_create_profile(db)
    return {"data": p.data}
