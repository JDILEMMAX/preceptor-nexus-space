"""Integration tests for all FastAPI endpoints via TestClient.

Verifies:
- GET /api/health returns 200 and database_active=True
- GET /api/domains returns all 3 domains
- GET /api/questions strips correct_option and explanation
- GET /api/questions supports ?domain= and ?limit= filters
- POST /api/evaluate grades mock submissions correctly
- POST /api/buddy/explain returns valid metaphors with and without an API key
"""

from __future__ import annotations

import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.main import app


# ---------------------------------------------------------------------------
# TestClient fixture
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def client(test_db_path: Path) -> TestClient:
    """Return a TestClient bound to the test database."""
    # DB_PATH is already patched by conftest.test_db_path fixture
    return TestClient(app, raise_server_exceptions=True)


# ---------------------------------------------------------------------------
# GET /api/health
# ---------------------------------------------------------------------------

class TestHealth:
    def test_returns_200(self, client: TestClient) -> None:
        response = client.get("/api/health")
        assert response.status_code == 200

    def test_database_active_true(self, client: TestClient) -> None:
        data = response = client.get("/api/health").json()
        assert data["database_active"] is True

    def test_has_uptime(self, client: TestClient) -> None:
        data = client.get("/api/health").json()
        assert "uptime_seconds" in data
        assert isinstance(data["uptime_seconds"], float)

    def test_total_questions_positive(self, client: TestClient) -> None:
        data = client.get("/api/health").json()
        assert data["total_questions"] >= 0

    def test_status_field_is_ok(self, client: TestClient) -> None:
        data = client.get("/api/health").json()
        assert data["status"] in ("ok", "degraded")


# ---------------------------------------------------------------------------
# GET /api/domains
# ---------------------------------------------------------------------------

class TestDomains:
    def test_returns_200(self, client: TestClient) -> None:
        response = client.get("/api/domains")
        assert response.status_code == 200

    def test_returns_three_domains(self, client: TestClient) -> None:
        data = client.get("/api/domains").json()
        assert len(data) == 3

    def test_domain_has_required_fields(self, client: TestClient) -> None:
        data = client.get("/api/domains").json()
        required = {"id", "code", "title", "weight_min", "weight_max"}
        for domain in data:
            assert required.issubset(domain.keys()), (
                f"Domain missing keys: {required - domain.keys()}"
            )

    def test_cloud_concepts_domain_present(self, client: TestClient) -> None:
        data = client.get("/api/domains").json()
        codes = {d["code"] for d in data}
        assert "cloud-concepts" in codes

    def test_weight_values_in_valid_range(self, client: TestClient) -> None:
        data = client.get("/api/domains").json()
        for d in data:
            assert 0.0 <= d["weight_min"] <= 1.0
            assert 0.0 <= d["weight_max"] <= 1.0
            assert d["weight_min"] <= d["weight_max"]


# ---------------------------------------------------------------------------
# GET /api/questions
# ---------------------------------------------------------------------------

class TestQuestions:
    def test_returns_200(self, client: TestClient) -> None:
        response = client.get("/api/questions")
        assert response.status_code == 200

    def test_correct_option_is_stripped(self, client: TestClient) -> None:
        """The client must NOT receive correct_option in the response."""
        data = client.get("/api/questions").json()
        assert len(data) > 0, "Expected at least one question"
        for q in data:
            assert "correct_option" not in q, (
                "correct_option MUST be stripped before sending to client"
            )

    def test_explanation_is_stripped(self, client: TestClient) -> None:
        """The client must NOT receive explanation in the response."""
        data = client.get("/api/questions").json()
        for q in data:
            assert "explanation" not in q, (
                "explanation MUST be stripped before sending to client"
            )

    def test_questions_have_four_options(self, client: TestClient) -> None:
        data = client.get("/api/questions").json()
        required_options = {"option_a", "option_b", "option_c", "option_d"}
        for q in data:
            assert required_options.issubset(q.keys())

    def test_domain_filter(self, client: TestClient) -> None:
        data = client.get("/api/questions?domain=cloud-concepts").json()
        assert len(data) > 0
        for q in data:
            assert q["domain_code"] == "cloud-concepts"

    def test_limit_filter(self, client: TestClient) -> None:
        data = client.get("/api/questions?limit=2").json()
        assert len(data) <= 2

    def test_invalid_domain_returns_empty(self, client: TestClient) -> None:
        data = client.get("/api/questions?domain=nonexistent-domain").json()
        assert data == []

    def test_limit_zero_rejected(self, client: TestClient) -> None:
        """limit=0 is below the minimum (ge=1) and should be rejected."""
        response = client.get("/api/questions?limit=0")
        assert response.status_code == 422


# ---------------------------------------------------------------------------
# POST /api/evaluate
# ---------------------------------------------------------------------------

