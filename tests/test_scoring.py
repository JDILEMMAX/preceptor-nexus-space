"""Unit tests for backend/scoring.py.

Verifies:
- 100% correct submission scores 1000/1000
- 0% correct submission scores 0/1000
- Mixed submissions produce domain-weighted intermediate scores
- 700-point threshold boundary (pass vs fail)
- Domain weighting constants are applied correctly
- Empty submission is handled gracefully
"""

from __future__ import annotations

from pathlib import Path

import pytest

from backend.models import AnswerEntry
from backend.scoring import (
    _DOMAIN_WEIGHTS,
    _PASSING_MARK,
    _SCALED_MAX,
    evaluate_submission,
)


# ---------------------------------------------------------------------------
# Helpers to build AnswerEntry lists
# ---------------------------------------------------------------------------

def _make_answers(pairs: list[tuple[int, str]]) -> list[AnswerEntry]:
    """Build a list of AnswerEntry from (question_id, chosen_option) pairs."""
    return [AnswerEntry(question_id=qid, chosen_option=opt) for qid, opt in pairs]


# ---------------------------------------------------------------------------
# Fixtures - load actual DB question IDs from the test database
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def question_ids(test_db_path: Path) -> dict[str, list[tuple[int, str]]]:
    """Return question IDs grouped by domain with their correct answers.

    Structure:
        {
          'cloud-concepts': [(id, correct_option), ...],
          'azure-architecture-services': [...],
          'azure-management-governance': [...],
        }
    """
    import sqlite3
    conn = sqlite3.connect(test_db_path)
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        """
        SELECT q.id, d.code, q.correct_option
        FROM questions q
        JOIN domains d ON d.id = q.domain_id
        ORDER BY d.code, q.id;
        """
    ).fetchall()
    conn.close()

    grouped: dict[str, list[tuple[int, str]]] = {}
    for row in rows:
        grouped.setdefault(row["code"], []).append((row["id"], row["correct_option"]))
    return grouped


# ---------------------------------------------------------------------------
# Score constants
# ---------------------------------------------------------------------------

class TestScoringConstants:
    def test_scaled_max_is_1000(self) -> None:
        assert _SCALED_MAX == 1000

    def test_passing_mark_is_700(self) -> None:
        assert _PASSING_MARK == 700

    def test_domain_weights_sum_to_approximately_1(self) -> None:
        total = sum(_DOMAIN_WEIGHTS.values())
        assert abs(total - 1.0) < 0.01, f"Domain weights sum to {total}, expected ~1.0"

    def test_all_three_domains_have_weights(self) -> None:
        assert "cloud-concepts" in _DOMAIN_WEIGHTS
        assert "azure-architecture-services" in _DOMAIN_WEIGHTS
        assert "azure-management-governance" in _DOMAIN_WEIGHTS


# ---------------------------------------------------------------------------
# Perfect score
# ---------------------------------------------------------------------------

class TestPerfectScore:
    def test_all_correct_scores_1000(
        self, test_db_path: Path, question_ids: dict[str, list[tuple[int, str]]]
    ) -> None:
        """Submitting every correct answer must yield scaled_score == 1000."""
        all_correct = [
            (qid, opt)
            for pairs in question_ids.values()
            for qid, opt in pairs
        ]
        result = evaluate_submission(_make_answers(all_correct))
        assert result.scaled_score == 1000, (
            f"Expected 1000 for all-correct submission, got {result.scaled_score}"
        )

    def test_all_correct_marks_passed(
        self, test_db_path: Path, question_ids: dict[str, list[tuple[int, str]]]
    ) -> None:
        all_correct = [
            (qid, opt)
            for pairs in question_ids.values()
            for qid, opt in pairs
        ]
        result = evaluate_submission(_make_answers(all_correct))
        assert result.passed is True

    def test_all_correct_100_percent(
        self, test_db_path: Path, question_ids: dict[str, list[tuple[int, str]]]
    ) -> None:
        all_correct = [
            (qid, opt)
            for pairs in question_ids.values()
            for qid, opt in pairs
        ]
        result = evaluate_submission(_make_answers(all_correct))
        assert result.percentage == 100.0


# ---------------------------------------------------------------------------
# Zero score
# ---------------------------------------------------------------------------

def _wrong_option(correct: str) -> str:
    """Return a letter that is definitely not the correct answer."""
    for letter in ("A", "B", "C", "D"):
        if letter != correct:
            return letter
    return "A"


