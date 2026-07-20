# TaskFlow API Reference

Base URL (local): `http://localhost:4000`
Base URL (production): see `README.md` for the current deployed URL.

All request and response bodies are JSON. All error responses share one shape:

```json
{
  "error": {
    "code": "SOME_CODE",
    "message": "Human-readable message",
    "details": { }
  }
}
```

`details` is only present on validation errors (`400 VALIDATION_ERROR`), and contains Zod's field-level breakdown.

## Authentication

Two routes (`/auth/register`, `/auth/login`) are public. Every route under `/tasks` requires a JSON Web Token, obtained from either of those two routes.

Send it on every `/tasks` request as:

```
Authorization: Bearer <token>
```

| Missing/malformed header | Expired token | Invalid/tampered token |
|---|---|---|
| `401` — "Missing or malformed Authorization header" | `401` — "Token has expired" | `401` — "Invalid token" |

Tokens expire after **1 hour** by default (`JWT_EXPIRES_IN` in `.env`). There is no refresh-token flow — the client must log in again once the token expires.

---

## `GET /health`

Health check. No auth required.

**Response — `200 OK`**
```json
{
  "status": "ok",
  "timestamp": "2026-07-20T10:00:00.000Z"
}
```

---

## `POST /auth/register`

Creates a new account and returns a token (auto-logs-in on registration). No auth required.

**Request body**

| Field | Type | Required | Constraints |
|---|---|---|---|
| `email` | string | yes | Must be a valid email format |
| `password` | string | yes | 8–72 characters |

```json
{
  "email": "user@example.com",
  "password": "a-secure-password"
}
```

