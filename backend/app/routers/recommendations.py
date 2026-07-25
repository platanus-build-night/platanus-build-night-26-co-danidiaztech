"""/recommendations — delegates to app.engine.recommend (Agent E, stub)."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.engine import recommend as recommend_engine
from app.schemas import Recommendation

router = APIRouter(tags=["recommendations"])


@router.get("/recommendations", response_model=list[Recommendation])
def get_recommendations(db: Session = Depends(get_db)) -> list[dict]:
    return recommend_engine.recommend(db)
