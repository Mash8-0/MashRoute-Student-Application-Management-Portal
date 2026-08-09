# MDAC Reminder and Tracking

## Overview

MashRoute tracks Malaysia Digital Arrival Card (MDAC) requirements on the existing application arrival workflow. The backend is the source of truth for MDAC eligibility, deadlines, workflow state, reminders, and tenant-scoped permissions.

## Business Rule

MDAC uses the Malaysia arrival calendar date, not only the flight departure date. The registration window is three Malaysia calendar days including the submission date.

For Malaysia arrival date `D`:

- Window opens: `D - 2 calendar days`
- Deadline: `D`
- Eligible dates: `D-2`, `D-1`, `D`

Example: if the Malaysia arrival date is `10 August 2026`, MDAC opens on `8 August 2026` and is due on `10 August 2026`.

The official registration URL is:

https://imigresen-online.imi.gov.my/mdac/register

MashRoute does not automate submission to the Immigration website.

## Data Model

The feature extends `Application` because arrival data already lives there. It adds flight details, Malaysia accommodation details, MDAC requirement/status fields, proof document linkage, verifier identity, review notes, and previous arrival date for review/audit.

Permanent MDAC states:

- `NOT_REQUIRED`
- `REQUIRED`
- `SUBMITTED`
- `VERIFIED`
- `NEEDS_REVIEW`

Time-dependent display states are computed from Malaysia calendar dates:

- `NOT_YET_ELIGIBLE`
- `ELIGIBLE_NOW`
- `DUE_TOMORROW`
- `DUE_TODAY`
- `OVERDUE`
- `ARRIVAL_DATE_CHANGED`

## Permissions

- Tenant Admin: tenant-wide view, edit arrival information, upload proof, mark not required, verify, or mark for review.
- Assigned Staff: assigned records only, update arrival information, upload proof, mark submitted. Staff cannot verify proof.
- Super Admin: follows existing super-admin tenant access policy.

All sensitive state changes write to `ActivityLog`.

## Notifications

The scheduler creates idempotent in-app reminders with metadata idempotency keys:

- Seven calendar days before arrival: MDAC will become available soon.
- Window open: MDAC can now be submitted.
- One day before arrival: urgent due tomorrow.
- Arrival date: due today.
- After arrival: overdue.
- Arrival date changed: notify assigned staff and tenant admins.
- Proof uploaded/submitted: notify tenant admins.
- Verified or needs review: notify assigned staff.

The scheduler is disabled in `NODE_ENV=test`. It can be disabled with `MDAC_REMINDERS_ENABLED=false`.

## Configuration

Optional server environment variables:

- `MDAC_TIMEZONE`, default `Asia/Kuala_Lumpur`
- `MDAC_WINDOW_DAYS`, default `3`
- `MDAC_URL`, default official MDAC registration URL
- `MDAC_REMINDERS_ENABLED=false` to disable reminder runs
- `MDAC_REMINDER_INTERVAL_MS`, default six hours, minimum one hour

## API

- `GET /api/v1/applications/mdac/records`
- `GET /api/v1/applications/:id/mdac`
- `PATCH /api/v1/applications/:id/arrival`
- `PATCH /api/v1/applications/:id/mdac/not-required`
- `POST /api/v1/applications/:id/mdac/submitted`
- `POST /api/v1/applications/:id/mdac/proof`
- `POST /api/v1/applications/:id/mdac/verify`
- `GET /api/v1/analytics/dashboard` includes `mdacActionRequired`

## PM2 Scheduler Note

No separate process is required. The scheduler starts with the existing backend process in `src/server.js`. Under PM2, keep one backend instance unless the reminder job is moved to a dedicated worker; multiple instances would each run the same scheduler, with notification idempotency preventing duplicates but adding unnecessary work.

## Migration

Migration file:

`backend/prisma/migrations/20260809000000_mdac_reminder_tracking/migration.sql`

Local/staging steps:

1. Back up the database.
2. Run `cd backend && npx prisma migrate deploy`.
3. Run `cd backend && npx prisma generate`.
4. Restart the backend process after review.

Do not run these steps against production until the feature branch has been reviewed.

## Testing

Useful local checks:

- `cd backend && npx prisma validate`
- `cd backend && npx prisma generate`
- `cd backend && node tests/mdac-eligibility.test.js`
- `cd frontend && npm run build`

## Rollback

Application code can be reverted by redeploying the previous release. Database rollback requires a reviewed SQL rollback plan because PostgreSQL enum value removal is not trivial. The added columns are nullable/defaulted and do not alter existing application rows destructively.
