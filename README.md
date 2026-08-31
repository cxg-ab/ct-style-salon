# CT Style Salon

Responsive booking experience for CT Style Salon at My City Centre Masdar, Abu Dhabi.

## What it includes

- Public browsing for salon services and stylists
- Stylist-specific recurring availability
- Multi-service appointment booking with duration-aware availability
- Appointment lookup by email
- English and Arabic UI with RTL support
- Clerk-protected manager workspace
- Manager editing for services, employee profiles, photos, and schedules
- PostgreSQL persistence with generated OpenAPI clients and Zod validators
- App Storage uploads for employee profile photos

## Workspace

This repository is a pnpm monorepo:

- `artifacts/ct-style-salon` — React and Vite web app
- `artifacts/api-server` — Express API server
- `lib/db` — Drizzle schema and database package
- `lib/api-spec` — OpenAPI source
- `lib/api-client-react` — generated React Query client
- `lib/api-zod` — generated Zod schemas

## Local development

Install dependencies and start the configured workflows:

```bash
pnpm install
pnpm --filter @workspace/ct-style-salon run dev
pnpm --filter @workspace/api-server run dev
```

The API uses the workspace database connection and Clerk environment variables. App Storage must also be provisioned for employee photo uploads.

## Verification

```bash
pnpm -w run typecheck
pnpm --filter @workspace/api-server test
pnpm --filter @workspace/ct-style-salon run test
pnpm --filter @workspace/ct-style-salon run build
```

## API contracts

Update `lib/api-spec/openapi.yaml`, then regenerate the typed packages:

```bash
pnpm --filter @workspace/api-spec run codegen
```

## Manager access

Guests can browse and book without an account. Manager mutations require a signed-in Clerk user whose public metadata contains:

```json
{ "role": "manager" }
```

Employee photos are uploaded directly to App Storage through a manager-only presigned upload URL. The database stores the normalized object path, not an external image URL.