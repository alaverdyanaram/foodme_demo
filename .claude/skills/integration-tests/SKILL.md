---
name: integration-tests
description: Write integration tests for FoodMe: backend HTTP + security + persistence through MockMvc on H2, repository tests with @DataJpaTest, and frontend page/component tests against a mocked API. Use when asked for integration or API tests, endpoint coverage, repository/query tests, or tests of a page wired to its data layer.
---

# Integration tests

An integration test runs several real layers together but no real browser against a deployed system. For isolated logic, use `unit-tests`. For the real UI against a real backend, use `e2e-tests`. Backend conventions are in `.claude/rules/backend-testing.md`.

Before writing: check the code path for `FM-BUG-xx` / `FM-FLAKE-xx` markers. Don't make a test pass by working around a planted bug. Tell the user, and expose it only if they want that.

## 1. Backend API (main kind; `@SpringBootTest` + MockMvc)

The existing suite uses this pattern (`ChefControllerTest`, `DishControllerTest`, `OrderControllerTest`, `CustomerAuthControllerTest`). It covers controller → service → repository → H2, plus the real `SecurityConfig` and `GlobalExceptionHandler`.

```java
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class XControllerTest {
    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
}
```
For each endpoint, cover:
- the happy path: status plus the key `jsonPath` fields, including the `{ list, count }` shape for lists
- validation failures: 400 with `$.message`
- not found: 404
- auth: no token gives 401, a customer token on `/admin/**` gives 403, and a valid admin or customer token gives 200
- state changes, read back through a GET (e.g. create an order, then `GET /api/customer/orders`; `PATCH /admin/order/{id}/status`, then `GET /admin/order/{id}`)

Data and auth:
- Customer: `POST /api/auth/register` with a unique email (`"x-" + UUID.randomUUID() + "@example.com"`), then use `$.token`.
- Admin: `POST /admin/auth/login` with `{ "username": "admin", "password": "admin123" }` (seeded in `data.sql` with the same BCrypt hash as Flyway `V1`), then use `$.token`.
- Fixtures go in `data.sql`. Keep existing ids, and give new rows ids far from existing ones (e.g. 900+).
- The context and database are shared across classes. Never assert global counts. Filter to the data your test created.

Postgres-only SQL: H2 runs in `MODE=PostgreSQL` but isn't Postgres. Native queries (e.g. `DishSearchRepositoryImpl` uses `ILIKE`) and migrations aren't proven by H2. If behaviour depends on Postgres specifics, say so, and use Testcontainers only if the user agrees to add `org.testcontainers:postgresql` + `junit-jupiter` (needs Docker).

## 2. Backend repositories (`@DataJpaTest`)

Use these for custom queries in `repository/` (derived queries with paging, `DishSearchRepositoryImpl`).
```java
@DataJpaTest
@ActiveProfiles("test")
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE) // keep the test profile's H2 + data.sql
class DishRepositoryTest { @Autowired DishRepository repo; }
```
Each test rolls back automatically. Assert filtering (ACTIVE only), paging totals and ordering (`priority_index`).

## 3. Frontend page/component tests (Vitest + RTL + mocked API)

These render a real page with its hooks, react-query and router, but replace the network. They need the Vitest setup from the `unit-tests` skill (confirm the setup with the user if it isn't there yet).

- Storefront: mock the API module with `vi.mock("@/api/foodme", ...)` (or stub `fetch`). Render the page inside `QueryClientProvider` (new `QueryClient` per test, `retry: false`) and a `MemoryRouter` / `createMemoryRouter` with the real route. Use `fake-indexeddb` for the cart.
- Good targets: the Chef page lists dishes and add-to-cart updates the cart panel. Checkout shows or hides address fields by delivery method, blocks submit on invalid input, and calls `createOrder` with the right payload. The Orders page renders the `{ list, count }` response.
- Admin: render `<Admin dataProvider={fakeProvider}>` with one `<Resource>` (or use `ra-core` `testDataProvider`) to check list columns, edit form submission and order status actions.
- Query by role and label, and wait with `findBy*` / `waitFor`.

## Run
```bash
cd apps/backend && ./gradlew test --tests "am.foodme.backend.OrderControllerTest"
cd apps/web && npx vitest run src/pages
```

## Done means
- Each new test passes in isolation **and** with the full suite (`./gradlew test` / `npm test`), which catches shared-state leaks.
- No sleeps, no dependence on test order, no real network.
- The report lists the endpoints and pages covered, auth cases included, any fixture or dependency added, and what H2 can't prove.
