# MashRoute Audit Report

Date: 2026-07-01

## Initial Project Status

Status: Functional with remaining controlled-production work.

The app starts locally, the frontend builds, frontend lint passes, Prisma schema validation passes, direct login works, and the previously broken students endpoint is repaired. Authenticated document-record downloads have been added. Some production-hardening items remain, mainly formal Prisma migration baselining and a decision on whether agents should become a distinct role.

## Architecture Summary

- Frontend: React 18, Vite, React Router, Zustand auth store, Axios API client, Tailwind CSS.
- Backend: Express, Prisma Client, PostgreSQL/Neon, Socket.io, JWT access tokens, HttpOnly refresh-token cookie.
- Database: PostgreSQL via Prisma schema in `backend/prisma/schema.prisma`.
- Storage: Google Drive when configured, with local `/uploads` fallback.
- Notifications: Socket.io in-app notifications and Meta WhatsApp Cloud API integration; email dependencies are present but email sending is not fully wired through audited flows.
- Deployment: PM2 config in `deploy/ecosystem.config.js`, Nginx config in `deploy/nginx-mashroute.conf`, Render config in `backend/render.yaml`.

## Checks Run

- `backend`: `npx prisma validate` passed.
- `backend`: `npx prisma generate` passed.
- `backend`: `npx prisma db push` completed without data-loss warnings and synchronized Neon with the current Prisma schema.
- `backend`: `npx prisma migrate status` still reports no `prisma/migrations` folder; the current database is not yet baselined for Prisma Migrate.
- `backend`: `npm audit --omit=dev` passed after dependency cleanup.
- `backend`: `npm run backfill:student-creators` completed; all 11 active students now have `createdById`.
- `backend`: application commission snapshot columns were added, existing applications were backfilled, and zero-value placeholder commission rows were cleaned.
- `frontend`: `npm run lint` passed.
- `frontend`: `npm run build` passed with bundle-size warnings and a mixed static/dynamic import warning for `@react-pdf/renderer`.
- `frontend`: `npm audit --audit-level=high --omit=dev` passed.

## Issues Found

