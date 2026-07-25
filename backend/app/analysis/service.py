"""The analyze flow: session -> features -> provider -> validate -> persist.

Idempotent: re-analysing a session replaces its `analyses` row. The provider
label is stored inside `analyses.features` for traceability, never inside the
Analysis result itself.
"""
from __future__ import annotations

import logging
from typing import Any

from sqlalchemy.orm import Session

from app.analysis.context import build_context
from app.analysis.features_fallback import fallback_features, merge_features
from app.analysis.provider import generate_analysis, load_config
from app.models import Analysis, SessionModel

log = logging.getLogger(__name__)


class SessionNotFound(LookupError):
    pass


def _features(events: list[dict[str, Any]]) -> dict[str, Any]:
    """Deterministic features: the real extractor if it works, ours to fill gaps."""
    primary: dict[str, Any] | None = None
    try:
        from app.features.extract import extract_features

        primary = extract_features(events)
    except Exception:  # noqa: BLE001 - extractor is another agent's module
        log.warning("feature extractor unavailable; using fallback", exc_info=True)
    return merge_features(primary, fallback_features(events))


def _profile_data(db: Session) -> dict[str, Any]:
    try:
        from app.engine.profile import get_or_create_profile

        return get_or_create_profile(db).data or {}
    except Exception:  # noqa: BLE001
        log.warning("profile unavailable; analysing without it", exc_info=True)
        return {}


def _update_profile(db: Session, session: SessionModel, result: dict[str, Any]) -> None:
    try:
        from app.engine.profile import recompute_profile

        recompute_profile(db, session, result)
    except Exception:  # noqa: BLE001 - never fail an analysis on the profile hook
        log.warning("profile recompute failed", exc_info=True)


def run_analysis(db: Session, session_id: int) -> dict[str, Any]:
    session = db.get(SessionModel, session_id)
    if session is None:
        raise SessionNotFound(session_id)

    events = [
        {"t_ms": e.t_ms, "kind": e.kind, "payload": e.payload} for e in session.events
    ]
    features = _features(events)
    ctx = build_context(session, events, session.problem, features, _profile_data(db))

    result, label = generate_analysis(load_config(db), ctx)
    features = {**features, "_provider": label}

    row = db.query(Analysis).filter(Analysis.session_id == session_id).one_or_none()
    if row is None:
        db.add(Analysis(session_id=session_id, features=features, result=result))
    else:
        row.features = features
        row.result = result
    db.commit()

    _update_profile(db, session, result)
    return result
