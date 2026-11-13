---
name: e2e-tests
description: Write end-to-end Playwright tests for FoodMe that drive the real storefront and/or admin UI against a running backend, including cross-app journeys (customer orders in the storefront, admin processes it in the back office). Use when asked for e2e, UI, browser, user-journey or regression tests.
---

# End-to-end tests (Playwright)

E2E tests drive the real UI in Chromium against a real backend and database. They are the slowest kind, so use them for user journeys and leave logic branches to `unit-tests` / `integration-tests`. Per-app details (commands, config, existing helpers) are in `.claude/rules/web-testing.md` and `.claude/rules/admin-testing.md`, and the `web-testing` / `admin-testing` skills cover running and debugging.

## 1. Choose where the spec goes
| Journey | Suite | File |
|---|---|---|
| Storefront only (browse, cart, checkout, auth, layout) | `apps/web/e2e` (parallel) | `storefront-flows.spec.ts`, `happy-path.spec.ts`, `layout.spec.ts`, or a new `<area>.spec.ts` |
| Admin only (login, lists, edit, order status) | `apps/admin/e2e` (serial) | `admin-flows.spec.ts` |
| Cross-app (storefront order → admin) | `apps/web/e2e` | `happy-path.spec.ts`. It already logs into admin. Keep cross-app specs here |

Don't add `flake-*` files. That name is reserved for the course's planted flaky specs.

## 2. Prerequisites
- Backend up: `curl -s localhost:8081/actuator/health` returns UP (`apps/backend`: `./gradlew bootRun`, needs Postgres). Otherwise ask the user for a deployed URL.
- `npx playwright install chromium` once.
- Each config starts its own Vite server (web :5180, admin :5174).

## 3. Write the spec
1. **One journey per test**, with a title that reads as the scenario: `"takeaway checkout succeeds without address"`.
2. **Setup through the API, act through the UI.** Customers come from `registerCustomerViaApi(request, API)` (`apps/web/e2e/auth.ts`) and orders from `createOrderViaApi(request)` (admin spec). Use the UI only for the behaviour under test. Every email and name must be unique (`Date.now()` + random).
3. **Locators:** use `getByRole` / `getByLabel` / `getByText` first. Scope inside a region (`page.getByRole("form", { name: "Checkout" }).getByLabel("Phone")`, `page.locator("aside.uc-panel")`). The existing component hooks (`a.cc_card`, `button.dc_card`, `.cic_root`) are allowed. Tailwind or MUI-generated classes aren't. If an element has no accessible name, add one in the app code (and say so) rather than using a fragile selector.
4. **Waiting:** the backend adds 200–1500 ms of latency to every API call. Wait with web-first assertions (`toBeVisible`, `toHaveURL`, `toHaveCount`, `toHaveText`) or `page.waitForResponse` for a specific call. **Never use `waitForTimeout`.**
5. **Assert outcomes the user sees** (order number shown, cart total, status chip). For anything persisted, also check it through the API or the other app.
6. **Isolation:** web specs run in parallel and admin specs serially against a shared database. Don't rely on counts, row positions or data from other tests. Admin tests that edit seed chefs or dishes must restore them.
7. **Planted bugs:** if the journey crosses an `FM-BUG-xx` (e.g. FM-BUG-02 drops a chef on the last explore page, FM-BUG-08 in admin `OrderShow`), tell the user. Either write the spec to expose it (expected failure, with a comment naming the bug) or avoid that path, as they prefer.

Cross-app example outline (web suite):
```ts
test("customer order appears in admin and can be accepted", async ({ page, request }) => {
  // storefront: explore -> chef -> add dish -> checkout (takeaway, cash) -> read order number
  // admin: open ADMIN_URL/#/login, sign in admin/admin123, open the order by number, mark ACCEPTED
  // verify: GET /api/order/number/{number} or the tracking page shows ACCEPTED
});
```
For the admin part inside the web suite, do what `happy-path.spec.ts` does: `page.goto(\`${API}/backoffice/#/login\`)`. The admin SPA is served by the backend, so this only works when the backend has the built admin bundle (the Docker image or a deployed instance). A plain `./gradlew bootRun` has no `/backoffice`. In that case, run the cross-app spec against a deployed URL and say so.

## 4. Prove it isn't flaky
```bash
npx playwright test -g "<title>" --repeat-each=5          # web
npx playwright test -g "<title>" --repeat-each=3          # admin (serial, slower)
npm run test:e2e                                          # whole suite still green
```
Also run once against a deployed instance if the user has one (`PLAYWRIGHT_BASE_URL` + `VITE_API_BASE_URL`, or `ADMIN_BASE_URL`).

## Done means
The report gives the scenario covered, the file, the repeat-run result, the target URL, any app selectors or ARIA labels added, and any planted bug the test exposes on purpose.
