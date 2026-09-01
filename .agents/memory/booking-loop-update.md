---
name: Booking loop update
description: Phase 1 UX-audit remediations every agent must keep. Appointment book, gated lookup, cancel/reschedule, honest confirmation, local dates.
---

# Booking loop update (Sep 2026)

Shipped on branch `cursor/close-booking-loop-2380` / PR #1. Implements Phase 1 of the CT Style Salon UX audit (F-01, F-02, F-03, F-04, F-19, F-20, F-30) plus small a11y/RTL/SEO items.

**Why this exists:** The product used to stop at booking. There was no salon appointment book, no cancel/reschedule, an email-only public lookup (PII), and confirmation copy that promised mail the repo never sent. Later agents must not reopen that loop.

## Guest booking

- Confirmation shows a **6-character `lookupCode`** derived from HMAC of the guest email (`appointmentLookupCode` in `artifacts/api-server/src/lib/booking-access.ts`). It is not a new database column.
- Copy: save the reference; use it with the email to view, move, or cancel. Promise mail **only** when `emailSent` is true.
- Mail: `artifacts/api-server/src/lib/mail.ts` uses Resend when `RESEND_API_KEY` is set. Optional `RESEND_FROM`. Optional `BOOKING_LOOKUP_SECRET` (falls back to `SESSION_SECRET`).
- Date picker: `localDateISO()` in `artifacts/ct-style-salon/src/lib/dates.ts`. Never `new Date().toISOString().slice(0, 10)` for local calendar days.
- Changing stylist: `selectEmployee(id, serviceIds)` keeps services and clears only the time.

## Guest appointments (`/appointments`)

- UI: `artifacts/ct-style-salon/src/pages/guest-appointments.tsx`
- Lookup requires **email + lookupCode**.
- Cancel and reschedule call `PATCH /api/appointments/:id` with the same credentials.

## Manager workspace (`/manage`)

- Appointment book is first: `artifacts/ct-style-salon/src/pages/appointment-book.tsx` (day/week, stylist filter, cancel, move).
- Then service menu and employee roster (unchanged purpose).
- Manager `GET /api/appointments` uses Clerk / `x-salon-manager` and date filters (`date` or `from`+`to`, optional `stylistId`). No guest email required.

## API contract

| Method | Path | Who | Notes |
|---|---|---|---|
| GET | `/api/appointments?email=&lookupCode=` | Guest | 401 without matching code; 429 if rate-limited |
| GET | `/api/appointments?date=` or `from`/`to` | Manager | Day/week book |
| POST | `/api/appointments` | Guest | Response includes `lookupCode`, `emailSent` |
| PATCH | `/api/appointments/:appointmentId` | Guest (email+code) or manager | `{ status: "cancelled" }` or `{ date, time }` |

OpenAPI: `lib/api-spec/openapi.yaml`. Zod: `lib/api-zod`. Extra client: `lib/api-client-react/src/appointments-extra.ts` (`updateAppointment`).

Availability and create/reschedule overlap queries **exclude** `status = cancelled`.

## Also changed in the same pass

- `artifacts/ct-style-salon/index.html` — title, description, OG, HairSalon JSON-LD
- Arabic font pairing (IBM Plex Sans Arabic + Noto Naskh Arabic), RTL `letter-spacing: normal`, display line-height
- `prefers-reduced-motion`, skip link, mobile menu aria-expanded / Escape / scroll lock
- Booking form `autoComplete`, booking errors use `role="alert"` and mapped copy
- Primary terracotta darkened to `20 55% 40%` for AA
- 404 is branded and translated, not engineer scaffolding

## Still open (do not assume done)

- F-05 / F-09 / F-10 — Arabic as first-class DB fields; stop fragment concatenation
- F-21–F-24 — better booking errors already started; slot grouping, mobile summary bar, empty-slot next-available still open
- F-25 / F-27 / F-28 — extract shadcn primitives; decide dark mode
- F-31 / F-32 — commission a real hero photo; self-host fonts
- Live hours/staff/menu vs placeholder seed (Marco / Aisha / Daniel) is content, not this PR

## How to apply

1. Read this file and `AGENTS.md` before touching appointments.
2. After OpenAPI changes, regenerate clients (`pnpm --filter @workspace/api-spec run codegen`).
3. Keep API tests discovering live services/stylists (see `salon-regression-fixtures.md`). New appointment tests must use `appointmentLookupCode(email)` or the create response `lookupCode`.
4. Isolated unit tests (no DB): `booking-access.test.ts`, `booking-flow.test.ts`, `dates.test.ts`.
