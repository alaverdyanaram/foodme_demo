---
paths:
  - "apps/admin/**"
---

# Frontend: admin back office (`apps/admin`)

react-admin 5 + MUI 6, React 18, **plain JavaScript/JSX** (no TypeScript), axios, notistack, Sentry.

## Commands (run from `apps/admin`)
```bash
npm run dev       # app at "/" in dev, calls the backend at http://localhost:8081
npm run build     # production base is /backoffice/
npm run lint      # eslint (eslint.config.js)
```
Seeded login: `admin` / `admin123` (from Flyway `V1__init.sql`).

## Structure and conventions
- `src/App.jsx` registers the `<Resource>`s: `orders` (list + show), `chefs` (list + edit), `dishes` (list + edit). Pages live in `src/pages/<resource>/`. A new resource needs a page, a `<Resource>` entry and an entry in `RESOURCE_TO_PATH`.
- **Data provider** (`providers/dataProvider.js`): converts the backend's `{ list, count }` into react-admin's `{ data, total }`. Plural resource names map to singular `/admin/<path>` endpoints through `RESOURCE_TO_PATH`. Pagination is converted to the backend's 0-based `page` / `size`. **Sorting is done client-side** on the current page, because the backend doesn't sort.
- HTTP goes through `api/base-api.js` (axios). Per-resource calls are in `api/{auth,chef,dish,order}-api.js`. The API base is empty (same-origin) in production and `http://localhost:8081` in dev. `VITE_API_BASE_URL` overrides it.
- **Auth:** `providers/authProvider.js` + `api/auth-api.js` call `/admin/auth/login`. The JWT is kept in `localStorage.token`, and an axios interceptor attaches it. On a 401 the app redirects to the login route, which honours `import.meta.env.BASE_URL`.
- **Routing:** react-admin's default **hash router** (`/backoffice/#/orders`). Don't add `basename` or a `BrowserRouter`. As the comment in `App.jsx` explains, that renders a blank page. E2E specs rely on `/#/...` URLs.
- `vite.config.js` sets `base: '/backoffice/'` only in production mode, because Spring Boot serves the build there. The backend's own `/admin/**` paths are the API, not this app.
- Order statuses are defined in `constants/OrderStatus.jsx`. Keep them aligned with the backend `Order` status values.
- The theme is in `theme/theme.js`. `layout/` holds the app layout and back button. `security/` holds the route guards.

## Build and deploy
`VITE_SENTRY_DSN` is baked in at build time. In the backend Docker image it's mapped from `VITE_SENTRY_DSN_ADMIN`.

## Deliberate demo behaviour
`lib/flakyHeartbeat.js` (synthetic GlitchTip errors) and `FM-BUG-xx` markers (e.g. `FM-BUG-08` in `OrderShow.jsx`) are intentional. Leave them unless asked.
