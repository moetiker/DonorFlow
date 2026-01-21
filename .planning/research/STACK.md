# Technology Stack: Token-Based Public Status Links

**Project:** DonorFlow - Public Status Links Feature
**Researched:** 2026-01-21
**Confidence:** HIGH (verified with official documentation)

## Executive Summary

Adding token-based public status links to DonorFlow requires:
1. Secure token generation using Node.js built-in `crypto` module
2. Middleware configuration to exclude `/s/[token]` routes from authentication
3. New Prisma model for storing share tokens
4. Mobile-first Bootstrap 5 patterns (already in use)

No new dependencies required. All functionality achievable with existing stack.

---

## Recommended Stack Additions

### Token Generation

| Technology | Version | Purpose | Rationale |
|------------|---------|---------|-----------|
| Node.js `crypto` | Built-in | Token generation | Already available, cryptographically secure, no dependencies |

**Decision: Use `crypto.randomBytes()` over nanoid**

Rationale:
- DonorFlow already uses Node.js built-in modules (crypto for bcryptjs comparison)
- No additional dependencies needed
- `crypto.randomBytes(24).toString('base64url')` produces URL-safe 32-character tokens
- 24 bytes = 192 bits of entropy (far exceeds the ~122 bits in UUID v4)

**Token Format:**
```typescript
import { randomBytes } from 'crypto'

function generateShareToken(): string {
  // 24 bytes = 32 base64url characters, 192 bits entropy
  return randomBytes(24).toString('base64url')
}
// Example output: "Kj7mN2xP9qR4sT1vW3yZ5aB8cD0eF6gH"
```

**Why not nanoid?**
- Would add a dependency (118 bytes, but still a dependency)
- `crypto.randomBytes` with `base64url` encoding is equally secure
- Keeps stack minimal per DonorFlow conventions

**Security Properties (HIGH confidence - Node.js official docs):**
- Uses OS-level cryptographic RNG
- 192 bits entropy is unguessable (would take billions of years to brute-force)
- `base64url` encoding is URL-safe (no +, /, or = characters)

