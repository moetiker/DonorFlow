# Phase 2: Public API - Research

**Researched:** 2026-01-21
**Domain:** Public API routes in authenticated Next.js application
**Confidence:** HIGH

## Summary

Phase 2 implements public API endpoints that serve member/group status data to unauthenticated users via token-based capability URLs. The implementation requires three key changes: (1) updating middleware.ts matcher to exclude `/s/` and `/api/public/` routes from NextAuth authentication, (2) creating a `withPublicApiRoute()` helper that provides error handling without authentication, and (3) building the `/api/public/status/[token]/route.ts` endpoint with explicit Prisma `select` to prevent PII leakage.

Phase 1 has already implemented the statusToken fields on Member and Group models, and the token auto-generation via Prisma Client Extensions. This phase focuses solely on exposing that data through public endpoints. The key security considerations are: using 404 (not 401/403) for invalid tokens to prevent token enumeration, excluding PII fields from responses, and adding `Referrer-Policy: no-referrer` header.

**Primary recommendation:** Create a minimal `withPublicApiRoute()` wrapper in lib/api-helpers.ts that provides error handling without authentication, then implement `/api/public/status/[token]/route.ts` with explicit field selection via Prisma `select`.

## Standard Stack

### Core
| Component | Version | Purpose | Why Standard |
|-----------|---------|---------|--------------|
| Next.js App Router | 15.5.9 | API route structure | Already in use, standard pattern |
| Prisma | 6.4.1 | Database queries with explicit select | Already in use, prevents over-fetching |
| NextAuth middleware | 4.x | Auth bypass via matcher | Already configured, needs matcher update |

### Supporting
| Component | Purpose | When to Use |
|-----------|---------|-------------|
| `lib/api-helpers.ts` | Route wrappers | Add `withPublicApiRoute()` to existing file |
| `lib/utils.ts` | `serializeDates()` | All API responses returning Prisma data |
| `lib/validation/i18n.ts` | `getLocaleFromRequest()` | Public routes needing locale-aware responses |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `withPublicApiRoute()` wrapper | Raw async handler | Less error handling boilerplate but must remember try/catch |
| Prisma `select` | Prisma `omit` | `select` is explicit-safe (allowlist); `omit` is implicit-dangerous (blocklist) |

## Architecture Patterns

### Recommended Project Structure
```
app/
├── api/
│   ├── public/                    # Public API namespace (no auth)
│   │   └── status/
│   │       └── [token]/
│   │           └── route.ts       # GET /api/public/status/[token]
│   └── auth/                      # Existing auth routes (excluded from middleware)
lib/
├── api-helpers.ts                 # Add withPublicApiRoute() here
└── validation.ts                  # Add token validation schema
```

### Pattern 1: Middleware Matcher Exclusion

**What:** Update Next.js middleware config to exclude public routes from authentication.

**When to use:** Any route that should be accessible without login.

**Current middleware.ts:**
```typescript
export const config = {
  matcher: [
    '/((?!api/auth|login|_next/static|_next/image|favicon.ico).*)'
  ]
}
```

**Updated middleware.ts:**
```typescript
export const config = {
  matcher: [
    '/((?!api/auth|api/public|s/|login|_next/static|_next/image|favicon.ico).*)'
  ]
}
```

**Why this pattern:**
- Negative lookahead regex is the standard Next.js pattern
- `api/public` excludes the entire public API namespace
- `s/` excludes the status page routes (Phase 3)
- Order doesn't matter in negative lookahead

### Pattern 2: Public API Route Wrapper

**What:** A wrapper function that provides error handling without authentication.

**When to use:** All routes in `/api/public/` namespace.

**Implementation (add to lib/api-helpers.ts):**
```typescript
/**
 * Wraps public API route handlers with error handling (NO authentication)
 * Use this for routes in /api/public/ namespace only
 */
export function withPublicApiRoute<T extends any[]>(
  handler: (request: NextRequest, ...args: T) => Promise<NextResponse>
) {
  return async (request: NextRequest, ...args: T): Promise<NextResponse> => {
    try {
      return await handler(request, ...args)
    } catch (error) {
      console.error(`Public API Error: ${request.method} ${request.url}`, error)

      return NextResponse.json(
        { error: 'Internal Server Error' },
        { status: 500 }
      )
    }
  }
}
```