| Severity | Category | Module | File | Issue | Root Cause | Recommended Fix | Approval Required |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Critical | Security | Google Drive OAuth setup | `backend/src/routes/driveAuth.routes.js` | Public setup callback can exchange an OAuth code, write `GOOGLE_REFRESH_TOKEN` into `.env`, and display the token. | `/drive-auth/url` and `/drive-auth/callback` are unauthenticated and have no setup secret/state check. | Require a server-side setup token, pass it as OAuth `state`, reject callbacks without it, and stop displaying refresh tokens. | No, clear security bug. |
| High | Authorization | Commission management | `backend/src/modules/universities/university.routes.js`, `frontend/src/pages/shared/UniversityDetail.jsx` | Super Admin can modify tenant commission records. | Backend `PUT /universities/:id/commissions` authorizes `SUPER_ADMIN`, and frontend shows edit controls for Super Admin when an agency is selected. | Restrict commission mutation to `TENANT_ADMIN`; keep Super Admin read-only. | No, explicitly required by approved permission matrix. |
| High | Authorization | Application workflow | `backend/src/modules/applications/application.service.js` | Several Tenant Admin-only actions also allow Super Admin, and basic application update does not receive user role/user id for staff ownership enforcement. | Service checks use `userRole !== 'TENANT_ADMIN' && userRole !== 'SUPER_ADMIN'`; `updateApplication` calls `_assertExists` without staff scoping. | Fixed: route/service checks now enforce Tenant Admin for restricted workflow actions and staff ownership for permitted actions. | Approved and completed. |
| High | Tenant isolation | Realtime notifications | `backend/src/server.js` | Socket clients can join arbitrary `tenant:{id}` and `user:{id}` rooms. | Socket room joins trust client-supplied IDs without token authentication/authorization. | Fixed: Socket.io authenticates JWT handshake and derives rooms from the verified user. | Approved and completed. |
| High | Documents/Security | File access | `backend/src/modules/documents/*`, `frontend/src/components/documents/*` | Uploaded document records used direct local/Drive URLs for downloads. | Static Express serving and Drive public permissions bypass backend authorization. | Fixed for document-record downloads by routing them through an authenticated backend endpoint. Legacy preview/static/workflow raw URLs still require a broader storage migration. | Approved and partially completed. |
| High | Security | Secret management | `backend/prisma/seed.js`, `backend/.env.production.example` | Real-looking default super-admin password appears in seed fallback and production example. | Hardcoded fallback/default credential. | Replace with safe placeholder/generate requirement; do not publish real credentials. | No, clear secret-management bug affecting future setup only. |
| High | Database | Students | `backend/prisma/schema.prisma`, Neon database | `/students` returns 500 because Prisma selects `Student.phdGrade`, but the connected database does not have that column. | Prisma schema/client and live database are out of sync; no Prisma Migrate baseline exists. | Fixed with approved `npx prisma db push`; `/students` now returns 200. | Approved and completed. |
| Medium | Database | Migrations | `backend/prisma` | No Prisma migration history exists for current database. | Schema is managed by `db push`/manual sync, not Prisma Migrate baseline. | Prepare a baseline migration plan and backup/rollback instructions before production migrations. | Yes, production database process change. |
| Medium | Roles | Authorization model | `backend/prisma/schema.prisma` | Prompt requires Agent role, but schema only has `SUPER_ADMIN`, `TENANT_ADMIN`, `STAFF`. | Agent appears modeled through `STAFF` plus `agentCategory`, not a distinct role. | Decide whether to add `AGENT` role or document STAFF-as-agent behavior. | Yes, schema and workflow change. |
| Medium | Authorization | User management | `backend/src/modules/users/user.controller.js`, `backend/src/modules/users/user.service.js` | Tenant Admin user update/reset/delete operations were not consistently scoped to the actor tenant. | Service methods mutated by `id` only after the controller dropped or failed to pass tenant context. | Fixed: user get/update/reset/delete now validate tenant scope before mutation; Tenant Admin cannot promote users to Super Admin. | Approved and completed. |
| Medium | Commission | Application commission tracking | `backend/prisma/schema.prisma`, `backend/src/modules/applications/application.service.js`, `backend/src/modules/universities/university.routes.js` | Applications only tracked payout status, not the commission rate/tier snapshot; cleared commission rows could linger. | Commission lookup was UI-only and save used upserts without deleting removed/zero rows. | Fixed: applications now store commission snapshots; commission saves replace the current structure and reject invalid amounts. | Approved and completed. |
| Medium | Dependency | Email | `backend/package.json` | `nodemailer` has high-severity advisories. | Installed version range is vulnerable according to npm audit. | Fixed: upgraded `nodemailer`, removed unused vulnerable `node-cron` and `uuid`; backend production audit passes. | Approved and completed. |
| Medium | Deployment | Startup script | `start.sh` | Startup script points to old `/Users/macminim2/Scholarlink` paths. | Script was not updated after project rename/path change. | Update paths to `/Users/user/MashRoute` or replace with documented PM2 workflow. | No, clear deployment script bug. |
| Low | Performance | Frontend bundle | `frontend/src/components/loe/IIMATTemplate.jsx`, build config | Large `IIMATTemplate` bundle and mixed static/dynamic import warning. | `@react-pdf/renderer` is both statically and dynamically imported. | Split PDF generator cleanly or adjust imports. | Yes, performance refactor. |

## Change Log

### Critical: Protected Google Drive OAuth setup

