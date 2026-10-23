"""Database initialization and seeding module for Preceptor Nexus Space.

Populates SQLite database with normalized domains, questions and African regional analogies.
Enforces WAL journal mode and foreign key constraints.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
import sqlite3
import sys


def get_db_path() -> Path:
    """Resolve database path from environment or default data directory."""
    env_path = os.environ.get("DB_PATH")
    if env_path:
        return Path(env_path)
    if len(sys.argv) > 1 and not sys.argv[1].startswith("-"):
        return Path(sys.argv[1])
    return Path(__file__).resolve().parent / "preceptor_nexus.db"


def init_db(db_path: Path | None = None) -> Path:
    """Initialize SQLite database with schema and seed data idempotently."""
    resolved_path = db_path or get_db_path()
    resolved_path.parent.mkdir(parents=True, exist_ok=True)

    base_dir = Path(__file__).resolve().parent
    schema_file = base_dir / "schema.sql"
    seed_file = base_dir / "az900_seed.json"

    if not schema_file.exists():
        raise FileNotFoundError(f"Schema file not found at {schema_file}")
    if not seed_file.exists():
        raise FileNotFoundError(f"Seed file not found at {seed_file}")

    conn = sqlite3.connect(resolved_path)
    try:
        conn.execute("PRAGMA foreign_keys = ON;")
        journal_mode = conn.execute("PRAGMA journal_mode = WAL;").fetchone()[0]
        print(f"Connected to SQLite database: {resolved_path}")
        print(f"Journal mode set to: {journal_mode}")

        # Apply schema
        schema_sql = schema_file.read_text(encoding="utf-8")
        conn.executescript(schema_sql)
        print("Applied schema definitions successfully.")

        # Load seed data
        seed_data = json.loads(seed_file.read_text(encoding="utf-8"))

        # Seed domains
        domain_records = seed_data.get("domains", [])
        domains_inserted = 0
        domains_updated = 0
        for domain in domain_records:
            cursor = conn.execute(
                """
                INSERT INTO domains (code, title, weight_min, weight_max)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(code) DO UPDATE SET
                    title = excluded.title,
                    weight_min = excluded.weight_min,
                    weight_max = excluded.weight_max;
                """,
                (
                    domain["code"],
                    domain["title"],
                    float(domain["weight_min"]),
                    float(domain["weight_max"]),
                ),
            )
            if cursor.rowcount == 1:
                domains_inserted += 1
            else:
                domains_updated += 1

        # Fetch domain lookup map (code -> id)
        domain_lookup: dict[str, int] = {}
        for row in conn.execute("SELECT id, code FROM domains"):
            domain_lookup[row[1]] = row[0]

        # Seed questions
        question_records = seed_data.get("questions", [])
        questions_inserted = 0
        questions_updated = 0
        for q in question_records:
            code = q["domain_code"]
            domain_id = domain_lookup.get(code)
            if domain_id is None:
                raise ValueError(f"Domain code '{code}' not recognized in database.")

            existing = conn.execute(
                "SELECT id FROM questions WHERE domain_id = ? AND question_text = ?",
                (domain_id, q["question_text"]),
            ).fetchone()

            if existing:
                conn.execute(
                    """
                    UPDATE questions
                    SET option_a = ?, option_b = ?, option_c = ?, option_d = ?,
                        correct_option = ?, explanation = ?
                    WHERE id = ?;
                    """,
                    (
                        q["option_a"],
                        q["option_b"],
                        q["option_c"],
                        q["option_d"],
                        q["correct_option"],
                        q["explanation"],
                        existing[0],
                    ),
                )
                questions_updated += 1
            else:
                conn.execute(
                    """
                    INSERT INTO questions (
                        domain_id, question_text, option_a, option_b, option_c, option_d,
                        correct_option, explanation
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?);
                    """,
                    (
                        domain_id,
                        q["question_text"],
                        q["option_a"],
                        q["option_b"],
                        q["option_c"],
                        q["option_d"],
                        q["correct_option"],
                        q["explanation"],
                    ),
                )
                questions_inserted += 1

        # Seed analogies
        analogy_records = seed_data.get("analogies", [])
        analogies_inserted = 0
        analogies_updated = 0
        for a in analogy_records:
            existing = conn.execute(
                "SELECT id FROM analogies WHERE metaphor_title = ?",
                (a["metaphor_title"],),
            ).fetchone()

            if existing:
                conn.execute(
                    """
                    UPDATE analogies
                    SET topic = ?, azure_service = ?, analogy_text = ?
                    WHERE id = ?;
                    """,
                    (a["topic"], a["azure_service"], a["analogy_text"], existing[0]),
                )
                analogies_updated += 1
            else:
                conn.execute(
                    """
                    INSERT INTO analogies (topic, azure_service, metaphor_title, analogy_text)
                    VALUES (?, ?, ?, ?);
                    """,
                    (a["topic"], a["azure_service"], a["metaphor_title"], a["analogy_text"]),
                )
                analogies_inserted += 1

        conn.commit()

        # Verification report
        total_domains = conn.execute("SELECT COUNT(*) FROM domains").fetchone()[0]
        total_questions = conn.execute("SELECT COUNT(*) FROM questions").fetchone()[0]
        total_analogies = conn.execute("SELECT COUNT(*) FROM analogies").fetchone()[0]

        print("-" * 60)
        print("DATABASE SEED SUMMARY:")
        print(f"  Domains: {total_domains} present (inserted {domains_inserted}, updated {domains_updated})")
        print(f"  Questions: {total_questions} present (inserted {questions_inserted}, updated {questions_updated})")
        print(f"  Analogies: {total_analogies} present (inserted {analogies_inserted}, updated {analogies_updated})")
        print("-" * 60)

        # Questions per domain verification
        for row in conn.execute(
            """
            SELECT d.code, d.title, COUNT(q.id)
            FROM domains d
            LEFT JOIN questions q ON q.domain_id = d.id
            GROUP BY d.id;
            """
        ):
            print(f"  Domain '{row[0]}' ({row[1]}): {row[2]} questions")

        print("Seeding completed successfully with zero duplicates.")
        return resolved_path
    finally:
        conn.close()


if __name__ == "__main__":
    init_db()
