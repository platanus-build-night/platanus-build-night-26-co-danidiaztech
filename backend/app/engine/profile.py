"""Rolling skill profile — owned by Agent E.

`profile.data` shape:
    {
      "est_rating": int,
      "tags": {tag: {"mastery": 0-1, "attempts": int, "solved": int,
                      "last_seen_session": int | None}},
      "recent_topics": [tag, ...]   # most-recent-first, capped
    }

Mastery is an EWMA over per-tag outcomes (AC vs. not), with the learning
rate scaled by how the problem's rating compares to the user's current
`est_rating` — solving something above your level moves the needle more
than solving something well below it (and the same scaling softens how
hard a single failure on an easy problem drags mastery down). `est_rating`
itself drifts toward a solved problem's rating. `recent_topics` records
topic exposure order and feeds the rec engine's staleness/diversity terms.

Two update paths, both funneling through `_apply_outcome`:
  - `update_mastery_on_submit` — called by `app.judge.service.submit` after
    every judged submission (AC or not).
  - `recompute_profile` — the analyze-time hook Agent F calls from
    `POST /sessions/{id}/analyze`; looks at whether the session ever
    produced an AC submission and applies the same update, tagged with the
    session id so `last_seen_session`/`recent_topics` reflect it even if
    the judge-time update already covered the AC itself (idempotent-ish:
    a second pass just nudges mastery slightly further toward the same
    outcome, an acceptable simplification for a deterministic, zero-AI
    engine).
"""
from __future__ import annotations

from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Profile

DEFAULT_EST_RATING = 1200
DEFAULT_TAG_MASTERY = 0.3
RECENT_TOPICS_CAP = 5

BASE_ALPHA_SOLVE = 0.35
BASE_ALPHA_FAIL = 0.15
RATING_SCALE = 400.0
RATING_FACTOR_MIN = 0.5
RATING_FACTOR_MAX = 1.5
EST_RATING_LEARNING_RATE = 0.1

DEFAULT_PROFILE_DATA: dict[str, Any] = {
    "est_rating": DEFAULT_EST_RATING,
    "tags": {
        "dp": {"mastery": 0.42, "attempts": 5, "solved": 2, "last_seen_session": None},
        "graphs": {"mastery": 0.58, "attempts": 8, "solved": 5, "last_seen_session": None},
        "binary-search": {"mastery": 0.35, "attempts": 3, "solved": 1, "last_seen_session": None},
        "greedy": {"mastery": 0.5, "attempts": 4, "solved": 2, "last_seen_session": None},
    },
    "recent_topics": [],
}


def _default_tag() -> dict[str, Any]:
    return {"mastery": DEFAULT_TAG_MASTERY, "attempts": 0, "solved": 0, "last_seen_session": None}


def _ensure_shape(data: Optional[dict[str, Any]]) -> dict[str, Any]:
    """Fill in any missing keys so older/fixture profile rows migrate
    forward to the current shape without losing existing values."""
    data = dict(data or {})
    data.setdefault("est_rating", DEFAULT_EST_RATING)
    tags: dict[str, Any] = {}
    for tag, td in (data.get("tags") or {}).items():
        td = dict(td or {})
        td.setdefault("mastery", DEFAULT_TAG_MASTERY)
        td.setdefault("attempts", 0)
        td.setdefault("solved", 0)
        td.setdefault("last_seen_session", None)
        tags[tag] = td
    data["tags"] = tags
    data.setdefault("recent_topics", [])
    return data


def get_or_create_profile(db: Session) -> Profile:
    profile = db.get(Profile, 1)
    if profile is None:
        profile = Profile(id=1, data=_ensure_shape(DEFAULT_PROFILE_DATA))
        db.add(profile)
        db.commit()
        db.refresh(profile)
        return profile

    shaped = _ensure_shape(profile.data)
    if shaped != profile.data:
        profile.data = shaped
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return profile


def _rating_factor(problem_rating: Optional[int], est_rating: int) -> float:
    """Scales the EWMA learning rate by how far above/below the user's
    current estimate the problem sits. >1 for problems above est_rating
    (a solve there is stronger evidence of mastery / a fail there is
    weaker evidence against it), <1 below."""
    if not problem_rating:
        return 1.0
    delta = (problem_rating - est_rating) / RATING_SCALE
    return min(RATING_FACTOR_MAX, max(RATING_FACTOR_MIN, 1.0 + delta))


def _update_tag(
    tag_data: dict[str, Any], solved: bool, rating_factor: float, session_id: Optional[int]
) -> dict[str, Any]:
    mastery = tag_data.get("mastery", DEFAULT_TAG_MASTERY)
    outcome = 1.0 if solved else 0.0
    base_alpha = BASE_ALPHA_SOLVE if solved else BASE_ALPHA_FAIL
    alpha = min(0.9, max(0.02, base_alpha * rating_factor))
    new_mastery = mastery + alpha * (outcome - mastery)
    new_mastery = min(1.0, max(0.0, new_mastery))
    return {
        "mastery": round(new_mastery, 4),
        "attempts": tag_data.get("attempts", 0) + 1,
        "solved": tag_data.get("solved", 0) + (1 if solved else 0),
        "last_seen_session": session_id if session_id is not None else tag_data.get("last_seen_session"),
    }


def _apply_outcome(db: Session, problem: Any, solved: bool, session_id: Optional[int]) -> Profile:
    profile = get_or_create_profile(db)
    data = _ensure_shape(profile.data)

    tags = problem.tags or []
    rating_factor = _rating_factor(getattr(problem, "rating", None), data["est_rating"])
    for tag in tags:
        current = data["tags"].get(tag, _default_tag())
        data["tags"][tag] = _update_tag(current, solved, rating_factor, session_id)

    if solved and getattr(problem, "rating", None):
        data["est_rating"] = int(
            round(data["est_rating"] + EST_RATING_LEARNING_RATE * (problem.rating - data["est_rating"]))
        )

    if tags:
        recent = [t for t in data.get("recent_topics", []) if t not in tags]
        data["recent_topics"] = (list(tags) + recent)[:RECENT_TOPICS_CAP]

    profile.data = data  # reassign (not mutate-in-place) so SQLAlchemy's
    # JSONB change tracking picks it up.
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


def update_mastery_on_submit(
    db: Session, problem: Any, verdict: str, session_id: Optional[int] = None
) -> Profile:
    """Called by app.judge.service.submit after every judged submission."""
    return _apply_outcome(db, problem, solved=(verdict == "AC"), session_id=session_id)


def _session_has_ac(db: Session, session: Any) -> bool:
    from app.models import Submission

    row = db.execute(
        select(Submission.id).where(Submission.session_id == session.id, Submission.verdict == "AC")
    ).first()
    return row is not None


def recompute_profile(db: Session, session: Any, analysis_result: dict[str, Any]) -> Profile:
    """Analyze-time hook (Agent F calls this from POST /sessions/{id}/analyze
    after producing the Analysis JSON). Determines whether the session ever
    produced an AC submission and applies the same mastery update as
    `update_mastery_on_submit`, tagged with this session id."""
    problem = getattr(session, "problem", None)
    if problem is None:
        return get_or_create_profile(db)
    solved = _session_has_ac(db, session)
    return _apply_outcome(db, problem, solved=solved, session_id=session.id)
