"""Anti-cheat server-side scoring engine for AZ-900 exam submissions.

Compares learner answers against authoritative SQLite records and applies
official AZ-900 domain weighting to calculate a 0-1000 scaled score.

Official domain weights used (midpoint of published ranges):
  - Cloud Concepts:               0.275 (~28%)
  - Azure Architecture & Services: 0.375 (~37%)
  - Azure Management & Governance: 0.350 (~35%)
"""

from __future__ import annotations

from dataclasses import dataclass, field

from backend.database import db_connection
from backend.models import (
    AnswerEntry,
    DomainBreakdown,
    EvaluationResult,
    QuestionReview,
)

# ---------------------------------------------------------------------------
# Domain weight constants
# Midpoint of the published AZ-900 syllabus ranges.
# ---------------------------------------------------------------------------

_DOMAIN_WEIGHTS: dict[str, float] = {
    "cloud-concepts": 0.275,
    "azure-architecture-services": 0.375,
    "azure-management-governance": 0.350,
}

_SCALED_MAX = 1000
_PASSING_MARK = 700


# ---------------------------------------------------------------------------
# Internal data structures
# ---------------------------------------------------------------------------

@dataclass
class _QuestionRecord:
    id: int
    domain_id: int
    domain_code: str
    domain_title: str
    question_text: str
    correct_option: str
    explanation: str


@dataclass
class _DomainAccumulator:
    domain_code: str
    domain_title: str
    correct: int = 0
    total: int = 0


# ---------------------------------------------------------------------------
# Public scoring function
# ---------------------------------------------------------------------------

def evaluate_submission(answers: list[AnswerEntry]) -> EvaluationResult:
    """Evaluate a learner submission and return a fully scored result.

    Steps:
    1. Fetch authoritative question records from SQLite.
    2. Compare each submitted answer against the stored correct_option.
    3. Accumulate per-domain correct/total counts.
    4. Calculate weighted scaled score on a 0-1000 scale.

    Args:
        answers: Validated list of AnswerEntry objects from the request body.

    Returns:
        EvaluationResult with score, pass/fail decision and per-question reviews.
    """
    if not answers:
        return _empty_result()

    # Collect unique question IDs from submission
    question_ids = list({a.question_id for a in answers})

    # Fetch authoritative records from database
    question_map = _fetch_questions(question_ids)

    # Build per-domain accumulators
    domain_accumulators: dict[str, _DomainAccumulator] = {}
    reviews: list[QuestionReview] = []

    for entry in answers:
        record = question_map.get(entry.question_id)
        if record is None:
            # Skip unrecognised question IDs silently
            continue

        is_correct = entry.chosen_option.upper() == record.correct_option.upper()

        # Ensure accumulator exists for this domain
        if record.domain_code not in domain_accumulators:
            domain_accumulators[record.domain_code] = _DomainAccumulator(
                domain_code=record.domain_code,
                domain_title=record.domain_title,
            )

        acc = domain_accumulators[record.domain_code]
        acc.total += 1
        if is_correct:
            acc.correct += 1

        reviews.append(
            QuestionReview(
                question_id=record.id,
                question_text=record.question_text,
                chosen_option=entry.chosen_option.upper(),
                correct_option=record.correct_option,
                is_correct=is_correct,
                explanation=record.explanation,
                domain_code=record.domain_code,
            )
        )

    total_evaluated = len(reviews)
    total_correct = sum(acc.correct for acc in domain_accumulators.values())
    raw_percentage = (total_correct / total_evaluated * 100) if total_evaluated > 0 else 0.0

    # Weighted score calculation
    scaled_score = _calculate_scaled_score(domain_accumulators)

    domain_breakdown = _build_breakdown(domain_accumulators, scaled_score)

    return EvaluationResult(
        scaled_score=scaled_score,
        percentage=round(raw_percentage, 2),
        passed=scaled_score >= _PASSING_MARK,
        passing_mark=_PASSING_MARK,
        domain_breakdown=domain_breakdown,
        reviews=reviews,
        total_submitted=len(answers),
        total_evaluated=total_evaluated,
    )


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------

