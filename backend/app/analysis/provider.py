"""Provider abstraction — settings-row driven, NOT env driven.

Three transports, one Analysis JSON:
  * `api`   — anthropic Messages API with structured outputs (json_schema).
  * `plan`  — claude-agent-sdk query() authenticated with a Claude plan OAuth
              token, injected into that call's env only.
  * `mock`  — canned analysis; also the automatic fallback when the selected
              provider isn't configured.

Both real paths share ONE prompt builder (app.analysis.prompts) and ONE
validator (app.analysis.validator), so they cannot drift apart.
"""
from __future__ import annotations

import asyncio
import contextlib
import os
import threading
from dataclasses import dataclass
from typing import Any, Iterator

from sqlalchemy.orm import Session

from app.analysis.mock import mock_analysis
from app.analysis.prompts import build_system_prompt, build_user_prompt
from app.analysis.validator import AnalysisFormatError, analysis_json_schema, validate_analysis
from app.models import Settings

PROVIDERS = ("api", "plan", "mock")
DEFAULT_MODEL = os.getenv("ANTHROPIC_MODEL") or "claude-opus-4-8"
MAX_TOKENS = 8000
EFFORT = "medium"


class ProviderError(RuntimeError):
    """A provider call failed for a reason worth showing the user verbatim."""


@dataclass(frozen=True)
class ProviderConfig:
    provider: str
    model: str
    api_key: str | None
    oauth_token: str | None


# ------------------------------------------------------------- settings row --

def _defaults() -> dict[str, Any]:
    """Seed values for the singleton settings row.

    Credentials live in the DB, but a dev `.env` that already has a key
    shouldn't force a trip through the UI before the first analysis.
    """
    env_key = os.getenv("ANTHROPIC_API_KEY") or None
    return {
        "provider": "api" if env_key else "mock",
        "model": DEFAULT_MODEL,
        "api_key": env_key,
        "oauth_token": None,
    }


def get_or_create_settings(db: Session) -> Settings:
    row = db.get(Settings, 1)
    if row is None:
        row = Settings(id=1, data=_defaults())
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


def update_settings(db: Session, patch: dict[str, Any]) -> Settings:
    """Partial update — only keys present in `patch` are touched."""
    row = get_or_create_settings(db)
    data = dict(row.data or {})
    data.update({k: v for k, v in patch.items() if v is not None})
    row.data = data
    db.commit()
    db.refresh(row)
    return row


def load_config(db: Session) -> ProviderConfig:
    """Read the provider config at call time (never cached)."""
    data = get_or_create_settings(db).data or {}
    provider = data.get("provider") or "mock"
    if provider not in PROVIDERS:
        provider = "mock"
    return ProviderConfig(
        provider=provider,
        model=data.get("model") or DEFAULT_MODEL,
        api_key=(data.get("api_key") or None),
        oauth_token=(data.get("oauth_token") or None),
    )


def mask(value: str | None) -> str | None:
    """Credentials are never returned in full — last 4 characters only."""
    if not value:
        return None
    return "••••" + value[-4:] if len(value) > 4 else "••••"


def resolve(cfg: ProviderConfig) -> tuple[str, str | None]:
    """(effective provider, reason it differs from the selected one)."""
    if cfg.provider == "api" and not cfg.api_key:
        return "mock", "no API key set — using mock analysis"
    if cfg.provider == "plan" and not cfg.oauth_token:
        return "mock", "no plan token set — using mock analysis"
    return cfg.provider, None


def status_text(cfg: ProviderConfig) -> str:
    effective, reason = resolve(cfg)
    if reason:
        return f"Falling back to mock: {reason}."
    if effective == "mock":
        return "Mock mode — canned analysis, no API calls."
    if effective == "api":
        return f"Ready — Anthropic API, model {cfg.model}."
    return f"Ready — Claude plan (claude-agent-sdk), model {cfg.model}."


# ------------------------------------------------------------ env isolation --

_ENV_LOCK = threading.Lock()


