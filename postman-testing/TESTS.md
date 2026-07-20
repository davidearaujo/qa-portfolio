# TaskFlow API — Postman Test Documentation

This document describes every request in `collections/TaskFlow.postman_collection.json`: what it tests, what it depends on, and what it asserts. It's meant as a reference alongside the collection itself — useful when reviewing coverage, onboarding someone else to the project, or deciding where to add new tests.

**Total: 36 requests across 5 folders, 87+ assertions.**

## Run order matters

Folders must run in this sequence, because later folders depend on environment variables set by earlier ones:

```
Health → Auth → Tasks → Cross-User Ownership → Data-Driven Validation (independent)
```

| Folder | Depends on variable | Set by |
|---|---|---|
| Tasks | `{{token}}` | Auth / Login - Success |
| Cross-User Ownership | `{{ownershipTaskId}}`, `{{token}}` | Tasks / Create Task - For Ownership Test |
| Data-Driven Validation | none | Runs independently, uses its own CSV |

---

## Folder: Health

Basic smoke test confirming the API is reachable before running anything else.

| Request | Method & Path | Assertions |
|---|---|---|
| Health Check | `GET /health` | Status 200 · Content-Type is JSON · Response time < 3000ms · Body has `status` and `timestamp` |

---

## Folder: Auth

Covers registration and login: happy paths plus every validation/authentication failure the API is designed to produce.

| Request | Method & Path | Assertions | Notes |
|---|---|---|---|
| Register - Success | `POST /auth/register` | Status 201 · Content-Type JSON · Response time < 3000ms · Response has `user.id`, `user.email`, `user.createdAt`, `token` (string) | Pre-request script generates a unique email (`qa.test.<timestamp>@example.com`) and saves it as `{{existingEmail}}`; saves `{{token}}` and `{{userId}}` |
| Register - Duplicate Email (409) | `POST /auth/register` | Status 409 · Error shape `{ error: { code, message } }` · `code` = `CONFLICT` · message includes "already exists" | Re-uses `{{existingEmail}}` from the previous request |
| Register - Invalid Email Format (400) | `POST /auth/register` | Status 400 · `code` = `VALIDATION_ERROR` · `error.details.fieldErrors` has an `email` key | Body: `email: "not-an-email"` |
| Register - Weak Password (400) | `POST /auth/register` | Status 400 · `code` = `VALIDATION_ERROR` · `error.details.fieldErrors` has a `password` key | Body: `password: "123"` (below 8-char minimum) |
| Register - Missing Fields (400) | `POST /auth/register` | Status 400 · `code` = `VALIDATION_ERROR` | Body: `{}` |
| Login - Success | `POST /auth/login` | Status 200 · Content-Type JSON · Response time < 3000ms · Response has `user` and `token` | Re-uses `{{existingEmail}}`; overwrites `{{token}}` |
| Login - Wrong Password (401) | `POST /auth/login` | Status 401 · `code` = `UNAUTHORIZED` · message includes "invalid email or password" | Correct email, wrong password |
| Login - Unknown Email (401) | `POST /auth/login` | Status 401 · `code` = `UNAUTHORIZED` · message is **exactly** "Invalid email or password" | Explicitly asserts the message is identical to the wrong-password case, proving the API doesn't leak which emails are registered |
| Login - Invalid Email Format (400) | `POST /auth/login` | Status 400 · `code` = `VALIDATION_ERROR` | Body: `email: "not-an-email"` |

---

## Folder: Tasks

Full CRUD coverage, plus pagination, filtering, and auth enforcement on every route. All requests use `Authorization: Bearer {{token}}` unless marked "No Auth".

