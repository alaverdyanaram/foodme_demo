# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

FoodMe is a food-ordering demo used for a QA/DevOps course. It contains **intentional** defects, flakiness and noise for students to find. Code tagged `FM-BUG-xx` (deliberate bugs) or `FM-FLAKE-xx` (deliberate test flakiness), plus the "flaky heartbeat" jobs and simulated API latency, are features of the course, not accidents. Don't "fix" them unless asked. Bug fixes are tracked as Jira tickets (e.g. `KAN-4`), which are referenced in commit messages.

The repo has three apps under `apps/` and no root package manager or build script. Run each app's commands from its own directory.

| App | Stack | Dev port | Rules (`.claude/rules/`) | Skills (`.claude/skills/`) |
|---|---|---|---|---|
| `apps/backend` | Spring Boot 3.3 / Java 17 / Gradle, Postgres + Flyway, JWT | 8081 | `backend.md`, `backend-testing.md` | `backend`, `backend-testing` |
| `apps/web` | Customer storefront: React 19 + TS + Vite, Tailwind, TanStack Query, Dexie cart | Vite default (e2e: 5180) | `web.md`, `web-testing.md` | `web`, `web-testing` |
| `apps/admin` | Back office: react-admin + MUI, plain JS/JSX | Vite default (e2e: 5174) | `admin.md`, `admin-testing.md` | `admin`, `admin-testing` |

- **Rules** hold the conventions and load automatically when you work on matching paths.
- **Skills** are step-by-step workflows: locate, change in order, verify, report. Use the matching skill when making a change or running or writing tests in that component. A change that spans components (e.g. a new backend field shown in the admin) starts with `backend`, then moves on to `admin` or `web`.
- **Test-writing skills** cut across components by test type: `unit-tests` (JUnit + Mockito, and Vitest for the frontends, which has no setup yet), `integration-tests` (MockMvc / `@DataJpaTest` on H2, frontend pages against a mocked API) and `e2e-tests` (Playwright journeys, including storefront → admin).
- **`regression`** runs every suite (backend tests, lint/build, e2e, locally or against a deployed URL). It sorts each failure as planted bug, planted flake, flaky, environment or real regression (checked against the merge base with `main`) and gives a PASS/FAIL/INCOMPLETE verdict. Its output goes to `.regression/` (gitignored).
- **`jira`** covers the KAN project on `ayasus.atlassian.net` through the Atlassian MCP: fixing a ticket from start to finish, filing bugs with the team's template, verification comments, status changes and JQL lookups. Every write to Jira needs the user's approval first.

## Test-quality hooks (`.claude/settings.json` → `.claude/hooks/*.mjs`, need `node`)

- **PreToolUse `no-fixed-waits`:** blocks a test edit that adds `waitForTimeout`, `Thread.sleep` or a `setTimeout` delay. Wait for the outcome with web-first assertions instead.
- **PreToolUse `no-fixed-test-data`:** blocks a test edit that adds a hard-coded account email. Generate unique emails (`Date.now()` / `UUID`).
- **PostToolUse `require-assertions`:** after a test file is saved, lists every `test()` / `@Test` with no assertion. Fix those before moving on.

The two PreToolUse hooks check only the lines an edit adds, so the planted `FM-FLAKE` code can still be edited. Each script starts with a header explaining what it does and why.

## How the pieces fit

- **Single-origin deployment.** `apps/backend/Dockerfile` (build context = repo root) builds both SPAs and bundles them into the Spring Boot jar. The storefront is served at `/` and the admin at `/backoffice/` (hash-routed). Both frontends therefore default to an empty (same-origin) API base in production and `http://localhost:8081` in dev. `VITE_API_BASE_URL` overrides it.
- **API namespaces:** `/api/**` is the storefront API (customer JWT for `/api/customer/**` and `POST /api/order`), and `/admin/**` is the back-office API (admin JWT). Don't confuse `/admin` (API) with `/backoffice` (admin SPA).
- **Local full stack:** run Postgres (db/user/password `foodme`), then `./gradlew bootRun` in `apps/backend`, then `npm run dev` in `apps/web` and/or `apps/admin`. Both Playwright suites need this backend running. The seeded admin login is `admin` / `admin123`.
- **Deploy:** `render.yaml` deploys the single app image plus a Render Postgres (auto-deploys on push). `render-monitoring.yaml` deploys a separate Grafana/Prometheus/Loki stack from `infra/monitoring/stack`. See `infra/monitoring/README.md`, including the Grafana MCP endpoint at `/mcp`.
- **Observability env:** `SENTRY_DSN` (backend). `VITE_SENTRY_DSN` is baked in at build time for each frontend and mapped from `VITE_SENTRY_DSN_WEB` / `VITE_SENTRY_DSN_ADMIN` in Docker. `LOKI_PUSH_URL` turns on backend log shipping. Errors go to GlitchTip (Sentry-compatible).

## Notes

- The root `.env.example` mentions `infra/docker-compose.yml`, Jenkins and `docs/deployment.md`. None of these exist in the repo, so there's no local compose setup.
- The root `README.md` is a no-code, step-by-step student guide for deploying to Render with GlitchTip and Grafana.
