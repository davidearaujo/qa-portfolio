# TaskFlow — Postman API Test Suite

Blackbox API test suite for the [TaskFlow API](../app/server), covering happy paths, validation errors, authentication/authorization failures, not-found and conflict cases, cross-user ownership isolation, pagination, and data-driven validation sweeps.

## What's covered

| Area | Status codes exercised |
|---|---|
| Health check | 200 |
| Registration | 201, 400, 409 |
| Login | 200, 400, 401 |
| Task CRUD | 200, 201, 204, 400, 401, 404 |
| Pagination & filtering | 200, 400 |
| Cross-user ownership | 404 (never 403 — see note below) |
| Data-driven validation | 201, 400 (9 payload variations via CSV) |

Every request asserts: status code, response `Content-Type`, response time, and — for error responses — the exact `{ error: { code, message } }` shape the API is designed to return.

## Design notes worth knowing

- **Login returns the same 401 message** for "unknown email" and "wrong password" — the suite explicitly asserts on this to catch any future regression that might leak which emails are registered.
- **Fetching another user's task returns 404, not 403.** The Cross-User Ownership folder specifically asserts the response is *not* 403, since a 403 would confirm the resource exists.
- **`DELETE` returns `204` with an empty body** — asserted explicitly, since expecting JSON here is a common mistake.

## Running via the Postman GUI

1. Import `collections/TaskFlow.postman_collection.json`
2. Import `environments/local.postman_environment.json` and `environments/production.postman_environment.json`
3. Select the environment you want (top-right dropdown)
4. Run folders **in this order**: `Health` → `Auth` → `Tasks` → `Cross-User Ownership`
   (Tasks depends on a token saved by Auth; Cross-User Ownership depends on a task ID saved by Tasks)
5. For the data-driven suite: open the **Collection Runner**, select only the `Data-Driven Validation` folder, and attach `data/register-validation-data.csv` as the data file

## Running via Newman (CLI)

```bash
npm install

# Main suite, against your local dev server (must be running on :4000)
npm run test:local

# Main suite, against the deployed production API
npm run test:production

# Data-driven CSV sweep
npm run test:data-driven:local
```

HTML reports are written to `newman-reports/`.

## Continuous Integration

`.github/workflows/postman.yml` (at the repo root) runs this suite automatically on every push/PR that touches `postman-testing/` or `app/server/`. It spins up a fresh instance of the API inside the CI runner itself (rather than hitting the deployed Render URL), so results aren't affected by free-tier cold starts or external network conditions. Test reports are uploaded as a downloadable workflow artifact.

## Regenerating the collection

`generate-collection.js` is the source of truth — it programmatically builds `collections/TaskFlow.postman_collection.json`. If you want to add or edit requests, editing this script (and re-running `node generate-collection.js`) is far less error-prone than hand-editing the exported JSON directly.

## Updating the production environment URL

If you redeploy the backend and its URL changes, update `baseUrl` in `environments/production.postman_environment.json` (and re-import into Postman if you're using the GUI).