| Request | Method & Path | Assertions | Notes |
|---|---|---|---|
| Create Task - Success | `POST /tasks` | Status 201 · Content-Type JSON · Response time < 3000ms · Task shape (`id`, `title`, `description`, `completed`, `createdAt`, `updatedAt`) · `completed` defaults to `false` | Saves `{{taskId}}` — used by most later requests in this folder |
| Create Task - For Ownership Test | `POST /tasks` | Status 201 | Saves `{{ownershipTaskId}}` — a separate task reserved for the Cross-User Ownership folder, so it isn't deleted mid-suite |
| Create Task - Missing Title (400) | `POST /tasks` | Status 400 · `code` = `VALIDATION_ERROR` | Body has no `title` |
| Create Task - Title Too Long (400) | `POST /tasks` | Status 400 · `code` = `VALIDATION_ERROR` | Title is 201 characters (limit is 200) |
| Create Task - No Auth (401) | `POST /tasks` | Status 401 · `code` = `UNAUTHORIZED` | No `Authorization` header sent |
| List Tasks - Success | `GET /tasks` | Status 200 · Content-Type JSON · Response time < 3000ms · Response has `data` array and `pagination` object with exactly `page`, `limit`, `total`, `totalPages` | |
| List Tasks - Filter Completed=false | `GET /tasks?completed=false` | Status 200 · Every task in `data` has `completed: false` | |
| List Tasks - Invalid Page Param (400) | `GET /tasks?page=not-a-number` | Status 400 · `code` = `VALIDATION_ERROR` | Non-numeric page value fails coercion |
| List Tasks - No Auth (401) | `GET /tasks` | Status 401 · `code` = `UNAUTHORIZED` | |
| Get Task By Id - Success | `GET /tasks/{{taskId}}` | Status 200 · Content-Type JSON · Task shape | |
| Get Task By Id - Not Found (404) | `GET /tasks/999999` | Status 404 · `code` = `NOT_FOUND` | ID that doesn't exist |
| Get Task By Id - Invalid Id Format (400) | `GET /tasks/not-an-id` | Status 400 · `code` = `BAD_REQUEST` | Non-numeric ID in the URL |
| Get Task By Id - No Auth (401) | `GET /tasks/{{taskId}}` | Status 401 · `code` = `UNAUTHORIZED` | |
| Update Task - Mark Complete | `PATCH /tasks/{{taskId}}` | Status 200 · Task shape · `completed` is `true` | Body: `{ completed: true }` |
| Update Task - Empty Body (400) | `PATCH /tasks/{{taskId}}` | Status 400 · `code` = `VALIDATION_ERROR` | Body: `{}` — the API requires at least one field |
| Update Task - Not Found (404) | `PATCH /tasks/999999` | Status 404 · `code` = `NOT_FOUND` | |
| Update Task - No Auth (401) | `PATCH /tasks/{{taskId}}` | Status 401 · `code` = `UNAUTHORIZED` | |
| Delete Task - Not Found (404) | `DELETE /tasks/999999` | Status 404 · `code` = `NOT_FOUND` | Run before deleting the real task, so `{{taskId}}` is still valid for later requests |
| Delete Task - No Auth (401) | `DELETE /tasks/{{taskId}}` | Status 401 · `code` = `UNAUTHORIZED` | Confirms the task is **not** deleted without a valid token |
| Delete Task - Success (204) | `DELETE /tasks/{{taskId}}` | Status 204 · Response body is empty (length 0) | Explicitly checks there's no JSON body, since `204 No Content` responses shouldn't have one |

---

## Folder: Cross-User Ownership

Confirms a second user can never read, modify, or delete the first user's data — and that the API hides the resource's existence entirely rather than returning a 403.

| Request | Method & Path | Assertions | Notes |
|---|---|---|---|
| Register Second User | `POST /auth/register` | Status 201 · Response has `user` and `token` | Pre-request script generates a second unique email (`qa.userB.<timestamp>@example.com`); saves `{{token2}}` |
| Get User A's Task As User B (404) | `GET /tasks/{{ownershipTaskId}}` | Status 404 · `code` = `NOT_FOUND` · Status is explicitly **not** 403 | Uses `{{token2}}` to try to access User A's task |
| Update User A's Task As User B (404) | `PATCH /tasks/{{ownershipTaskId}}` | Status 404 · `code` = `NOT_FOUND` | Body: `{ completed: true }` — should have no effect |
| Delete User A's Task As User B (404) | `DELETE /tasks/{{ownershipTaskId}}` | Status 404 · `code` = `NOT_FOUND` | Task must still exist afterward |
| Cleanup: Delete Ownership Task As Owner | `DELETE /tasks/{{ownershipTaskId}}` | Status 204 | Uses `{{token}}` (User A, the real owner) to clean up the test task |

---

## Folder: Data-Driven Validation

A single request run multiple times via the Collection Runner or Newman's `-d` flag, sweeping many registration payloads from `data/register-validation-data.csv` in one pass.

| Request | Method & Path | Assertions | Notes |
|---|---|---|---|
| Register - Data-Driven Invalid Payloads | `POST /auth/register` | Status matches the `expectedStatus` column for that row · Response shape matches its status (`error` object for 4xx, `token` for 201) | Reads `email`, `password`, `expectedStatus` from the current CSV row via `pm.iterationData` |

### CSV test cases (`data/register-validation-data.csv`)

| # | Case | Expected status |
|---|---|---|
| 1 | Empty email | 400 |
| 2 | Malformed email — no `@` or domain | 400 |
| 3 | Malformed email — missing `@` | 400 |
| 4 | Malformed email — double `@` | 400 |
| 5 | Email contains a space | 400 |
| 6 | Password below 8-character minimum | 400 |
| 7 | Empty password | 400 |
| 8 | Password at **exactly** the 72-character maximum (boundary case — should succeed) | 201 |
| 9 | Password exceeding the 72-character maximum | 400 |

Row 8 is a deliberate boundary test: it confirms the limit is inclusive (72 characters is valid, not rejected).

---

## Shared assertion patterns

A few checks are reused across many requests rather than written per-request:

- **`Error response has correct shape`** — every 4xx/5xx response is checked for `error.code` and `error.message`, and `error.code` is asserted to equal the specific expected code (`VALIDATION_ERROR`, `UNAUTHORIZED`, `NOT_FOUND`, `CONFLICT`, `BAD_REQUEST`).
- **`Task response has correct shape`** — every successful task response is checked for `id`, `title`, `description`, `completed`, `createdAt`, `updatedAt`.
- **Response time** is asserted only on a representative sample of requests (not all 36) to keep the suite focused — Health Check, Register - Success, Login - Success, Create Task - Success, and List Tasks - Success.

## Where to add new tests

If you extend the API later, the natural places to add coverage are:
- A new folder per resource, following the same happy-path → validation → auth → not-found progression used in `Tasks`
- New CSV rows in `data/register-validation-data.csv` for additional edge cases, no code changes needed
- Update `generate-collection.js` rather than hand-editing the exported JSON, then re-run `node generate-collection.js`
