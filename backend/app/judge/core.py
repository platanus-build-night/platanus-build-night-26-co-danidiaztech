"""Pure sandboxed code runner. Owned by Agent B.

Implements CONTRACTS.md's Judge spec: subprocess execution of `python3` /
`g++ -O2 -std=c++17` (compiled once, cached by source hash so repeated
calls for the same submission's test cases don't recompile), RLIMIT_AS
(memory_limit_mb + 64MB slack) + RLIMIT_CPU via `resource.setrlimit`,
wall-clock `timeout=time_limit_ms*mult` (python mult 3x, cpp mult 1x),
killing the whole process group on timeout.

This module is intentionally stdlib-only and free of any app/DB
dependencies so it can be imported both by `backend/app/judge/service.py`
(Agent E — verdict comparison, parallel execution, early-stop-on-first-fail;
extend that module, don't rewrite this split) and by
`backend/seed/validate.py` (Agent B) to validate seeded problems against
their reference solutions before they ever hit the API.
"""
from __future__ import annotations

import hashlib
import os
import resource
import signal
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from typing import TypedDict

MEM_SLACK_MB = 64
COMPILE_TIMEOUT_S = int(os.getenv("JUDGE_COMPILE_TIMEOUT_S") or 20)

# Deployment tunables. A shared-CPU host (Render free is ~0.1 vCPU) runs an
# honest solution many times slower than the desktop the limits were calibrated
# on, which manufactures TLEs on correct code. `JUDGE_TIME_SCALE` widens every
# wall-clock budget without touching the problems' stated limits, and
# `JUDGE_MEMORY_CAP_MB` clamps a problem's 256 MB allowance down to something a
# 512 MB container can actually survive.
_TIME_SCALE = float(os.getenv("JUDGE_TIME_SCALE") or 1.0)
PY_TIMEOUT_MULT = 3 * _TIME_SCALE
CPP_TIMEOUT_MULT = 1 * _TIME_SCALE

_MEMORY_CAP_MB = int(os.getenv("JUDGE_MEMORY_CAP_MB") or 0)


def effective_memory_mb(memory_limit_mb: int) -> int:
    """A problem's memory allowance, clamped by any deployment cap."""
    if _MEMORY_CAP_MB > 0:
        return min(memory_limit_mb, _MEMORY_CAP_MB)
    return memory_limit_mb

_CACHE_DIR = Path(tempfile.gettempdir()) / "cptrainer_judge_cache"
_CACHE_DIR.mkdir(exist_ok=True)

PYTHON_ALIASES = {"python", "python3", "py", "py3"}
CPP_ALIASES = {"cpp", "c++", "gpp", "g++"}


class ExecResult(TypedDict):
    stdout: str
    stderr: str
    time_ms: int
    returncode: int
    timed_out: bool
    compile_ok: bool
    compile_error: str


def _ok_result(stdout: str, stderr: str, time_ms: float, returncode: int) -> ExecResult:
    return {
        "stdout": stdout,
        "stderr": stderr,
        "time_ms": int(round(time_ms)),
        "returncode": returncode,
        "timed_out": False,
        "compile_ok": True,
        "compile_error": "",
    }


def _timeout_result(time_ms: float) -> ExecResult:
    return {
        "stdout": "",
        "stderr": "",
        "time_ms": int(round(time_ms)),
        "returncode": -1,
        "timed_out": True,
        "compile_ok": True,
        "compile_error": "",
    }


def _compile_error_result(message: str) -> ExecResult:
    return {
        "stdout": "",
        "stderr": message,
        "time_ms": 0,
        "returncode": -1,
        "timed_out": False,
        "compile_ok": False,
        "compile_error": message,
    }


def _set_limits(memory_limit_mb: int, cpu_limit_s: int):
    """Returns a preexec_fn: new process group + RLIMIT_AS/RLIMIT_CPU."""

    def _apply():
        os.setsid()
        mem_bytes = (effective_memory_mb(memory_limit_mb) + MEM_SLACK_MB) * 1024 * 1024
        try:
            resource.setrlimit(resource.RLIMIT_AS, (mem_bytes, mem_bytes))
        except (ValueError, OSError):
            pass
        try:
            resource.setrlimit(resource.RLIMIT_CPU, (cpu_limit_s, cpu_limit_s))
        except (ValueError, OSError):
            pass

    return _apply


def _kill_process_group(proc: subprocess.Popen) -> None:
    try:
        os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
    except (ProcessLookupError, PermissionError):
        pass
    try:
        proc.wait(timeout=2)
    except Exception:
        pass


