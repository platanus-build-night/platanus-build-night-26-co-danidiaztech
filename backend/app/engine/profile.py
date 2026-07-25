"""Rolling skill profile — STUB, owned by Agent E.

Agent E implements the EWMA per-tag mastery update described in
CONTRACTS.md's rec engine spec (solve weight scales with problem rating vs.
user estimate; attempts/time penalties), triggered after each session
analysis and after submissions.

Current behavior: ensures the singleton `profile` row (id=1) exists with a
realistic fixture mastery shape; recompute_profile() is a no-op beyond that.
"""
from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.models import Profile

DEFAULT_PROFILE_DATA: dict[str, Any] = {
    "tags": {
        "dp": {"mastery": 0.42, "attempts": 5, "solved": 2},
        "graphs": {"mastery": 0.58, "attempts": 8, "solved": 5},
        "binary-search": {"mastery": 0.35, "attempts": 3, "solved": 1},
        "greedy": {"mastery": 0.5, "attempts": 4, "solved": 2},
    },
    "trend": "improving",
}


def get_or_create_profile(db: Session) -> Profile:
    profile = db.get(Profile, 1)
    if profile is None:
        profile = Profile(id=1, data=DEFAULT_PROFILE_DATA)
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return profile


def recompute_profile(db: Session, session: Any, analysis_result: dict[str, Any]) -> Profile:
    """Update the rolling profile after a session analysis. STUB: no-op update."""
    return get_or_create_profile(db)
