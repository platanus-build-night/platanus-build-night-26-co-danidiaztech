"""Deterministic recommendation engine — STUB, owned by Agent E.

Agent E implements the scoring spec from CONTRACTS.md:
Score = 0.4*weakness(tag overlap) + 0.35*ratingFit(target=est+150±150)
      + 0.15*staleness(topic not seen recently) + 0.1*diversity(!= last topics)
against `profile.data`'s per-tag EWMA mastery, excluding already-solved
problems, returning the top 3 with human-readable `why` chips.

Current behavior: returns up to 3 problems (any not yet solved, i.e. no AC
submission) with a flat fixture score/why, so /recommendations has a
realistic, contract-shaped response end-to-end.
"""
from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Problem, Submission


def recommend(db: Session) -> list[dict[str, Any]]:
    solved_ids = {
        row[0]
        for row in db.execute(
            select(Submission.problem_id).where(Submission.verdict == "AC")
        ).all()
    }
    problems = db.execute(select(Problem)).scalars().all()
    candidates = [p for p in problems if p.id not in solved_ids][:3]

    out: list[dict[str, Any]] = []
    for p in candidates:
        out.append(
            {
                "problem": {
                    "id": p.id,
                    "title": p.title,
                    "tags": p.tags or [],
                    "rating": p.rating,
                    "solved": False,
                },
                "score": 0.5,
                "why": ["fixture recommendation — real scoring not implemented yet"],
            }
        )
    return out