def _run_subprocess(cmd: list[str], stdin: str, wall_timeout_s: float, memory_limit_mb: int) -> ExecResult:
    cpu_limit_s = max(1, int(wall_timeout_s) + 1)
    start = time.monotonic()
    try:
        proc = subprocess.Popen(
            cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            preexec_fn=_set_limits(memory_limit_mb, cpu_limit_s),
            text=True,
        )
    except OSError as e:
        return _compile_error_result(f"failed to start process: {e}")

    try:
        stdout, stderr = proc.communicate(input=stdin, timeout=wall_timeout_s)
    except subprocess.TimeoutExpired:
        _kill_process_group(proc)
        elapsed_ms = (time.monotonic() - start) * 1000
        return _timeout_result(elapsed_ms)

    elapsed_ms = (time.monotonic() - start) * 1000
    return _ok_result(stdout or "", stderr or "", elapsed_ms, proc.returncode)


def _compile_cpp(code: str) -> tuple[str | None, str]:
    """Compile C++ source, cached by content hash. Returns (binary_path, error)."""
    digest = hashlib.sha256(code.encode("utf-8", errors="replace")).hexdigest()[:24]
    binary_path = _CACHE_DIR / f"cpp_{digest}"
    if binary_path.exists():
        return str(binary_path), ""

    src_path = _CACHE_DIR / f"cpp_{digest}.cpp"
    src_path.write_text(code)
    try:
        proc = subprocess.run(
            ["g++", "-O2", "-std=c++17", "-o", str(binary_path), str(src_path)],
            capture_output=True,
            text=True,
            timeout=COMPILE_TIMEOUT_S,
        )
    except subprocess.TimeoutExpired:
        return None, "compilation timed out"
    finally:
        try:
            src_path.unlink(missing_ok=True)
        except Exception:
            pass

    if proc.returncode != 0:
        return None, proc.stderr
    return str(binary_path), ""


def compile_cpp(code: str) -> tuple[str | None, str]:
    """Public wrapper around the content-hash-cached cpp compiler (Agent E
    extension point). Lets callers compile a submission's source ONCE up
    front — before fanning per-test runs out across a ProcessPoolExecutor —
    so (a) CE can be surfaced immediately without running any tests, and
    (b) parallel workers never race to compile the same binary (they just
    hit the on-disk cache `_compile_cpp` already maintains). Returns
    (binary_path, error); error is the raw compiler stderr on failure.
    """
    return _compile_cpp(code)


def _run_python(code: str, stdin: str, time_limit_ms: int, memory_limit_mb: int) -> ExecResult:
    digest = hashlib.sha256(code.encode("utf-8", errors="replace")).hexdigest()[:24]
    src_path = _CACHE_DIR / f"py_{digest}.py"
    if not src_path.exists():
        src_path.write_text(code)
    wall_timeout_s = (time_limit_ms * PY_TIMEOUT_MULT) / 1000.0
    return _run_subprocess([sys.executable or "python3", str(src_path)], stdin, wall_timeout_s, memory_limit_mb)


def _run_cpp(code: str, stdin: str, time_limit_ms: int, memory_limit_mb: int) -> ExecResult:
    binary_path, err = _compile_cpp(code)
    if binary_path is None:
        return _compile_error_result(err)
    wall_timeout_s = (time_limit_ms * CPP_TIMEOUT_MULT) / 1000.0
    return _run_subprocess([binary_path], stdin, wall_timeout_s, memory_limit_mb)


def execute(
    language: str,
    code: str,
    stdin: str,
    time_limit_ms: int,
    memory_limit_mb: int,
) -> ExecResult:
    """Run `code` in `language` against `stdin`, enforcing time/memory limits.

    Returns an ExecResult: `timed_out` True => TLE; `compile_ok` False =>
    CE (cpp only, `compile_error` has the compiler message); otherwise
    `returncode` non-zero => RE. Callers own the AC/WA decision by comparing
    `stdout` against expected output (see `compare_output` below).
    """
    lang = (language or "").strip().lower()
    if lang in PYTHON_ALIASES:
        return _run_python(code, stdin, time_limit_ms, memory_limit_mb)
    if lang in CPP_ALIASES:
        return _run_cpp(code, stdin, time_limit_ms, memory_limit_mb)
    return _compile_error_result(f"unsupported language: {language!r}")


def compare_output(actual: str, expected: str) -> bool:
    """Token-wise, whitespace- and trailing-newline-insensitive comparison."""
    return actual.split() == expected.split()


def verdict_for(result: ExecResult, expected: str) -> str:
    """Map an ExecResult (+ expected output) to a CONTRACTS.md verdict."""
    if not result["compile_ok"]:
        return "CE"
    if result["timed_out"]:
        return "TLE"
    if result["returncode"] != 0:
        return "RE"
    if compare_output(result["stdout"], expected):
        return "AC"
    return "WA"
