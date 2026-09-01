# CT Style Salon

CT Style Salon is a polished salon booking experience for discovering services, choosing a stylist, and reserving a visit.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/ct-style-salon/src/App.tsx` — client routes and booking UI
- `artifacts/ct-style-salon/src/index.css` — shared salon visual language and responsive styles
- `lib/api-spec/openapi.yaml` — source of truth for salon API contracts
- `artifacts/api-server/src/routes/salon.ts` — salon service, availability, and appointment endpoints
- `lib/db/src/schema/salon.ts` — salon services, stylists, and appointments schema

## Architecture decisions

- Booking is guest-first and uses email lookup instead of requiring account creation.
- The storefront reference image is used as the salon's hero visual, with a charcoal, warm-wood, bronze, and cream palette informed by the public CT Style Salon listing.
- Public listing details used in the experience: My City Centre Masdar, Khalifa City/Abu Dhabi; 4.8 rating from 212 reviews; phone +971 2 552 0422; Instagram @ct_style_salon.
- Calendar-only appointment dates remain date strings in PostgreSQL to avoid timezone shifts.
- Availability is computed from a fixed daily slot schedule and existing appointments.

## Product

- Visitors can browse the salon and featured services.
- Guests can book a service with a stylist, date, time, and contact details.
- Guests can look up confirmed visits by the email used when booking.
- The salon summary includes rating, location, hours, and next availability.

## Manager workflow

- The manager overview tracks completed appointments today, total appointments for today, next visits, and employees available in the next two hours.
- Each available employee has a booking shortcut that opens step 02, “Choose a service,” with that employee already selected.
- Employee profile editing and working-schedule editing are separate. Each employee has an independent collapsed Working schedule panel that opens on demand.
- Enabled working days start with a valid preset break, and managers can edit or add up to three breaks per day. Breaks are validated against working hours and blocked in availability.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Regenerate API hooks and Zod schemas after changing `lib/api-spec/openapi.yaml`.
- The web artifact requires workflow-provided `PORT` and `BASE_PATH`; use its managed workflow for previews.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
