---
name: admin
description: Make a change to the FoodMe admin back office (apps/admin, react-admin + MUI, JSX), such as a resource, list column, edit field, filter, order status action or login. Use when asked to add or modify back-office UI or fix an admin bug.
---

# Admin back office change workflow

Conventions are in `.claude/rules/admin.md`. Read it first if it isn't already loaded.

## 1. Locate
- Resources are registered in `src/App.jsx`. Pages are in `src/pages/{orders,chefs,dishes}/`.
- Backend endpoints: `GET /admin/<x>` (list), `GET /admin/<x>/{id}`, `PUT /admin/{chef,dish}/{id}`, `PATCH /admin/order/{id}/status`, `POST /admin/auth/login`.
- Look for `FM-BUG-xx` markers (e.g. `FM-BUG-08` in `OrderShow.jsx`). If the change touches one the user didn't mention, stop and ask.

## 2. Change
- **New column or field:** confirm the backend DTO already returns or accepts it (`apps/backend/src/main/java/am/foodme/backend/dto/`). If it doesn't, use the `backend` skill first. Then add the react-admin field (`TextField`, `NumberField`, `ChipField`, …) or input with `source` set to the DTO property name.
- **New filter:** add an input to the list's `filters` array. Its `source` is passed as a query param, so the backend must accept it.
- **Sorting:** the data provider sorts only the current page on the client. If correct global sorting is needed, it requires backend support. Say so rather than faking it.
- **New resource:** add the page(s), a `<Resource>` in `App.jsx`, and a `RESOURCE_TO_PATH` entry in `providers/dataProvider.js`. If the endpoint uses something other than `getList` / `getOne` / `update`, add the method to the data provider.
- **Order statuses:** change `constants/OrderStatus.jsx` (values, colours, allowed transitions) together with the backend status handling.
- Keep the default hash router. Don't add `basename` or `BrowserRouter`.

## 3. Verify
```bash
cd apps/admin
npm run lint
npm run build      # production build uses base /backoffice/
```
Then check it in the running app: backend on `:8081` (`./gradlew bootRun`) and `npm run dev`. Log in with `admin` / `admin123` at `/#/login` in the browser pane and walk through the changed screen. Requests take 200–1500 ms because of simulated latency.

Run `npm run test:e2e` (see the `admin-testing` skill). If you changed the login page or menu labels, also run `apps/web/e2e/happy-path.spec.ts`, which logs into admin.

If you couldn't run the backend or the browser check, say so in the report.
