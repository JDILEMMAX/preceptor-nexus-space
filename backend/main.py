"""Preceptor Nexus Space - FastAPI Application Entry Point.

Endpoints:
  GET  /api/health          - System health telemetry
  GET  /api/domains         - All AZ-900 exam domains
  GET  /api/questions       - Practice questions (answers stripped)
  POST /api/evaluate        - Server-side exam scoring
  POST /api/buddy/explain   - African analogy generation
"""

from __future__ import annotations

import time
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from backend.ai_proxy import explain_topic
from backend.database import db_connection, ensure_database, get_question_count
from backend.models import (
    BuddyRequest,
    BuddyResponse,
    DomainSchema,
    EvaluationResult,
    HealthResponse,
    QuestionClientSchema,
    SubmissionSchema,
)
from backend.scoring import evaluate_submission

# ---------------------------------------------------------------------------
# Startup timestamp
# ---------------------------------------------------------------------------

_START_TIME: float = 0.0


# ---------------------------------------------------------------------------
# Lifespan
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Validate database readiness before the server accepts traffic."""
    global _START_TIME
    _START_TIME = time.monotonic()

    print("[main] Validating database on startup...")
    try:
        ensure_database()
        print("[main] Database ready.")
    except Exception as exc:
        print(f"[main] CRITICAL: Database initialisation failed - {exc}")
        raise

    yield

    print("[main] Shutting down Preceptor Nexus Space backend.")


# ---------------------------------------------------------------------------
# Application factory
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Preceptor Nexus Space API",
    description=(
        "Anti-cheat AZ-900 exam evaluation engine with African analogy study buddy. "
        "Unofficial learning tool - not affiliated with Microsoft."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@app.get(
    "/api/health",
    response_model=HealthResponse,
    summary="System health telemetry",
    tags=["System"],
)
def get_health() -> HealthResponse:
    """Return uptime, database connectivity and question count."""
    uptime = time.monotonic() - _START_TIME if _START_TIME else 0.0

    try:
        total_questions = get_question_count()
        db_active = True
    except Exception:
        total_questions = 0
        db_active = False

    return HealthResponse(
        status="ok" if db_active else "degraded",
        uptime_seconds=round(uptime, 3),
        database_active=db_active,
        total_questions=total_questions,
    )


# ---------------------------------------------------------------------------
# Domains
# ---------------------------------------------------------------------------

@app.get(
    "/api/domains",
    response_model=list[DomainSchema],
    summary="List all AZ-900 exam domains",
    tags=["Content"],
)
def get_domains() -> list[DomainSchema]:
    """Return all 3 AZ-900 exam domains with syllabus weighting data."""
    with db_connection() as conn:
        rows = conn.execute(
            "SELECT id, code, title, weight_min, weight_max FROM domains ORDER BY id;"
        ).fetchall()

    if not rows:
        raise HTTPException(status_code=503, detail="Domain data unavailable - database may not be seeded.")

    return [DomainSchema(**dict(row)) for row in rows]


# ---------------------------------------------------------------------------
# Questions (answers stripped for secure client delivery)
# ---------------------------------------------------------------------------

@app.get(
    "/api/questions",
    response_model=list[QuestionClientSchema],
    summary="Fetch practice questions with answers stripped",
    tags=["Content"],
)
def get_questions(
    domain: str | None = Query(default=None, description="Filter by domain code"),
    limit: int | None = Query(default=None, ge=1, le=200, description="Maximum number of questions"),
) -> list[QuestionClientSchema]:
    """Return practice questions safe for client delivery.

    The correct_option and explanation fields are stripped server-side
    to prevent client-side answer extraction (anti-cheat).
    """
    query = """
        SELECT
            q.id,
            q.domain_id,
            d.code AS domain_code,
            q.question_text,
            q.option_a,
            q.option_b,
            q.option_c,
            q.option_d
        FROM questions q
        JOIN domains d ON d.id = q.domain_id
    """
    params: list = []

    if domain:
        query += " WHERE d.code = ?"
        params.append(domain)

    query += " ORDER BY q.id"

    if limit:
        query += " LIMIT ?"
        params.append(limit)

    query += ";"

    with db_connection() as conn:
        rows = conn.execute(query, params).fetchall()

    return [QuestionClientSchema(**dict(row)) for row in rows]


# ---------------------------------------------------------------------------
# Evaluate
# ---------------------------------------------------------------------------

@app.post(
    "/api/evaluate",
    response_model=EvaluationResult,
    summary="Server-side exam evaluation",
    tags=["Assessment"],
)
def post_evaluate(submission: SubmissionSchema) -> EvaluationResult:
    """Evaluate a learner submission against authoritative database records.

    Answers are scored server-side only. The client never receives correct
    answers before submission, ensuring exam integrity.
    """
    if not submission.answers:
        raise HTTPException(status_code=422, detail="Submission must contain at least one answer.")

    result = evaluate_submission(submission.answers)
    return result


# ---------------------------------------------------------------------------
# Study Buddy
# ---------------------------------------------------------------------------

@app.post(
    "/api/buddy/explain",
    response_model=BuddyResponse,
    summary="Generate African analogy for an Azure concept",
    tags=["Study Buddy"],
)
async def post_buddy_explain(request: BuddyRequest) -> BuddyResponse:
    """Explain an Azure concept using a vivid African regional analogy.

    Attempts Gemini AI generation first. Falls back to curated seed
    analogies when the API key is absent or the call fails.
    """
    return await explain_topic(request.query)


# ---------------------------------------------------------------------------
# Development runner
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "backend.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info",
    )
