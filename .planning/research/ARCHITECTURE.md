# Architecture Patterns: Token-Based Public Status Links

**Domain:** Public status pages in authenticated Next.js app
**Researched:** 2026-01-21
**Confidence:** HIGH

## Executive Summary

Integrating token-based public status pages into DonorFlow's existing NextAuth-protected Next.js App Router application requires three architectural changes:

1. **Middleware modification** - Add `/s/` to the exclusion pattern in `matcher`
2. **Public API route** - Create a new unauthenticated route that validates tokens
3. **Database extension** - Add `StatusLink` model with secure token storage

The existing architecture supports this cleanly because DonorFlow already excludes `api/auth` and `login` from middleware protection. The pattern extends naturally to `/s/[token]` routes.

## Recommended Architecture

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `middleware.ts` | Route filtering (excludes `/s/`) | N/A - edge function |
| `app/s/[token]/page.tsx` | Public status page UI | Public API |
| `app/api/public/status/[token]/route.ts` | Public data fetch, token validation | Prisma |
| `lib/api-helpers.ts` | New `withPublicApiRoute` wrapper | Existing patterns |
| `prisma/schema.prisma` | `StatusLink` model | SQLite via Prisma |

### Data Flow

```
User visits /s/abc123
    |
    v
middleware.ts (SKIPPED - /s/ excluded from matcher)
    |
    v
app/s/[token]/page.tsx (client component)
    |
    v
fetch('/api/public/status/abc123')
    |
    v
app/api/public/status/[token]/route.ts
    |-- Validate token exists and not expired
    |-- Check link is active
    |-- Fetch associated data (member, sponsor, donations)
    |
    v
Return JSON (limited fields, no sensitive data)
```

## Implementation Pattern 1: Middleware Exclusion

### Current State (middleware.ts)

```typescript
export const config = {
  matcher: [
    '/((?!api/auth|login|_next/static|_next/image|favicon.ico).*)'
  ]
}
```

### Target State

```typescript
export const config = {
  matcher: [
    '/((?!api/auth|api/public|login|s/|_next/static|_next/image|favicon.ico).*)'
  ]
}
```

**Key changes:**
- Add `api/public` - public API routes namespace
- Add `s/` - public status page routes

**Security consideration:** The negative lookahead pattern ensures ONLY these specific paths bypass auth. All other routes remain protected.

### Security Verification

