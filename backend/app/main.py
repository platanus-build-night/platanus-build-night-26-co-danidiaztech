"""FastAPI app entrypoint. Creates tables on startup (no alembic) and wires
up all routers under /api.

In development the Vite dev server (:5173) proxies /api here, so CORS is opened
for it. In production the built frontend is served by THIS app from
`FRONTEND_DIST` — same origin, so no CORS is involved at all and the client's
relative `/api` calls work untouched.
"""
from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.db import Base, engine
from app.routers import analysis, judge, problems, recommendations, sessions, settings

app = FastAPI(title="WatchMeCode API")

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
app.include_router(settings.router, prefix="/api")


# --------------------------------------------------------------- frontend --
# Mounted LAST so every /api route above wins the match first. Absent in local
# development (no build directory) — the Vite dev server handles the UI there.
_dist = Path(os.getenv("FRONTEND_DIST") or "/app/frontend_dist")

if _dist.is_dir():
    # Hashed build assets: immutable, so let the browser cache them hard.
    app.mount("/assets", StaticFiles(directory=_dist / "assets"), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa(full_path: str) -> FileResponse:
        """Serve the SPA, letting client-side routing own the URL space.

        A hard refresh on /about or /review/3 must return index.html rather than
        404, since those routes only exist in the browser. Real files (favicon,
        the timeline screenshot) are served directly when they exist.
        """
        candidate = _dist / full_path
        if full_path and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(_dist / "index.html")
