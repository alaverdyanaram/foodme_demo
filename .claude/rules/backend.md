---
paths:
  - "apps/backend/**"
---

# Backend (Spring Boot)

Spring Boot 3.3, Java 17, Gradle (use the `./gradlew` wrapper), Postgres + Flyway, JWT (`com.auth0:java-jwt`), Lombok. The base package is `am.foodme.backend`. The dev server runs on port 8081 (`server.port=${PORT:8081}`).

## Commands (run from `apps/backend`)
```bash
./gradlew bootRun     # needs Postgres on localhost:5432, db/user/password "foodme", unless DB_* / DATABASE_URL is set
./gradlew bootJar
```

## Structure and conventions
- Layers: `controller/{api,admin}` → `service` → `repository` → `model` (JPA entities). Request/response shapes live in `dto/`.
- Controllers take their base path from constants in `utils/ControllerUtil`. Add new route roots there instead of hard-coding strings.
- Use constructor injection (explicit constructors, not `@Autowired` fields), following the existing classes.
- DTOs use Lombok `@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder` and a static `mapEntityToDto(entity)` factory. Never return JPA entities from controllers.
- Entities use `@Getter @Setter`, `@Table(schema = "foodme")`, and sequence ids (`foodme.<table>_id_seq`, `allocationSize = 1`).
- Throw `NotFoundException` / `BadRequestException` from services. `exceptionHandler/GlobalExceptionHandler` turns them into `ErrorResponseDto` with 404/400. Any other exception becomes a 500 with a stack trace. Both frontends show the `message` field from the error body.
- List endpoints return `{ list, count }` DTOs (e.g. `DishPaginationCountDto`, `AdminListResponseDto`) with 0-based `page` / `size` query params. The admin data provider relies on this shape.
- Translatable fields come in `En` / `Am` / `Ru` variants. Some DTOs use `Hy` instead of `Am`. Keep all three languages when you add a field.

## Security (`security/SecurityConfig.java`)
- `/api/**`: public storefront API. Exceptions: `/api/customer/**` and `POST /api/order` need the `CUSTOMER` role. `/api/auth/**` handles customer register/login.
- `/admin/**`: back-office API, JWT-authenticated, except `/admin/auth/login` and `GET /admin/dish/**`. Don't confuse it with the `/backoffice` SPA path.
- `/actuator/{health,info,prometheus}`, `/swagger-ui.html` and `/v3/api-docs` are public.
- Every new endpoint needs a deliberate rule in `SecurityConfig`. The catch-all `anyRequest().permitAll()` means a forgotten rule makes the endpoint public.

## Database
- All tables are in the `foodme` schema. Hibernate runs with `ddl-auto=validate`, so every entity or column change needs a new Flyway migration `src/main/resources/db/migration/V{n+1}__description.sql`. Never edit an applied migration.
- The test suite does **not** run Flyway (see `backend-testing.md`). Update `src/test/resources/data.sql` too when a schema change affects seeded tables.
- Chef and dish images are stored in Postgres and served from `/api/images/**`. `ImageSeedRunner` loads `src/main/resources/img-seed/` on first start (`foodme.images.seed-enabled`).
- `DatabaseUrlEnvironmentPostProcessor` (registered in `META-INF/spring.factories`) converts a Render/Neon `postgresql://` `DATABASE_URL` into JDBC settings.

## Single-origin serving
`apps/backend/Dockerfile` (build context = repo root) builds both SPAs into `static/` (storefront at `/`, admin at `/backoffice/`) and `SpaWebConfig` serves them. Route changes must not shadow `/`, `/backoffice` or SPA deep links. The Docker JVM flags are tuned for Render's 512 MB / 0.1 CPU free tier. Don't remove them.

## Deliberate demo behaviour (leave as is unless asked)
- `// FM-BUG-xx` markers (in `OrderService`, `ChefService`, `OrderDto`, `CreateOrderDishDto`) are planted course bugs.
- `SimulatedLatencyConfig` adds a random 200–1500 ms delay to `/api/**` and `/admin/**` (not images or actuator). Tune it with `foodme.latency.min-ms` / `max-ms`.
- `observability/FlakyHeartbeatJob` (`@Profile("!test")`) sends synthetic errors to GlitchTip. `DebugController` exposes `/api/debug/boom`.
- Logs are JSON (`logback-spring.xml`) and go to Loki only when `LOKI_PUSH_URL` is set. `HttpLoggingFilter` logs `/api` and `/admin` traffic with secrets redacted. If you add fields or headers that carry secrets, add them to its redaction.
- Sentry/GlitchTip uses `SENTRY_DSN`. Empty means disabled.
