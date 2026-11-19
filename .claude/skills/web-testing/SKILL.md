---
name: web-testing
description: Run, write or debug the FoodMe storefront Playwright e2e tests (apps/web/e2e). Use when asked to test the storefront, add an e2e scenario, investigate a failing or flaky storefront spec, or run the full web + admin e2e suite.
---

# Storefront e2e workflow

Conventions are in `.claude/rules/web-testing.md`. Read it first if it isn't already loaded.

## 0. Prerequisites
1. The backend must be running on `:8081`: `curl -s localhost:8081/actuator/health` should return `{"status":"UP"...}`. If it doesn't, start it (`apps/backend`: `./gradlew bootRun`, which needs Postgres) or ask the user for a deployed URL.
2. First run on a machine: `npx playwright install chromium`.
3. Don't start the dev server yourself. The Playwright config starts `vite --port 5180` (and reuses one that's already running locally).

## Run
```bash
cd apps/web
npm run test:e2e                                  # whole storefront suite
npx playwright test e2e/storefront-flows.spec.ts  # one file
npx playwright test -g "cart quantity"            # by title
npx playwright test --repeat-each=5 -g "..."      # flakiness check
npx playwright show-report                        # HTML report
npx playwright show-trace test-results/<dir>/trace.zip
npm run test:e2e:all                              # storefront + admin
```
Against a deployed instance: set both `PLAYWRIGHT_BASE_URL` and `VITE_API_BASE_URL` to `https://<host>`.

## Write a spec
1. Put it in the matching `e2e/*.spec.ts` (`storefront-flows` for UI flows, `happy-path` for end-to-end checkout, `layout` for structure), or create a new file.
2. Do setup with API helpers from `e2e/auth.ts` and unique data. Only drive through the UI what the test is about.
3. Prefer `getByRole` / `getByLabel` locators. If an element has no accessible name, add one in the component instead of using a brittle CSS path.
4. Wait with web-first assertions after each step that triggers an API call (latency is 200–1500 ms). Never use `waitForTimeout`.
5. Run the new spec with `--repeat-each=5` before calling it done.

## Debug a failure
1. Rerun the single test, then with `--repeat-each=5` to separate flaky from broken.
2. Open the trace or report to see the failing step, DOM and network.
3. Check for `FM-FLAKE-xx` (planted flaky test) or `FM-BUG-xx` (planted app bug) markers. Report them. Don't fix them unless asked.
4. Common real causes: assertions that run before the latency-delayed response arrives, reloading before the Dexie cart write lands, leftover cart state from another chef, selectors broken by a component rename.
5. When asked to fix a planted flake, replace the timing guess with a web-first wait and mark it `// FM-FLAKE-xx FIX: <reason>`.

## Report
List the specs run, pass/fail/flaky counts, the target URL, and for failures the failing step plus the error message.
