# Deploying WatchMeCode

**One service on Render.** FastAPI serves the API *and* the built frontend from the
same origin, so there's no CORS config, no proxy rewrite, and no API-base variable to
keep in sync. The Blueprint provisions Postgres and injects `DATABASE_URL` itself.

Verified locally against Render's actual free-tier constraints (512 MB RAM, ~0.5 vCPU)
before writing this — see [Verified numbers](#verified-numbers).

---

## 1. Push to a repo you own

Render can only deploy from a repository **you** own — it can't be granted access to the
organization repo. Mirror to a personal repo and push to both:

```bash
gh repo create watchmecode --public --source=. --remote=personal
git remote set-url --add --push origin git@github.com:platanus-build-night/platanus-build-night-26-co-danidiaztech.git
git remote set-url --add --push origin git@github.com:<your-user>/watchmecode.git
git push personal HEAD:main
```

From then on a single `git push` updates both repos.

## 2. Create the Blueprint on Render

1. Sign in at [render.com](https://render.com) with GitHub (no credit card for free tier).
2. **New → Blueprint**, pick the personal repo. Render reads `render.yaml` and shows one
   web service plus one Postgres database.
3. **Apply.** First build takes ~5 min (it compiles the frontend and installs `g++`).

Nothing to configure by hand — `render.yaml` already pins `DATABASE_URL` and the judge
tuning below.

## 3. Seed the problems

The database starts empty; tables are created automatically on first boot but the 51
problems are not. From the Render dashboard open the service's **Shell** and run:

```bash
python seed/seed.py
```

It's idempotent — safe to re-run. Verify with `curl https://<your-app>.onrender.com/api/problems`.

## 4. Connect Claude

Open the deployed app → **Settings** → choose **API key** and paste an Anthropic key (or
**Claude Plan** with a `claude setup-token` token) → **Test connection**.

The key lives in your deployed database, not in the repo or in an env var. Until it's
set the app runs in **Mock** mode and is fully usable — every feature except a real
analysis works without any AI configured.

---

## Judge tuning (already set in `render.yaml`)

The judge compiles and runs untrusted code, so it needs limits calibrated to the host —
these are the difference between a working deploy and an OOM-killed one:

| Variable | Value | Why |
|---|---|---|
| `JUDGE_MAX_WORKERS` | `1` | `os.cpu_count()` reports the **host's** cores inside a container. Left alone the judge would fan out 4 concurrent submissions on a 512 MB box and get the service killed. |
| `JUDGE_MEMORY_CAP_MB` | `192` | Clamps each problem's 256 MB allowance to something that fits alongside uvicorn and a ~190 MB `g++` compile. |
| `JUDGE_TIME_SCALE` | `4` | Shared CPU runs an honest solution several times slower than the machine these limits were calibrated on. Without slack, correct code gets a false TLE. |
| `JUDGE_COMPILE_TIMEOUT_S` | `60` | Same reason, for compilation. |

Raise `JUDGE_MAX_WORKERS` if you move to a paid instance with real cores.

## Verified numbers

Measured by building the production image and running it under Render-equivalent limits
(`--memory=512m --cpus=0.5`):

| Check | Result |
|---|---|
| `/api/health`, `/api/problems`, `/`, `/about` deep link, `/favicon.svg` | all **200** |
| Python custom run | **18 ms** |
| C++ custom run (cold `bits/stdc++.h` compile) | **3.4 s** |
| Full C++ submit, 20 tests | **AC, 3.5 s** |
| Peak container memory | **83 MB / 512 MB (16%)** |
| OOM kills / restarts | **none** |

C++ compilation was the main risk going in; it fits comfortably. The binary is cached by
content hash, so repeat submissions of the same source skip the compile entirely.

## Known free-tier behaviour

- **Cold starts.** Free services sleep after ~15 min idle; the next request takes ~50 s to
  wake. Before demoing, open the app once a minute beforehand.
- **Database expiry.** Render's free Postgres expires after **90 days**. Fine for judging;
  for anything longer, swap in a [Neon](https://neon.tech) free database (no expiry) by
  replacing `DATABASE_URL` — no code change needed.
- **Ephemeral disk.** The compile cache lives in `/tmp` and is wiped on redeploy. Only
  effect: the first submission after a deploy pays the compile cost again.

## Local production check

To reproduce the verification above before pushing:

```bash
docker build -t watchmecode .
docker run --rm -p 8099:8000 --memory=512m --cpus=0.5 \
  -e DATABASE_URL="postgresql+psycopg://trainer:trainer@host.docker.internal:5433/trainer" \
  -e JUDGE_MAX_WORKERS=1 -e JUDGE_MEMORY_CAP_MB=192 -e JUDGE_TIME_SCALE=4 \
  --add-host=host.docker.internal:host-gateway \
  watchmecode
```
