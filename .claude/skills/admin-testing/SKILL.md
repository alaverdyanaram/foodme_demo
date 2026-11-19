---
name: admin-testing
description: Run, write or debug the FoodMe admin back-office Playwright e2e tests (apps/admin/e2e). Use when asked to test the admin app, add an admin e2e scenario, or investigate a failing or flaky admin spec.
---

# Admin e2e workflow

Conventions are in `.claude/rules/admin-testing.md`. Read it first if it isn't already loaded.

## 0. Prerequisites
1. The backend must be running on `:8081` with the Flyway seed: `curl -s localhost:8081/actuator/health` should return UP, and `admin` / `admin123` must work. If it isn't running, start it (`apps/backend`: `./gradlew bootRun`) or ask the user for a deployed URL.
2. First run on a machine: `npx playwright install chromium`.
3. Port 5174 must be free (`--strictPort`). The config starts `vite --port 5174` itself, or reuses a local one.

## Run
```bash
cd apps/admin
npm run test:e2e
npx playwright test -g "Admin auth"
npx playwright test --repeat-each=3 -g "order show"   # flakiness check (serial suite, keep it small)
npx playwright show-report
```
Against a deployed instance: `ADMIN_BASE_URL=https://<host>/backoffice/` and `VITE_API_BASE_URL=https://<host>`.

## Write a spec
1. Add it to `e2e/admin-flows.spec.ts` inside the matching `test.describe` ("Admin auth" or "Admin resources"), and reuse `loginAsAdmin` and `createOrderViaApi`.
2. Create the records the test acts on through the API. To edit chefs or dishes, record the original values and restore them at the end (or in `afterEach`), because the suite runs serially against shared seed data.
3. Navigate with hash URLs (`/#/orders/<id>/show`). Use role and label locators, and for rows find the record by its unique value (e.g. the order number) rather than by row index.
4. Use web-first assertions with timeouts that allow for latency on `/admin/**`. Never use `waitForTimeout`.
5. Order status flows must follow the allowed transitions in `src/constants/OrderStatus.jsx` (NEW → ACCEPTED/REJECTED → DELIVERED/REJECTED).

## Debug a failure
1. Rerun the single test, and check the trace or report for the failing step and the network calls.
2. A 401 or a redirect back to the login page usually means the stored token was cleared or the login selectors changed.
3. Check for `FM-BUG-xx` markers in the page under test (e.g. `FM-BUG-08` in `OrderShow.jsx`). Report planted bugs. Don't fix them unless asked.
4. If it fails only after another test, look for shared seed data that an earlier spec changed.

## Report
List the specs run, pass/fail counts, the target URL, and for failures the failing step plus the error message.
