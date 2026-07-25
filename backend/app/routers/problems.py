"""Problems CRUD — fully functional against the DB (Agent A)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Problem, Submission
from app.schemas import ProblemDetail, ProblemListItem

router = APIRouter(tags=["problems"])


@router.get("/problems", response_model=list[ProblemListItem])
def list_problems(
    tag: str | None = Query(default=None),
    min_rating: int | None = Query(default=None),
    max_rating: int | None = Query(default=None),
    q: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> list[ProblemListItem]:
    problems = db.execute(select(Problem)).scalars().all()
    solved_ids = {
        row[0]
        for row in db.execute(
            select(Submission.problem_id).where(Submission.verdict == "AC")
        ).all()
    }

    out: list[ProblemListItem] = []
    for p in problems:
        if tag and tag not in (p.tags or []):
            continue
        if min_rating is not None and (p.rating or 0) < min_rating:
            continue
        if max_rating is not None and (p.rating or 0) > max_rating:
            continue
        if q and q.lower() not in p.title.lower():
            continue
        out.append(
            ProblemListItem(
                id=p.id, title=p.title, tags=p.tags or [], rating=p.rating, solved=p.id in solved_ids
            )
        )
    return out


@router.get("/problems/{problem_id}", response_model=ProblemDetail)
def get_problem(problem_id: int, db: Session = Depends(get_db)) -> Problem:
    problem = db.get(Problem, problem_id)
    if problem is None:
        raise HTTPException(status_code=404, detail="problem not found")
    return problem