**Source:** [Node.js Crypto Documentation](https://nodejs.org/api/crypto.html#cryptorandombytessize-callback)

---

### Database Schema Extension

| Technology | Version | Purpose | Rationale |
|------------|---------|---------|-----------|
| Prisma | 7.2 (existing) | Token storage | Already in use, SQLite compatible |

**New Model: ShareToken**

```prisma
model ShareToken {
  id           String    @id @default(cuid())
  token        String    @unique
  type         String    // 'member' or 'group'
  targetId     String    // memberId or groupId
  label        String?   // Optional display label
  expiresAt    DateTime?
  lastAccessedAt DateTime?
  accessCount  Int       @default(0)
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  @@index([token])
  @@index([targetId])
  @@index([type, targetId])
}
```

**Design Decisions:**

1. **Separate model vs. adding to Member/Group:** Separate model allows multiple tokens per entity, expiration, and access tracking without schema changes to core models.

2. **No foreign key constraint:** Using `targetId` + `type` rather than `memberId`/`groupId` foreign keys avoids complex polymorphic relations. Validate at application level.

3. **Token uniqueness:** `@unique` constraint on token ensures fast lookup and prevents collisions.

4. **Optional expiration:** `expiresAt` allows time-limited links (e.g., for temporary sharing).

5. **Access tracking:** `lastAccessedAt` and `accessCount` for analytics without complex logging.

---

### Public Route Configuration

| Technology | Version | Purpose | Rationale |
|------------|---------|---------|-----------|
| NextAuth Middleware | 4.24 (existing) | Route protection bypass | Already configured, just needs matcher update |

**Current Middleware (middleware.ts):**
```typescript
export const config = {
  matcher: [
    '/((?!api/auth|login|_next/static|_next/image|favicon.ico).*)'
  ]
}
```

**Updated Middleware for Public Routes:**
```typescript
export const config = {
  matcher: [
    // Exclude: api/auth, login, static assets, AND /s/* (public share links)
    '/((?!api/auth|login|s/|_next/static|_next/image|favicon.ico).*)'
  ]
}
```

**Route Structure:**
```
app/
  s/
    [token]/
      page.tsx         # Public status view (Server Component)
```

**Why `/s/` prefix?**
- Short, memorable URLs (`/s/abc123` vs `/share/abc123`)
- Clear namespace separation from authenticated routes
- Single character saves bytes in URLs shared via SMS/social

**Verification (HIGH confidence - Auth.js official docs):**
The matcher regex pattern excludes paths from middleware entirely. Requests to `/s/*` will bypass authentication checks completely.

**Source:** [Auth.js Protecting Routes](https://authjs.dev/getting-started/session-management/protecting)

---

### Public API Route

**Route:** `app/api/public/status/[token]/route.ts`

```typescript
// This route is public - no withApiRoute wrapper
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { serializeDates } from '@/lib/utils'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  // Find and validate token
  const shareToken = await prisma.shareToken.findUnique({
    where: { token }
  })

  if (!shareToken) {
    return NextResponse.json({ error: 'Invalid link' }, { status: 404 })
  }

  // Check expiration
  if (shareToken.expiresAt && shareToken.expiresAt < new Date()) {
    return NextResponse.json({ error: 'Link expired' }, { status: 410 })
  }

  // Update access tracking (fire and forget)
  prisma.shareToken.update({
    where: { id: shareToken.id },
    data: {
      lastAccessedAt: new Date(),
      accessCount: { increment: 1 }
    }
  }).catch(() => {}) // Non-blocking

  // Fetch status data based on type
  // ... implementation details
}
```

**Middleware Update for API:**
```typescript
// Also exclude public API from auth
'/((?!api/auth|api/public|login|s/|_next/static|_next/image|favicon.ico).*)'
```

---

### Mobile-First UI with Bootstrap 5

| Technology | Version | Purpose | Rationale |
|------------|---------|---------|-----------|
| Bootstrap | 5.3.8 (existing) | Responsive layout | Already in use, mobile-first by default |
| React-Bootstrap | 2.10 (existing) | React components | Already in use |

**Bootstrap 5 Breakpoints (for reference):**

| Breakpoint | Class infix | Dimensions |
|------------|-------------|------------|
| Extra small | (none) | <576px |
| Small | `sm` | >=576px |
| Medium | `md` | >=768px |
| Large | `lg` | >=992px |
| Extra large | `xl` | >=1200px |
| XXL | `xxl` | >=1400px |

**Mobile-First Pattern for Status View:**

```tsx
// Design for mobile first, enhance for larger screens
<Container className="py-3 py-md-4">
  {/* Stack vertically on mobile, side-by-side on tablet+ */}
  <Row className="g-3">
    <Col xs={12} md={6}>
      <Card>
        <Card.Body className="text-center">
          {/* Large, touch-friendly progress display */}
          <h2 className="display-4">{progress}%</h2>
          <ProgressBar now={progress} className="mb-3" style={{ height: '1.5rem' }} />
        </Card.Body>
      </Card>
    </Col>
    <Col xs={12} md={6}>
      {/* Stats cards stack on mobile */}
      <Card className="mb-3 mb-md-0">
        <Card.Body>
          <small className="text-muted d-block">Collected</small>
          <span className="fs-4">{formatCurrency(collected)}</span>
        </Card.Body>
      </Card>
    </Col>
  </Row>
</Container>
```

**Key Mobile Patterns:**

1. **Touch targets:** Minimum 44x44px for interactive elements
2. **Readable text:** Base font size 16px minimum (Bootstrap default)
3. **Vertical stacking:** `Col xs={12}` for full-width on mobile
4. **Generous spacing:** `py-3` padding, `g-3` gutters
5. **Large typography:** `.display-*` and `.fs-*` classes for emphasis

**Source:** [Bootstrap 5.3 Breakpoints](https://getbootstrap.com/docs/5.3/layout/breakpoints/)

---

## Next.js 16 Dynamic Route Pattern

**File Structure:**
```
app/
  s/
    [token]/
      page.tsx      # Server Component (default)
      loading.tsx   # Loading state
      not-found.tsx # 404 handling
```

**Page Implementation:**

```tsx
// app/s/[token]/page.tsx
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { StatusView } from './StatusView'

interface PageProps {
  params: Promise<{ token: string }>
}

export default async function PublicStatusPage({ params }: PageProps) {
  const { token } = await params

  const shareToken = await prisma.shareToken.findUnique({
    where: { token }
  })

  if (!shareToken) {
    notFound()
  }

  if (shareToken.expiresAt && shareToken.expiresAt < new Date()) {
    notFound() // Or custom expired page
  }

  // Fetch status data...
  const statusData = await getStatusData(shareToken)

  return <StatusView data={statusData} />
}

// Generate metadata for social sharing
export async function generateMetadata({ params }: PageProps) {
  const { token } = await params
  const shareToken = await prisma.shareToken.findUnique({
    where: { token }
  })

  return {
    title: shareToken?.label || 'Donation Progress',
    description: 'View donation collection progress',
    // Prevent search engine indexing of private links
    robots: 'noindex, nofollow'
  }
}
```

**TypeScript Note (Next.js 16):**
In Next.js 15+, `params` is a `Promise` and must be awaited. This is a breaking change from Next.js 14.

**Source:** [Next.js Dynamic Route Segments](https://nextjs.org/docs/app/api-reference/file-conventions/dynamic-routes)

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not Alternative |
|----------|-------------|-------------|---------------------|
| Token generation | `crypto.randomBytes` | nanoid | Adds dependency, no security benefit |
| Token generation | `crypto.randomBytes` | `crypto.randomUUID` | UUID format is long (36 chars), includes dashes |
| Token encoding | `base64url` | `hex` | Hex is 50% longer (48 chars vs 32) |
| Token length | 24 bytes (192 bits) | 16 bytes (128 bits) | Extra security margin, negligible size difference |
| Route prefix | `/s/` | `/share/` or `/status/` | Brevity for mobile sharing |
| Schema | Separate ShareToken model | Add token to Member/Group | Less flexible, harder to add features |

---

## Implementation Checklist

### 1. Database Schema
- [ ] Add ShareToken model to `prisma/schema.prisma`
- [ ] Run `npm run db:push`

### 2. Token Generation Utility
- [ ] Create `lib/tokens.ts` with `generateShareToken()` function
- [ ] Add Zod schema for token validation

### 3. Middleware Update
- [ ] Update `middleware.ts` matcher to exclude `/s/` and `/api/public/`

### 4. API Routes
- [ ] Create `app/api/public/status/[token]/route.ts` (public, read-only)
- [ ] Create `app/api/share-tokens/route.ts` (authenticated, CRUD)
- [ ] Create `app/api/share-tokens/[id]/route.ts` (authenticated, CRUD)

### 5. Public Page
- [ ] Create `app/s/[token]/page.tsx` (Server Component)
- [ ] Create `app/s/[token]/loading.tsx`
- [ ] Create `app/s/[token]/not-found.tsx`

### 6. Admin UI
- [ ] Add share link management to member/group detail views
- [ ] Copy-to-clipboard functionality
- [ ] QR code generation (optional, use existing library if available)

### 7. Translations
- [ ] Add i18n keys to all locale files (`messages/de.json`, etc.)

---

## Security Considerations

| Concern | Mitigation |
|---------|------------|
| Token guessability | 192 bits entropy, cryptographic RNG |
| Token enumeration | Rate limiting on API (implement if needed) |
| Information disclosure | Read-only access, aggregate data only |
| Link persistence | Optional expiration, revocation capability |
| SEO indexing | `robots: noindex, nofollow` meta tag |
| HTTPS | Already enforced for all routes |

---

## Sources

- [Node.js Crypto Documentation](https://nodejs.org/api/crypto.html#cryptorandombytessize-callback) - HIGH confidence
- [Auth.js Protecting Routes](https://authjs.dev/getting-started/session-management/protecting) - HIGH confidence
- [Next.js Dynamic Route Segments](https://nextjs.org/docs/app/api-reference/file-conventions/dynamic-routes) - HIGH confidence
- [Bootstrap 5.3 Breakpoints](https://getbootstrap.com/docs/5.3/layout/breakpoints/) - HIGH confidence
- [Nanoid GitHub](https://github.com/ai/nanoid) - MEDIUM confidence (comparison reference)
- [Secure Random Values in Node.js](https://gist.github.com/joepie91/7105003c3b26e65efcea63f3db82dfba) - MEDIUM confidence (best practices)
