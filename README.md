# Financial Money Mentor

An AI-driven personal finance decision-support app — not just a budget tracker. It computes your
financial health, forecasts cash-flow shortages, evaluates "can I afford this?", simulates loan and
income-loss what-ifs, and gives you a prioritized action plan. A chat mentor explains the numbers in
plain language and lays out options — it never issues directives like "take this loan."

## Stack

- **Frontend**: React + Vite + TypeScript + Tailwind CSS + Recharts (`frontend/`)
- **Backend**: Node.js + Express + TypeScript + Prisma + SQLite (`backend/`)
- **AI**: pluggable provider — Claude, OpenAI, or Gemini API (`backend/src/ai/`)

## Running locally

### 1. Backend

```
cd backend
npm install
cp .env.example .env
npx prisma migrate dev --name init
npm run seed               # loads the spec's worked example as demo data
npm run dev                 # http://localhost:4000
```

To chat with the AI mentor, set `AI_PROVIDER` in `backend/.env` to one of `claude`, `openai`, or `gemini`,
and fill in the matching API key:

- `AI_PROVIDER=claude` + `ANTHROPIC_API_KEY=...` (from https://console.anthropic.com/)
- `AI_PROVIDER=openai` + `OPENAI_API_KEY=...` (from https://platform.openai.com/api-keys)
- `AI_PROVIDER=gemini` + `GEMINI_API_KEY=...` (from https://aistudio.google.com/apikey)

### 2. Frontend

```
cd frontend
npm install
npm run dev                 # http://localhost:5173
```

The Vite dev server proxies `/api/*` to the backend on port 4000.

## Testing

```
cd backend
npm test
```

Engine unit tests are calibrated against the spec's own worked examples (₹9,500 disposable income,
a cash-flow shortage at day 8, a 40,000 phone purchase evaluation, etc.).

## Notes

- Single-user demo mode: there's no login, all data belongs to one demo user.
- Data entry is manual only (no bank integration) — by design, per the project's privacy principle.
- The financial math (health score, forecasts, affordability, simulations) is fully deterministic and
  unit-tested; the AI layer only explains those numbers, it never computes them.
