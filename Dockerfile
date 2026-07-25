# WatchMeCode — single-image deploy: FastAPI serves the API *and* the built SPA.
#
# One service instead of a split frontend/backend host means no CORS, no proxy
# rewrite, and no API-base configuration: the client's relative `/api` calls are
# same-origin by construction.

# --- Stage 1: build the frontend -------------------------------------------
FROM node:22-slim AS frontend

WORKDIR /build
# Copy manifests first so `npm ci` is cached until dependencies actually change.
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build


# --- Stage 2: runtime -------------------------------------------------------
FROM python:3.12-slim

# g++ is not a build tool here — it IS the product: the judge compiles user C++
# submissions at runtime, so it must exist in the final image, not just stage 1.
RUN apt-get update \
    && apt-get install -y --no-install-recommends g++ \
    && rm -rf /var/lib/apt/lists/*

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    FRONTEND_DIST=/app/frontend_dist

WORKDIR /app

COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/app ./app
COPY backend/seed ./seed
COPY --from=frontend /build/dist ./frontend_dist

# Judged code runs as this unprivileged user. It cannot write to /app, and the
# judge's own RLIMIT_AS/RLIMIT_CPU caps still apply on top.
RUN useradd --create-home --shell /usr/sbin/nologin runner \
    && chown -R runner:runner /app
USER runner

# Render (and most PaaS) inject the port to bind. Default matches local dev.
ENV PORT=8000
EXPOSE 8000

# Single worker on purpose: the judge forks its own process pool, and a second
# uvicorn worker would double the memory floor on a small instance.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT} --workers 1"]
