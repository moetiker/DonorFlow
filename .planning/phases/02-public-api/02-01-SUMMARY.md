---
phase: 02-public-api
plan: 01
subsystem: api
tags: [public-api, capability-urls, tokens, status-endpoint, security]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: statusToken fields on Member and Group, token generation infrastructure
provides:
  - Public status API endpoint (GET /api/public/status/[token])
  - Middleware exclusion for public routes (api/public/*, s/*)
  - withPublicApiRoute wrapper for unauthenticated endpoints
affects: [02-public-api, 03-member-status-page, 04-group-status-page]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "withPublicApiRoute for unauthenticated API endpoints"
    - "Capability URL token validation (32-char format)"
    - "Security headers for public endpoints (Referrer-Policy, Cache-Control)"
    - "Explicit Prisma select to prevent PII leakage"

key-files:
  created:
    - app/api/public/status/[token]/route.ts
  modified:
    - middleware.ts
    - lib/api-helpers.ts

key-decisions:
  - "404 for invalid tokens (not 401/403) - avoids information disclosure"
  - "Security headers: Referrer-Policy: no-referrer, Cache-Control: private, max-age=60"
  - "Group targets set to 0 (aggregate calculation deferred to Phase 4)"

patterns-established:
  - "Public API routes in /api/public/* namespace, excluded from auth middleware"
  - "Use withPublicApiRoute (not withApiRoute) for public endpoints"
  - "Explicit Prisma select to prevent PII leakage in public responses"

# Metrics
duration: 6min
completed: 2026-01-21
---

# Phase 2 Plan 1: Public Status API Summary

**Public status endpoint for capability URL access - returns member/group donation progress without authentication**

## Performance

- **Duration:** 6 min
- **Started:** 2026-01-21T21:32:46Z
- **Completed:** 2026-01-21T21:38:56Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Middleware exclusion for `/api/public/*` and `/s/*` routes (no auth required)
- `withPublicApiRoute()` wrapper for public endpoints with error handling
- GET `/api/public/status/[token]` returns member or group donation status
- Response includes progress (target, actual, percentage) and sponsors list
- Security: No PII exposed, security headers set, 404 for invalid tokens

## Task Commits

Each task was committed atomically:

1. **Task 1: Update middleware and add public route wrapper** - `0dc761a` (feat)
2. **Task 2: Create public status API endpoint** - `fcdabbf` (feat)

## Files Created/Modified

- `middleware.ts` - Added exclusion for api/public and s/ routes
- `lib/api-helpers.ts` - Added withPublicApiRoute() wrapper function
- `app/api/public/status/[token]/route.ts` - Public status API endpoint

## Decisions Made

- **404 for invalid tokens:** Returns 404 (not 401/403) to avoid information disclosure about token validity
- **Group targets:** Set to 0 for now - aggregate target calculation from member targets deferred to Phase 4
- **Security headers:** Referrer-Policy: no-referrer (prevents token leakage via referrer), Cache-Control: private, max-age=60
- **Explicit Prisma select:** Only select non-PII fields to prevent accidental data leakage

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- **Dev database schema mismatch:** The dev.db did not have statusToken columns yet (only prod.db from Phase 1). Resolved by running `prisma db push --accept-data-loss` on dev.db and generating tokens for existing members/groups.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Public status API endpoint ready for use by member status pages
- `/s/*` route excluded from auth middleware, ready for Phase 3 status page implementation
- Token generation infrastructure (from Phase 1) working with both member and group tokens

---
*Phase: 02-public-api*
*Completed: 2026-01-21*
