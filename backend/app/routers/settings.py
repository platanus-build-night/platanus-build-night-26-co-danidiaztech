"""/settings — AI provider configuration (single-user, no auth).

Credentials are stored plaintext in the local DB but are never returned in
full: GET masks them to their last 4 characters.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.analysis.provider import (
    PROVIDERS,
    load_config,
    mask,
    status_text,
    test_connection,
    update_settings,
)
from app.db import get_db
from app.schemas import SettingsOut, SettingsTestResult, SettingsUpdate

router = APIRouter(tags=["settings"])


def _out(db: Session) -> SettingsOut:
    cfg = load_config(db)
    return SettingsOut(
        provider=cfg.provider,
        model=cfg.model,
        api_key_masked=mask(cfg.api_key),
        oauth_token_masked=mask(cfg.oauth_token),
        status=status_text(cfg),
    )


@router.get("/settings", response_model=SettingsOut)
def get_settings(db: Session = Depends(get_db)) -> SettingsOut:
    return _out(db)


@router.put("/settings", response_model=SettingsOut)
def put_settings(payload: SettingsUpdate, db: Session = Depends(get_db)) -> SettingsOut:
    if payload.provider is not None and payload.provider not in PROVIDERS:
        raise HTTPException(status_code=400, detail=f"provider must be one of {PROVIDERS}")
    update_settings(db, payload.model_dump(exclude_none=True))
    return _out(db)


@router.post("/settings/test", response_model=SettingsTestResult)
def post_settings_test(db: Session = Depends(get_db)) -> SettingsTestResult:
    return SettingsTestResult(**test_connection(load_config(db)))
