---
name: unit-tests
description: Write unit tests for FoodMe code: backend services and helpers (JUnit 5 + Mockito, no Spring context), and storefront/admin logic (Vitest). Use when asked for unit tests, fast isolated tests, or coverage of a specific class, function, hook, schema or provider.
---

# Unit tests

A unit test exercises one class or function in isolation: no Spring context, no database, no HTTP, no browser. For tests through the HTTP layer and database, use `integration-tests`. For tests through the real UI, use `e2e-tests`.

Before writing: if the code under test has an `FM-BUG-xx` marker, tell the user. A correct test will fail on a planted bug. Write it only if they want the bug exposed, and say that the failure is expected.

## Backend (JUnit 5 + Mockito + AssertJ)

The project has no backend unit tests yet. Existing tests are all `@SpringBootTest`. `spring-boot-starter-test` already provides JUnit 5, Mockito and AssertJ, so there's nothing to install.

- Location: `apps/backend/src/test/java/am/foodme/backend/<same package as the class>/<Class>Test.java` (e.g. `.../service/OrderServiceTest.java`).
- No Spring annotations. Use `@ExtendWith(MockitoExtension.class)`, `@Mock` the repositories and collaborators, and construct the class under test with its constructor. All beans use constructor injection, so no reflection is needed.
- `MeterRegistry` (in `OrderService`): pass `new SimpleMeterRegistry()` instead of a mock.
- Build entities with setters (Lombok `@Setter`) and DTOs with `@Builder`.
- Name tests `method_condition_expectedResult`. Use AssertJ `assertThat(...)`. For errors, use `assertThatThrownBy(...).isInstanceOf(BadRequestException.class)`.

Good targets:
- `service/*Service`: business rules (order creation and pricing, delivery price, status transitions, chef/dish filtering). Mock the repositories and check what gets saved with `ArgumentCaptor`.
- `dto/*Dto.mapEntityToDto`: mapping, including null-safety and the `Am`/`Hy`/`Ru` translations.
- `security/JwtService`: construct it as `new JwtService(secret, issuer)`. Test that `generateToken` → `verify` round-trips, and that a wrong secret, wrong issuer or tampered token is rejected.
- `config/DatabaseUrlEnvironmentPostProcessor`: `postgresql://user:pass@host/db?sslmode=require` → JDBC url, user and password. Use `MockEnvironment` from `spring-test`.
- `exceptionHandler/GlobalExceptionHandler`: status and body for each exception type.

Run:
```bash
cd apps/backend
./gradlew test --tests "am.foodme.backend.service.OrderServiceTest"
```

## Frontends (Vitest)

Neither frontend has a unit-test runner yet. **Setup is a one-time change that adds dev dependencies, so confirm it with the user first.** Then:

**Storefront (`apps/web`, Vite 8, React 19, TS):**
```bash
cd apps/web
npm i -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom fake-indexeddb
```
- Add `test: { environment: "jsdom", setupFiles: ["./src/test/setup.ts"] }` to `vite.config.ts` (with `/// <reference types="vitest/config" />`), so the `@/` alias is shared.
- `src/test/setup.ts`: `import "@testing-library/jest-dom/vitest"; import "fake-indexeddb/auto";`
- Script: `"test": "vitest run"`, `"test:watch": "vitest"`.
- Keep Playwright specs out of Vitest: set `test.include: ["src/**/*.test.{ts,tsx}"]` so `e2e/` isn't picked up.
- Pick versions whose peer dependencies match the installed Vite and React. Check `npm ls vite` after installing.

**Admin (`apps/admin`, Vite 6, React 18, JS):** same idea. Add `vitest jsdom @testing-library/react @testing-library/jest-dom`, set `test: { environment: "jsdom", include: ["src/**/*.test.{js,jsx}"] }` in `vite.config.js`, and add a `"test": "vitest run"` script.

Put tests next to the source as `<file>.test.ts(x)` / `.test.js(x)`.

Good storefront targets:
- `src/schemas/*`: `checkoutSchema.safeParse(...)`. `DELIVERY` requires street and city, `TAKEAWAY` doesn't. Check the email and phone rules.
- `src/hooks/useCart.ts` functions (`addDishToCart`, quantity changes, `clearCart`, `getCartChefId`), using `fake-indexeddb`. Cover the single-chef `"mismatch"` result, `replaceOtherChef`, the `minimumOrderCount` floor, and the addition-specific `uid`. Clear `db.products` in `beforeEach`.
- `src/lib/utils.ts` (`formatAmd`, `translate`, `sameLabel`), `lib/auth-next.ts` (`safeAuthNext` must reject open redirects such as `//evil.com` and `https://...`), and `lib/auth-storage.ts` (localStorage round-trip, corrupt JSON).
- `src/api/client.ts`: stub `fetch` with `vi.stubGlobal`. Check the bearer header, `ApiRequestError` carrying the backend `message`, and that a 401 on `/api/customer/**` clears auth.
- Small presentational components (e.g. `item-quantity-button-group`): disabled at `min`, callbacks fire. Use RTL with role/label queries.

Good admin targets:
- `providers/dataProvider.js`: mock `../api/base-api.js` with `vi.mock`. Check 1-based → 0-based page conversion, `RESOURCE_TO_PATH` mapping, `{ list, count }` → `{ data, total }`, and client-side sort ASC/DESC.
- `providers/authProvider.js`: token stored or cleared, `checkError` on 401/403.
- `constants/OrderStatus.jsx`: the transition table (no transitions out of `DELIVERED` / `REJECTED`).

Run:
```bash
npm test                         # in apps/web or apps/admin
npx vitest run src/hooks/useCart.test.ts
```

## Done means
- New tests pass, or fail only on a planted bug the user agreed to expose.
- They don't depend on test order, real time (use `vi.useFakeTimers()` / a fixed `Clock`), network or a running backend.
- Report what is covered, the commands run and their results, and any dependencies or config added.
