"""Hand-computed unit tests for the deterministic rec-engine scorer
(app.engine.recommend.score_problem). Pure function, no DB.

Score = 0.4*weakness + 0.35*ratingFit + 0.15*staleness + 0.1*diversity
"""
from __future__ import annotations

import pytest

from app.engine.recommend import score_problem


def test_score_high_when_hard_weak_tag_matches_rating_target_and_is_recent():
    # est_rating=1200 -> rating target = 1350. Problem rating is exactly on
    # target (ratingFit=1.0). Tag "dp" mastery 0.4 (weakness=0.6). "dp" is
    # also the MOST recent topic practiced, so staleness=0 and diversity=0
    # (this pulls the overall score down despite the strong weakness/rating
    # terms -- recency/diversity intentionally discourage back-to-back
    # repeats of the same topic).
    profile_data = {
        "est_rating": 1200,
        "tags": {"dp": {"mastery": 0.4, "attempts": 3, "solved": 1, "last_seen_session": 1}},
        "recent_topics": ["dp", "graphs"],
    }
    result = score_problem(tags=["dp"], rating=1350, profile_data=profile_data)

    assert result["components"]["weakness"] == pytest.approx(0.6)
    assert result["components"]["rating_fit"] == pytest.approx(1.0)
    assert result["components"]["staleness"] == pytest.approx(0.0)
    assert result["components"]["diversity"] == pytest.approx(0.0)
    assert result["score"] == pytest.approx(0.4 * 0.6 + 0.35 * 1.0 + 0.15 * 0.0 + 0.1 * 0.0)
    assert result["score"] == pytest.approx(0.59)
    assert "dp mastery 40%" in result["why"]
    assert "rating 1350 fits your 1200+150 target" in result["why"]


def test_score_unseen_tag_far_off_rating_still_gets_staleness_and_diversity_credit():
    # Never-attempted tag ("graphs" absent from profile) defaults to
    # DEFAULT_TAG_MASTERY=0.3 -> weakness=0.7. Rating sits exactly one
    # tolerance-width (150) below target=1350, so ratingFit clamps to 0.
    # Empty recent_topics -> staleness and diversity both max out at 1.0.
    profile_data = {"est_rating": 1200, "tags": {}, "recent_topics": []}
    result = score_problem(tags=["graphs"], rating=1200, profile_data=profile_data)

    assert result["components"]["weakness"] == pytest.approx(0.7)
    assert result["components"]["rating_fit"] == pytest.approx(0.0)
    assert result["components"]["staleness"] == pytest.approx(1.0)
    assert result["components"]["diversity"] == pytest.approx(1.0)
    assert result["score"] == pytest.approx(0.4 * 0.7 + 0.35 * 0.0 + 0.15 * 1.0 + 0.1 * 1.0)
    assert result["score"] == pytest.approx(0.53)
    assert "graphs mastery 30%" in result["why"]
    assert "graphs not practiced recently" in result["why"]


def test_score_low_for_mastered_tag_way_below_rating_target():
    # Strong mastery (0.9) -> weakness=0.1. Rating (1000) is far (650) below
    # target=1650 -> ratingFit clamps to 0. Tag is the sole/most-recent
    # topic -> staleness and diversity both 0. Every term drags the score
    # down, landing near zero -- this should NOT be a top recommendation.
    profile_data = {
        "est_rating": 1500,
        "tags": {"greedy": {"mastery": 0.9, "attempts": 10, "solved": 9, "last_seen_session": 2}},
        "recent_topics": ["greedy"],
    }
    result = score_problem(tags=["greedy"], rating=1000, profile_data=profile_data)

    assert result["components"]["weakness"] == pytest.approx(0.1)
    assert result["components"]["rating_fit"] == pytest.approx(0.0)
    assert result["components"]["staleness"] == pytest.approx(0.0)
    assert result["components"]["diversity"] == pytest.approx(0.0)
    assert result["score"] == pytest.approx(0.4 * 0.1)
    assert result["score"] == pytest.approx(0.04)
