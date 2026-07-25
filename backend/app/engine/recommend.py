"""Deterministic recommendation engine — owned by Agent E. Zero AI.

Score(problem) = 0.4*weakness + 0.35*ratingFit + 0.15*staleness + 0.1*diversity
(CONTRACTS.md's rec engine spec), against `profile.data` (see
`app.engine.profile`), excluding already-solved problems. Top 3 returned
with human-readable `why` chips.

The scoring itself lives in the pure, DB-free `score_problem(tags, rating,
profile_data)` so it can be hand-verified in `backend/tests/test_recommend.py`
without spinning up a database. `recommend(db)` is the thin DB-facing
wrapper that feeds it real problems/profile data.

Term definitions (each in [0, 1]):
  - weakness: mean(1 - mastery) over the problem's tags. An unseen tag
    defaults to DEFAULT_TAG_MASTERY (0.3), so untouched topics read as
    moderately weak rather than as strong.
  - ratingFit: triangular falloff around target = est_rating + 150, zero
    once |rating - target| >= 150 (the contract's "±150" tolerance).
  - staleness: for each tag, 1.0 if it never appears in recent_topics
    (never practiced recently -> maximally stale, i.e. a good resurfacing
    candidate), else its normalized position in recent_topics (0.0 = most
    recent). Mean over the problem's tags.
  - diversity: 1 minus the fraction of the problem's tags equal to the
    single most-recent topic — rewards problems that break from what was
    just practiced.
"""
from __future__ import annotations

from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.engine.profile import DEFAULT_TAG_MASTERY, get_or_create_profile
from app.models import Problem, Submission

W_WEAKNESS = 0.4
W_RATING = 0.35
W_STALENESS = 0.15
W_DIVERSITY = 0.1

RATING_TARGET_OFFSET = 150
RATING_TOLERANCE = 150
UNRATED_RATING_FIT = 0.3  # neutral-ish score when a candidate has no rating


def _weakness(tags: list[str], tag_data: dict[str, Any]) -> tuple[float, Optional[str], float]:
    if not tags:
        return 0.5, None, DEFAULT_TAG_MASTERY
    masteries = [(t, tag_data.get(t, {}).get("mastery", DEFAULT_TAG_MASTERY)) for t in tags]
    weakest_tag, weakest_mastery = min(masteries, key=lambda x: x[1])
    weakness = sum(1.0 - m for _, m in masteries) / len(masteries)
    return weakness, weakest_tag, weakest_mastery


def _rating_fit(rating: Optional[int], est_rating: int) -> float:
    if rating is None:
        return UNRATED_RATING_FIT
    target = est_rating + RATING_TARGET_OFFSET
    return max(0.0, 1.0 - abs(rating - target) / RATING_TOLERANCE)


def _staleness(tags: list[str], recent_topics: list[str]) -> tuple[float, Optional[str]]:
    if not tags:
        return 0.5, None
    if not recent_topics:
        return 1.0, tags[0]
    n = len(recent_topics)
    scores: list[float] = []
    stalest_tag, stalest_score = None, -1.0
    for tag in tags:
        score = (recent_topics.index(tag) / n) if tag in recent_topics else 1.0
        scores.append(score)
        if score > stalest_score:
            stalest_score, stalest_tag = score, tag
    return sum(scores) / len(scores), stalest_tag


def _diversity(tags: list[str], recent_topics: list[str]) -> float:
    if not tags:
        return 0.5
    if not recent_topics:
        return 1.0
    last = recent_topics[0]
    overlap = sum(1 for t in tags if t == last) / len(tags)
    return 1.0 - overlap


def score_problem(tags: list[str], rating: Optional[int], profile_data: dict[str, Any]) -> dict[str, Any]:
    """Pure scoring function — no DB. `profile_data` is a `profile.data`-
    shaped dict (see app.engine.profile): {est_rating, tags, recent_topics}."""
    est_rating = profile_data.get("est_rating", 1200)
    tag_data = profile_data.get("tags", {})
    recent_topics = profile_data.get("recent_topics", [])

    weakness, weakest_tag, weakest_mastery = _weakness(tags, tag_data)
    rating_fit = _rating_fit(rating, est_rating)
    staleness, stale_tag = _staleness(tags, recent_topics)
    diversity = _diversity(tags, recent_topics)

    score = W_WEAKNESS * weakness + W_RATING * rating_fit + W_STALENESS * staleness + W_DIVERSITY * diversity

    why: list[str] = []
    if weakest_tag:
        why.append(f"{weakest_tag} mastery {round(weakest_mastery * 100)}%")
    if rating is not None:
        why.append(f"rating {rating} fits your {est_rating}+150 target")
    if stale_tag and staleness >= 0.5:
        why.append(f"{stale_tag} not practiced recently")
    if not why:
        why.append("balanced pick across your profile")

    return {
        "score": round(score, 4),
        "why": why[:3],
        "components": {
            "weakness": round(weakness, 4),
            "rating_fit": round(rating_fit, 4),
            "staleness": round(staleness, 4),
            "diversity": round(diversity, 4),
        },
    }


def recommend(db: Session, top_n: int = 3) -> list[dict[str, Any]]:
    profile = get_or_create_profile(db)
    profile_data = profile.data or {}

    solved_ids = {
        row[0] for row in db.execute(select(Submission.problem_id).where(Submission.verdict == "AC")).all()
    }
    problems = db.execute(select(Problem)).scalars().all()
    candidates = [p for p in problems if p.id not in solved_ids]

    scored = []
    for p in candidates:
        tags = p.tags or []
        scored_entry = score_problem(tags, p.rating, profile_data)
        scored.append((scored_entry["score"], p, scored_entry["why"]))

    scored.sort(key=lambda x: x[0], reverse=True)

    out: list[dict[str, Any]] = []
    for score, p, why in scored[:top_n]:
        out.append(
            {
                "problem": {
                    "id": p.id,
                    "title": p.title,
                    "tags": p.tags or [],
                    "rating": p.rating,
                    "solved": False,
                },
                "score": score,
                "why": why,
            }
        )
    return out
