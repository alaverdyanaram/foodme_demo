---
paths:
  - "apps/web/e2e/**"
  - "apps/web/playwright.config.ts"
---

# Storefront testing (Playwright)

The storefront has only end-to-end tests in `apps/web/e2e`. There are no unit or component tests.

## Commands (run from `apps/web`)
```bash
npm run test:e2e                              # starts `vite --port 5180` itself
npx playwright test e2e/happy-path.spec.ts
npx playwright test -g "takeaway checkout"
npm run test:e2e:all                          # web + admin suites
npx playwright show-report
```
- The specs need a **running backend** on `http://localhost:8081` (`./gradlew bootRun` with Postgres). `VITE_API_BASE_URL` changes both the SPA's API and the `API` constant the specs use for setup.
- `PLAYWRIGHT_BASE_URL` points the suite at a deployed instance. On a single-origin deploy, set `VITE_API_BASE_URL` to the same host.
- Config: Chromium only, `fullyParallel: true`, `retries` of 2 on CI and 0 locally, trace `on-first-retry`, HTML report.

## Writing specs
- Tests run in parallel against a shared database, so create fresh data per test. Use the helpers in `e2e/auth.ts`: `createAccountAtCheckout(page)` through the UI, or `registerCustomerViaApi(request, API)` for setup, both with unique `Date.now()` + random emails. Don't depend on order counts or data left over from other tests.
- Use API setup (`request.post(...)`) instead of UI clicks for anything that isn't under test.
- Locators: use roles, labels and accessible names first (`getByRole("button", { name: "Add to cart" })`, `getByRole("form", { name: "Checkout" }).getByLabel(...)`). The existing component class hooks (`a.cc_card`, `button.dc_card`, `aside.uc-panel`, `.cic_root`) are acceptable. Don't select by Tailwind utility classes.
- Wait with web-first assertions (`expect(locator).toBeVisible()`, `toHaveURL`, `toHaveCount`). Never use `waitForTimeout`. The backend adds 200–1500 ms random latency to every API call, so assuming the page updates immediately makes tests flaky.
- The cart lives in IndexedDB (Dexie), which is per browser context, so each test starts with an empty cart. After add-to-cart, check that the cart panel updated before reloading or navigating.
- The live seed has 6 `ACTIVE` chefs. Specs that count chefs must allow for the planted `FM-BUG-02` (the list endpoint drops one on the last page).
- `happy-path.spec.ts` also logs into the admin app (seeded `admin` / `admin123`) at `${API}/backoffice/#/login`. That needs a backend serving the built admin bundle (the Docker image or a deployed instance), not a plain `bootRun`. If the admin login changes, update this spec too.

## Deliberate flakiness
`flake-*.spec.ts` files and `// FM-FLAKE-xx` markers (e.g. `waitForTimeout(300)` in `flake-dish-modal.spec.ts`) are planted for the course. Leave them unless asked. When asked to fix one, replace the timing guess with a proper web-first wait and mark it `FM-FLAKE-xx FIX`, as `flake-cart-persistence.spec.ts` does.