@contextlib.contextmanager
def _plan_env(token: str) -> Iterator[dict[str, str]]:
    """Expose CLAUDE_CODE_OAUTH_TOKEN and hide ANTHROPIC_API_KEY for one call.

    The agent SDK spawns the Claude CLI, which inherits os.environ — and a
    present ANTHROPIC_API_KEY silently outranks the plan token. Options.env
    can add a variable but cannot delete an inherited one, so the process env
    is patched (under a lock) for the duration of the call and restored after.
    """
    scrub = ("ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN")
    with _ENV_LOCK:
        saved = {k: os.environ.get(k) for k in (*scrub, "CLAUDE_CODE_OAUTH_TOKEN")}
        try:
            for key in scrub:
                os.environ.pop(key, None)
            os.environ["CLAUDE_CODE_OAUTH_TOKEN"] = token
            yield {"CLAUDE_CODE_OAUTH_TOKEN": token}
        finally:
            for key, value in saved.items():
                if value is None:
                    os.environ.pop(key, None)
                else:
                    os.environ[key] = value


# ------------------------------------------------------------------- api ----

def _api_error(exc: Exception, model: str) -> str:
    import anthropic

    if isinstance(exc, anthropic.AuthenticationError):
        return "Invalid API key — Anthropic rejected the credentials."
    if isinstance(exc, anthropic.PermissionDeniedError):
        return "This API key does not have permission for that model."
    if isinstance(exc, anthropic.NotFoundError):
        return f"Model '{model}' not found for this API key."
    if isinstance(exc, anthropic.RateLimitError):
        return "Rate limited by the Anthropic API — retry in a moment."
    if isinstance(exc, anthropic.APIConnectionError):
        return "Could not reach api.anthropic.com — check your network."
    if isinstance(exc, anthropic.APIStatusError):
        return f"Anthropic API error {exc.status_code}: {exc.message}"
    return f"{type(exc).__name__}: {exc}"


def _api_client(cfg: ProviderConfig):
    import anthropic

    if not cfg.api_key:
        raise ProviderError("No API key set. Add one in Settings or switch to Mock.")
    return anthropic.Anthropic(api_key=cfg.api_key)


def _text_of(response: Any) -> str:
    return "".join(b.text for b in response.content if getattr(b, "type", None) == "text")


def _call_api(cfg: ProviderConfig, system: str, user: str) -> dict[str, Any]:
    import anthropic

    client = _api_client(cfg)
    kwargs: dict[str, Any] = {
        "model": cfg.model,
        "max_tokens": MAX_TOKENS,
        "system": system,
        "messages": [{"role": "user", "content": user}],
        "thinking": {"type": "adaptive"},
        "output_config": {
            "effort": EFFORT,
            "format": {"type": "json_schema", "schema": analysis_json_schema()},
        },
    }
    try:
        response = client.messages.create(**kwargs)
    except anthropic.BadRequestError:
        # Model or account without structured-output support: same prompt,
        # plain JSON reply, same validator.
        kwargs["output_config"] = {"effort": EFFORT}
        try:
            response = client.messages.create(**kwargs)
        except Exception as exc:  # noqa: BLE001 - surfaced to the UI verbatim
            raise ProviderError(_api_error(exc, cfg.model)) from exc
    except Exception as exc:  # noqa: BLE001
        raise ProviderError(_api_error(exc, cfg.model)) from exc

    return validate_analysis(_text_of(response))


# ------------------------------------------------------------------ plan ----

JSON_ONLY_SUFFIX = (
    "\n\nIMPORTANT: reply with the raw JSON object only. No tool use, no file reads, "
    "no markdown fences, no text before or after the JSON."
)


