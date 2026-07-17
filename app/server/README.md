# TaskFlow API

A small task-management REST API built with Express, TypeScript, and SQLite.
Built as the system-under-test for a QA portfolio (Postman + Selenium/Cypress/Playwright projects).

## Stack
- Node.js + Express + TypeScript
- SQLite (`better-sqlite3`) — zero-config, file-based, no external DB account needed
- JWT auth (`jsonwebtoken` + `bcryptjs`)
- Validation via `zod`

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

The API starts on `http://localhost:4000` (configurable via `.env`).
The SQLite database file and schema are created automatically on first boot — no migrations to run.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Run with hot-reload (tsx watch) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run the compiled build |
| `npm run lint` | Type-check without emitting files |

## API Reference

All error responses follow the same shape:
```json
{ "error": { "code": "SOME_CODE", "message": "Human readable message", "details": {} } }
```

### Auth

| Method | Route | Auth | Description | Status codes |
|---|---|---|---|---|
| POST | `/auth/register` | No | Create an account | 201, 400, 409 |
| POST | `/auth/login` | No | Get a JWT | 200, 400, 401 |

### Tasks
All `/tasks` routes require `Authorization: Bearer <token>`.

| Method | Route | Description | Status codes |
|---|---|---|---|
| GET | `/tasks?page=&limit=&completed=` | List current user's tasks (paginated, filterable) | 200, 400, 401 |
| GET | `/tasks/:id` | Get one task | 200, 400, 401, 404 |
| POST | `/tasks` | Create a task | 201, 400, 401 |
| PATCH | `/tasks/:id` | Update a task (partial) | 200, 400, 401, 404 |
| DELETE | `/tasks/:id` | Delete a task | 204, 400, 401, 404 |

### Misc
| Method | Route | Description |
|---|---|---|
| GET | `/health` | Health check, returns `{ status: "ok", timestamp }` |

## Notable design decisions (useful context for QA)
- Login returns the **same** error message for "unknown email" and "wrong password" (401 `Invalid email or password`) — deliberate, to avoid leaking which emails are registered.
- Requesting a task that exists but belongs to another user returns **404**, not 403 — deliberate, to avoid revealing that the ID exists.
- Validation errors always return `400` with `code: "VALIDATION_ERROR"` and field-level `details` from Zod.
- `DELETE` returns `204 No Content` with an empty body (standard REST convention) — don't expect a JSON body on that response.

## Deployment
Deployed for free on [Render](https://render.com) (Web Service, free tier). Build command: `npm install && npm run build`. Start command: `npm start`. Remember to set `JWT_SECRET`, `CORS_ORIGIN`, and `DATABASE_PATH` as environment variables in the Render dashboard.
