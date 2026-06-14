# NeuroPath — Autonomous Adaptive Learning OS (v2)

Multi-agent (LangGraph) backend on FastAPI, React/Vite/Three.js/D3 frontend,
PostgreSQL (Neon) database, JWT auth, and an AI Proctoring layer that adapts
roadmaps, resources, and assessments to each learner in real time.

---

## 1. What's new in v2

1. **No static resources** — every concept gets a dynamically generated, interactive
   3D simulation (8 template types: graph algorithms, sorting, neural networks,
   math/physics, data structures, system architecture, probability/stats, generic 3D).
2. **Higher-quality roadmaps & assessments** — CurriculumAgent now produces 8-12
   rigorously sequenced concepts with key skills, time estimates, and chapter refs;
   AssessmentAgent generates 5 scenario-based questions per quiz with explanations
   and a 75% pass threshold.
3. **Strict sequential progression** — only one concept is "available" at a time.
   Passing its quiz unlocks the next concept in `sequential_order`. No skipping ahead.
4. **3D simulation for every node** — `simulation_type` is mandatory for all concepts;
   the Simulation Agent generates a config for each.
5. **JWT auth (signup/login)** — all learning data is now tied to a real user account
   (`/auth/signup`, `/auth/login`, `/auth/me`). All other endpoints require a Bearer token.
6. **Dashboard** — daily/weekly progress charts (XP, time, score), streaks, and a
   list of every course the user has started, with one-click resume.
7. **AI Proctoring** — tracks per-question answer time, simulation viewing time,
   correct/incorrect patterns. Updates a `ProctoringProfile` (strength/weakness tags,
   preferred difficulty, consistency score) after every quiz. This profile feeds back
   into: CurriculumAgent (roadmap generation), AssessmentAgent (quiz difficulty &
   targeted questions), and FeedbackAgent (remediation + difficulty adjustment).

---

## 2. Repository layout

```
neuropath/
  backend/
    app/
      agents/        # 6 agents + LangGraph orchestration (main + assessment graphs)
      api/           # auth, intake, roadmap, learning, dashboard routes
      models/        # SQLAlchemy models (13 tables) + Pydantic schemas
      services/      # LLM client, file extraction, JWT auth, AI proctoring
      db/            # SQLAlchemy session
      config.py
      main.py
    schema.sql        # full raw SQL schema (13 tables, indexes, constraints)
    init_db.py        # creates tables from SQLAlchemy models
    requirements.txt
    render.yaml
    .env.example
  frontend/
    src/
      pages/          # Landing, Login, Signup, Topic, Upload, Dashboard,
                       # Roadmap, Simulation, Quiz, MindMap
      components/
        sims/         # 8 Three.js simulation renderers
      lib/api.ts       # API client with JWT interceptor
      store/           # zustand: auth + roadmap state
    package.json
    vercel.json
    .env.example
```

---

## 3. Prerequisites