### Pattern 3: Token Lookup with Explicit Select

**What:** Query by statusToken with allowlist of safe fields.

**When to use:** Any public endpoint returning entity data.

**Example for member token:**
```typescript
// Source: DonorFlow codebase pattern + Prisma official docs
const member = await prisma.member.findUnique({
  where: { statusToken: token },
  select: {
    id: true,
    firstName: true,
    lastName: true,
    // Explicitly OMIT: email, phone, notes, etc. (no PII)
    sponsors: {
      select: {
        id: true,
        company: true,
        firstName: true,
        lastName: true,
        // Explicitly OMIT: email, phone, street, postalCode, city, notes
        donations: {
          where: { type: 'MONETARY', fiscalYearId: currentYear.id },
          select: {
            id: true,
            amount: true,
            donationDate: true,
            // Explicitly OMIT: note
          },
          orderBy: { donationDate: 'desc' }
        }
      }
    },
    memberTargets: {
      where: { fiscalYearId: currentYear.id },
      select: {
        targetAmount: true
      }
    }
  }
})
```

### Pattern 4: 404 for Invalid Tokens

**What:** Return 404 Not Found for invalid/missing tokens, never 401/403.

**Why:** Prevents token enumeration attacks. A 401 would reveal the token format is valid but not found. A 404 treats all invalid requests the same.

**Implementation:**
```typescript
// Token not found - return 404 (not 401)
if (!member && !group) {
  return NextResponse.json(
    { error: 'Not found' },
    { status: 404 }
  )
}
```

### Pattern 5: Security Headers

**What:** Add security headers to public API responses.

**Implementation:**
```typescript
const response = NextResponse.json(data)
response.headers.set('Referrer-Policy', 'no-referrer')
response.headers.set('Cache-Control', 'private, max-age=60')
return response
```

### Anti-Patterns to Avoid

- **Using `withApiRoute()` on public endpoints:** It enforces auth, causing 401 responses
- **Using Prisma `include` without `select`:** Returns ALL fields including PII
- **Returning 401/403 for invalid tokens:** Enables token enumeration attacks
- **Hardcoding fiscal year:** Always query current fiscal year dynamically

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Token format validation | Custom regex | Simple length check (32 chars, base64url) | Tokens are opaque; format is implementation detail |
| Date serialization | Manual `.toISOString()` | `serializeDates()` from lib/utils | Consistent, recursive, handles nested objects |
| Error handling | Manual try/catch in each handler | `withPublicApiRoute()` wrapper | Consistent error response format |
| Locale detection | Custom header parsing | `getLocaleFromRequest()` from lib/validation/i18n | Already handles Accept-Language parsing |

**Key insight:** The existing codebase already has utilities for date serialization, locale detection, and error handling. Phase 2 should reuse these patterns, only adding the `withPublicApiRoute()` wrapper to handle the no-auth case.

## Common Pitfalls

### Pitfall 1: Using withApiRoute on Public Routes

**What goes wrong:** Routes in `/api/public/` return 401 Unauthorized even though middleware excludes them.

**Why it happens:** `withApiRoute()` calls `getServerSession()` internally, which returns null for unauthenticated requests, triggering the 401 response.

**How to avoid:** Create and use `withPublicApiRoute()` wrapper for all public routes.

**Warning signs:** 401 responses when testing public endpoints with curl (no auth headers).

### Pitfall 2: Middleware Matcher Not Updated

**What goes wrong:** Public routes return 401 or redirect to login page.

**Why it happens:** NextAuth middleware intercepts requests before they reach the route handler.

**How to avoid:** Update `middleware.ts` matcher to exclude `api/public|s/`.

**Warning signs:** Browser redirects to `/login` when accessing `/api/public/status/[token]`.

**Verification:** Test with `curl -v http://localhost:7526/api/public/status/sometoken` - should get 404, not 401 or redirect.

### Pitfall 3: PII Leakage via Full Object Return

**What goes wrong:** API exposes email, phone, address, notes to anonymous users.

**Why it happens:** Using `include` instead of `select` in Prisma queries returns all fields.

