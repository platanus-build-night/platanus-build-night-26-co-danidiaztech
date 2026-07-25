"""/run and /submit — stub endpoints delegating to app.judge.service (Agent E
fills in the real judge; app.judge.core (Agent B) is the pure runner).

Submissions ARE persisted to the DB (the submissions table is part of the
real, functional CRUD surface) even though the verdict itself is fixture data
until Agent B/E land the real judge.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.judge import service as judge_service
from app.models import Problem, Submission
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

    result = judge_service.submit(problem, payload.language, payload.code)

    submission = Submission(
        session_id=payload.session_id,
        problem_id=payload.problem_id,
        language=payload.language,
        code=payload.code,
        verdict=result["verdict"],
        time_ms=result["time_ms"],
        per_test=result["per_test"],
    )
    db.add(submission)
    db.commit()

    return result
