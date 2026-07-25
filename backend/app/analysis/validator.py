"""One validator for every provider path (parity guarantee).

Both real providers hand their raw output here; whatever comes back is a dict
that already satisfies `app.schemas.AnalysisResult`, so the route's response
model can never be the thing that fails.
"""
from __future__ import annotations

import json
from typing import Any

from pydantic import ValidationError

from app.schemas import AnalysisResult


class AnalysisFormatError(ValueError):
    """The model returned something that isn't a valid Analysis JSON object."""


def _strict(node: Any) -> Any:
    """Make a pydantic JSON schema acceptable as a structured-output schema.

    Structured outputs require `additionalProperties: false` and every property
    listed in `required`; annotations like `title`/`default` are dropped.
    """
    if isinstance(node, list):
        return [_strict(x) for x in node]
    if not isinstance(node, dict):
        return node

    out: dict[str, Any] = {}
    for key, value in node.items():
        if key in ("properties", "$defs") and isinstance(value, dict):
            # These keys map *names* to schemas — never treat a name as a keyword.
            out[key] = {name: _strict(sub) for name, sub in value.items()}
        elif key in ("title", "default"):
            continue
        else:
            out[key] = _strict(value)

    if out.get("type") == "object" and "properties" in out:
        out["additionalProperties"] = False
        out["required"] = list(out["properties"].keys())
    return out


def analysis_json_schema() -> dict[str, Any]:
    """JSON Schema for the Analysis object, for the API structured-output path."""
    return _strict(AnalysisResult.model_json_schema())


def _extract_json_object(text: str) -> dict[str, Any]:
    """Pull the JSON object out of a model reply that may have wrapping."""
    text = text.strip()
    if text.startswith("```"):
        text = text.split("```", 2)[1]
        if text.lstrip().lower().startswith("json"):
            text = text.lstrip()[4:]
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end <= start:
        raise AnalysisFormatError("no JSON object found in model output")
    try:
        parsed = json.loads(text[start : end + 1])
    except json.JSONDecodeError as exc:
        raise AnalysisFormatError(f"model output is not valid JSON: {exc}") from exc
    if not isinstance(parsed, dict):
        raise AnalysisFormatError("model output is not a JSON object")
    return parsed


PHASE_LABELS = ("reading", "thinking", "coding", "debugging", "stuck")
MARKER_KINDS = ("aha", "hesitation", "wrong-turn")
# The model occasionally reaches for a marker kind as a phase label. `schemas.Phase`
# types these as plain strings, so nothing else catches it, and the review player
# colours phases by label — an unknown one renders as a hole in the timeline.
_PHASE_ALIASES = {"wrong-turn": "coding", "aha": "thinking", "hesitation": "thinking"}


def validate_analysis(raw: str | dict[str, Any]) -> dict[str, Any]:
    """Parse + validate + normalise into the contract's Analysis JSON shape."""
    data = raw if isinstance(raw, dict) else _extract_json_object(raw)
    try:
        result = AnalysisResult.model_validate(data)
    except ValidationError as exc:
        raise AnalysisFormatError(f"analysis failed schema validation: {exc}") from exc

    for phase in result.phases:
        if phase.label not in PHASE_LABELS:
            phase.label = _PHASE_ALIASES.get(phase.label, "coding")
    for marker in result.markers:
        if marker.kind not in MARKER_KINDS:
            marker.kind = "hesitation"

    # The Aha-Gap is the product's headline stat — keep it arithmetically
    # honest rather than trusting the model's subtraction.
    if result.ahaMomentSec is None or result.firstCorrectCodeSec is None:
        result.ahaGapSeconds = None
    else:
        result.ahaGapSeconds = result.firstCorrectCodeSec - result.ahaMomentSec

    return result.model_dump()
