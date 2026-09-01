# Agent notes — CT Style Salon

Read this before changing booking, appointments, or the manager workspace.

## Current product state (Sep 2026)

Phase 1 of the UX audit is on `cursor/close-booking-loop-2380` (PR #1). The booking loop is closed:

- Managers have a **day/week appointment book** on `/manage`.
- Guests get a **6-character booking reference** after booking. Email is sent only if `RESEND_API_KEY` is set.
- Guests **must** send `email` + `lookupCode` to list, cancel, or reschedule. Email-only lookup is 401 and rate-limited.
- Confirmation copy must **not** promise an inbox message unless mail actually sent (`emailSent`).

Full detail: [`.agents/memory/booking-loop-update.md`](.agents/memory/booking-loop-update.md)

## Do not regress

- Do not restore `GET /api/appointments?email=` without a reference.
- Do not tell guests “a confirmation is headed to your inbox” unless `appointment.emailSent` is true.
- Do not clear selected services when the guest changes stylist (`selectEmployee` keeps `serviceIds`).
- Do not set the booking date with `toISOString().slice(0, 10)` — use `localDateISO()` from `src/lib/dates.ts` (Abu Dhabi UTC+4 midnight bug).
- Do not hide cancelled appointments from overlap checks incorrectly — cancelled visits must free the chair (`status !== cancelled`).
- Do not delete the manager appointment book. Service/roster editors are not enough to run the floor.

## Open follow-up (Phase 2–3)

Arabic fields on services/stylists, parameterised strings, slot grouping, mobile price bar, real hero photo, shadcn extraction. See the memory file.

## Other memory

- [`.agents/memory/MEMORY.md`](.agents/memory/MEMORY.md) — index of durable notes
- [`.agents/memory/salon-regression-fixtures.md`](.agents/memory/salon-regression-fixtures.md) — API tests must discover live records
- [`.agents/memory/orval-zod-compatibility.md`](.agents/memory/orval-zod-compatibility.md) — Zod 4 required for generated validators