Per [Next.js Middleware documentation](https://nextjs.org/docs/14/app/building-your-application/routing/middleware), the matcher pattern is statically analyzed at build time. The pattern `(?!api/auth|api/public|login|s/)` creates an explicit allowlist - any route NOT in this list triggers middleware (and thus auth).

**Important:** DonorFlow is on Next.js 16.x which is past the [CVE-2025-29927](https://projectdiscovery.io/blog/nextjs-middleware-authorization-bypass) vulnerability (fixed in 15.2.3+). However, as best practice, the public API route should also validate tokens at the data access layer, not rely solely on middleware bypass.

## Implementation Pattern 2: Public API Routes

### Option A: Separate Namespace (Recommended)

Create a new directory `app/api/public/` for all unauthenticated endpoints.

```
app/api/
├── auth/              # NextAuth (already public via matcher)
├── public/            # NEW: public endpoints
│   └── status/
│       └── [token]/
│           └── route.ts
├── donations/         # Protected (existing)
├── members/           # Protected (existing)
└── ...
```

**Advantages:**
- Clear separation of authenticated vs public routes
- Easy to audit which endpoints are public
- Single matcher addition (`api/public`)
- Consistent with existing `api/auth` pattern

### Option B: Inline Token Validation

Keep in existing namespace, but add token-based auth bypass.

```typescript
// app/api/donations/route.ts
export const GET = async (request: NextRequest) => {
  const token = request.headers.get('x-status-token')

  if (token) {
    // Validate token, return limited data
    return handlePublicRequest(token)
  }

  // Existing auth flow
  return withApiRoute(async () => { ... })
}
```

**Disadvantages:**
- Mixes concerns in existing routes
- Harder to audit public surface area
- Requires modifying multiple existing files

**Recommendation: Use Option A** - it's cleaner, more auditable, and follows DonorFlow's existing pattern of namespace separation.

### New API Helper: withPublicApiRoute

```typescript
// lib/api-helpers.ts (addition)

/**
 * Wraps public API route handlers with error handling (no auth)
 * Use ONLY for routes that validate access via tokens
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
        {
          error: 'Internal Server Error',
          message: error instanceof Error ? error.message : 'Unknown error'
        },
        { status: 500 }
      )
    }
  }
}
```

## Implementation Pattern 3: Database Schema

### StatusLink Model

```prisma
// prisma/schema.prisma (addition)

model StatusLink {
  id              String     @id @default(cuid())
  token           String     @unique  // The URL token (cuid2 recommended)

  // What this link shows
  entityType      String     // 'member' | 'group' | 'sponsor'
  entityId        String     // ID of the linked entity

  // Access control
  isActive        Boolean    @default(true)
  expiresAt       DateTime?  // Optional expiration

  // Tracking
  createdAt       DateTime   @default(now())
  lastAccessedAt  DateTime?
  accessCount     Int        @default(0)

  // Who created it
  createdById     String?

  @@index([token])
  @@index([entityType, entityId])
  @@index([expiresAt])
}
```

### Token Generation

Use [CUID2](https://github.com/paralleldrive/cuid2) for tokens:
- 25 characters, URL-safe (no special characters)
- Cryptographically secure (Sha3 hashing, multiple entropy sources)
- Audited for security, recommended for secret sharing links
- Not guessable, no timestamp leakage (unlike ULID)

```typescript
import { createId } from '@paralleldrive/cuid2'

const token = createId() // e.g., "tz4a98xxat96iws9zmbrgj3a"
```

## Implementation Pattern 4: Page Component

### Directory Structure

```
app/
├── s/                     # NEW: public status pages
│   └── [token]/
│       ├── page.tsx       # Status display (client component)
│       └── loading.tsx    # Skeleton while fetching
├── login/
│   └── page.tsx
├── dashboard/
│   └── page.tsx
└── ...
```

### Page Implementation Approach

```typescript
// app/s/[token]/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { Container, Card, Alert, Spinner } from 'react-bootstrap'

interface StatusData {
  entityType: 'member' | 'group' | 'sponsor'
  entityName: string
  donations: Array<{
    amount: number
    date: string
    sponsorName: string  // Limited info
  }>
  totals: {
    count: number
    amount: number
  }
}

export default function StatusPage({
  params
}: {
  params: Promise<{ token: string }>
}) {
  const [data, setData] = useState<StatusData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchStatus() {
      const { token } = await params
      const response = await fetch(`/api/public/status/${token}`)

      if (!response.ok) {
        if (response.status === 404) {
          setError('Link not found or expired')
        } else {
          setError('Failed to load status')
        }
        setLoading(false)
        return
      }

      const result = await response.json()
      setData(result)
      setLoading(false)
    }

    fetchStatus()
  }, [params])

  // ... render logic
}
```

**Key design decisions:**
- Client component (no server-side session needed)
- Fetches via public API (token validation happens server-side)
- Graceful error states for invalid/expired tokens
- No authentication UI (Navbar excluded)

## Anti-Patterns to Avoid

### Anti-Pattern 1: Exposing Authenticated Routes

**What:** Adding token validation to existing protected routes
**Why bad:**
- Increases attack surface of authenticated endpoints
- Hard to audit what's publicly accessible
- Risk of accidentally exposing more data than intended
**Instead:** Create separate `/api/public/` namespace

### Anti-Pattern 2: Token in Query String Only

**What:** `?token=abc123` without path-based routing
**Why bad:**
- Tokens may be logged in server access logs
- Shared more easily via URL copy
- Less intuitive URL structure
**Instead:** Use path-based tokens `/s/[token]`

### Anti-Pattern 3: Middleware-Only Security

**What:** Relying solely on middleware matcher exclusion
**Why bad:**
- Single point of failure
- CVE-2025-29927 showed middleware can be bypassed
- No defense in depth
**Instead:** Validate token in API route handler AND use middleware exclusion

### Anti-Pattern 4: Exposing Full Entity Data

**What:** Returning all sponsor/member fields in public response
**Why bad:**
- Privacy violation (email, phone, address exposed)
- No need for full data on status page
**Instead:** Create explicit DTOs with only required fields

```typescript
// Good: Explicit public response shape
const publicResponse = {
  entityType: link.entityType,
  entityName: getDisplayName(entity),
  donations: donations.map(d => ({
    amount: d.amount,
    date: d.donationDate,
    // Intentionally omit: sponsor email, phone, address, notes
  })),
  totals: { count, amount }
}
```

## Build Order (Dependency-Based)

The following order respects dependencies:

### Phase 1: Database (Foundation)

1. Add `StatusLink` model to `prisma/schema.prisma`
2. Run `npm run db:push`
3. Install `@paralleldrive/cuid2`

**Why first:** API and UI depend on database schema.

### Phase 2: API Layer

1. Add `withPublicApiRoute` to `lib/api-helpers.ts`
2. Create `app/api/public/status/[token]/route.ts`
3. Add token validation logic
4. Add rate limiting (optional but recommended)

**Why second:** UI fetches from API.

### Phase 3: Middleware

1. Update matcher in `middleware.ts`
2. Test that `/s/` and `/api/public/` bypass auth
3. Test that other routes still require auth

**Why third:** API must exist before exposing routes.

### Phase 4: UI Layer

1. Create `app/s/[token]/page.tsx`
2. Create `app/s/[token]/loading.tsx`
3. Add i18n strings for status page
4. Style with React-Bootstrap

**Why fourth:** Depends on API being functional.

### Phase 5: Admin Integration

1. Add "Create Status Link" UI to member/group/sponsor pages
2. Add link management (view, deactivate, copy)
3. Add link listing in settings or dedicated page

**Why last:** Core feature must work before admin UI.

## Scalability Considerations

| Concern | At 100 links | At 10K links | At 1M links |
|---------|--------------|--------------|-------------|
| Token lookup | Index on token (instant) | Same | Same |
| Expiry cleanup | Manual or ignore | Cron job | Background worker |
| Access tracking | Sync update | Async update | Queue-based |
| Rate limiting | None needed | Per-token limits | IP + token limits |

For DonorFlow's scale (small org), the simple synchronous approach is sufficient. If scaling becomes a concern, access counting can be moved to an async pattern.

## Sources

### Official Documentation (HIGH confidence)
- [Next.js Middleware Documentation](https://nextjs.org/docs/14/app/building-your-application/routing/middleware) - Matcher patterns, exclusion syntax
- [NextAuth.js Next.js Configuration](https://next-auth.js.org/configuration/nextjs) - Middleware integration patterns

### Security References (HIGH confidence)
- [CVE-2025-29927 Analysis](https://projectdiscovery.io/blog/nextjs-middleware-authorization-bypass) - Why middleware-only security is insufficient
- [CUID2 Security Audit](https://github.com/paralleldrive/cuid2) - Token generation best practices

### DonorFlow Codebase (VERIFIED)
- `/home/moetiker/checkouts/donorflow/middleware.ts` - Current matcher pattern
- `/home/moetiker/checkouts/donorflow/lib/api-helpers.ts` - Existing withApiRoute pattern
- `/home/moetiker/checkouts/donorflow/prisma/schema.prisma` - Database conventions