def _plan_text(cfg: ProviderConfig, system: str, user: str) -> str:
    try:
        from claude_agent_sdk import (
            AssistantMessage,
            ClaudeAgentOptions,
            ResultMessage,
            TextBlock,
            query,
        )
    except ImportError as exc:
        raise ProviderError(
            "claude-agent-sdk is not installed — run `pip install claude-agent-sdk`."
        ) from exc

    if not cfg.oauth_token:
        raise ProviderError(
            "No plan token set. Run `claude setup-token` and paste the token in Settings."
        )

    async def _run() -> str:
        options = ClaudeAgentOptions(
            system_prompt=system,
            model=cfg.model,
            max_turns=1,
            allowed_tools=[],
            permission_mode="dontAsk",
            setting_sources=[],
            env={"CLAUDE_CODE_OAUTH_TOKEN": cfg.oauth_token or ""},
        )
        chunks: list[str] = []
        result_text = ""
        async for message in query(prompt=user + JSON_ONLY_SUFFIX, options=options):
            if isinstance(message, AssistantMessage):
                chunks += [b.text for b in message.content if isinstance(b, TextBlock)]
            elif isinstance(message, ResultMessage):
                if message.is_error:
                    raise ProviderError(f"Claude plan call failed: {message.result or 'unknown error'}")
                result_text = message.result or ""
        return result_text or "".join(chunks)

    try:
        with _plan_env(cfg.oauth_token):
            return asyncio.run(_run())
    except ProviderError:
        raise
    except Exception as exc:  # noqa: BLE001
        name = type(exc).__name__
        if name == "CLINotFoundError":
            raise ProviderError(
                "Claude Code CLI not found — install it, then run `claude setup-token`."
            ) from exc
        raise ProviderError(f"Claude plan call failed ({name}): {exc}") from exc


def _call_plan(cfg: ProviderConfig, system: str, user: str) -> dict[str, Any]:
    raw = _plan_text(cfg, system, user)
    try:
        return validate_analysis(raw)
    except AnalysisFormatError:
        # One retry, same prompt plus a corrective nudge (contract: retry once).
        retry = (
            user
            + "\n\nYour previous reply did not match the required shape. Return ONLY the JSON "
            "object, using exactly the keys and casing from the output shape in your "
            "instructions (startSec/endSec/atSec, strengths as plain strings, drills with "
            "title/why). No extra keys, no prose, no fences."
        )
        return validate_analysis(_plan_text(cfg, system, retry))


# ------------------------------------------------------------------ public --

def generate_analysis(
    cfg: ProviderConfig,
    ctx: dict[str, Any],
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Run one analysis. Returns (analysis json, provider label for features)."""
    effective, reason = resolve(cfg)
    label: dict[str, Any] = {
        "requested": cfg.provider,
        "provider": effective,
        "model": cfg.model if effective != "mock" else None,
    }
    if reason:
        label["fallback_reason"] = reason

    if effective == "mock":
        return mock_analysis(ctx.get("session", {}).get("duration_sec")), label

    system = build_system_prompt()
    user = build_user_prompt(ctx)
    try:
        result = _call_api(cfg, system, user) if effective == "api" else _call_plan(cfg, system, user)
    except (ProviderError, AnalysisFormatError) as exc:
        label["provider"] = "mock"
        label["fallback_reason"] = str(exc)
        return mock_analysis(ctx.get("session", {}).get("duration_sec")), label
    return result, label


def test_connection(cfg: ProviderConfig) -> dict[str, Any]:
    """Cheap live call through the SELECTED provider (not the fallback)."""
    out: dict[str, Any] = {"ok": False, "provider": cfg.provider, "model": cfg.model}

    if cfg.provider == "mock":
        return {**out, "ok": True, "model": None}

    if cfg.provider == "api":
        try:
            client = _api_client(cfg)
            client.messages.create(
                model=cfg.model,
                max_tokens=16,
                thinking={"type": "disabled"},
                messages=[{"role": "user", "content": "Reply OK."}],
            )
        except ProviderError as exc:
            return {**out, "error": str(exc)}
        except Exception as exc:  # noqa: BLE001
            return {**out, "error": _api_error(exc, cfg.model)}
        return {**out, "ok": True}

    try:
        text = _plan_text(cfg, "Reply with exactly: OK", "Reply OK.")
    except ProviderError as exc:
        return {**out, "error": str(exc)}
    except Exception as exc:  # noqa: BLE001
        return {**out, "error": f"{type(exc).__name__}: {exc}"}
    if not text.strip():
        return {**out, "error": "Claude plan returned an empty response."}
    return {**out, "ok": True}
