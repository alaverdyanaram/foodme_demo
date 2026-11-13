---
name: backend
description: Make a change to the FoodMe Spring Boot backend (apps/backend) end to end, such as a new or changed endpoint, entity/column, Flyway migration, service logic or security rule. Use when asked to add or modify backend API behaviour or fix a backend bug.
---

# Backend change workflow

Conventions are in `.claude/rules/backend.md`. Read it first if it isn't already loaded. This skill is the order of work.

## 1. Locate
- Find the controller from the URL: `/api/<x>` → `controller/api/<X>Controller`, `/admin/<x>` → `controller/admin/Admin<X>Controller`. Route roots are in `utils/ControllerUtil`.
- Follow the call into `service/` and `repository/`. Look for an existing DTO in `dto/` before creating one.
- Before changing logic, check for `// FM-BUG-xx` / `FM-FLAKE-xx` markers nearby. If the change touches one and the user didn't ask to fix it, stop and ask.

## 2. Change in this order
1. **Schema** (only if the data model changes): add `src/main/resources/db/migration/V{next}__<snake_description>.sql` (the next number after the highest existing `V*`). Use the `foodme.` schema prefix. New tables need a `foodme.<table>_id_seq` sequence. Never edit existing migrations.
2. **Entity** in `model/`: the field and `@Column(name = ...)` must match the migration exactly, because `ddl-auto=validate` fails startup on a mismatch. Give translatable fields `En` / `Am` / `Ru` variants.
3. **Test seed**: if the table appears in `src/test/resources/data.sql`, add the new columns there too. Tests build the schema from the entities, not from Flyway.
4. **Repository / service**: put business rules in the service. Throw `NotFoundException` / `BadRequestException` for client errors.
5. **DTO**: add fields plus the mapping in `mapEntityToDto`. Lists use the `{ list, count }` shape.
6. **Controller**: use constructor injection and a `ControllerUtil` constant for the root path.
7. **Security**: add an explicit matcher in `security/SecurityConfig.java` in the right position (matchers are evaluated in order). Without one, the endpoint is public via `anyRequest().permitAll()`.
8. **Consumers**: if the response shape changed, update `apps/web/src/types` + `src/api/foodme.ts` and/or the admin `dataProvider` / pages. Mention any you didn't update.

## 3. Verify
```bash
cd apps/backend
./gradlew test                      # fast feedback, H2
./gradlew bootRun                   # proves the migration + validate step against real Postgres
```
- Add or extend a MockMvc test in `src/test/java/am/foodme/backend/<X>ControllerTest.java` (see the `backend-testing` skill).
- Exercise the endpoint, for example `curl -s localhost:8081/api/...`. Expect 200–1500 ms of simulated latency. Swagger is at `http://localhost:8081/swagger-ui.html`.
- If Postgres isn't available locally, say that the migration was **not** verified against Postgres.

## 4. Commit
If the work belongs to a Jira ticket, reference it, e.g. `fix(order): ... (KAN-12)`.
