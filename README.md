# FinMentor

An AI-powered personal finance assistant. FinMentor builds a complete picture of your finances
(income, expenses, savings, loans/EMIs, upcoming payments and goals), then:

- **Scores your financial health (0–100)** and flags risks: thin emergency savings, expensive
  debt, overspending, goals falling behind.
- **Forecasts your cash flow** month by month, so you see a shortfall before it happens.
- **Answers "Can I afford this?"** for any purchase, paid from savings or on EMI.
- **Simulates what-ifs**: big purchases, new loans, pay cuts, emergencies, savings plans,
  spending cuts.
- **Builds an action plan**: specific steps with rupee amounts and dates.
- **Explains everything in plain language** through a chat mentor powered by **Google Gemini**,
  using your own numbers rather than generic advice.

**Tech stack:** Python · FastAPI · React · TypeScript · Tailwind CSS · Recharts ·
PostgreSQL (Supabase) · Google Gemini API · pytest

---

## Contents
1. [How it works](#how-it-works)
2. [Prerequisites](#prerequisites)
3. [Run the project (step by step)](#run-the-project-step-by-step)
4. [Using the app](#using-the-app)
5. [Running the tests](#running-the-tests)
6. [Configuration reference](#configuration-reference)
7. [Project structure](#project-structure)
8. [Troubleshooting](#troubleshooting)
9. [Privacy](#privacy)
10. [API overview](#api-overview)

---

## How it works

All the financial calculations are plain, deterministic Python. Gemini only **explains** results
the engines have already computed; it never does the maths, and it never decides whether you can
afford something.

```
 React app ──► FastAPI ──► Profile builder ──► Health & risk engine ──► Action planner
    ▲             │               │                    │
    │             │               ├──► Cash-flow forecast
    │             │               └──► What-if simulator ──► "Can I afford this?"
    │             │
    │             └──► Mentor: facts from the engines ──► Google Gemini ──► plain-language reply
    │
 Supabase (login + PostgreSQL, each user can only see their own rows)
```

| Engine | File (`backend/app/services/`) | What it does |
|---|---|---|
| Profile builder | `profile_builder.py` | Loads everything the user has entered into one financial profile |
| Health & risk | `health_engine.py` | Savings rate, debt-to-income, emergency-fund months, spending on wants, credit-card use, goal pace → score + risks |
| Forecast | `forecast.py` | Month-by-month bank balance: salary, bills, EMIs (they stop when loans end), goal savings, one-off payments |
| What-if simulator | `simulator.py` | Applies hypothetical changes to a copy of the profile and compares before vs after |
| Can I afford this? | `affordability.py` | Runs a purchase through the simulator, checks 6 rules → Yes / Yes with caution / Not now / No, plus a safe budget and alternatives |
| Action planner | `action_planner.py` | Turns risks into ordered steps with ₹ amounts; your done/dismissed choices are kept |
| Mentor | `mentor.py`, `llm/client.py` | Builds a fact sheet and streams Gemini's reply; affordability answers come straight from the engine; falls back to templated answers if Gemini is unavailable |

---

## Prerequisites

Install these first:

| Tool | Version | Check with |
|---|---|---|
| Python | 3.10 or newer | `python --version` |
| Node.js | 18 or newer (includes npm) | `node --version` |
| A Supabase account | free tier is fine | https://supabase.com |
| A Google Gemini API key | free tier is fine | https://aistudio.google.com/apikey |

---

## Run the project (step by step)

You'll need **two terminals** at the end: one for the backend and one for the frontend.

### Step 1 — Set up Supabase (database + login)

1. Go to https://supabase.com, sign in and click **New project**. Wait for it to finish setting up.
2. Open **SQL Editor** → **New query**. Paste the contents of **`supabase/schema.sql`** and click **Run**.
3. Open another new query. Paste the contents of **`supabase/migrations/002_finmentor.sql`** and click **Run**.
4. *(Recommended for local testing)* Go to **Authentication → Sign In / Providers → Email** and turn
   **off "Confirm email"**. That lets you log in straight after signing up. Otherwise you need to
   click the link in the confirmation email first.
5. Go to **Project Settings → API** (and **JWT Keys**) and copy these four values:
   - **Project URL**
   - **anon / public** key
   - **service_role** key (secret; it goes only in the backend)
   - **JWT secret** (the legacy JWT secret)

### Step 2 — Get a Gemini API key

1. Go to https://aistudio.google.com/apikey.
2. Click **Create API key** and copy it.

### Step 3 — Fill in the `.env` files

Both files already exist, with blank slots.

**`backend/.env`**
```env
SUPABASE_URL=https://<your-project>.supabase.co
SUPABASE_ANON_KEY=<anon public key>
SUPABASE_SERVICE_ROLE_KEY=<service_role key>
SUPABASE_JWT_SECRET=<JWT secret>

ENV=development
CORS_ORIGINS=http://localhost:5173

GEMINI_API_KEY=<your Gemini API key>
GEMINI_MODEL=gemini-flash-latest
GEMINI_FALLBACK_MODEL=gemini-3.5-flash-lite
LLM_TIMEOUT_SECONDS=60
```

**`frontend/.env`**
```env
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon public key>
VITE_API_BASE_URL=http://localhost:8000
```

> ⚠️ Keep the **service_role key** and the **Gemini key** in `backend/.env` only. Anything in
> `frontend/.env` is bundled into the browser app, where anyone can read it.
> Both `.env` files are listed in `.gitignore`, so they won't be committed.

### Step 4 — Start the backend (terminal 1)

**Windows (PowerShell)**
```powershell
cd backend
python -m venv venv                  # first time only
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt      # first time only
uvicorn app.main:app --reload --port 8000
```

**Windows (Git Bash)**
```bash
cd backend
python -m venv venv                  # first time only
source venv/Scripts/activate
pip install -r requirements.txt      # first time only
uvicorn app.main:app --reload --port 8000
```

**macOS / Linux**
```bash
cd backend
python3 -m venv venv                 # first time only
source venv/bin/activate
pip install -r requirements.txt      # first time only
uvicorn app.main:app --reload --port 8000
```

Check that it's running:
- http://localhost:8000/health should show `{"status":"ok"}`
- http://localhost:8000/docs shows the interactive API docs

> If PowerShell blocks `Activate.ps1`, run
> `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once, or use Git Bash.

### Step 5 — Start the frontend (terminal 2)

```bash
cd frontend
npm install          # first time only
npm run dev
```

Open **http://localhost:5173** in your browser.

### Step 6 — Try it out

1. Click **Get started** and sign up with an email and password.
2. On the privacy screen, keep **"Use my data for recommendations"** on. The AI mentor needs it.
3. Complete the short onboarding (name, income, dependents).
4. On the last step, choose **"Explore first with a sample profile"** to load a fictional person's
   finances instantly, or **"Add expenses, loans & goals"** to enter your own.
5. Explore the dashboard, then try **What-if**, **Plan** and **Mentor**. For example, ask the mentor
   *"Can I afford a ₹60,000 phone?"* or *"How fast can I clear my credit card?"*

### Every time after the first run

```bash
# terminal 1
cd backend
.\venv\Scripts\Activate.ps1          # or: source venv/Scripts/activate  /  source venv/bin/activate
uvicorn app.main:app --reload --port 8000

# terminal 2
cd frontend
npm run dev
```

---

## Using the app

| Page | What you can do |
|---|---|
| **Overview** | Health score and its breakdown, 6-month cash-flow chart, risks, your next 3 steps, goal progress, upcoming payments |
| **My money** | Add, edit or delete income, expenses (mark needs vs wants), loans & EMIs, savings, goals and one-off upcoming payments. Load the sample profile from here too |
| **What-if** | **Can I afford this?** (savings or EMI) and the **simulator**: stack changes, compare against your current path, save scenarios |
| **Plan** | Your action plan grouped by area (spending, saving, debt, goals). Mark steps done, in progress, or not for you |
| **Mentor** | Chat about your money. Also available from the **Ask FinMentor** button on every page |

---

## Running the tests

The tests don't need Supabase or a Gemini key; everything external is mocked.

```bash
cd backend
.\venv\Scripts\Activate.ps1          # or the activate command for your shell
pytest
```

They cover the finance maths, health score and risks, forecast, simulator, affordability rules,
action planner, mentor fact sheet, every API route (against an in-memory database), and the Gemini
client (streaming, retries, fallback model, error messages).

Frontend type-check and production build:
```bash
cd frontend
npm run build
```

---

## Configuration reference

**`backend/.env`**

| Variable | Required | Description |
|---|---|---|
| `SUPABASE_URL` | ✅ | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | ✅ | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Secret service-role key (used only to write audit logs) |
| `SUPABASE_JWT_SECRET` | ✅ | Used to verify login tokens |
| `CORS_ORIGINS` | ✅ | Frontend address(es), comma-separated. Default `http://localhost:5173` |
| `GEMINI_API_KEY` | For AI chat | Without it, the mentor still answers using templates |
| `GEMINI_MODEL` | – | Default `gemini-flash-latest` (always the current Flash model) |
| `GEMINI_FALLBACK_MODEL` | – | Default `gemini-3.5-flash-lite`; used only when the main model is overloaded. Leave blank to disable |
| `LLM_TIMEOUT_SECONDS` | – | Default `60` |

**`frontend/.env`**

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Same as `SUPABASE_URL` |
| `VITE_SUPABASE_ANON_KEY` | Same as `SUPABASE_ANON_KEY` |
| `VITE_API_BASE_URL` | Backend address. Default `http://localhost:8000` |

> After changing `backend/.env`, restart the backend. After changing `frontend/.env`, restart
> `npm run dev`.

---

## Project structure

```
Finance_agent/
├── backend/
│   ├── app/
│   │   ├── main.py                 # FastAPI app + router registration
│   │   ├── core/                   # config (.env), auth, Supabase clients
│   │   ├── routers/                # HTTP endpoints (finances, analysis, simulate, actions, mentor, …)
│   │   ├── schemas/                # Pydantic models
│   │   ├── services/               # the engines (health, forecast, simulator, affordability, planner, mentor)
│   │   │   └── llm/client.py       # Google Gemini streaming client
│   │   └── data/sample_profile.json  # fictional demo profile
│   ├── tests/                      # pytest suite + in-memory Supabase fake
│   ├── requirements.txt
│   └── .env                        # your secrets (not committed)
├── frontend/
│   ├── src/
│   │   ├── pages/                  # Dashboard, Profile, Simulate, Plan, Mentor, onboarding…
│   │   ├── components/             # layout, charts, chat, editors, UI primitives
│   │   └── lib/                    # API client, types, formatting
│   └── .env                        # Supabase URL/anon key + backend URL
└── supabase/
    ├── schema.sql                  # base tables + row-level security
    └── migrations/002_finmentor.sql  # FinMentor tables
```

---

## Troubleshooting

| Problem | Fix |
|---|---|
| **401 "Invalid or expired token"** on every page | `SUPABASE_JWT_SECRET` is wrong. Copy the **legacy JWT secret** from Supabase (Project Settings → JWT Keys) and restart the backend. The backend verifies tokens with this shared secret (HS256). |
| **Can't log in after signing up** | Email confirmation is on. Click the link in the email, or turn off "Confirm email" (Step 1.4). |
| **Errors like `relation "expenses" does not exist`** | The migration hasn't been run. Run `supabase/migrations/002_finmentor.sql` in the SQL Editor. |
| **Browser shows a CORS error** | Make sure `CORS_ORIGINS` in `backend/.env` matches the address in your browser (e.g. `http://localhost:5173`), then restart the backend. |
| **Frontend shows "Failed to fetch"** | The backend isn't running, or `VITE_API_BASE_URL` is wrong. |
| **Mentor says "No Gemini API key set"** | Add `GEMINI_API_KEY` to `backend/.env` and restart the backend. |
| **Mentor says "Gemini is busy right now"** | Google's servers are overloaded. The app has already retried and tried the fallback model; wait a minute. |
| **Mentor says "model not found"** | Google retired that model. Set `GEMINI_MODEL=gemini-flash-latest`. |
| **Mentor returns 403 / asks for permission** | Turn on "Use my data for recommendations" on the privacy screen (`/consent`). |
| **`uvicorn` or `pytest` not found** | Activate the virtual environment first (Step 4). |
| **Port 8000 or 5173 already in use** | Stop the other process, or run `uvicorn … --port 8001` and update `VITE_API_BASE_URL`. |

---

## Privacy

- **Row-level security** on every table: each user can only read and write their own rows. The
  backend acts as the logged-in user, not as an admin.
- The mentor only works if the user has turned on the **"Use my data for recommendations"** consent.
- Only a computed **summary** of the user's numbers is sent to Google Gemini, never raw database
  rows, IDs or account details. Savings facts marked `ai_allowed = false` are left out.
- "Can I afford this?" verdicts come from the rule engine, never from the AI.
- Users can **export** or **delete** all their data (`/privacy/export`, `DELETE /privacy`).
- The sample profile (`backend/app/data/sample_profile.json`) is fictional.

---

## API overview

Full interactive docs: http://localhost:8000/docs (while the backend is running).

| Area | Endpoints |
|---|---|
| Profile data | `GET/POST /finances/{income,expenses,debts,goals}`, `PUT/DELETE /finances/{…}/{id}`, `GET/PUT /finances/savings`, `POST /finances/load-sample` |
| Upcoming payments | `GET/POST /calendar`, `PUT/DELETE /calendar/{id}` |
| Analysis | `GET /analysis/overview`, `GET /analysis/health`, `GET /analysis/forecast?months=6` |
| Decisions | `POST /simulate`, `POST /simulate/afford`, `GET/POST /simulate/saved`, `DELETE /simulate/saved/{id}` |
| Action plan | `GET /actions`, `PATCH /actions/{id}` |
| Mentor | `POST /mentor/chat` (streamed text), `GET/DELETE /mentor/history` |
| Account | `/profile`, `/profile/onboarding/*`, `/privacy`, `/privacy/export` |
