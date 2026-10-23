"""Pydantic v2 request and response schemas for Preceptor Nexus Space API."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

class HealthResponse(BaseModel):
    """System health telemetry returned by GET /api/health."""

    status: Literal["ok", "degraded"] = "ok"
    uptime_seconds: float = Field(..., description="Seconds since server startup")
    database_active: bool = Field(..., description="True when database is reachable")
    total_questions: int = Field(..., description="Count of practice questions in the database")
    version: str = Field(default="1.0.0", description="Backend API semantic version")


# ---------------------------------------------------------------------------
# Domains
# ---------------------------------------------------------------------------

class DomainSchema(BaseModel):
    """One AZ-900 exam domain with official syllabus weighting."""

    id: int
    code: str = Field(..., description="URL-safe domain identifier")
    title: str = Field(..., description="Human-readable domain name")
    weight_min: float = Field(..., description="Minimum syllabus weighting fraction (0-1)")
    weight_max: float = Field(..., description="Maximum syllabus weighting fraction (0-1)")


# ---------------------------------------------------------------------------
# Questions - secure client view (answers stripped)
# ---------------------------------------------------------------------------

class QuestionClientSchema(BaseModel):
    """Practice question safe for client delivery: answer fields omitted."""

    id: int
    domain_id: int
    domain_code: str = Field(default="", description="Code of the parent domain")
    question_text: str
    option_a: str
    option_b: str
    option_c: str
    option_d: str
    # NOTE: correct_option and explanation are intentionally absent here.


# ---------------------------------------------------------------------------
# Evaluation - submission and results
# ---------------------------------------------------------------------------

class AnswerEntry(BaseModel):
    """Single answer submitted by a learner."""

    question_id: int
    chosen_option: str = Field(..., description="The option letter chosen: A, B, C or D")

    @field_validator("chosen_option")
    @classmethod
    def validate_option(cls, value: str) -> str:
        normalised = value.strip().upper()
        if normalised not in ("A", "B", "C", "D"):
            raise ValueError(f"chosen_option must be A, B, C or D - received '{value}'")
        return normalised


class SubmissionSchema(BaseModel):
    """Complete exam submission payload from the learner's client."""

    answers: list[AnswerEntry] = Field(
        ...,
        min_length=1,
        description="List of question-answer pairs comprising the submission",
    )


class QuestionReview(BaseModel):
    """Per-question breakdown returned inside EvaluationResult."""

    question_id: int
    question_text: str
    chosen_option: str
    correct_option: str
    is_correct: bool
    explanation: str
    domain_code: str


class DomainBreakdown(BaseModel):
    """Score summary for a single AZ-900 domain."""

    domain_code: str
    domain_title: str
    correct: int
    total: int
    percentage: float = Field(..., description="Percentage correct within this domain (0-100)")
    weighted_contribution: float = Field(
        ..., description="Contribution to the overall 1000-point scaled score"
    )


class EvaluationResult(BaseModel):
    """Full evaluation report returned by POST /api/evaluate."""

    scaled_score: int = Field(..., description="Overall score on 0-1000 scale")
    percentage: float = Field(..., description="Raw percentage correct (0-100)")
    passed: bool = Field(..., description="True when scaled_score >= 700")
    passing_mark: int = Field(default=700, description="Minimum passing scaled score")
    domain_breakdown: list[DomainBreakdown]
    reviews: list[QuestionReview]
    total_submitted: int
    total_evaluated: int


# ---------------------------------------------------------------------------
# AI Study Buddy
# ---------------------------------------------------------------------------

class BuddyRequest(BaseModel):
    """Topic query sent to the Study Buddy endpoint."""

    query: str = Field(
        ...,
        min_length=3,
        description="Natural language topic or Azure concept to explain",
    )


class BuddyResponse(BaseModel):
    """Analogy response returned by POST /api/buddy/explain."""

    topic: str
    azure_service: str
    metaphor_title: str
    analogy_text: str
    source: Literal["ai_generated", "seed_fallback"] = Field(
        ...,
        description="Indicates whether the response came from Gemini AI or the local seed database",
    )
    raw_ai_text: str | None = Field(
        default=None,
        description="Full raw text from the AI when source is ai_generated",
    )