- Issue: Public Drive OAuth setup route could write `GOOGLE_REFRESH_TOKEN` into `.env` and display it.
- Root cause: `/api/v1/drive-auth/url` and `/api/v1/drive-auth/callback` had no setup token/state guard.
- Files: `backend/src/routes/driveAuth.routes.js`, `backend/.env.example`, `backend/.env.production.example`.
- Change made: Added `DRIVE_AUTH_SETUP_TOKEN` requirement, passed it through OAuth `state`, rejected missing/invalid callbacks, and stopped rendering the refresh token.
- Why safe: The route is only for one-time setup and should not be public in normal operation.
- Tests: `node --check backend/src/routes/driveAuth.routes.js`; `curl /api/v1/drive-auth/url` without setup token.
- Result: Syntax check passed; route returns `403`.
- Database migration required: No.
- Deployment action required: Set `DRIVE_AUTH_SETUP_TOKEN` only when Drive reauthorization is needed, then restart backend.

### High: Super Admin commission mutation blocked

- Issue: Super Admin could edit agency commission records despite approved read-only commission access.
- Root cause: Backend `PUT /universities/:id/commissions` allowed `SUPER_ADMIN`; frontend showed an edit button for Super Admin with selected agency.
- Files: `backend/src/modules/universities/university.routes.js`, `frontend/src/pages/shared/UniversityDetail.jsx`, `frontend/src/api/endpoints.js`.
- Change made: Restricted commission write route to `TENANT_ADMIN`; removed Super Admin commission edit UI and changed copy to read-only.
- Why safe: Matches the approved permission matrix and keeps Super Admin read access.
- Tests: `node --check backend/src/modules/universities/university.routes.js`; direct Super Admin `PUT /api/v1/universities/:id/commissions`.
- Result: Syntax check passed; Super Admin write returns `403 Insufficient permissions`.
- Database migration required: No.
- Deployment action required: Restart backend and rebuild frontend.

### High: Removed published default production credential

- Issue: Real-looking default super-admin password appeared in seed fallback and production example.
- Root cause: Hardcoded credential-like value.
- Files: `backend/prisma/seed.js`, `backend/.env.production.example`.
- Change made: Replaced production example credential with placeholders and changed seed fallback to a generic change-me password.
- Why safe: Existing database users are not modified; only future seed/default setup is affected.
- Tests: `npx prisma validate`; `npx prisma generate`.
- Result: Passed.
- Database migration required: No.
- Deployment action required: Ensure real production `SUPER_ADMIN_PASSWORD` is set securely before seeding.

### Medium: Fixed stale local startup script paths

- Issue: `start.sh` referenced old `Scholarlink` paths and `/tmp/sl-*` files.
- Root cause: Project rename/path drift.
- File: `start.sh`.
- Change made: Updated paths to `/Users/user/MashRoute` and `/tmp/mashroute-*`.
- Why safe: Local convenience script only; PM2 deployment config unchanged.
- Tests: Shell patch review.
- Result: Paths now point to current workspace.
- Database migration required: No.
- Deployment action required: No for PM2 deployments.

### High: Synchronized Neon database with Prisma schema

- Issue: Student queries failed because the database was missing columns present in Prisma schema.
- Root cause: Database was not in sync with `schema.prisma`, and no Prisma Migrate baseline exists.
- Files: `backend/prisma/schema.prisma` plus live Neon schema.
- Change made: Ran `npx prisma db push`, which completed without data-loss warnings and regenerated Prisma Client.
- Why safe: Plain `db push` was used without `--accept-data-loss` or reset flags; Prisma did not report destructive changes.
- Tests: `npx prisma validate`; direct API login; `GET /api/v1/students?page=1&limit=5`.
- Result: Schema validates; students endpoint returns `200`.
- Database migration required: Schema sync applied. Formal migration baseline still pending.
- Deployment action required: Run the same controlled schema sync or an approved baseline migration in production environments.

### High: Tightened application workflow authorization

