---
name: web
description: Make a change to the FoodMe customer storefront (apps/web, React + TypeScript), such as a page, component, API call, form, cart behaviour or styling. Use when asked to add or modify storefront UI or fix a storefront bug.
---

# Storefront change workflow

Conventions are in `.claude/rules/web.md`. Read it first if it isn't already loaded.

## 1. Locate
- Map the URL to a page with `src/router.tsx`, then find the components under `src/components/sections/`.
- Cart logic is in `src/hooks/useCart.ts`, API calls in `src/api/foodme.ts`, types in `src/types/index.ts`, and form validation in `src/schemas/`.
- Look for `FM-BUG-xx` markers before changing behaviour. If the change touches one the user didn't mention, stop and ask.

## 2. Change
- **New backend call:** add the DTO type to `src/types`, add a method to `foodmeApi`, and use it with `useQuery` / `useMutation` in the page. If the backend endpoint doesn't exist yet, use the `backend` skill first.
- **New page:** create `src/pages/<Name>/index.tsx` and register it in `router.tsx` with `withLayout(...)`.
- **Form:** extend the zod schema and connect fields with react-hook-form. Give inputs a `<Label htmlFor>` so `getByLabel` works.
- **Cart:** change it only through the functions in `useCart.ts`. Keep the single-chef rule and the `minimumOrderCount` floor.
- **UI:** reuse `components/ui/*` primitives and Tailwind. Keep existing short class hooks (`cc_card`, `dc_card`, `uc-panel`, `cic_root`, …) and ARIA labels, because the e2e specs use them. Grep `apps/web/e2e` before renaming any of them.

## 3. Verify
```bash
cd apps/web
npm run lint
npm run build          # runs tsc -b; type errors fail the build
```
Then check it in the running app: start the backend (`apps/backend`: `./gradlew bootRun`) and `npm run dev`, open the page in the browser pane, and walk through the changed flow. API calls take 200–1500 ms because of simulated latency. Make sure loading states look right.

Run the affected Playwright specs (see the `web-testing` skill), e.g. `npx playwright test e2e/storefront-flows.spec.ts`. If you changed a selector the specs use, update the specs in the same change.

If you couldn't run the backend or the browser check, say so in the report.
