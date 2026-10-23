<div align="center">

# Preceptor Nexus Space

### Adaptive AZ-900 Cognitive Mastery Platform

![Stack](https://img.shields.io/badge/stack-React%20%7C%20FastAPI%20%7C%20SQLite-blueviolet?style=flat-square)
![Build](https://img.shields.io/badge/build-passing-brightgreen?style=flat-square)
![Tests](https://img.shields.io/badge/tests-backend%20%7C%20frontend-blue?style=flat-square)
![Architecture](https://img.shields.io/badge/architecture-local--first%20dual--tier-orange?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-lightgrey?style=flat-square)
![PLP Cohort](https://img.shields.io/badge/PLP-1MillionDevs%20Cohort-purple?style=flat-square)

*Built for the 1MillionDevs Vibe Coding Hackathon - AZ-900 Edition | October 2026*

> **Unofficial learning tool. Not affiliated with or endorsed by Microsoft Corporation.**

</div>

---

## Executive Summary

Africa is the world's youngest continent by median age. Its next generation of software engineers is navigating cloud certification exams designed primarily for learners in contexts far removed from their daily realities. AZ-900 study materials are produced for Silicon Valley laptops - not Nairobi boda boda stages, M-Pesa payment flows or Kenyan national power substations.

**Preceptor Nexus Space** is an adaptive cognitive mastery platform that reframes Azure cloud concepts through African regional metaphors while delivering a rigorous, anti-cheat examination engine. It unifies all five hackathon problem statements into one seamless learning loop: smart quiz assessment, spaced-repetition flashcard coaching, intelligent study planning, readiness tracking and an AI-powered study buddy that speaks in the learner's own landscape.

The platform operates fully offline with browser-side IndexedDB persistence and connects to a FastAPI backend for server-authoritative scoring and AI-generated analogies when network access is available.

---

## The Five Core Pillars

| Pillar | Feature | Description |
|---|---|---|
| Practice & Assessment | Smart Quiz Builder | Anti-cheat server-side scoring across 30+ original AZ-900 questions |
| Memory & Revision | Flashcard Coach | Spaced-repetition Leitner box system with offline IndexedDB persistence |
| Planning | Personal Study Planner | Exam-date countdown with auto-generated daily revision slots |
| Progress | Readiness Tracker | Domain-weighted score history with visual progress diagnostics |
| Support | AI Study Buddy | Gemini Flash AI with African analogy metaphors; zero-failure SQLite fallback |

### Unified Adaptive Mastery Loop

```
       Study Planner
      (set exam date)
            |
            v
     Practice Quiz
   (stripped answers)
            |
            v
    Server Evaluation <---> SQLite (authoritative answers)
            |
            v
     Readiness Tracker
   (domain score history)
            |
            v
     Flashcard Coach
  (Leitner spaced revision)
            |
            v
      AI Study Buddy
  (Gemini + seed fallback)
            |
            +----------> next session
```

---

## System Architecture

```
+---------------------------------------------------------+
|                     LEARNER DEVICE                      |
|                                                         |
|   Browser (React / TanStack Start / Tailwind CSS)       |
|   +-------------------+   +-------------------------+   |
|   |  IndexedDB Store  |   |  LocalStorage (Settings)|   |
|   |  - answers        |   |  - theme preference     |   |
|   |  - flashcards     |   +-------------------------+   |
|   |  - study plan     |                                 |
|   |  - chat history   |  Routes:                        |
|   +-------------------+  /         Home + Quiz          |
|             |            /flashcards Leitner coach       |
|       Vercel Edge CDN    /planner   Study calendar       |
|       (static bundle)    /buddy     AI metaphor chat     |
+---------------------------------------------------------+
                          |  HTTPS REST
                          v
+---------------------------------------------------------+
|                   RENDER CLOUD                          |
|                                                         |
|   FastAPI (backend/main.py) - uvicorn                   |
|   +--------------------------------------------------+  |
|   |  GET  /api/health        Telemetry sensor        |  |
|   |  GET  /api/domains       Syllabus domain list    |  |
|   |  GET  /api/questions     Answer-stripped quiz    |  |
|   |  POST /api/evaluate      Anti-cheat scoring      |  |
|   |  POST /api/buddy/explain African analogies       |  |
|   +--------------------------------------------------+  |
|             |                        |                   |
|      SQLite WAL DB          Google Gemini Flash         |
|   preceptor_nexus.db        (fallback: seed pool)       |
+---------------------------------------------------------+
```

---

## Technology Stack & Rationale

| Layer | Technology | Rationale |
|---|---|---|
| Frontend Framework | React + TanStack Start | File-based routing with server-side rendering capability; Lovable scaffold compatibility |
| Build Tool | Vite | Sub-second HMR; native ESM for rapid iteration |
| Styling | Tailwind CSS + custom liquid glass | Utility-first with bespoke glassmorphism design tokens |
| Icons | Lucide React | Consistent lightweight SVG icon set |
| Offline State | IndexedDB (idb-keyval pattern) | Persistent structured storage without a service worker requirement |
| Backend Framework | FastAPI | Async Python with auto-generated OpenAPI docs; minimal boilerplate |
| Database | SQLite 3 + WAL mode | Zero-config persistent storage on Render; concurrent reads during writes |
| ORM / Validation | Pydantic v2 | Runtime schema validation with full type inference |
| AI Provider | Google Gemini Flash | Low-latency generative AI; free tier suitable for hackathon scale |
| Runtime | Python 3.11+ | Full typing support; `asynccontextmanager` lifespan API |
| Testing | pytest + Vitest | Backend integration via TestClient; frontend unit tests in Vitest |

---

## Repository Structure

```
preceptor-nexus-space/
|
|-- backend/                   Python FastAPI application tier
|   |-- __init__.py
|   |-- database.py            SQLite connection manager + auto-heal bootstrap
|   |-- models.py              Pydantic v2 request/response schemas
|   |-- scoring.py             Anti-cheat weighted scoring engine
|   |-- ai_proxy.py            Gemini Flash proxy + SQLite seed fallback
|   +-- main.py                FastAPI app entry point (lifespan, CORS, routes)
|
|-- data/                      Database layer
|   |-- schema.sql             Normalized 3NF DDL (domains, questions, analogies)
|   |-- az900_seed.json        30 original AZ-900 questions + 12 African metaphors
|   |-- seed.py                Idempotent seeding script (WAL + FK enforcement)
|   +-- preceptor_nexus.db     SQLite WAL database (git-ignored)
|
|-- docs/                      Architecture documentation
|   |-- ARCHITECTURE.md        Distributed topology, anti-cheat rationale, diagrams
|   +-- DATA_MODEL.md          Schema dictionary, storage matrix, index strategy
|
|-- frontend/                  React client (TanStack Start + Vite)
|   |-- src/
|   |   |-- components/        Reusable UI components
|   |   |-- lib/
|   |   |   |-- data/          Bundled questions, metaphors and seed data
|   |   |   |-- logic.ts       Leitner scoring and adaptive quiz logic
|   |   |   |-- offline.ts     IndexedDB persistence layer
|   |   |   |-- store.tsx      React context state management
|   |   |   +-- types.ts       Shared TypeScript interfaces
|   |   |-- routes/            File-based page routes
|   |   |   |-- index.tsx      Home + quiz launcher
|   |   |   |-- flashcards.tsx Leitner flashcard coach
|   |   |   |-- planner.tsx    Study calendar
|   |   |   |-- assessment.tsx Score dashboard
|   |   |   +-- buddy.tsx      AI study buddy chat
|   |   +-- styles.css         Liquid glass design system tokens
|   +-- src/test/              Frontend Vitest test suites
|
|-- tests/                     Backend pytest test suites
|   |-- __init__.py
|   |-- conftest.py            Shared fixtures + temp database setup
|   |-- test_scoring.py        Unit tests for scoring engine
|   +-- test_api.py            Integration tests via FastAPI TestClient
|
|-- requirements.txt           Python backend dependencies
|-- README.md                  This file
+-- LICENSE                    MIT License
```

---

## Local Setup & Execution

### Prerequisites

- Python 3.11+
- Node.js 20+
- npm or bun

### 1. Clone and prepare environment

```bash
git clone https://github.com/JDILEMMAX/preceptor-nexus-space.git
cd preceptor-nexus-space

# Create Python virtual environment
python -m venv .venv
.venv\Scripts\activate   # Windows
# source .venv/bin/activate  # macOS/Linux
```

### 2. Install backend dependencies

```bash
pip install -r requirements.txt
```

### 3. Seed the database

```bash
python data/seed.py
```

The database is auto-healed on server startup. This step is optional for development.

### 4. Configure environment variables

Copy the example file and fill in your API key:

```bash
cp .env.example .env
# Then open .env and set GEMINI_API_KEY=your_actual_key
```

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | Optional | Google AI Studio key. Without it the Study Buddy falls back to curated seed analogies. |
| `VITE_API_URL` | Optional | Override the backend URL (default: `http://localhost:8000`). |
| `HOST` | Optional | Bind address for uvicorn (default: `0.0.0.0`). |
| `PORT` | Optional | Port for uvicorn (default: `8000`). |

The `.env` file is Git-ignored. Never commit it.

### 5. Start the backend

```bash
uvicorn backend.main:app --reload --port 8000
```

API docs available at: http://localhost:8000/docs

### 6. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend available at: http://localhost:5173

### 7. Run backend tests

```bash
pytest tests/ -v
```

### 8. Run Playwright E2E tests

Playwright uses system-installed Chrome - no browser download needed.

```bash
# Install test dependencies (one-time)
pip install playwright pytest-playwright

# With both services running (steps 5 and 6 above):
pytest tests/test_e2e_browser.py -v
```

Tests cover:
- Viewport responsiveness at Desktop (1920x1080), Tablet (768x1024) and Mobile (375x667)
- All five routes: Dashboard, Assessment, Flashcards, Planner and AI Buddy
- Health badge accuracy, quiz interaction, card flip, theme toggle and storage popover

---

## API Route Specification

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/health` | Public | System uptime, database status and question count |
| GET | `/api/domains` | Public | All 3 AZ-900 domains with syllabus weighting data |
| GET | `/api/questions` | Public | Practice questions with correct answers stripped. Supports `?domain=` and `?limit=` |
| POST | `/api/evaluate` | Public | Evaluate learner submission server-side. Returns weighted score (0-1000) and domain diagnostics |
| POST | `/api/buddy/explain` | Public | Generate African regional analogy via Gemini AI with SQLite seed fallback |
| GET | `/docs` | Public | Auto-generated OpenAPI interactive documentation |
| GET | `/redoc` | Public | ReDoc API reference |

### Sample: POST /api/evaluate

**Request:**
```json
{
  "answers": [
    { "question_id": 1, "chosen_option": "B" },
    { "question_id": 2, "chosen_option": "C" }
  ]
}
```

**Response:**
```json
{
  "scaled_score": 750,
  "percentage": 75.0,
  "passed": true,
  "passing_mark": 700,
  "domain_breakdown": [...],
  "reviews": [...]
}
```

---

## Hackathon Compliance

This project was submitted for the **1MillionDevs Vibe Coding Hackathon - AZ-900 Edition** (20-23 October 2026).

**Compliance checklist:**

- [x] Addresses at least one of the five problem statements (all five are addressed)
- [x] All practice questions are original, written for this project
- [x] No real Microsoft exam questions are reproduced
- [x] No Microsoft logos are used
- [x] Clearly labelled as an unofficial, community-made tool

**Judging criteria alignment:**

| Criterion | Implementation |
|---|---|
| Learning value | Adaptive mastery loop - all five problem areas unified |
| Prompt engineering | Structured African analogy prompt with JSON schema enforcement |
| User experience | Liquid glass UI with offline-first IndexedDB persistence |
| Rapid prototyping | Lovable scaffold + FastAPI data tier built in 72 hours |
| Technical creativity | Anti-cheat server-side scoring with domain weighting |
| Presentation | README, architecture docs and API documentation included |

---

<div align="center">

Built with purpose for African learners. Not affiliated with Microsoft.

[Jesse Vincent](https://github.com/JDILEMMAX) - Power Learn Project - 1MillionDevs Cohort 2026

</div>
