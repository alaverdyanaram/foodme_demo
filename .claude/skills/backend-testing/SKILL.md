---
name: backend-testing
description: Run, write or debug FoodMe backend tests (JUnit + MockMvc on H2 in apps/backend/src/test). Use when asked to test backend code, add test coverage for an endpoint, investigate a failing or flaky backend test, or check a backend change.
---

# Backend testing workflow

Conventions are in `.claude/rules/backend-testing.md`. Read it first if it isn't already loaded.

## Run
```bash
cd apps/backend
./gradlew test                                                    # whole suite
./gradlew test --tests am.foodme.backend.DishControllerTest       # one class
./gradlew test --tests "am.foodme.backend.DishControllerTest.*search*"   # pattern
./gradlew test --rerun-tasks                                      # ignore Gradle's up-to-date cache
```
Reports: `build/reports/tests/test/index.html`. Raw XML: `build/test-results/test/`.

## Write a test
1. Add it to the existing `<Area>ControllerTest` class, or create one with `@SpringBootTest @AutoConfigureMockMvc @ActiveProfiles("test")`.
2. Arrange through the API, not repositories: register a customer with a unique email (copy the `customerToken()` helper pattern from `OrderControllerTest`) and log in as admin through `/admin/auth/login` (`{ "username", "password" }`) when needed.
3. Use only seed data from `src/test/resources/data.sql` that is stable: chef ids 1–3, dish ids. Add seed rows there if the test needs new fixtures, keeping existing ids.
4. Assert status and body with `jsonPath`. Cover the happy path, a validation or 400 case, and the auth case (401/403) for protected endpoints.
5. Don't assert global counts or depend on `@Order`. The context and database are shared across classes.

## Debug a failure
1. Rerun only the failing test 3–5 times (`--tests ... --rerun-tasks`). If it passes sometimes, it's flaky. Otherwise it's deterministic.
2. Check for an `FM-FLAKE-xx` or `FM-BUG-xx` marker in the test or the code under test. Those are planted for the course. Report the marker and don't fix it unless asked.
3. Usual causes of real flakiness here: shared H2 state between classes, `@Order` dependencies, time or date-based assertions (`LocalDate.now()`), sequence-generated numbers.
4. An entity/column mismatch shows up as a context-load failure for *every* class. Check the entity against `data.sql` first.
5. Fix the cause (isolate the data, remove ordering). Never add `Thread.sleep` or retries.

## Report
State which tests ran, how many passed or failed, and quote the assertion message of any failure. Point out that H2 tests don't validate Flyway migrations.
