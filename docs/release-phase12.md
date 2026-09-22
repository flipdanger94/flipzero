# Phase 12 — Production release runbook

Release branch: `release/phase9-11-preprod`  
Pull request: #30  
Migration: `/setup/release-0015`

## Preconditions

- PR #30 remains mergeable with `main`.
- Release branch is 0 commits behind `main`.
- Developer Platform CI is green.
- Responsive Accessibility Performance CI is green.
- Testing Phase CI is green.
- Preproduction Release CI is green.
- Vercel preview provisioning errors are treated separately from application build validation.
- Production runtime errors are checked before release.

## Release sequence

1. Re-check that `main` has not moved and PR #30 is still mergeable.
2. Merge PR #30 into `main`.
3. Trigger the manual Vercel production deployment workflow from `main`.
4. Confirm the deployment reaches READY and points at the expected merge commit.
5. Sign in with the configured admin account and apply `/setup/release-0015`.
6. Confirm all developer integration tables are reported as applied.
7. Run GitHub Actions workflow `Post-deploy Smoke` against the production base URL.
8. Verify manually:
   - OAuth authorize flow.
   - OAuth token exchange.
   - Bot/app install flow.
   - Webhook Test delivery.
   - Direct-message pagination.
   - Space member pagination.
   - Mobile/tablet navigation and modal keyboard behavior.
9. Check Vercel runtime errors after release.

## Required smoke results

- `GET /api/health` -> HTTP 200.
- Health payload reports `service=flipzero-web`.
- Health payload reports `status=ok`.
- Database health reports `ok`.
- `GET /` -> HTTP 200.
- `GET /login` -> HTTP 200.
- Anonymous `GET /api/public/v1/me` -> HTTP 401.
- Anonymous `GET /api/v1/developer/apps` -> HTTP 401.

## Rollback conditions

Rollback if any of the following occurs after deployment:

- Production deployment does not reach READY.
- `/api/health` is degraded or returns 503.
- Authentication or protected-route access is broken.
- A high-volume runtime error cluster appears.
- Core messaging, spaces, or login become unavailable.

## Rollback procedure

1. Do not re-run migrations repeatedly.
2. Use the last known-good Vercel production deployment as the rollback target.
3. Restore production traffic to that deployment.
4. Re-check `/api/health`, login, messaging, spaces, and runtime errors.
5. Keep PR/release diagnostics and fix forward on a new branch.

The developer integration migration is additive. Do not manually drop the new tables during an application rollback unless a separate database rollback has been explicitly reviewed.
