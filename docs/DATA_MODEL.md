# DATA MODEL: Preceptor Nexus Space

Relational schema reference, storage distribution matrix and indexing strategy.

---

## 1. Relational Schema (3NF)

### Table: `domains`

The root lookup table. Contains the three official AZ-900 syllabus domains.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Surrogate key |
| `code` | TEXT | NOT NULL, UNIQUE | URL-safe slug: `cloud-concepts`, `azure-architecture-services`, `azure-management-governance` |
| `title` | TEXT | NOT NULL | Human-readable name |
| `weight_min` | REAL | NOT NULL | Lower bound of official syllabus weighting (fraction 0-1) |
| `weight_max` | REAL | NOT NULL | Upper bound of official syllabus weighting (fraction 0-1) |

**Sample rows:**

| id | code | title | weight_min | weight_max |
|---|---|---|---|---|
| 1 | cloud-concepts | Cloud Concepts | 0.25 | 0.30 |
| 2 | azure-architecture-services | Azure Architecture & Services | 0.35 | 0.40 |
| 3 | azure-management-governance | Azure Management & Governance | 0.30 | 0.35 |

---

### Table: `questions`

Practice questions normalised to domain via foreign key.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Surrogate key |
| `domain_id` | INTEGER | NOT NULL, FK -> domains(id) CASCADE | Owning domain |
| `question_text` | TEXT | NOT NULL | Full question prompt |
| `option_a` | TEXT | NOT NULL | Option A text |
| `option_b` | TEXT | NOT NULL | Option B text |
| `option_c` | TEXT | NOT NULL | Option C text |
| `option_d` | TEXT | NOT NULL | Option D text |
| `correct_option` | TEXT | NOT NULL, CHECK IN ('A','B','C','D') | Authoritative answer letter |
| `explanation` | TEXT | NOT NULL | Architectural explanation of the correct answer |

**Referential integrity:** `ON DELETE CASCADE` ensures questions are removed when their parent domain is deleted.

---

### Table: `analogies`

Curated African regional metaphors for Azure cloud concepts.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Surrogate key |
| `topic` | TEXT | NOT NULL | General conceptual topic (e.g. "Messaging and Asynchronous Decoupling") |
| `azure_service` | TEXT | NOT NULL | Primary Azure service being explained |
| `metaphor_title` | TEXT | NOT NULL | Short title of the analogy (unique per seed) |
| `analogy_text` | TEXT | NOT NULL | Full narrative analogy text |

**Seed count:** 12 analogies covering M-Pesa queues, power grid substations, granary silos, matatu interchanges and more.

---

## 2. Entity Relationship Diagram

```
+----------------+         +---------------------+
|    domains     |         |      questions      |
+----------------+         +---------------------+
| id (PK)        |<--------| id (PK)             |
| code (UNIQUE)  |  1:many | domain_id (FK)      |
| title          |         | question_text       |
| weight_min     |         | option_a            |
| weight_max     |         | option_b            |
+----------------+         | option_c            |
                           | option_d            |
                           | correct_option      |
                           | explanation         |
                           +---------------------+

+---------------------+
|      analogies      |
+---------------------+
| id (PK)             |  (no FK - standalone lookup table)
| topic               |
| azure_service       |
| metaphor_title      |
| analogy_text        |
+---------------------+
```

---

## 3. Storage Distribution Matrix

| Data Type | Storage Location | Format | Persistence | Notes |
|---|---|---|---|---|
| Practice questions | Render SQLite WAL | Relational rows | Persistent on disk | Authoritative source for scoring |
| Domain metadata | Render SQLite WAL | Relational rows | Persistent on disk | 3 rows, rarely changes |
| Seed analogies | Render SQLite WAL | Relational rows | Persistent on disk | AI fallback pool |
| Learner answers (pre-submit) | Browser RAM | React state | Session-only | Cleared on page refresh |
| Attempt history | Browser IndexedDB | JSON records | Persistent per-origin | Survives browser restart |
| Flashcard deck | Browser IndexedDB | JSON records | Persistent per-origin | Includes Leitner box numbers |
| Study planner | Browser IndexedDB | JSON records | Persistent per-origin | Exam date and daily slots |
| Chat history | Browser IndexedDB | JSON records | Persistent per-origin | AI buddy conversation |
| Bookmarks | Browser IndexedDB | String array | Persistent per-origin | Bookmarked question IDs |
| Theme preference | Browser LocalStorage | String key-value | Persistent per-origin | 'light' or 'dark' |

---

## 4. B-Tree Index Strategy

Three covering indexes are created by `data/schema.sql`:

### `idx_questions_domain_id`

```sql
CREATE INDEX IF NOT EXISTS idx_questions_domain_id ON questions (domain_id);
```

**Purpose:** Accelerates `WHERE d.code = ?` domain-filtered question fetches. Without this index SQLite would perform a full table scan on every `GET /api/questions?domain=...` call.

**Query plan impact:** `SEARCH questions USING INDEX idx_questions_domain_id (domain_id=?)`

---

### `idx_analogies_topic`

```sql
CREATE INDEX IF NOT EXISTS idx_analogies_topic ON analogies (topic);
```

**Purpose:** Speeds seed fallback lookups in the AI proxy when searching for topic-matching analogies.

---

### `idx_analogies_azure_service`

```sql
CREATE INDEX IF NOT EXISTS idx_analogies_azure_service ON analogies (azure_service);
```

**Purpose:** Enables fast azure_service keyword matching during analogy retrieval.

---

## 5. WAL Mode Rationale

SQLite Write-Ahead Logging (WAL) is enabled via:

```sql
PRAGMA journal_mode = WAL;
```

Key benefits for this architecture:

| Benefit | Explanation |
|---|---|
| Concurrent reads | Readers do not block writers. Multiple `/api/questions` requests can run simultaneously alongside an active `/api/evaluate` write. |
| Crash safety | Committed transactions survive process crashes. Incomplete writes to the WAL file do not corrupt the main database. |
| Performance | Sequential WAL appends are faster than rollback journal page overwrites for write-heavy seed operations. |

---

## 6. Query Patterns

### Fetch questions for quiz (domain-filtered)

```sql
SELECT
    q.id, q.domain_id, d.code AS domain_code,
    q.question_text, q.option_a, q.option_b, q.option_c, q.option_d
FROM questions q
JOIN domains d ON d.id = q.domain_id
WHERE d.code = ?
ORDER BY q.id
LIMIT ?;
```

Uses: `idx_questions_domain_id` covering the join predicate.

### Evaluate submission (authoritative answers)

```sql
SELECT
    q.id, q.domain_id, d.code AS domain_code, d.title AS domain_title,
    q.question_text, q.correct_option, q.explanation
FROM questions q
JOIN domains d ON d.id = q.domain_id
WHERE q.id IN (?, ?, ...);
```

Uses: Primary key B-tree scan on `questions.id` (O(log n)).

### Analogy seed fallback

```sql
SELECT topic, azure_service, metaphor_title, analogy_text FROM analogies;
```

Full table scan (12 rows) - acceptable at this scale. Keyword scoring applied in Python.