def _fetch_questions(question_ids: list[int]) -> dict[int, _QuestionRecord]:
    """Load question records from SQLite and return as a lookup dict."""
    if not question_ids:
        return {}

    placeholders = ",".join("?" * len(question_ids))
    query = f"""
        SELECT
            q.id,
            q.domain_id,
            d.code AS domain_code,
            d.title AS domain_title,
            q.question_text,
            q.correct_option,
            q.explanation
        FROM questions q
        JOIN domains d ON d.id = q.domain_id
        WHERE q.id IN ({placeholders});
    """
    with db_connection() as conn:
        rows = conn.execute(query, tuple(question_ids)).fetchall()

    return {
        row["id"]: _QuestionRecord(
            id=row["id"],
            domain_id=row["domain_id"],
            domain_code=row["domain_code"],
            domain_title=row["domain_title"],
            question_text=row["question_text"],
            correct_option=row["correct_option"],
            explanation=row["explanation"],
        )
        for row in rows
    }


def _calculate_scaled_score(
    accumulators: dict[str, _DomainAccumulator],
) -> int:
    """Return a 0-1000 weighted scaled score from per-domain results.

    Each domain's percentage correct is multiplied by its official weighting
    and summed to produce a normalised score, then scaled to 0-1000.

    Domains with no submitted questions receive 0% for that domain.
    """
    if not accumulators:
        return 0

    # Determine effective weights: only include domains that have questions
    effective_domains = set(accumulators.keys()) | set(_DOMAIN_WEIGHTS.keys())
    total_weight = sum(
        _DOMAIN_WEIGHTS.get(code, 0.0) for code in effective_domains
    )
    if total_weight == 0:
        return 0

    weighted_sum = 0.0
    for code in effective_domains:
        weight = _DOMAIN_WEIGHTS.get(code, 0.0)
        acc = accumulators.get(code)
        if acc and acc.total > 0:
            domain_pct = acc.correct / acc.total
        else:
            domain_pct = 0.0
        weighted_sum += domain_pct * weight

    normalised = weighted_sum / total_weight
    return round(normalised * _SCALED_MAX)


def _build_breakdown(
    accumulators: dict[str, _DomainAccumulator],
    scaled_score: int,
) -> list[DomainBreakdown]:
    """Build per-domain breakdown list, filling in all known domains."""
    breakdown: list[DomainBreakdown] = []

    # Fetch domain titles for any domain not present in submission
    with db_connection() as conn:
        all_domains = {
            row["code"]: row["title"]
            for row in conn.execute("SELECT code, title FROM domains;").fetchall()
        }

    reported_codes: set[str] = set()

    for code, acc in accumulators.items():
        weight = _DOMAIN_WEIGHTS.get(code, 0.0)
        pct = (acc.correct / acc.total * 100) if acc.total > 0 else 0.0
        contrib = round(pct * weight * _SCALED_MAX / 100, 2)
        breakdown.append(
            DomainBreakdown(
                domain_code=code,
                domain_title=acc.domain_title,
                correct=acc.correct,
                total=acc.total,
                percentage=round(pct, 2),
                weighted_contribution=contrib,
            )
        )
        reported_codes.add(code)

    # Add zero-score entries for domains absent from submission
    for code, title in all_domains.items():
        if code not in reported_codes:
            breakdown.append(
                DomainBreakdown(
                    domain_code=code,
                    domain_title=title,
                    correct=0,
                    total=0,
                    percentage=0.0,
                    weighted_contribution=0.0,
                )
            )

    return breakdown


def _empty_result() -> EvaluationResult:
    """Return a zero-scored result when no valid answers are submitted."""
    return EvaluationResult(
        scaled_score=0,
        percentage=0.0,
        passed=False,
        passing_mark=_PASSING_MARK,
        domain_breakdown=[],
        reviews=[],
        total_submitted=0,
        total_evaluated=0,
    )
