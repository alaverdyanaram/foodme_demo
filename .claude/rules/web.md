---
paths:
  - "apps/web/**"
---

# Frontend: storefront (`apps/web`)

React 19 + TypeScript + Vite, Tailwind v4 (`@tailwindcss/vite`), Radix/shadcn-style primitives, TanStack Query, react-hook-form + zod, Dexie (IndexedDB), react-router v7, Sentry.

## Commands (run from `apps/web`)
```bash
npm run dev       # calls the backend at http://localhost:8081 in dev
npm run build     # tsc -b && vite build. Type errors fail the build
npm run lint      # oxlint (.oxlintrc.json)
```

## Structure and conventions
- The `@/` alias maps to `src/`. Use it for imports.
- Routes are in `src/router.tsx` (`createBrowserRouter`). Each page is `src/pages/<Name>/index.tsx`, wrapped in `AppLayout` through `withLayout`.
- `components/ui/` holds generic shadcn-style primitives (`cva` + `cn` from `lib/utils`). `components/sections/` holds feature components. `components/layout/` holds the header, footer and shell.
- **API:** every call goes through `apiClient` (`src/api/client.ts`) and the typed `foodmeApi` (`src/api/foodme.ts`). Add new endpoints to `foodmeApi` and their DTO types to `src/types`. Pages fetch with TanStack Query (`useQuery` / `useMutation`) over `foodmeApi`. Don't call `fetch` directly.
- The API base is empty (same-origin) in production builds and `http://localhost:8081` in dev. `VITE_API_BASE_URL` overrides it. Errors throw `ApiRequestError` with the backend's `message`. A 401 on `/api/customer/**` clears stored auth.
- **Auth:** the customer token is stored by `lib/auth-storage.ts` and exposed through `providers/auth-provider.tsx`. `lib/auth-next.ts` handles post-login redirects.
- **Forms:** use react-hook-form with zod schemas in `src/schemas/`. Conditional rules go in `superRefine` (e.g. the address is only required for `DELIVERY`). Payment is effectively `CASH` only. Other options are visual.
- **Cart:** the cart is client-side only, in IndexedDB via Dexie (`lib/db.ts`, table `products`, key `uid = chefId-dishId-sortedAdditionIds`), read reactively with `useLiveQuery` in `hooks/useCart.ts`. It holds items from **one chef at a time**. `addDishToCart` returns `"mismatch"` unless `replaceOtherChef` is set. Quantities respect `max(dish.minimumOrderCount, 1)`. Put cart mutations in `useCart.ts`, not in components.
- **Stable hooks for e2e:** Playwright specs select by short component class names (`cc_card`, `dc_card`, `uc-panel`, `cic_root`, …), ARIA roles, labels and accessible names (`aria-label="Decrease quantity"`, form `aria-label`s like "Checkout"). Renaming them breaks `apps/web/e2e`. Update the specs when you change one.
- `src/locales/en/translation.json` + `lib/i18n.ts` set up i18next, but components currently use literal English strings.

## Build and deploy
`VITE_SENTRY_DSN` is baked in at build time. In the backend Docker image it's mapped from `VITE_SENTRY_DSN_WEB`. Spring Boot serves the built `dist/` at `/`.

## Deliberate demo behaviour
`lib/flakyHeartbeat.ts` reports a synthetic error to GlitchTip about once every 10 minutes. It's intentional. `FM-BUG-xx` markers are planted bugs. Leave both alone unless asked.