**How to avoid:** Always use explicit `select` with allowlisted fields only.

**Warning signs:** Response contains fields like `email`, `phone`, `street`, `postalCode`, `city`, `notes`.

### Pitfall 4: Token Enumeration via Error Codes

**What goes wrong:** Attackers can distinguish between valid-but-expired tokens and invalid tokens.

**Why it happens:** Returning different error codes (401 vs 404) or messages for different failure modes.

**How to avoid:** Return 404 with generic "Not found" message for ALL token failures.

**Warning signs:** Different HTTP status codes or error messages for invalid vs expired vs malformed tokens.

### Pitfall 5: Missing Fiscal Year Handling

**What goes wrong:** API crashes or returns empty data when no current fiscal year exists.

**Why it happens:** Assuming a current fiscal year always exists.

**How to avoid:** Check for null fiscal year and return appropriate response (empty targets/donations but still show member/group info).

**Warning signs:** 500 errors when fiscal year table is empty or no current year exists.

## Code Examples

### Complete Token Lookup Query

```typescript
// Source: DonorFlow codebase patterns
import { prisma } from '@/lib/db'

async function getStatusByToken(token: string) {
  const now = new Date()

  // Get current fiscal year
  const currentYear = await prisma.fiscalYear.findFirst({
    where: {
      startDate: { lte: now },
      endDate: { gte: now }
    }
  })

  // Try member token first
  const member = await prisma.member.findUnique({
    where: { statusToken: token },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      sponsors: {
        select: {
          id: true,
          company: true,
          firstName: true,
          lastName: true,
          donations: {
            where: currentYear ? {
              type: 'MONETARY',
              fiscalYearId: currentYear.id
            } : { type: 'MONETARY' },
            select: {
              id: true,
              amount: true,
              donationDate: true
            },
            orderBy: { donationDate: 'desc' }
          }
        }
      },
      memberTargets: currentYear ? {
        where: { fiscalYearId: currentYear.id },
        select: { targetAmount: true }
      } : false
    }
  })

  if (member) {
    return { type: 'member' as const, data: member, fiscalYear: currentYear }
  }

  // Try group token
  const group = await prisma.group.findUnique({
    where: { statusToken: token },
    select: {
      id: true,
      name: true,
      members: {
        select: {
          id: true,
          firstName: true,
          lastName: true
        }
      },
      sponsors: {
        select: {
          id: true,
          company: true,
          firstName: true,
          lastName: true,
          donations: {
            where: currentYear ? {
              type: 'MONETARY',
              fiscalYearId: currentYear.id
            } : { type: 'MONETARY' },
            select: {
              id: true,
              amount: true,
              donationDate: true
            },
            orderBy: { donationDate: 'desc' }
          }
        }
      }
    }
  })

  if (group) {
    return { type: 'group' as const, data: group, fiscalYear: currentYear }
  }

  return null
}
```

### Complete Public API Route Handler

```typescript
// Source: DonorFlow codebase patterns
// File: app/api/public/status/[token]/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { withPublicApiRoute } from '@/lib/api-helpers'
import { serializeDates } from '@/lib/utils'

export const GET = withPublicApiRoute(async (
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) => {
  const { token } = await params

  // Basic format validation (32-char base64url)
  if (!token || token.length !== 32) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const result = await getStatusByToken(token)

  if (!result) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { type, data, fiscalYear } = result

  // Calculate progress
  let target = 0
  let actual = 0

  if (type === 'member' && data.memberTargets?.[0]) {
    target = data.memberTargets[0].targetAmount
  }

  const donations = data.sponsors.flatMap(s => s.donations)
  actual = donations.reduce((sum, d) => sum + (d.amount || 0), 0)

  const response = NextResponse.json(serializeDates({
    type,
    name: type === 'member'
      ? `${data.firstName} ${data.lastName}`
      : data.name,
    fiscalYear: fiscalYear ? {
      name: fiscalYear.name,
      startDate: fiscalYear.startDate,
      endDate: fiscalYear.endDate
    } : null,
    progress: {
      target,
      actual,
      percentage: target > 0 ? Math.round((actual / target) * 100) : 0
    },
    sponsors: data.sponsors.map(s => ({
      name: s.company || `${s.firstName || ''} ${s.lastName || ''}`.trim() || 'Anonymous',
      donated: s.donations.length > 0,
      totalAmount: s.donations.reduce((sum, d) => sum + (d.amount || 0), 0),
      lastDonation: s.donations[0]?.donationDate || null
    }))
  }))

  response.headers.set('Referrer-Policy', 'no-referrer')
  response.headers.set('Cache-Control', 'private, max-age=60')

  return response
})
```