- Issue: Super Admin and staff could reach actions beyond the approved matrix or intended ownership.
- Root cause: Route/service checks were too broad or lacked role/user context.
- Files: `backend/src/modules/applications/application.routes.js`, `backend/src/modules/applications/application.controller.js`, `backend/src/modules/applications/application.service.js`.
- Change made: Tenant Admin-only route guards added for restricted workflow/payment/commission actions; staff create/update/upload/note/history paths now use authenticated user ownership checks; request-body student/university/agent IDs are validated against tenant visibility.
- Why safe: Matches approved permission model and preserves staff access to assigned/permitted records.
- Tests: `node --check`; direct Super Admin `POST /applications/:id/accept`; `GET /applications`.
- Result: Syntax passed; Super Admin restricted action returns `403`; application list returns `200`.
- Database migration required: No.
- Deployment action required: Restart backend.

### High: Authenticated Socket.io rooms

- Issue: Sockets could join arbitrary tenant/user rooms from client-provided IDs.
- Root cause: No socket handshake authentication and trusted `join:*` payloads.
- Files: `backend/src/server.js`, `frontend/src/lib/socket.js`, `frontend/src/hooks/useSocket.js`.
- Change made: Client sends access token in Socket.io auth; server verifies JWT, checks active user/tenant, and auto-joins only derived rooms. Legacy join events are no-ops.
- Why safe: Keeps realtime behavior while preventing cross-tenant room joins.
- Tests: Unauthenticated socket connection.
- Result: Connection rejected with `Authentication required`.
- Database migration required: No.
- Deployment action required: Rebuild frontend and restart backend.

### High: Tightened payment and document authorization

- Issue: Payment mutations and document verification allowed broader roles than the approved tenant-admin model; staff document object access lacked ownership checks.
- Root cause: Route-level `SUPER_ADMIN` allowances and service methods without user-context filters.
- Files: `backend/src/modules/payments/payment.routes.js`, `backend/src/modules/documents/document.routes.js`, `backend/src/modules/documents/document.controller.js`, `backend/src/modules/documents/document.service.js`.
- Change made: Payment mutations and document verification are Tenant Admin-only; document list/get/upload/replace/delete/download now use tenant and staff ownership/application assignment filters.
- Why safe: Backend now enforces object-level tenant/ownership checks instead of relying on frontend visibility.
- Tests: `node --check`; frontend lint/build.
- Result: Syntax passed; frontend checks passed.
- Database migration required: No.
- Deployment action required: Restart backend.

### High: Added authenticated document-record downloads

- Issue: Document rows downloaded raw `fileUrl` values directly from local `/uploads` or Google Drive.
- Root cause: The frontend used anchor tags that bypassed backend document authorization.
- Files: `backend/src/modules/documents/document.routes.js`, `backend/src/modules/documents/document.controller.js`, `backend/src/modules/documents/document.service.js`, `frontend/src/api/endpoints.js`, `frontend/src/components/documents/DocumentUploadSection.jsx`, `frontend/src/components/documents/DocumentTimeline.jsx`.
- Change made: Added `GET /api/v1/documents/:id/download`, reusing tenant/staff object checks before streaming local files or proxying remote file bytes. Updated document-record download buttons and modal downloads to use Axios with the existing auth token.
- Why safe: Existing previews and legacy workflow links remain available, while normal document-record downloads now require authentication and authorization.
- Tests: `node --check`; `npm run lint`; `npx prisma validate`.
- Result: Passed.
- Database migration required: No.
- Deployment action required: Rebuild frontend and restart backend.

### Medium: Dependency audit cleanup

- Issue: Backend production audit reported vulnerable dependencies.
- Root cause: Vulnerable `nodemailer` version and unused vulnerable `node-cron`/`uuid` dependencies.
- Files: `backend/package.json`, `backend/package-lock.json`.
- Change made: Upgraded `nodemailer` to `9.0.3`; removed unused `node-cron` and `uuid`.
- Why safe: Source scan found no runtime imports of removed packages.
- Tests: `npm audit --omit=dev`.
- Result: `found 0 vulnerabilities`.
- Database migration required: No.
- Deployment action required: Run `npm install` on deployment target.

