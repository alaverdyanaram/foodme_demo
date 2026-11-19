---
name: regression
description: Run the FoodMe regression suite (backend tests, frontend lint/build/unit tests, storefront and admin Playwright e2e, optionally against a deployed URL), sort failures into planted bugs, flaky tests or new regressions, and report. Use when asked to run regression, check nothing broke, validate a branch/PR before merge, or smoke-test a deploy. Optional args: a scope (backend | web | admin | e2e | full, default full) and/or a deployed base URL.
---

# Regression run

The goal is a trustworthy verdict on whether this change broke anything, not just a raw pass/fail dump. This codebase deliberately contains failing and flaky tests (`FM-BUG-xx`, `FM-FLAKE-xx`), so classifying failures is the core of the job.

## 0. Scope and preflight
1. Read the args. Scope defaults to `full`. A URL means the e2e suites run against that deployment instead of local servers.
2. `git status` and `git log -1 --oneline`: record the branch, commit and whether there are uncommitted changes. They belong in the report.
3. Build the **known-issues list** fresh from the code: `grep -rn "FM-BUG-\|FM-FLAKE-" apps --include=*.{java,ts,tsx,js,jsx}`, excluding `node_modules`. Note which file and test each marker sits in.
4. Make sure dependencies are there: `npm ci` in `apps/web` and `apps/admin` if `node_modules` is missing, and `npx playwright install chromium` once.

Run long steps in the background and don't poll them. Stages are independent: keep going after a failure and report everything at the end.

## 1. Static and fast stages (no backend needed)
| Stage | Command (from the app dir) | Result files |
|---|---|---|
| Backend tests | `./gradlew test --rerun-tasks` | `apps/backend/build/test-results/test/*.xml` |
| Web lint | `npm run lint` | stdout |
| Web build (type check) | `npm run build` | stdout |
| Admin lint | `npm run lint` | stdout |
| Admin build | `npm run build` | stdout |
| Unit tests (if present) | `npm test` in web/admin, if a `test` script exists | stdout |

`--rerun-tasks` makes sure Gradle actually runs the tests instead of reporting cached results.

## 2. E2E stages
**Local target** (no URL given):
1. Check whether Postgres is reachable (e.g. `pg_isready -h localhost -p 5432`, or just try the backend start). If there's no Postgres and no URL, **skip the e2e stages, report them as NOT RUN with the reason**, and suggest a deployed URL. Don't count that as a pass.
2. Start the backend in the background (`apps/backend`: `./gradlew bootRun`) and wait until `curl -s localhost:8081/actuator/health` reports `UP` (the first start can take a minute: Flyway plus image seeding).
3. A plain `bootRun` doesn't serve `/backoffice`, so the cross-app test in `happy-path.spec.ts` ("admin can login and list orders after a storefront checkout") will fail locally for an environmental reason. Classify it as `ENV`, not as a regression.

**Deployed target** (URL given, e.g. `https://foodme-x.onrender.com`): free Render instances sleep. Hit `/actuator/health` first and wait for UP (it can take 1–3 minutes). Then set `PLAYWRIGHT_BASE_URL=<url>`, `VITE_API_BASE_URL=<url>` and `ADMIN_BASE_URL=<url>/backoffice/`.

Run both suites with a machine-readable reporter:
```bash
cd apps/web   && PLAYWRIGHT_JSON_OUTPUT_FILE=../../.regression/web.json   npx playwright test --reporter=list,json
cd apps/admin && PLAYWRIGHT_JSON_OUTPUT_FILE=../../.regression/admin.json npx playwright test --reporter=list,json
```
(`.regression/` is a scratch folder. Don't commit it.)

## 3. Classify every failure
For each failing test, do these checks in order:
1. **Rerun it alone 3 times**: Gradle `--tests "<Class>.<method>" --rerun-tasks`, Playwright `npx playwright test --last-failed` or `-g "<title>" --repeat-each=3`.
2. Assign one category:
   - `PLANTED-BUG`: the failure traces to code with an `FM-BUG-xx` marker (read the assertion and the marked code; don't guess from names alone).
   - `PLANTED-FLAKE`: the test or its file carries an `FM-FLAKE-xx` marker, or it's a `flake-*.spec.ts`.
   - `FLAKY`: no marker, but it passed at least once in the reruns. Still worth flagging.
   - `ENV`: the infrastructure can't support it (no `/backoffice` locally, a sleeping deploy, a port conflict, no browser installed).
   - `REGRESSION`: fails consistently, has no marker and isn't environmental.
3. **Confirm each regression against the baseline**: check out the merge base with `main` in a temporary git worktree (`git worktree add <scratch>/base $(git merge-base HEAD main)`), run only that test there, then remove the worktree. Passes on base and fails on HEAD means a regression from this change. Fails on both means a pre-existing failure. Never stash or reset the user's working tree to do this.

Don't fix anything during a regression run. Report only, unless the user asks for fixes.

## 4. Clean up
Stop the backend you started (and only that one), remove the baseline worktree, and leave `.regression/` in place for inspection, or delete it if the user prefers.

## 5. Report
Start with the verdict: **PASS** (no `REGRESSION`), **FAIL** (at least one `REGRESSION`), or **INCOMPLETE** (stages not run). Then:

```
Target: local (commit abc1234, branch fix/xyz, uncommitted changes: no)
| Stage            | Result | Passed | Failed | Skipped/Not run |
| Backend tests    | ...    |        |        |                 |
| Web lint/build   | ...    |        |        |                 |
| Admin lint/build | ...    |        |        |                 |
| Web e2e          | ...    |        |        |                 |
| Admin e2e        | ...    |        |        |                 |

Regressions (new):  test, error message, suspected cause (file:line), baseline result
Pre-existing failures:  ...
Flaky:  test, pass rate in reruns
Planted (expected):  FM-BUG-xx / FM-FLAKE-xx with the tests they affect
Not run:  stage + reason
```
Quote real error messages. Never report a stage as passed if it didn't run. When the user is likely to share the result, offer to publish the report as an artifact or to post it as a comment on the related Jira ticket (ask before posting).
