"""Metaphor engine for the AI Study Buddy feature.

Priority chain:
1. Call Google Gemini Flash via google-genai SDK using GEMINI_API_KEY.
2. On any failure (missing key, rate limit, network error), fall back to
   the local analogies table in SQLite.

Zero unhandled 500 errors: all failures are caught and degraded gracefully.
"""

from __future__ import annotations

import json
import os
import re

import httpx

from backend.database import db_connection
from backend.models import BuddyResponse

# ---------------------------------------------------------------------------
# Prompt template
# ---------------------------------------------------------------------------

_SYSTEM_PROMPT = (
    "You are Preceptor Nexus, an AI study buddy for African learners preparing "
    "for the Microsoft AZ-900 Azure Fundamentals exam. "
    "Explain Azure cloud concepts using vivid regional African analogies - "
    "draw on everyday experiences like M-Pesa mobile money, boda boda motorcycle taxis, "
    "matatu commuter minibuses, maize granaries, SACCO credit unions, Kenyan power grid substations "
    "and devolved county governance. "
    "Keep explanations grounded, friendly and exam-focused. "
    "Respond strictly in JSON with keys: topic, azure_service, metaphor_title, analogy_text. "
    "No additional keys. No markdown formatting around the JSON block."
)

_USER_TEMPLATE = "Explain this Azure concept with an African analogy: {query}"

# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------


async def explain_topic(query: str) -> BuddyResponse:
    """Return an analogy for the given query.

    Attempts Gemini AI first. Falls back to SQLite seed data on any error.

    Args:
        query: Natural language topic from the learner.

    Returns:
        BuddyResponse with source flag set to 'ai_generated' or 'seed_fallback'.
    """
    api_key = os.environ.get("GEMINI_API_KEY", "").strip()

    if api_key:
        try:
            return await _call_gemini(api_key, query)
        except Exception as exc:  # noqa: BLE001
            print(f"[ai_proxy] Gemini call failed ({type(exc).__name__}: {exc}). "
                  "Falling back to seed database.")

    return _seed_fallback(query)


# ---------------------------------------------------------------------------
# Gemini implementation
# ---------------------------------------------------------------------------

_GEMINI_MODELS = [
    "gemini-2.5-flash-lite",   # accessible to all API key tiers
    "gemini-3-flash-preview",  # next generation preview
    "gemini-flash-lite-latest",
    "gemini-2.5-flash",
    "gemini-1.5-flash-latest",
]


async def _call_gemini(api_key: str, query: str) -> BuddyResponse:
    """Call Gemini Flash REST API and parse the structured JSON response.

    Tries candidate model names in order until one succeeds.
    """
    last_exc: Exception | None = None
    for model in _GEMINI_MODELS:
        url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"{model}:generateContent"
        )
        try:
            return await _call_gemini_model(api_key, query, url)
        except Exception as exc:  # noqa: BLE001
            last_exc = exc
            print(f"[ai_proxy] Model {model} failed ({type(exc).__name__}). Trying next.")
    raise last_exc or RuntimeError("All Gemini model candidates failed.")


async def _call_gemini_model(api_key: str, query: str, url: str) -> BuddyResponse:
    """Single attempt against one model URL."""
    payload = {
        "system_instruction": {"parts": [{"text": _SYSTEM_PROMPT}]},
        "contents": [
            {
                "role": "user",
                "parts": [{"text": _USER_TEMPLATE.format(query=query)}],
            }
        ],
        "generationConfig": {
            "temperature": 0.7,
            "maxOutputTokens": 512,
            "responseMimeType": "application/json",
        },
    }
    headers = {"Content-Type": "application/json"}
    params = {"key": api_key}

    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.post(url, json=payload, headers=headers, params=params)
        response.raise_for_status()

    data = response.json()
    raw_text = (
        data.get("candidates", [{}])[0]
        .get("content", {})
        .get("parts", [{}])[0]
        .get("text", "")
    )

    parsed = _parse_ai_json(raw_text)

    return BuddyResponse(
        topic=parsed.get("topic", query),
        azure_service=parsed.get("azure_service", "Azure Cloud"),
        metaphor_title=parsed.get("metaphor_title", "African Analogy"),
        analogy_text=parsed.get("analogy_text", raw_text),
        source="ai_generated",
        raw_ai_text=raw_text,
    )


def _parse_ai_json(raw_text: str) -> dict:
    """Extract JSON from raw AI output, stripping markdown fences if present."""
    # Strip potential markdown code fences
    cleaned = re.sub(r"^```(?:json)?\s*", "", raw_text.strip(), flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*```$", "", cleaned.strip())
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        return {}


# ---------------------------------------------------------------------------
# SQLite seed fallback
# ---------------------------------------------------------------------------

def _seed_fallback(query: str) -> BuddyResponse:
    """Search the local analogies table for the best matching metaphor.

    Scoring: count keyword overlaps between query tokens and the
    concatenated topic + azure_service + metaphor_title fields.
    Returns the first analogy record when no match is found.
    """
    query_tokens = set(query.lower().split())

    with db_connection() as conn:
        rows = conn.execute(
            "SELECT topic, azure_service, metaphor_title, analogy_text FROM analogies;"
        ).fetchall()

    if not rows:
        return _generic_fallback(query)

    best_row = None
    best_score = -1

    for row in rows:
        candidate = " ".join([
            row["topic"],
            row["azure_service"],
            row["metaphor_title"],
        ]).lower()
        candidate_tokens = set(re.split(r"\W+", candidate))
        score = len(query_tokens & candidate_tokens)
        if score > best_score:
            best_score = score
            best_row = row

    if best_row is None:
        best_row = rows[0]

    return BuddyResponse(
        topic=best_row["topic"],
        azure_service=best_row["azure_service"],
        metaphor_title=best_row["metaphor_title"],
        analogy_text=best_row["analogy_text"],
        source="seed_fallback",
        raw_ai_text=None,
    )


def _generic_fallback(query: str) -> BuddyResponse:
    """Return a generic response when the analogies table is empty."""
    return BuddyResponse(
        topic=query,
        azure_service="Azure Cloud Services",
        metaphor_title="Cloud as Community Infrastructure",
        analogy_text=(
            "Think of Azure cloud services like the essential infrastructure "
            "that powers a modern African city - from mobile money networks that "
            "keep commerce flowing to the power grid substations that keep lights on. "
            "Each service plays a critical, interconnected role."
        ),
        source="seed_fallback",
        raw_ai_text=None,
    )