### Medium: Tenant-scoped user mutations

- Issue: Tenant Admin user mutations could target users by id without a consistent tenant ownership check.
- Root cause: `updateUser`, `resetUserPassword`, and `deleteUser` updated by primary key only; controller did not pass tenant scope to reset/delete.
- Files: `backend/src/modules/users/user.controller.js`, `backend/src/modules/users/user.service.js`.
- Change made: Added tenant-scoped target validation before user update/reset/delete; Super Admin honors optional `X-Tenant-Id` scope; Tenant Admin cannot assign `SUPER_ADMIN`.
- Why safe: Prevents cross-tenant user mutation while preserving Super Admin global maintenance access when no tenant override is supplied.
- Tests: `node --check`; backend JS syntax sweep; API smoke test.
- Result: Passed.
- Database migration required: No.
- Deployment action required: Restart backend.

### Medium: Student creator backfill script wired

- Issue: Existing students with null `createdById` remain hidden from staff-scoped views.
- Root cause: `createdById` was added after existing student records were created.
- Files: `backend/scripts/backfill-student-creator.js`, `backend/package.json`.
- Change made: Added `npm run backfill:student-creators`; hardened the script shutdown path so Prisma disconnects after success or failure; students without applications now fall back to an active Tenant Admin in the same tenant.
- Why safe: Script is idempotent and only updates students where `createdById` is null.
- Tests: `DRY_RUN=1 npm run backfill:student-creators`; `npm run backfill:student-creators`; direct Prisma count verification.
- Result: Backfill applied. All 11 active students now have `createdById`; 0 active students remain missing a creator.
- Database migration required: No schema migration.
- Deployment action required: For other environments, run `DRY_RUN=1 npm run backfill:student-creators` first, then run without `DRY_RUN` when ready.

### Medium: Commission structure rebuilt

- Issue: Commission rates were not snapshotted onto applications, so historical payouts could drift when university rates changed. Clearing a rate in the UI could also leave stale rows in the database.
- Root cause: Application only stored `commissionStatus`; university commission save performed upserts but did not treat the submitted structure as authoritative.
- Files: `backend/prisma/schema.prisma`, `backend/src/modules/applications/application.service.js`, `backend/src/modules/universities/university.routes.js`, `backend/scripts/backfill-application-commissions.js`, `frontend/src/pages/shared/ApplicationDetail.jsx`, `backend/package.json`.
- Change made: Added application commission snapshot fields, calculated snapshots during application create/update, passed snapshot value to commission WhatsApp notifications, replaced commission save logic with validate/delete/recreate semantics, and added an application commission backfill script.
- Why safe: Existing applications keep a stable rate snapshot once matched; future commission edits no longer mutate old payout history.
- Tests: `npx prisma validate`; `npx prisma db push`; backend JS syntax sweep; frontend lint/build; API smoke test.
- Result: Passed. Cleaned 64 zero-value placeholder commission rows; 168 positive commission rows remain. Existing 5 applications were backfilled, but none matched a positive rate based on their current university/program/agent tier.
- Database migration required: Applied with `npx prisma db push`; formal Prisma migration baseline remains pending.
- Deployment action required: Rebuild/restart backend and frontend after schema sync.

## Updates Waiting for Approval

- Fully migrate legacy workflow URLs, previews, public `/uploads`, and Drive `anyone` permissions to private/short-lived access. Risk: High; affects existing document links and storage behavior.
- Baseline Prisma migrations for the existing Neon database. Risk: High; requires backup, migration plan, and rollback plan.
- Add a distinct `AGENT` role or formally map agents to existing `STAFF` role. Risk: High; schema, permissions, UI, and data migration impact.
- Refactor LOE/PDF bundle splitting. Risk: Low; performance-only.
