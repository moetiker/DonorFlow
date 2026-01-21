# Project Research Summary

**Project:** DonorFlow - Token-Based Public Status Links
**Domain:** Public pages in authenticated Next.js application
**Researched:** 2026-01-21
**Confidence:** HIGH

## Executive Summary

Adding token-based public status links to DonorFlow is a well-understood pattern with no new dependencies required. The feature allows members to view their donation collection progress via shareable URLs (`/s/[token]`) that bypass NextAuth authentication. The implementation requires three architectural changes: a new `ShareToken` database model, middleware matcher updates to exclude `/s/` and `/api/public/` routes from auth, and a dedicated public API namespace.

The recommended approach uses `crypto.randomBytes(24).toString('base64url')` for secure token generation (192 bits entropy, URL-safe), a separate `ShareToken` Prisma model for flexibility, and a `/api/public/` namespace for public endpoints. The status page should be a client component that fetches from the public API, displaying progress toward collection targets with donor lists (donated vs. not-yet-donated). LYBUNT highlighting (donors who gave last year but not this year) is a high-value differentiator that leverages existing data.

The critical risks are: (1) using insecure CUID for tokens instead of cryptographic random bytes, (2) forgetting to update middleware matcher causing 401 errors for public visitors, (3) using `withApiRoute()` on public endpoints which enforces auth, and (4) exposing PII by returning full database records instead of explicit field selections. DonorFlow is on Next.js 15.5.9, which is patched against CVE-2025-29927 (middleware bypass vulnerability).

## Key Findings

### Recommended Stack

No new dependencies needed. All functionality achievable with existing stack.

**Core technologies:**
- `crypto.randomBytes` (Node.js built-in): Token generation - 192 bits entropy, URL-safe base64url encoding
- Prisma (existing): ShareToken model with unique index on token
- NextAuth middleware (existing): Matcher update to exclude `/s/` and `/api/public/`
- React-Bootstrap (existing): Mobile-first responsive status display

**Token format:** `crypto.randomBytes(24).toString('base64url')` produces 32-character tokens with 192 bits entropy - unguessable and URL-safe.

### Expected Features

**Must have (table stakes):**
- Progress indicator (target vs collected)
- List of sponsors who donated (name, amount, date)
- List of sponsors who haven't donated yet
- Mobile-optimized responsive display
- Multi-language support (de, en, fr, it)

