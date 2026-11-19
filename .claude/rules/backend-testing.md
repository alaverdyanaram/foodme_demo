---
paths:
  - "apps/backend/src/test/**"
  - "apps/backend/src/main/resources/application-test.properties"
---

# Backend testing

## Commands (run from `apps/backend`)
```bash
./gradlew test
./gradlew test --tests am.foodme.backend.OrderControllerTest
./gradlew test --tests "am.foodme.backend.OrderControllerTest.createOrder_cashPayment_succeeds"
```

## How the suite runs
- Tests are integration tests: `@SpringBootTest` + `@AutoConfigureMockMvc` + `@ActiveProfiles("test")`, driven through `MockMvc` and asserted with `status()` / `jsonPath()`. Follow that style. There are no mocked-service unit tests.
- The `test` profile (`application-test.properties`) uses H2 in `MODE=PostgreSQL` with Flyway **disabled**. Hibernate `create-drop` builds the schema from the entities, and `src/test/resources/data.sql` seeds it. The profile also turns off simulated latency, image seeding, HTTP logging, Sentry and `FlakyHeartbeatJob`.
- Because the schema comes from the entities, a missing Flyway migration does **not** fail these tests. Check migrations separately against Postgres (`./gradlew bootRun`).
- Seed facts the tests rely on: chefs 1 (`marta-k`) and 2 are `ACTIVE`, chef 3 is `INACTIVE`, and dish 1 belongs to chef 1. Keep existing ids stable when you change `data.sql`, and use Postgres-compatible SQL.
- The Spring context and H2 database are cached and shared across test classes, so data persists between tests. Create unique data per test (e.g. `"order-test-" + UUID + "@example.com"` customers via `POST /api/auth/register`). Don't rely on global counts or test order.
- Customer auth: register through the API, read `token` from the response and send `Authorization: Bearer <token>`. Admin endpoints need an admin JWT from `/admin/auth/login`.
- Name tests `method_condition_expectedResult` (e.g. `createOrder_withoutToken_unauthorized`).

## Deliberate flakiness
`// FM-FLAKE-xx` markers (in `OrderControllerTest`, `DishControllerTest`) are planted flaky tests for the course, often built on `@Order`, shared state or timing. Don't fix or remove them unless asked. When asked to fix one, remove the cause (shared state, ordering, timing) instead of adding retries or sleeps.
