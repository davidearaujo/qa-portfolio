# TaskFlow

A small full-stack task manager, built specifically as the system-under-test for a QA portfolio (Postman API testing + Selenium/Cypress/Playwright E2E testing, including BDD with Gherkin).

## Structure

```
app/
├── server/    # Express + TypeScript + SQLite REST API
└── client/    # React + TypeScript frontend (Vite)
```

Each has its own README with setup instructions.

## Running locally

Open two terminals:

```bash
# Terminal 1
cd server
npm install
cp .env.example .env
npm run dev
# API on http://localhost:4000

# Terminal 2
cd client
npm install
cp .env.example .env
npm run dev
# App on http://localhost:5173
```

Register an account, then log in — the SQLite database and schema are created automatically, no manual setup required.

## Why this app

Built to give both QA projects real, meaningful surface area to test against:

- **Auth flow** (register/login) → validation errors, duplicate-email conflicts, wrong-password handling, JWT-protected routes
- **CRUD with ownership scoping** → tasks belong to a specific user; accessing someone else's task returns 404
- **Pagination and filtering** → query params, edge cases (empty pages, invalid values)
- **Consistent, structured error responses** → predictable `{ error: { code, message, details? } }` shape across every endpoint
- **A real (if small) UI** → login/register forms, task list, filters, pagination — enough for genuine E2E flows, not just a single button click

See the [server README](./server/README.md) for the full API reference and the [client README](./client/README.md) for the list of `data-testid` selectors to use in your E2E tests.
