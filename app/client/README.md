# TaskFlow Client

React + TypeScript frontend for TaskFlow, built with Vite.

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

Runs on `http://localhost:5173` by default. Make sure the [TaskFlow API](../server) is running on `http://localhost:4000` (or update `VITE_API_URL` in `.env`).

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Type-check and build for production into `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Type-check without building |

## Structure

```
src/
├── api/client.ts          # typed fetch wrapper matching the backend's API contract
├── context/AuthContext.tsx # auth state (token/user in localStorage)
├── components/
│   ├── ProtectedRoute.tsx  # redirects unauthenticated users to /login
│   ├── TaskForm.tsx        # new task creation form
│   └── TaskItem.tsx        # single task row
├── pages/
│   ├── LoginPage.tsx
│   ├── RegisterPage.tsx
│   └── TasksPage.tsx       # main authenticated view: list, filter, paginate
└── styles/index.css
```

## Notes for QA / test automation

Every interactive element has a stable `data-testid` attribute — use these as selectors in Selenium/Cypress/Playwright instead of CSS classes or text content, which are more likely to change.

Key ones:
- `login-email-input`, `login-password-input`, `login-submit`, `login-error`
- `register-email-input`, `register-password-input`, `register-submit`, `register-error`
- `task-title-input`, `task-description-input`, `task-submit`, `task-form-error`
- `task-item` (has `data-task-id` and `data-completed` attributes), `task-toggle`, `task-delete`
- `filter-all`, `filter-active`, `filter-completed`
- `pagination-prev`, `pagination-next`, `pagination-status`
- `logout-button`, `current-user-email`

## Deployment
Deployed for free on [Vercel](https://vercel.com) or [Netlify](https://netlify.com). Build command: `npm run build`. Output directory: `dist`. Set `VITE_API_URL` as an environment variable pointing at your deployed backend (e.g. the Render URL).
