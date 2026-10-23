-- Schema for Preceptor Nexus Space SQLite Database
-- Invariant: WAL mode enabled with foreign key constraints enforced

CREATE TABLE IF NOT EXISTS domains (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    weight_min REAL NOT NULL,
    weight_max REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    domain_id INTEGER NOT NULL,
    question_text TEXT NOT NULL,
    option_a TEXT NOT NULL,
    option_b TEXT NOT NULL,
    option_c TEXT NOT NULL,
    option_d TEXT NOT NULL,
    correct_option TEXT NOT NULL CHECK (correct_option IN ('A', 'B', 'C', 'D')),
    explanation TEXT NOT NULL,
    FOREIGN KEY (domain_id) REFERENCES domains (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS analogies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    topic TEXT NOT NULL,
    azure_service TEXT NOT NULL,
    metaphor_title TEXT NOT NULL,
    analogy_text TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_questions_domain_id ON questions (domain_id);
CREATE INDEX IF NOT EXISTS idx_analogies_topic ON analogies (topic);
CREATE INDEX IF NOT EXISTS idx_analogies_azure_service ON analogies (azure_service);