**Should have (competitive):**
- LYBUNT highlighting (Last Year But Unfortunately Not This Year) - high-value for follow-up targeting
- Progress bar/thermometer visualization
- Group aggregate view (all members' progress)

**Defer (v2+):**
- Year-over-year comparison per sponsor
- Print-friendly CSS
- Donation amount sorting options
- Token expiration and regeneration

**Anti-features (do NOT include):**
- Donor contact information (privacy)
- Donation editing capability (security)
- Social sharing buttons (private links)
- Real-time updates (unnecessary complexity)

### Architecture Approach

Create a separate `/api/public/` namespace for unauthenticated endpoints, mirroring the existing `/api/auth/` pattern. The status page at `/s/[token]` is a client component that fetches from `/api/public/status/[token]`. Token validation happens at the API layer (defense in depth), not just middleware exclusion.

**Major components:**
1. `ShareToken` model - Stores token, type (member/group), targetId, optional expiration, access tracking
2. `middleware.ts` update - Excludes `/s/` and `/api/public/` from auth matcher
3. `/api/public/status/[token]/route.ts` - Public API with token validation, explicit field selection
4. `/app/s/[token]/page.tsx` - Client component status display with error handling

### Critical Pitfalls

1. **Using CUID as public token** - CUIDs contain timestamps and are enumerable. Use `crypto.randomBytes(24).toString('base64url')` instead.

2. **Forgetting middleware update** - Public routes return 401 without matcher update. Add `|s/|api/public` to exclusion pattern. Test in incognito window.

3. **Using withApiRoute on public endpoints** - The existing wrapper enforces auth. Create `withPublicApiRoute()` or use raw handler for public routes.

4. **Exposing PII in API response** - Use explicit `select` in Prisma queries. Only return name/company, amount, date. Never return email, phone, address.

5. **Token leakage via Referrer header** - Set `Referrer-Policy: no-referrer` on status pages. Add `rel="noreferrer"` to any external links.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Foundation (Database + Auth Bypass)
**Rationale:** API and UI depend on database schema; middleware must be updated before public routes work
**Delivers:** ShareToken model, token generation utility, middleware exclusion
**Addresses:** Token storage, secure generation
**Avoids:** CUID token pitfall, middleware blocking pitfall

**Tasks:**
- Add ShareToken model to prisma/schema.prisma
- Run db:push
- Create lib/tokens.ts with generateShareToken()
- Update middleware.ts matcher pattern
- Create withPublicApiRoute helper (or document raw handler pattern)

### Phase 2: Public API
**Rationale:** UI fetches from API; API must validate tokens and return safe data
**Delivers:** Public status endpoint with token validation
**Uses:** ShareToken model, explicit Prisma select
**Implements:** /api/public/status/[token]/route.ts

**Tasks:**
- Create app/api/public/status/[token]/route.ts
- Implement token validation (format check, existence, expiration)
- Return only safe fields (no PII)
- Update access tracking (lastAccessedAt, accessCount)
- Test with curl (no auth headers)

### Phase 3: Status Page UI
**Rationale:** Depends on working API; focus on mobile-first design
**Delivers:** Public status page with progress display, donor lists
**Addresses:** Progress indicator, donor lists, mobile optimization, i18n

**Tasks:**
- Create app/s/[token]/page.tsx (client component)
- Create app/s/[token]/loading.tsx
- Create app/s/[token]/not-found.tsx
- Implement progress bar visualization
- Display donated sponsors list
- Display not-yet-donated sponsors list
- Add Referrer-Policy header
- Add i18n strings to all locale files

### Phase 4: Admin UI Integration
**Rationale:** Core feature must work before adding management UI
**Delivers:** Token creation and management from member/group pages
**Addresses:** Admin controls for creating/viewing status links

**Tasks:**
- Add "Create Status Link" button to member detail view
- Add "Create Status Link" button to group detail view
- Add copy-to-clipboard functionality
- Add link listing/management UI
- Show access statistics (last accessed, count)

### Phase 5: Enhancements (Optional)
**Rationale:** Polish features after core functionality works
**Delivers:** LYBUNT highlighting, group aggregate views

**Tasks:**
- Implement LYBUNT highlighting (compare with previous fiscal year)
- Implement group aggregate view (all members' progress)
- Add visual indicators for high-priority follow-ups

### Phase Ordering Rationale

- **Database before API:** API queries depend on schema existing
- **Middleware before pages:** Pages return 401 without middleware update
- **API before UI:** Client component fetches from API
- **Core before admin:** Users need to see status before admins need management UI
- **Essentials before enhancements:** LYBUNT and group views are differentiators, not blockers

### Research Flags

Phases with standard patterns (skip additional research):
- **Phase 1:** Well-documented Prisma model patterns, crypto.randomBytes is standard Node.js
- **Phase 2:** DonorFlow already has API route patterns to follow
- **Phase 3:** Bootstrap responsive patterns are established
- **Phase 4:** Follows existing modal/form patterns in DonorFlow

Phases potentially needing validation:
- **Phase 5 (LYBUNT):** Verify data model supports efficient previous-year comparison queries

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All existing technologies, official Node.js crypto docs |
| Features | HIGH | Well-established donation tracking patterns, multiple sources |
| Architecture | HIGH | Follows existing DonorFlow patterns, official Next.js/NextAuth docs |
| Pitfalls | HIGH | CVE documented, security best practices verified |

**Overall confidence:** HIGH

### Gaps to Address

- **Rate limiting:** Not implemented in DonorFlow currently. Consider adding per-IP limits on public endpoints if abuse occurs.
- **Token expiration UI:** Schema supports expiration but admin UI for setting/viewing expiration deferred to v2+.
- **Accept-Language detection:** Public pages need to detect browser language preference for i18n (DonorFlow uses cookie-based locale for authenticated users).

## Sources

### Primary (HIGH confidence)
- [Node.js Crypto Documentation](https://nodejs.org/api/crypto.html#cryptorandombytessize-callback) - Token generation
- [Auth.js Protecting Routes](https://authjs.dev/getting-started/session-management/protecting) - Middleware patterns
- [Next.js Dynamic Route Segments](https://nextjs.org/docs/app/api-reference/file-conventions/dynamic-routes) - Route structure
- [Bootstrap 5.3 Breakpoints](https://getbootstrap.com/docs/5.3/layout/breakpoints/) - Responsive patterns

### Secondary (MEDIUM confidence)
- [CVE-2025-29927 Analysis](https://securitylabs.datadoghq.com/articles/nextjs-middleware-auth-bypass/) - Middleware security
- [CUID Deprecated Notice](https://github.com/paralleldrive/cuid) - Why not to use CUID for tokens
- [W3C Capability URLs](https://www.w3.org/2001/tag/doc/capability-urls/) - Token security best practices
- [Givebutter LYBUNT](https://givebutter.com/blog/lybunt-and-sybunt) - Feature patterns

### Verified in Codebase
- DonorFlow middleware.ts - Current matcher pattern
- DonorFlow lib/api-helpers.ts - withApiRoute pattern
- DonorFlow prisma/schema.prisma - Model conventions

---
*Research completed: 2026-01-21*
*Ready for roadmap: yes*