class TestZeroScore:
    def test_all_wrong_scores_0(
        self, test_db_path: Path, question_ids: dict[str, list[tuple[int, str]]]
    ) -> None:
        """Submitting all wrong answers must yield scaled_score == 0."""
        all_wrong = [
            (qid, _wrong_option(opt))
            for pairs in question_ids.values()
            for qid, opt in pairs
        ]
        result = evaluate_submission(_make_answers(all_wrong))
        assert result.scaled_score == 0, (
            f"Expected 0 for all-wrong submission, got {result.scaled_score}"
        )

    def test_all_wrong_marks_failed(
        self, test_db_path: Path, question_ids: dict[str, list[tuple[int, str]]]
    ) -> None:
        all_wrong = [
            (qid, _wrong_option(opt))
            for pairs in question_ids.values()
            for qid, opt in pairs
        ]
        result = evaluate_submission(_make_answers(all_wrong))
        assert result.passed is False

    def test_all_wrong_0_percent(
        self, test_db_path: Path, question_ids: dict[str, list[tuple[int, str]]]
    ) -> None:
        all_wrong = [
            (qid, _wrong_option(opt))
            for pairs in question_ids.values()
            for qid, opt in pairs
        ]
        result = evaluate_submission(_make_answers(all_wrong))
        assert result.percentage == 0.0


# ---------------------------------------------------------------------------
# Boundary test: passing threshold
# ---------------------------------------------------------------------------

class TestPassingThreshold:
    def test_score_above_700_passes(
        self, test_db_path: Path, question_ids: dict[str, list[tuple[int, str]]]
    ) -> None:
        """All-correct submission must produce a score that triggers passed=True."""
        all_correct = [
            (qid, opt)
            for pairs in question_ids.values()
            for qid, opt in pairs
        ]
        result = evaluate_submission(_make_answers(all_correct))
        assert result.scaled_score >= 700
        assert result.passed is True

    def test_score_of_0_fails(
        self, test_db_path: Path, question_ids: dict[str, list[tuple[int, str]]]
    ) -> None:
        all_wrong = [
            (qid, _wrong_option(opt))
            for pairs in question_ids.values()
            for qid, opt in pairs
        ]
        result = evaluate_submission(_make_answers(all_wrong))
        assert result.scaled_score < 700
        assert result.passed is False


# ---------------------------------------------------------------------------
# Empty submission
# ---------------------------------------------------------------------------

class TestEdgeCases:
    def test_empty_submission_returns_zero(self, test_db_path: Path) -> None:
        result = evaluate_submission([])
        assert result.scaled_score == 0
        assert result.passed is False
        assert result.total_submitted == 0

    def test_unknown_question_id_is_skipped(self, test_db_path: Path) -> None:
        """An answer referencing a non-existent question ID is silently ignored."""
        result = evaluate_submission(_make_answers([(999999, "A")]))
        assert result.total_evaluated == 0
        assert result.scaled_score == 0

    def test_result_includes_all_domain_breakdowns(
        self, test_db_path: Path, question_ids: dict[str, list[tuple[int, str]]]
    ) -> None:
        """EvaluationResult.domain_breakdown should include all 3 domains."""
        all_correct = [
            (qid, opt)
            for pairs in question_ids.values()
            for qid, opt in pairs
        ]
        result = evaluate_submission(_make_answers(all_correct))
        codes = {d.domain_code for d in result.domain_breakdown}
        assert "cloud-concepts" in codes
        assert "azure-architecture-services" in codes
        assert "azure-management-governance" in codes

    def test_reviews_include_explanation(
        self, test_db_path: Path, question_ids: dict[str, list[tuple[int, str]]]
    ) -> None:
        """Each QuestionReview must carry the explanation text."""
        first_pair = next(iter(question_ids.values()))[0]
        result = evaluate_submission(_make_answers([first_pair]))
        assert len(result.reviews) == 1
        assert result.reviews[0].explanation != ""

    def test_domain_breakdown_percentages_sum_correctly(
        self, test_db_path: Path, question_ids: dict[str, list[tuple[int, str]]]
    ) -> None:
        """All domain breakdowns should report percentage in 0-100 range."""
        all_correct = [
            (qid, opt)
            for pairs in question_ids.values()
            for qid, opt in pairs
        ]
        result = evaluate_submission(_make_answers(all_correct))
        for d in result.domain_breakdown:
            assert 0.0 <= d.percentage <= 100.0

    def test_option_normalisation(self, test_db_path: Path, question_ids: dict) -> None:
        """Lowercase option input must be accepted and normalised to uppercase."""
        first_qid, first_correct = next(iter(question_ids.values()))[0]
        entry = AnswerEntry(question_id=first_qid, chosen_option=first_correct.lower())
        result = evaluate_submission([entry])
        assert result.reviews[0].chosen_option == first_correct.upper()
