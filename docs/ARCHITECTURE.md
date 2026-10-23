# ARCHITECTURE: Preceptor Nexus Space

> Unofficial AZ-900 Adaptive Mastery Platform built for the 1MillionDevs Vibe Coding Hackathon.
> Not affiliated with or endorsed by Microsoft Corporation.

---

## 1. System Overview

Preceptor Nexus Space is a **local-first, dual-tier** learning platform:

- **Frontend tier:** React (TanStack Start, Vite) deployed on Vercel, storing learner state in browser IndexedDB for offline-first access.
- **Backend tier:** FastAPI + SQLite WAL deployed on Render, acting as the authoritative anti-cheat scoring engine and AI proxy gateway.

The two tiers are loosely coupled by a REST API. The frontend functions fully offline; the backend tier upgrades the experience with server-authoritative grading and AI-powered African analogies.

---

## 2. Distributed Topology

```
+---------------------------------------------------------+
|                     LEARNER DEVICE                      |
|                                                         |
|   Browser (React / TanStack Start)                      |
|   +-------------------+   +-------------------------+   |
|   |  IndexedDB Store  |   |  LocalStorage (Settings)|   |
|   |  - answers        |   |  - theme preference     |   |
|   |  - flashcards     |   |  - last visited route   |   |
|   |  - study plan     |   +-------------------------+   |
|   |  - chat history   |                                 |
|   +-------------------+                                 |
|             |                                           |
|       Vite Bundler (npm run dev / Vercel CDN)           |
+---------------------------------------------------------+
                          |  HTTPS REST
                          v
+---------------------------------------------------------+
|                   RENDER CLOUD (Singapore)              |
|                                                         |
|   FastAPI Application (backend/main.py)                 |
|   +--------------------------------------------------+  |
|   |  GET  /api/health         - Telemetry sensor     |  |
|   |  GET  /api/domains        - Syllabus domains     |  |
|   |  GET  /api/questions      - Stripped questions   |  |
|   |  POST /api/evaluate       - Anti-cheat scoring   |  |
|   |  POST /api/buddy/explain  - African analogies    |  |
|   +--------------------------------------------------+  |
|             |                   |                        |
|      SQLite WAL DB       Google Gemini Flash API         |
|   preceptor_nexus.db     (fallback: seed analogies)     |
+---------------------------------------------------------+
```

---

## 3. Offline-First Mechanics

The frontend is designed to be fully functional without a backend connection:

| Feature | Offline Behaviour | Online Enhancement |
|---|---|---|
| Practice Quiz | Uses bundled question data from `questions.ts` | Fetches fresh questions from `/api/questions` |
| Score Calculation | Client-side Leitner box logic | Server-validated score from `/api/evaluate` |
| Flashcards | Stored in IndexedDB with Leitner scheduling | Synced to cloud session (future roadmap) |
| Study Buddy | Canned metaphors from `metaphors.ts` | AI-generated analogy from `/api/buddy/explain` |
| Study Planner | Stored in IndexedDB | Saved server-side (future roadmap) |

**Opportunistic Sync:** The frontend attempts API calls on mount. On network failure, it degrades silently to local data with a status indicator.

---

## 4. Anti-Cheat Scoring Architecture

The scoring engine enforces exam integrity through server-side evaluation:

### Why server-side?

A client-side quiz can be trivially reverse-engineered via browser developer tools. If the correct answers are shipped in the JavaScript bundle, a learner can extract them without answering questions.

### Mechanism

1. `GET /api/questions` returns questions with `correct_option` and `explanation` **stripped** at the serialization layer (`QuestionClientSchema`).
2. The learner submits their answers to `POST /api/evaluate`.
3. The backend fetches authoritative answers from SQLite and compares them server-side.
4. A weighted scaled score (0-1000) is returned. The client never sees raw correct answers before submitting.

### Domain Weighting

| Domain | Official Syllabus Range | Midpoint Applied |
|---|---|---|
| Cloud Concepts | 25-30% | 27.5% |
| Azure Architecture & Services | 35-40% | 37.5% |
| Azure Management & Governance | 30-35% | 35.0% |

Composite score formula:

```
score = sum(domain_pct_correct * domain_weight for each domain)
scaled = round(score * 1000)
passed = (scaled >= 700)
```

---

## 5. Request Lifecycle Diagram

```
LEARNER                    FRONTEND                  BACKEND API              SQLITE
   |                           |                           |                      |
   |---[1. Open App]---------->|                           |                      |
   |                           |--[2. GET /api/health]---->|                      |
   |                           |                           |--[3. COUNT(*)]------->|
   |                           |                           |<--[4. row count]------|
   |                           |<--[5. health JSON]--------|                      |
   |<--[6. UI renders ready]---|                           |                      |
   |                           |                           |                      |
   |---[7. Start Quiz]-------->|                           |                      |
   |                           |--[8. GET /api/questions]->|                      |
   |                           |                           |--[9. SELECT, join]--->|
   |                           |                           |<--[10. rows]----------|
   |                           |<--[11. stripped list]-----|                      |
   |<--[12. Quiz renders]------|                           |                      |
   |                           |                           |                      |
   |---[13. Submit answers]--->|                           |                      |
   |                           |--[14. POST /api/evaluate]>|                      |
   |                           |                           |--[15. SELECT+JOIN]--->|
   |                           |                           |<--[16. auth. answers]-|
   |                           |                           |--[17. score calc]     |
   |                           |<--[18. EvaluationResult]--|                      |
   |<--[19. Score card]--------|                           |                      |
   |                           |                           |                      |
   |---[20. Ask buddy]-------->|                           |                      |
   |                           |--[21. POST /api/buddy]--->|                      |
   |                           |                           |--[22. Gemini Flash]   |
   |                           |                           |  (or SQLite fallback) |
   |                           |<--[23. BuddyResponse]-----|                      |
   |<--[24. Analogy card]------|                           |                      |
```

