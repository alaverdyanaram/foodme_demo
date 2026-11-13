---
paths:
  - "apps/admin/e2e/**"
  - "apps/admin/playwright.config.ts"
---

# Admin testing (Playwright)

The admin app has only end-to-end tests in `apps/admin/e2e/admin-flows.spec.ts`. There are no unit or component tests.

## Commands (run from `apps/admin`)
```bash
npm run test:e2e                         # starts `vite --port 5174 --strictPort` itself
npx playwright test -g "order show"
npx playwright show-report
```
- The specs need a **running backend** on `http://localhost:8081` with the Flyway seed (admin `admin` / `admin123`). `VITE_API_BASE_URL` overrides the backend for both the app and API setup.
- `ADMIN_BASE_URL` points the suite at another instance. For a deployed single-origin build, use `https://<host>/backoffice/`.
- Config: Chromium only, **`fullyParallel: false`** (specs share admin state and seed data), `retries` of 1 on CI and 0 locally, trace `on-first-retry`.

## Writing specs
- Log in with the `loginAsAdmin(page)` helper. It goes to `/#/login` and waits for the "Orders" menu item. Routes are hash-based (`/#/orders`, `/#/chefs/1`), so always navigate with `/#/...`.
- Create orders through the storefront API with `createOrderViaApi(request)`, which registers a customer and posts a `CASH` / `TAKEAWAY` order to `/api/order`. Don't depend on orders other tests created.
- Locators: use roles, labels and accessible names (`getByRole("menuitem", { name: "Orders" })`, `getByLabel("Username")`). Don't select by MUI-generated class names (`.css-xxxx`, `Mui...-root`), because they change across versions.
- The backend adds 200–1500 ms random latency to `/admin/**`. Use web-first assertions with generous timeouts on the first data load. Never use `waitForTimeout`.
- Tests that change shared seed data (chef or dish edits, order status changes) should restore it or work only on records they created.
- The storefront suite (`apps/web/e2e/happy-path.spec.ts`) also logs into admin. Keep login selectors stable or update both suites.

## Deliberate bugs
Specs may hit the planted `FM-BUG-xx` defects (e.g. `FM-BUG-08` in `OrderShow.jsx`). Don't change app code to make a spec pass unless you were asked to fix that bug.