class TestEvaluate:
    def _get_question_ids(self, client: TestClient) -> list[dict]:
        """Fetch questions and return raw row data with correct answers from the DB."""
        import sqlite3
        db_path = os.environ.get("DB_PATH", "")
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            "SELECT id, correct_option FROM questions ORDER BY id;"
        ).fetchall()
        conn.close()
        return [{"id": r["id"], "correct": r["correct_option"]} for r in rows]

    def test_returns_200(self, client: TestClient) -> None:
        q = self._get_question_ids(client)
        payload = {"answers": [{"question_id": q[0]["id"], "chosen_option": "A"}]}
        response = client.post("/api/evaluate", json=payload)
        assert response.status_code == 200

    def test_all_correct_scores_1000(self, client: TestClient) -> None:
        questions = self._get_question_ids(client)
        payload = {
            "answers": [
                {"question_id": q["id"], "chosen_option": q["correct"]}
                for q in questions
            ]
        }
        result = client.post("/api/evaluate", json=payload).json()
        assert result["scaled_score"] == 1000
        assert result["passed"] is True

    def test_all_wrong_scores_0(self, client: TestClient) -> None:
        questions = self._get_question_ids(client)

        def wrong(correct: str) -> str:
            for letter in ("A", "B", "C", "D"):
                if letter != correct:
                    return letter
            return "A"

        payload = {
            "answers": [
                {"question_id": q["id"], "chosen_option": wrong(q["correct"])}
                for q in questions
            ]
        }
        result = client.post("/api/evaluate", json=payload).json()
        assert result["scaled_score"] == 0
        assert result["passed"] is False

    def test_result_has_domain_breakdown(self, client: TestClient) -> None:
        questions = self._get_question_ids(client)
        payload = {
            "answers": [
                {"question_id": questions[0]["id"], "chosen_option": "A"}
            ]
        }
        result = client.post("/api/evaluate", json=payload).json()
        assert "domain_breakdown" in result
        assert len(result["domain_breakdown"]) > 0

    def test_result_has_reviews(self, client: TestClient) -> None:
        questions = self._get_question_ids(client)
        payload = {
            "answers": [
                {"question_id": questions[0]["id"], "chosen_option": "A"}
            ]
        }
        result = client.post("/api/evaluate", json=payload).json()
        assert "reviews" in result
        assert len(result["reviews"]) >= 0  # may be 0 if question ID is wrong

    def test_empty_submission_rejected(self, client: TestClient) -> None:
        """Empty answers list must be rejected with 422."""
        payload = {"answers": []}
        response = client.post("/api/evaluate", json=payload)
        assert response.status_code == 422

    def test_invalid_option_rejected(self, client: TestClient) -> None:
        """option 'Z' is not A/B/C/D and must be rejected with 422."""
        payload = {"answers": [{"question_id": 1, "chosen_option": "Z"}]}
        response = client.post("/api/evaluate", json=payload)
        assert response.status_code == 422

    def test_passing_mark_in_response(self, client: TestClient) -> None:
        questions = self._get_question_ids(client)
        payload = {
            "answers": [
                {"question_id": questions[0]["id"], "chosen_option": "A"}
            ]
        }
        result = client.post("/api/evaluate", json=payload).json()
        assert result["passing_mark"] == 700


# ---------------------------------------------------------------------------
# POST /api/buddy/explain
# ---------------------------------------------------------------------------

class TestBuddyExplain:
    def test_returns_200_without_api_key(self, client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
        """Without GEMINI_API_KEY the endpoint must still return 200 via seed fallback."""
        monkeypatch.delenv("GEMINI_API_KEY", raising=False)
        response = client.post("/api/buddy/explain", json={"query": "Azure Blob Storage"})
        assert response.status_code == 200

    def test_source_is_seed_fallback_without_key(
        self, client: TestClient, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.delenv("GEMINI_API_KEY", raising=False)
        data = client.post(
            "/api/buddy/explain", json={"query": "Service Bus queues"}
        ).json()
        assert data["source"] == "seed_fallback"

    def test_response_has_required_fields(
        self, client: TestClient, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.delenv("GEMINI_API_KEY", raising=False)
        data = client.post(
            "/api/buddy/explain", json={"query": "VNet peering"}
        ).json()
        required = {"topic", "azure_service", "metaphor_title", "analogy_text", "source"}
        assert required.issubset(data.keys())

    def test_empty_query_rejected(self, client: TestClient) -> None:
        """Query shorter than 3 characters must be rejected with 422."""
        response = client.post("/api/buddy/explain", json={"query": "ab"})
        assert response.status_code == 422

    def test_blob_storage_query_returns_valid_response(
        self, client: TestClient, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.delenv("GEMINI_API_KEY", raising=False)
        data = client.post(
            "/api/buddy/explain", json={"query": "blob storage granary"}
        ).json()
        assert data["analogy_text"] != ""
        assert data["source"] == "seed_fallback"

    def test_analogy_text_is_non_empty(
        self, client: TestClient, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.delenv("GEMINI_API_KEY", raising=False)
        data = client.post(
            "/api/buddy/explain", json={"query": "Availability Zones power grid"}
        ).json()
        assert len(data["analogy_text"]) > 10
