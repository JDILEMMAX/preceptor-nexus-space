"""Shared pytest fixtures for Preceptor Nexus Space backend and E2E tests.

Backend fixtures set up an isolated in-memory SQLite database for each test
session so tests are hermetically sealed from the production data file.

Playwright fixtures configure the browser to use the system-installed Chrome
so no network download is required.
"""

from __future__ import annotations

import os
import sqlite3
import tempfile
from pathlib import Path
from typing import Generator

import pytest

# ---------------------------------------------------------------------------
# Locate schema and seed files relative to project root
# ---------------------------------------------------------------------------

_PROJECT_ROOT = Path(__file__).resolve().parent.parent
_SCHEMA_FILE = _PROJECT_ROOT / "data" / "schema.sql"
_SEED_FILE = _PROJECT_ROOT / "data" / "az900_seed.json"


# ---------------------------------------------------------------------------
# Minimal seed data for unit tests that don't need the full 30-question set
# ---------------------------------------------------------------------------

_MINIMAL_SQL = """
INSERT INTO domains (code, title, weight_min, weight_max)
VALUES
    ('cloud-concepts', 'Cloud Concepts', 0.25, 0.30),
    ('azure-architecture-services', 'Azure Architecture & Services', 0.35, 0.40),
    ('azure-management-governance', 'Azure Management & Governance', 0.30, 0.35);

INSERT INTO questions (domain_id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation)
VALUES
    (1, 'Test question cloud 1', 'A', 'B', 'C', 'D', 'A', 'Explanation A'),
    (1, 'Test question cloud 2', 'A', 'B', 'C', 'D', 'B', 'Explanation B'),
    (2, 'Test question arch 1',  'A', 'B', 'C', 'D', 'C', 'Explanation C'),
    (2, 'Test question arch 2',  'A', 'B', 'C', 'D', 'D', 'Explanation D'),
    (3, 'Test question mgmt 1',  'A', 'B', 'C', 'D', 'A', 'Explanation A'),
    (3, 'Test question mgmt 2',  'A', 'B', 'C', 'D', 'B', 'Explanation B');

INSERT INTO analogies (topic, azure_service, metaphor_title, analogy_text)
VALUES
    ('Queues', 'Azure Service Bus', 'M-Pesa Queue', 'M-Pesa analogy text for testing.'),
    ('Storage', 'Azure Blob Storage', 'Granary Silo', 'Granary analogy text for testing.');
"""


@pytest.fixture(scope="session")
def test_db_path() -> Generator[Path, None, None]:
    """Create a temporary SQLite database populated with test fixtures.

    The database persists for the entire test session and is deleted afterward.
    The DB_PATH env var is patched so all backend modules use this test database.
    """
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tmp:
        db_file = Path(tmp.name)

    try:
        conn = sqlite3.connect(db_file)
        conn.execute("PRAGMA foreign_keys = ON;")
        conn.execute("PRAGMA journal_mode = WAL;")

        schema_sql = _SCHEMA_FILE.read_text(encoding="utf-8")
        conn.executescript(schema_sql)
        conn.executescript(_MINIMAL_SQL)
        conn.commit()
        conn.close()

        # Patch env var so database.py resolves to this temp file
        os.environ["DB_PATH"] = str(db_file)
        yield db_file
    finally:
        db_file.unlink(missing_ok=True)
        os.environ.pop("DB_PATH", None)


# ---------------------------------------------------------------------------
# Playwright browser configuration
# Use system-installed Chrome - no playwright install chromium required
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
def browser_type_launch_args(browser_type_launch_args: dict) -> dict:
    """Override Playwright launch args to use system Chrome instead of downloading Chromium."""
    return {
        **browser_type_launch_args,
        "channel": "chrome",
        "headless": True,
        "args": ["--no-sandbox", "--disable-dev-shm-usage"],
    }
