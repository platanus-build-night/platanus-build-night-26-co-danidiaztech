"""/run and /submit — delegate to app.judge.service (Agent E; app.judge.core,
Agent B, is the pure sandboxed runner underneath).

`submit()` in the service layer owns persistence: it writes the Submission
row itself, emits a `submit` session event when a session_id is given, and
nudges the rolling skill profile — see app/judge/service.py.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.judge import service as judge_service
from app.models import Problem
from app.schemas import RunRequest, RunResult, SubmitRequest, SubmitResult

router = APIRouter(tags=["judge"])


@router.post("/run", response_model=list[RunResult])
def run_code(payload: RunRequest, db: Session = Depends(get_db)) -> list[dict]:
    problem = db.get(Problem, payload.problem_id)
    if problem is None:
        raise HTTPException(status_code=404, detail="problem not found")
    return judge_service.run_samples(problem, payload.language, payload.code)


@router.post("/submit", response_model=SubmitResult)
def submit_code(payload: SubmitRequest, db: Session = Depends(get_db)) -> dict:
    problem = db.get(Problem, payload.problem_id)
    if problem is None:
        raise HTTPException(status_code=404, detail="problem not found")

    return judge_service.submit(
        db, problem, payload.language, payload.code, session_id=payload.session_id
    )