**Response — `201 Created`**
```json
{
  "user": {
    "id": 1,
    "email": "user@example.com",
    "createdAt": "2026-07-20 10:00:00"
  },
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Errors**

| Status | Code | When |
|---|---|---|
| `400` | `VALIDATION_ERROR` | Email is malformed, password is under 8 or over 72 characters, or either field is missing |
| `409` | `CONFLICT` | An account with this email already exists |

---

## `POST /auth/login`

Authenticates an existing account and returns a token. No auth required.

**Request body**

| Field | Type | Required | Constraints |
|---|---|---|---|
| `email` | string | yes | Must be a valid email format |
| `password` | string | yes | Non-empty |

```json
{
  "email": "user@example.com",
  "password": "a-secure-password"
}
```

**Response — `200 OK`**

Same shape as `POST /auth/register`'s response.

**Errors**

| Status | Code | When |
|---|---|---|
| `400` | `VALIDATION_ERROR` | Email is malformed or password is empty |
| `401` | `UNAUTHORIZED` | Email doesn't exist, **or** password is wrong |

> **Note:** the 401 message is deliberately identical ("Invalid email or password") whether the email doesn't exist or the password is wrong. This is intentional — it prevents an attacker from using this endpoint to check which emails are registered. Don't rely on the message to distinguish the two cases.

---

## `GET /tasks`

Lists the authenticated user's tasks, paginated. **Requires auth.**

**Query parameters**

| Param | Type | Required | Default | Constraints |
|---|---|---|---|---|
| `page` | integer | no | `1` | ≥ 1 |
| `limit` | integer | no | `10` | 1–100 |
| `completed` | `"true"` \| `"false"` | no | (no filter) | Filters by completion status |

Example: `GET /tasks?page=2&limit=20&completed=false`

**Response — `200 OK`**
```json
{
  "data": [
    {
      "id": 1,
      "title": "Write QA plan",
      "description": "Draft the test strategy doc",
      "completed": false,
      "createdAt": "2026-07-20 10:00:00",
      "updatedAt": "2026-07-20 10:00:00"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPages": 1
  }
}
```

**Errors**

| Status | Code | When |
|---|---|---|
| `400` | `VALIDATION_ERROR` | `page`/`limit` isn't a valid positive integer, `limit` exceeds 100, or `completed` isn't exactly `"true"`/`"false"` |
| `401` | `UNAUTHORIZED` | Missing, invalid, or expired token |

Only tasks belonging to the authenticated user are ever returned — there is no way to list another user's tasks.

---

## `GET /tasks/:id`

Fetches a single task by ID. **Requires auth.**

**Response — `200 OK`**
```json
{
  "data": {
    "id": 1,
    "title": "Write QA plan",
    "description": "Draft the test strategy doc",
    "completed": false,
    "createdAt": "2026-07-20 10:00:00",
    "updatedAt": "2026-07-20 10:00:00"
  }
}
```

**Errors**

| Status | Code | When |
|---|---|---|
| `400` | `BAD_REQUEST` | `:id` isn't a positive integer (e.g. `/tasks/abc`) |
| `401` | `UNAUTHORIZED` | Missing, invalid, or expired token |
| `404` | `NOT_FOUND` | Task doesn't exist, **or** it belongs to a different user |

> **Note:** requesting a task that exists but belongs to someone else returns `404`, not `403`. This is intentional — it avoids confirming to an attacker that a given task ID exists at all. Don't assume a `404` always means "this ID was never created."

---

## `POST /tasks`

Creates a new task owned by the authenticated user. **Requires auth.**

**Request body**

| Field | Type | Required | Constraints |
|---|---|---|---|
| `title` | string | yes | 1–200 characters (trimmed) |
| `description` | string | no | Up to 2000 characters |

```json
{
  "title": "Write QA plan",
  "description": "Draft the test strategy doc"
}
```

**Response — `201 Created`**

Same task shape as `GET /tasks/:id`. New tasks always have `completed: false`.

**Errors**

| Status | Code | When |
|---|---|---|
| `400` | `VALIDATION_ERROR` | `title` is missing, empty/whitespace-only, or over 200 characters; or `description` exceeds 2000 characters |
| `401` | `UNAUTHORIZED` | Missing, invalid, or expired token |

---

## `PATCH /tasks/:id`

Partially updates a task. Only the fields provided are changed; anything omitted keeps its current value. **Requires auth.**

**Request body** — at least one field is required

| Field | Type | Required | Constraints |
|---|---|---|---|
| `title` | string | no* | 1–200 characters (trimmed) if provided |
| `description` | string | no* | Up to 2000 characters if provided |
| `completed` | boolean | no* | — |

```json
{ "completed": true }
```

**Response — `200 OK`**

The updated task, same shape as `GET /tasks/:id`. `updatedAt` reflects the change.

**Errors**

| Status | Code | When |
|---|---|---|
| `400` | `VALIDATION_ERROR` | Body is empty (`{}`), `title` is empty/too long, or `description` is too long |
| `400` | `BAD_REQUEST` | `:id` isn't a positive integer |
| `401` | `UNAUTHORIZED` | Missing, invalid, or expired token |
| `404` | `NOT_FOUND` | Task doesn't exist, or belongs to a different user (same 404-not-403 behavior as `GET /tasks/:id`) |

---

## `DELETE /tasks/:id`

Deletes a task permanently. **Requires auth.**

**Response — `204 No Content`**

Empty body. Do not attempt to parse this response as JSON.

**Errors**

| Status | Code | When |
|---|---|---|
| `400` | `BAD_REQUEST` | `:id` isn't a positive integer |
| `401` | `UNAUTHORIZED` | Missing, invalid, or expired token |
| `404` | `NOT_FOUND` | Task doesn't exist, or belongs to a different user |

---

## Quick reference table

| Method | Path | Auth | Success | Possible errors |
|---|---|---|---|---|
| GET | `/health` | No | 200 | — |
| POST | `/auth/register` | No | 201 | 400, 409 |
| POST | `/auth/login` | No | 200 | 400, 401 |
| GET | `/tasks` | Yes | 200 | 400, 401 |
| GET | `/tasks/:id` | Yes | 200 | 400, 401, 404 |
| POST | `/tasks` | Yes | 201 | 400, 401 |
| PATCH | `/tasks/:id` | Yes | 200 | 400, 401, 404 |
| DELETE | `/tasks/:id` | Yes | 204 | 400, 401, 404 |

## Error code glossary

| Code | Status | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Request body or query params failed schema validation. `details.fieldErrors` names the specific field(s). |
| `BAD_REQUEST` | 400 | A URL parameter (currently only `:id`) is malformed. |
| `UNAUTHORIZED` | 401 | Missing, malformed, expired, or invalid token — or (on login) wrong credentials. |
| `NOT_FOUND` | 404 | Resource doesn't exist, isn't owned by the requester, or the route itself doesn't exist. |
| `CONFLICT` | 409 | Email already registered. |
| `INTERNAL_ERROR` | 500 | Unexpected server-side failure. Should not happen in normal use — please report if you see one. |