- Python 3.11+
- Node.js 18+
- A Neon (or any Postgres) database URL
- A Groq API key (https://console.groq.com) — free tier works with Llama 3.3 70B

---

## 4. Backend setup (local)

```bash
cd backend
python3 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate

pip install -r requirements.txt

cp .env.example .env
# Edit .env:
#   DATABASE_URL=postgresql://...neon.tech/neuropath?sslmode=require
#   GROQ_API_KEY=gsk_...
#   JWT_SECRET=<generate a long random string>
#   CORS_ORIGINS=http://localhost:5173

# Create tables (either method):
python init_db.py
#   OR: psql $DATABASE_URL -f schema.sql

# Run the API
uvicorn app.main:app --reload --port 8000
```

API docs at `http://localhost:8000/docs`.

---

## 5. Frontend setup (local)

```bash
cd frontend
npm install

cp .env.example .env
# VITE_API_BASE_URL=http://localhost:8000

npm run dev
```

Open `http://localhost:5173`.

---

## 6. End-to-end smoke test

1. **Sign up** (`/signup`) → creates a `User` + blank `ProctoringProfile`, returns a JWT
   stored in `localStorage` and attached to every API call.
2. **Dashboard** → empty state with "New topic" / "Upload book" CTAs, plus empty
   progress charts and proctoring panel (defaults: medium difficulty, 50% correct rate).
3. **Topic mode**: enter "Teach me Reinforcement Learning" → Generate.
   - KnowledgeSourceAgent → CurriculumAgent (8-12 sequential concepts, every node
     tagged with a `simulation_type`) → SimulationAgent (3D config per node) →
     MindMapAgent.
   - Roadmap page shows a **sequential progress rail** — only step 1 is unlocked.
4. Click the unlocked concept → **3D simulation** renders automatically based on
   `simulation_type` (graph/sorting/neural net/math/data structure/architecture/stats/generic).
   Leaving the page records viewing time to the proctoring profile.
5. **Take quiz** → AssessmentAgent generates 5 adaptive questions (with explanations).
   Per-question timing + total time are sent to `/evaluate`.
   - **Pass (≥75%)** → node mastered, next sequential node unlocked automatically,
     "Continue to next concept" button appears.
   - **Fail** → FeedbackAgent recommends prerequisite review + writes remediation text;
     AI Proctoring may flag a difficulty adjustment (increase/decrease) for future quizzes.
6. **Dashboard** now shows: updated daily progress bar chart, weekly summary stats,
   streak counter, XP, proctoring insight sentence, strength/weakness tags, and the
   course card with live progress %. Click a course card to resume exactly where you
   left off (`/learning-paths/{id}`).
7. **Mind Map** page — D3 radial graph of the same concept DAG.

---

## 7. Deployment

### Backend → Render
1. Push `backend/` to GitHub. In Render: New → Web Service, root dir `backend`.
2. `render.yaml` is auto-detected. Set env vars: `DATABASE_URL`, `GROQ_API_KEY`,
   `JWT_SECRET`, `CORS_ORIGINS` (your Vercel URL).
3. Deploy → note the service URL.

### Database → Neon
1. Create a project at https://neon.tech, copy connection string to `DATABASE_URL`.
2. Run `schema.sql` via the Neon SQL editor or `psql`.

### Frontend → Vercel
1. Push `frontend/` to GitHub. In Vercel: New Project, root dir `frontend`,
   framework preset Vite.
2. Env var `VITE_API_BASE_URL=https://<your-render-service>.onrender.com`.
3. Deploy. Update backend `CORS_ORIGINS` with the Vercel URL, redeploy backend.

---

## 8. API summary

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/auth/signup` | — | Create account, returns JWT |
| POST | `/auth/login` | — | OAuth2 form login, returns JWT |
| GET | `/auth/me` | ✓ | Current user info |
| POST | `/topic` | ✓ | Validate a topic submission |
| POST | `/upload` | ✓ | Upload PDF/DOCX, extract chapters |
| POST | `/generate-roadmap` | ✓ | Run main LangGraph (4 agents), persist sequential DAG/sims/mindmap |
| GET | `/learning-paths/{id}` | ✓ | Reload a previously generated roadmap (resume course) |
| POST | `/generate-simulation` | ✓ | Fetch stored 3D simulation config for a concept node |
| POST | `/simulation-viewed` | ✓ | AI proctoring: record time spent on a simulation |
| POST | `/generate-quiz` | ✓ | AssessmentAgent generates a 5-question adaptive quiz |
| POST | `/evaluate` | ✓ | Run assessment sub-graph; sequential unlock; updates proctoring profile |
| GET | `/mindmap?learning_path_id=` | ✓ | Fetch D3 mind map JSON |
| GET | `/agent-log?session_id=` | ✓ | Fetch chronological agent activity log |
| GET | `/dashboard` | ✓ | Courses, daily/weekly progress, streaks, proctoring profile |

---

## 9. AI Proctoring details

`ProctoringProfile` (one per user) tracks:
- `avg_reading_speed` — EMA of seconds spent per simulation (from `/simulation-viewed`)
- `avg_quiz_time` — EMA of seconds per quiz question (from `/evaluate`)
- `correct_rate` — EMA of quiz scores
- `strength_tags` / `weakness_tags` — `concept_tag`s from quiz questions, correct vs incorrect
- `preferred_difficulty` — easy/medium/hard, set by the LLM-based proctoring analysis
- `consistency_score` — 0-1, regularity/improvement of study pattern
- `roadmap_adjustments` — count of difficulty re-routes

This profile is passed into:
- **CurriculumAgent** when generating a new roadmap (adjusts difficulty curve, flags
  already-strong areas)
- **AssessmentAgent** when generating quizzes (targets weak tags, sets quiz difficulty)
- **FeedbackAgent** on quiz failure (personalizes remediation, recommends
  `difficulty_adjustment`)

`DailyProgress` rows (one per user per day) aggregate `concepts_studied`,
`quizzes_taken/passed`, `total_time_sec`, `avg_score`, and `xp_earned` — surfaced on
the dashboard as daily/weekly charts and streaks.

---

## 10. Notes / known MVP simplifications

- Quiz pass threshold raised to 75%.
- Sequential unlock overrides the prerequisite graph for *progression* (prerequisites
  are still shown for context/feedback), ensuring a single linear path per course —
  matches requirement "roadmap updation should be sequential."
- `difficulty_adjustment` from AI proctoring updates `learning_paths.difficulty_level`
  and the user's `preferred_difficulty`, which feeds the *next* roadmap/quiz generation
  (full mid-roadmap node regeneration is a natural extension but out of scope for MVP).
- Document text sent to CurriculumAgent capped at ~10-12K chars to control token usage.

---

## 11. Troubleshooting

### `TypeError: Client.__init__() got an unexpected keyword argument 'proxies'`

This is caused by an incompatible `httpx` version being installed alongside `groq`
(newer `httpx` ≥0.28 removed the `proxies` kwarg that older `groq` SDK versions pass
internally). Fix by pinning `httpx==0.27.2` (already done in `requirements.txt`).

If you already have a venv with the bad version installed, run:

```bash
cd backend
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install "httpx==0.27.2"
```

Then restart `uvicorn`. The app also now lazily initializes the Groq client, so even
if a version conflict exists, the server will start and the error will only surface
(with a clear traceback) on the first AI-generation request rather than crashing on boot.

### `psycopg2.errors.UndefinedColumn: column learning_paths.sequential_order does not exist`
(or similar for `proctoring_profiles`, `concept_nodes.simulation_type`, etc.)

Your database was created from the **v1 schema** before the v2 changes (sequential
roadmaps, AI proctoring, daily progress, JWT auth) were added. Run the migration
script against your existing database — it's additive/idempotent and won't drop data:

```bash
cd backend
psql $DATABASE_URL -f migration_v1_to_v2.sql
```

This:
- Adds `sequential_order`, `current_step`, `difficulty_level` to `learning_paths`
- Adds `sequential_position`, `avg_time_seconds` to `concept_nodes`, and migrates
  `simulation_template` → `simulation_type` (backfilling `generic_3d` if empty)
- Adds `time_taken_sec`, `per_question_time`, `difficulty_level` to `quiz_attempts`
- Adds `strong_areas`, `difficulty_adjustment` to `feedback_records`
- Creates `daily_progress`, `proctoring_profiles`, `proctoring_events` tables
- Backfills `sequential_position`/`sequential_order` from existing node creation
  order, and creates a blank `proctoring_profiles` row for every existing user

After running it, restart `uvicorn` — `/dashboard` and the rest of the v2 endpoints
should work. If you'd rather start fresh, drop all tables and re-run
`psql $DATABASE_URL -f schema.sql` (this deletes all existing data).

---

## 12. v3 additions: Rich 3D visuals, tiered quizzes, lesson content

### 3D simulations
- SimulationAgent now reasons about the best visual metaphor per concept and
  always includes a `learning_focus` caption shown above the 3D canvas.
- 3 new template types: `comparison_3d` (side-by-side bar comparison),
  `timeline_3d` (animated sequential process with play/pause), `state_machine_3d`
  (3D state diagram with transitions).
- Any node whose generated config is empty/trivial is automatically retried with
  a stricter single-node prompt before being persisted, so every concept gets a
  meaningful simulation.

### Tiered quizzes (Easy / Medium / Hard)
- Every quiz now has 6 questions in 3 sections of 2 (easy/medium/hard), rendered
  as distinct color-coded sections with per-section "answered" counters.
- Pass rule: overall score ≥ 75% **and** the easy section must be 100% — missing
  fundamentals blocks progression even if the overall score clears the bar.
- Results show a 3-segment score bar; failing the easy section shows a dedicated
  "Master the fundamentals first" message and surfaces those questions first in
  the review list.
- `QuizAttempt.section_scores` (JSONB) stores `{"easy":1.0,"medium":0.5,"hard":0.0}`.
- `weak_areas`/`strong_areas` are now tagged by level, e.g. `"hard: edge-case
  handling of null inputs"` — FeedbackAgent treats any `"easy:"` weak area as an
  automatic difficulty `decrease`.

### Topic-relevant lesson content ("Learn" tab)
- CurriculumAgent now also generates `content_md` (150-300 words of Markdown) per
  concept, framed specifically for the overall course topic (and grounded in the
  document excerpt for book mode).
- RoadmapPage has a new "📖 Learn" button per concept that renders this content via
  a lightweight built-in Markdown renderer (`MarkdownContent.tsx` — no extra deps).
- Time spent in the Learn panel is sent to `POST /content-viewed`, which feeds
  `ProctoringProfile.avg_reading_speed` the same way `/simulation-viewed` does —
  AI Proctoring now considers both simulation-viewing and lesson-reading time.

### Migration
Run `migration_v2_to_v3.sql` against an existing database:
```bash
psql $DATABASE_URL -f migration_v2_to_v3.sql
```
Adds `concept_nodes.content_md` and `quiz_attempts.section_scores`. Fresh
databases can just use the updated `schema.sql` directly.

### New/changed endpoints
- `POST /content-viewed` — `{concept_node_id, time_spent_sec}` → AI proctoring telemetry for lesson reading time.
- `POST /generate-simulation` response now includes `learning_focus`.
- `POST /evaluate` response now includes `section_scores: {"easy":..,"medium":..,"hard":..}`.
- `POST /generate-quiz` response `quiz_json` is now `{"sections":[...], "quiz_difficulty":..., "estimated_minutes":...}` instead of a flat `questions` list.
