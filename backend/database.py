"""SQLite connection manager for Preceptor Nexus Space.

Enforces WAL journal mode and foreign key constraints on every connection.
Auto-heals by running data/seed.py when the database is absent or empty.
"""

from __future__ import annotations

import importlib.util
import os
import sqlite3
import sys
from contextlib import contextmanager
from pathlib import Path
from typing import Generator


# ---------------------------------------------------------------------------
# Path resolution
# ---------------------------------------------------------------------------

_ROOT = Path(__file__).resolve().parent.parent  # project root
_DATA_DIR = _ROOT / "data"
_DEFAULT_DB = _DATA_DIR / "preceptor_nexus.db"
_SEED_SCRIPT = _DATA_DIR / "seed.py"


def _resolve_db_path() -> Path:
    """Return the active database path from env-var or default location."""
    env_path = os.environ.get("DB_PATH")
    if env_path:
        return Path(env_path)
    return _DEFAULT_DB


# ---------------------------------------------------------------------------
# Auto-heal bootstrap
# ---------------------------------------------------------------------------

def _db_needs_seeding(db_path: Path) -> bool:
    """Return True if the database does not exist or has zero tables."""
    if not db_path.exists():
        return True
    try:
        conn = sqlite3.connect(db_path)
        count = conn.execute(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table';"
        ).fetchone()[0]
        conn.close()
        return count == 0
    except Exception:
        return True


def _run_seed(db_path: Path) -> None:
    """Execute data/seed.py to populate the database."""
    if not _SEED_SCRIPT.exists():
        raise RuntimeError(f"Seed script not found at {_SEED_SCRIPT}")

    spec = importlib.util.spec_from_file_location("seed", _SEED_SCRIPT)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load seed module from {_SEED_SCRIPT}")

    module = importlib.util.module_from_spec(spec)
    # Inject the explicit db path so seed.py uses the same target
    os.environ.setdefault("DB_PATH", str(db_path))
    spec.loader.exec_module(module)  # type: ignore[union-attr]

    # Call init_db if the module exposes it
    if hasattr(module, "init_db"):
        module.init_db(db_path)


def ensure_database() -> Path:
    """Validate or auto-heal the database on application startup.

    Returns the resolved database path after guaranteeing it is seeded.
    """
    db_path = _resolve_db_path()
    if _db_needs_seeding(db_path):
        print(
            f"[database] Database at '{db_path}' is absent or empty. "
            "Running seed script..."
        )
        _run_seed(db_path)
        print("[database] Auto-heal seeding complete.")
    else:
        print(f"[database] Healthy database detected at '{db_path}'.")
    return db_path


# ---------------------------------------------------------------------------
# Connection factory
# ---------------------------------------------------------------------------

def _configure(conn: sqlite3.Connection) -> None:
    """Apply mandatory PRAGMAs to a new connection."""
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("PRAGMA journal_mode = WAL;")
    conn.row_factory = sqlite3.Row


def get_connection(db_path: Path | None = None) -> sqlite3.Connection:
    """Return a configured SQLite connection.

    The caller is responsible for closing the connection.
    """
    resolved = db_path or _resolve_db_path()
    conn = sqlite3.connect(resolved)
    _configure(conn)
    return conn


@contextmanager
def db_connection(db_path: Path | None = None) -> Generator[sqlite3.Connection, None, None]:
    """Context manager yielding a configured connection that auto-closes."""
    conn = get_connection(db_path)
    try:
        yield conn
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Convenience query helpers
# ---------------------------------------------------------------------------

def fetch_all(query: str, params: tuple = ()) -> list[dict]:
    """Execute a SELECT and return all rows as plain dicts."""
    with db_connection() as conn:
        rows = conn.execute(query, params).fetchall()
        return [dict(row) for row in rows]


def fetch_one(query: str, params: tuple = ()) -> dict | None:
    """Execute a SELECT and return the first row as a plain dict or None."""
    with db_connection() as conn:
        row = conn.execute(query, params).fetchone()
        return dict(row) if row else None


def get_question_count() -> int:
    """Return the total number of questions currently in the database."""
    result = fetch_one("SELECT COUNT(*) AS cnt FROM questions;")
    return result["cnt"] if result else 0
