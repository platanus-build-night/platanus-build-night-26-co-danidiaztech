"""FastAPI app entrypoint. Creates tables on startup (no alembic) and wires
up all routers under /api. CORS is open to the Vite dev server (:5173).
"""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db import Base, engine
from app.routers import analysis, judge, problems, recommendations, sessions

app = FastAPI(title="CP Trainer API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    # Import models so they're registered on Base.metadata before create_all.
    from app import models  # noqa: F401

    Base.metadata.create_all(bind=engine)


@app.get("/api/health")
def health() -> dict:
    return {"ok": True}


app.include_router(problems.router, prefix="/api")
app.include_router(sessions.router, prefix="/api")
app.include_router(judge.router, prefix="/api")
app.include_router(recommendations.router, prefix="/api")
app.include_router(analysis.router, prefix="/api")