---

## 6. Database Connectivity

The backend uses a single SQLite WAL file (`data/preceptor_nexus.db`).

**Auto-Heal Boot Sequence:**

On application startup the `lifespan` context manager calls `ensure_database()`. If the database file does not exist or contains zero tables, `data/seed.py` is invoked automatically to seed schema and fixture data. This guarantees a cold-start deployment on Render requires zero manual steps.

**Connection Configuration:**

Every connection applies:
- `PRAGMA foreign_keys = ON;` - enforces relational integrity
- `PRAGMA journal_mode = WAL;` - enables concurrent reads during writes
- `row_factory = sqlite3.Row` - enables dict-style column access

---

## 7. Security Considerations

| Concern | Mitigation |
|---|---|
| Answer leakage | `correct_option` stripped at serialization in `QuestionClientSchema` |
| CORS | Configured with `allow_origins=["*"]` for hackathon; restrict to Vercel domain in production |
| API key exposure | `GEMINI_API_KEY` read from environment variable only |
| SQL injection | All queries use parameterised placeholders |
| AI failures | All external AI calls are wrapped in `try/except`; fallback to local seed data |

---

## 8. Deployment Targets

| Tier | Platform | Configuration |
|---|---|---|
| Frontend | Vercel | `cd frontend && npm run build` |
| Backend | Render | `uvicorn backend.main:app --host 0.0.0.0 --port $PORT` |
| Database | Render Persistent Disk | Mounted at `/data/preceptor_nexus.db` |
| AI Proxy | Google Gemini Flash | `GEMINI_API_KEY` env var on Render |

---

## 9. Environment Configuration

A `.env` file at the project root configures both tiers at development time.

```
GEMINI_API_KEY=your_google_ai_studio_api_key_here
VITE_API_URL=http://localhost:8000
HOST=0.0.0.0
PORT=8000
ENVIRONMENT=development
```

- `.env` is Git-ignored and must never be committed.
- `.env.example` is committed and documents all required keys with placeholder values.
- `VITE_API_URL` is injected into the frontend bundle at build time by Vite's `VITE_*` prefix convention.
- The centralized API client at `frontend/src/lib/api.ts` reads `import.meta.env.VITE_API_URL` and defaults to `http://localhost:8000`.

---

## 10. Frontend-to-Backend Contract Wiring

The API client (`frontend/src/lib/api.ts`) exposes four typed async functions:

| Function | Method | Endpoint | Purpose |
|---|---|---|---|
| `fetchHealth` | GET | `/api/health` | Navbar health badge polling |
| `fetchQuestions` | GET | `/api/questions` | Quiz questions with answers stripped |
| `postEvaluate` | POST | `/api/evaluate` | Anti-cheat server-side scoring |
| `postBuddyExplain` | POST | `/api/buddy/explain` | African analogy generation |

Every function throws on non-OK responses so callers can catch and degrade gracefully.

**Health badge polling cadence:**
- Checked immediately on mount.
- Re-checked every 30 seconds.
- Re-checked on `visibilitychange` (tab becomes active).

**Assessment mode selection:**
- When the backend is reachable: fetches fresh questions from `/api/questions` (answers stripped, anti-cheat mode). Submits to `/api/evaluate` at the end of the quiz.
- When the backend is unreachable: falls back to bundled `QUESTIONS` in `questions.ts` with client-side Leitner scoring.

---

## 11. Playwright E2E Test Coverage

Automated browser tests live in `tests/test_e2e_browser.py` using `pytest-playwright`.

**Browser configuration:** `channel="chrome"` uses the system-installed Google Chrome. No `playwright install chromium` or network download is required.

**Test matrix:**

| Test | Viewports | Description |
|---|---|---|
| `test_dashboard_responsive` | Desktop / Tablet / Mobile | No horizontal overflow at each breakpoint |
| `test_route_renders` | Desktop | All five routes load without crashing |
| `test_health_badge_renders` | Desktop | Navbar badge shows connected or offline label |
| `test_assessment_start_and_answer` | Desktop | Quiz starts, question answered, progress advances |
| `test_flashcard_flip` | Desktop | Card flip reveals back face |
| `test_planner_slider` | Desktop | Hours slider responds to keyboard input |
| `test_theme_toggle` | Desktop | Toggle switches between Cyber-Dark and Frosted-Light |
| `test_buddy_suggestion_pill` | Desktop | Suggestion pill sends message and receives reply |
| `test_storage_status_popover` | Desktop | Storage status popover opens and closes |

**Prerequisites:**
```bash
# Backend (optional - app works offline)
uvicorn backend.main:app --reload --port 8000

# Frontend
cd frontend && npm run dev
```

**Run:**
```bash
pytest tests/test_e2e_browser.py -v
```