### Response Format Examples

**Successful member response:**
```json
{
  "type": "member",
  "name": "Max Mustermann",
  "fiscalYear": {
    "name": "2025/2026",
    "startDate": "2025-07-01T00:00:00.000Z",
    "endDate": "2026-06-30T23:59:59.999Z"
  },
  "progress": {
    "target": 5000,
    "actual": 3250,
    "percentage": 65
  },
  "sponsors": [
    {
      "name": "ABC Company",
      "donated": true,
      "totalAmount": 1000,
      "lastDonation": "2025-12-15T00:00:00.000Z"
    },
    {
      "name": "John Smith",
      "donated": false,
      "totalAmount": 0,
      "lastDonation": null
    }
  ]
}
```

**Successful group response:**
```json
{
  "type": "group",
  "name": "Group North",
  "fiscalYear": {
    "name": "2025/2026",
    "startDate": "2025-07-01T00:00:00.000Z",
    "endDate": "2026-06-30T23:59:59.999Z"
  },
  "progress": {
    "target": 0,
    "actual": 7500,
    "percentage": 0
  },
  "sponsors": [
    {
      "name": "XYZ Corp",
      "donated": true,
      "totalAmount": 5000,
      "lastDonation": "2025-11-20T00:00:00.000Z"
    }
  ]
}
```

**Error response (invalid token):**
```json
{
  "error": "Not found"
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `params` as sync object | `params` as Promise (await) | Next.js 15 | Route handlers must await params |
| Global middleware bypass | Matcher regex exclusion | NextAuth 4.x | Use negative lookahead pattern |
| `omit` for field exclusion | `select` for explicit inclusion | Best practice | Prevents accidental PII exposure |

**Deprecated/outdated:**
- Using `params.id` directly without await (Next.js 15+ requires `await params`)
- Using `any` type for route context (use `{ params: Promise<{ token: string }> }`)

## Open Questions

1. **Group target calculation**
   - What we know: Groups don't have direct targets; targets are on members
   - What's unclear: Should group status show aggregate target of all members?
   - Recommendation: For Phase 2, return target=0 for groups. Phase 5 can add aggregate calculation.

2. **Token expiration (deferred)**
   - What we know: Schema supports expiration but not implemented in Phase 1
   - What's unclear: Should Phase 2 check expiration field?
   - Recommendation: No - token expiration is a Phase 5+ feature. Phase 2 ignores expiration.

## Sources

### Primary (HIGH confidence)
- [Next.js Middleware Documentation](https://nextjs.org/docs/15/app/api-reference/file-conventions/middleware) - Matcher patterns
- [Auth.js Protecting Routes](https://authjs.dev/getting-started/session-management/protecting) - Middleware exclusion patterns
- DonorFlow `lib/api-helpers.ts` - Existing withApiRoute pattern
- DonorFlow `lib/db.ts` - Prisma client and query patterns
- DonorFlow `middleware.ts` - Current matcher configuration

### Secondary (MEDIUM confidence)
- DonorFlow Phase 1 verification - Confirms statusToken implementation
- DonorFlow API routes - Confirm query and response patterns

### Tertiary (LOW confidence)
- None - all findings verified against codebase or official docs

## Metadata

**Confidence breakdown:**
- Middleware matcher: HIGH - Official Next.js docs + existing codebase pattern
- Public route wrapper: HIGH - Direct extension of existing withApiRoute pattern
- Prisma select patterns: HIGH - Existing codebase patterns + Prisma official docs
- Response format: MEDIUM - Based on codebase patterns, may need adjustment in Phase 3

**Research date:** 2026-01-21
**Valid until:** 2026-02-21 (30 days - stable patterns, no fast-moving dependencies)
