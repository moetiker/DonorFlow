# Domain Pitfalls: Token-Based Public Status Links

**Domain:** Public status links for authenticated Next.js app with NextAuth
**Researched:** 2026-01-21
**Confidence:** HIGH (verified with official docs and security advisories)

---

## Critical Pitfalls

Mistakes that cause security vulnerabilities or require rewrites.

### Pitfall 1: Using CUID as Public Token

**What goes wrong:** DonorFlow uses `@default(cuid())` for all IDs. Using the existing sponsor/donation CUID as the public token creates a guessable, enumerable attack surface. CUIDs contain timestamps and machine identifiers that reduce entropy.

**Why it happens:** Developers reuse existing IDs for convenience, not realizing CUIDs were designed for database uniqueness, not security.

**Consequences:**
- Attackers can predict token patterns from timestamps
- Sequential enumeration becomes feasible
- One leaked token helps predict others
- Original CUID library is [deprecated as insecure](https://github.com/paralleldrive/cuid) due to timestamp leakage

**Prevention:**
- Generate dedicated share tokens using cryptographically secure random bytes
- Use `crypto.randomBytes(32).toString('base64url')` (Node.js) or CUID2
- Store token in separate field, not reuse the record ID
- Minimum 128 bits of entropy for public tokens

**Detection:** Review schema - if ShareLink.token uses `@default(cuid())`, this is vulnerable.

**Phase:** Database schema design (Phase 1)

---

### Pitfall 2: Middleware Bypass via x-middleware-subrequest Header (CVE-2025-29927)

**What goes wrong:** Next.js versions before 15.2.3 have a critical vulnerability where attackers can bypass middleware authentication by adding the `x-middleware-subrequest` header to requests.

**Why it happens:** Next.js uses this header internally to mark subrequests. External requests with this header skip middleware entirely, bypassing auth checks.

**Consequences:**
- All protected routes become accessible without authentication
- CVSS score: 9.1 (Critical)
- [Affects versions](https://securitylabs.datadoghq.com/articles/nextjs-middleware-auth-bypass/): < 12.3.5, < 13.5.9, < 14.2.25, < 15.2.3

**Prevention:**
- Verify Next.js version >= 15.2.3 (DonorFlow currently uses 15.5.9 - SAFE)
- Block `x-middleware-subrequest` header at reverse proxy/load balancer level
- Never rely solely on middleware for auth - use defense in depth

**Detection:** Check `package.json` for Next.js version. If self-hosted, verify header stripping at proxy level.

**Phase:** Infrastructure setup, ongoing security maintenance

---

### Pitfall 3: Forgetting to Exclude Public Route from Auth Middleware

**What goes wrong:** Adding `/s/[token]` route without updating middleware matcher causes 401 errors for all public link visitors.

**Why it happens:** DonorFlow's middleware uses a negative lookahead pattern that protects everything by default:
```typescript
matcher: ['/((?!api/auth|login|_next/static|_next/image|favicon.ico).*)']
```

**Consequences:**
- Public links redirect to login or return 401
- Feature appears broken in production
- Often missed because developers are logged in during testing

**Prevention:**
- Add `|s` to middleware matcher: `/((?!api/auth|login|s|_next/static|...)/.*)`
- Test public routes in incognito/private browser window
- Add integration test that fetches `/s/[token]` without auth headers

**Detection:** Access `/s/testtoken` while logged out. If redirected to login, middleware is blocking.

**Phase:** Route implementation (Phase 1)

---

### Pitfall 4: Public API Endpoint Without Auth Check

**What goes wrong:** Creating `/api/public/status/[token]` but forgetting it still goes through `withApiRoute()` which requires authentication.

**Why it happens:** DonorFlow's `withApiRoute()` wrapper always calls `withAuth()`. New public endpoints need a different wrapper or no wrapper.

**Consequences:**
- API returns 401 for all public requests
- Frontend shows loading forever or error state

**Prevention:**
- Create `withPublicApiRoute()` helper that skips auth but keeps error handling
- Or use raw handler without wrapper for public endpoints
- Document which endpoints are public vs protected

**Detection:** Call API endpoint with `curl` without cookies/auth headers.

**Phase:** API implementation (Phase 1)

---

## Moderate Pitfalls

Mistakes that cause delays, bugs, or technical debt.

### Pitfall 5: Token Leakage via Referrer Header

**What goes wrong:** Public status page includes links to external sites (analytics, social share buttons, third-party scripts). Token in URL leaks via HTTP Referer header.

**Why it happens:** Default browser behavior sends full URL as referrer when navigating to external sites.

**Consequences:**
- Third-party services log the token in their access logs
- Token becomes discoverable via third-party data breaches
- [W3C documents this as major capability URL risk](https://www.w3.org/2001/tag/doc/capability-urls/)

**Prevention:**
- Set `Referrer-Policy: no-referrer` header on public status pages
- Add `rel="noreferrer"` to all external links
- Avoid embedding third-party scripts on token-protected pages
- Consider putting token in fragment (`#token`) instead of path (not logged by servers)

**Detection:** Open Network tab, click external link, check Referer header in request.

**Phase:** Page implementation (Phase 2)

---

### Pitfall 6: Caching Token Pages at CDN/Proxy Level

**What goes wrong:** Status pages get cached by CDN or reverse proxy. Different sponsors see each other's data when cache key doesn't include token.

**Why it happens:** CDN caches by URL path but may normalize or ignore dynamic segments. ISR/SSG settings may accidentally cache dynamic content.

**Consequences:**
- Privacy violation - sponsor A sees sponsor B's donation data
- Stale data persists until cache expires
- Hard to debug - works in dev, fails in production with caching

**Prevention:**
- Use `dynamic = 'force-dynamic'` or `revalidate = 0` for status pages
- Set `Cache-Control: private, no-store` header
- Verify CDN configuration respects full path including token
- Test with multiple different tokens in quick succession

**Detection:** Request same path twice with different tokens, compare responses.

**Phase:** Route implementation, infrastructure (Phase 1-2)

---

### Pitfall 7: Exposing More Data Than Intended

**What goes wrong:** Database query fetches full sponsor record including email, phone, address and returns it to public endpoint. Frontend only displays name, but API response contains everything.

**Why it happens:** Reusing existing Prisma queries that include all fields. Not explicitly selecting only public-safe fields.

**Consequences:**
- PII leakage to anyone with token
- GDPR/privacy compliance violation
- Attackers can enumerate to collect personal data

**Prevention:**
- Explicit `select` in Prisma query: only `company`, `firstName`, `lastName`
- Create dedicated DTO/type for public response
- Never spread full database objects to response
- Review API response in browser Network tab

**Detection:** Compare API response fields against intended public fields.

**Phase:** API implementation (Phase 1)

---

### Pitfall 8: No Token Validation Before Database Query

**What goes wrong:** Every request to `/s/[token]` hits database, even for invalid/malformed tokens. Attackers can enumerate tokens or DoS the database.

**Why it happens:** Natural pattern is to query database and check if result exists.

**Consequences:**
- Database load from enumeration attacks
- Timing attacks reveal token existence
- Rate limiting harder to implement per-token

**Prevention:**
- Validate token format before database query (length, character set)
- Implement rate limiting per IP
- Use constant-time comparison if checking token validity
- Return identical response for "not found" and "invalid format"

**Detection:** Send requests with obviously invalid tokens, monitor database queries.

**Phase:** API implementation (Phase 1)

---

### Pitfall 9: Route Conflict with Existing Pages

**What goes wrong:** Creating `/s/[token]` route conflicts with potential future `/settings` or `/sponsors` routes if using catch-all. Or existing `/sponsors` URL gets captured by overly broad dynamic route.

**Why it happens:** [Next.js route precedence](https://nextjs.org/docs/pages/building-your-application/routing/dynamic-routes) is complex. Static routes should win but edge cases exist.

**Consequences:**
- Existing admin pages become inaccessible
- Build failures with "paths must be unique" errors
- Unpredictable routing behavior in production

**Prevention:**
- Use explicit `/s/[token]` not catch-all `[...token]`
- Keep public routes in isolated namespace (`/s/`, `/share/`, `/public/`)
- Test navigation to all admin pages after adding public routes
- Document route namespace allocation

**Detection:** Navigate to `/sponsors`, `/settings`, etc. after adding public routes.

**Phase:** Route structure design (Phase 1)

---

## Minor Pitfalls

Mistakes that cause annoyance but are easily fixable.

### Pitfall 10: Missing Locale Handling on Public Pages

**What goes wrong:** Public pages don't respect user's browser language preference. German users see English, or vice versa.

**Why it happens:** DonorFlow uses `next-intl` with cookie-based locale. Public visitors have no cookie set.

**Prevention:**
- Detect `Accept-Language` header for public pages
- Fall back to default locale (German) gracefully
- Consider adding language switcher to public page

**Phase:** UI implementation (Phase 2)

---

### Pitfall 11: No Expiration Strategy for Tokens

**What goes wrong:** Tokens live forever. Old sponsors can still access data years later, increasing attack surface over time.

**Why it happens:** Static tokens are simpler to implement than expiring ones.

**Prevention:**
- Add `expiresAt` field to token model
- Provide admin UI to regenerate/revoke tokens
- Consider automatic expiration (1 year?) with notification

**Phase:** Advanced features (Phase 3 or later)

---

### Pitfall 12: Poor UX for Invalid/Expired Tokens

**What goes wrong:** Invalid token shows generic 404 or error page. User has no idea why link doesn't work or what to do.

**Why it happens:** Focus on happy path, error states get default handling.

**Prevention:**
- Create dedicated "invalid link" page with explanation
- Suggest contacting organization
- Log invalid token access for monitoring

**Phase:** UI polish (Phase 2)

---

## Phase-Specific Warnings Summary

| Phase | Topic | Likely Pitfall | Mitigation |
|-------|-------|----------------|------------|
| 1 - Schema | Token generation | Using CUID (insecure) | Use crypto.randomBytes |
| 1 - Schema | Field selection | Exposing PII | Explicit select clause |
| 1 - Routes | Middleware config | Blocking public routes | Update matcher pattern |
| 1 - API | Auth wrapper | Using withApiRoute | Create withPublicApiRoute |
| 2 - UI | Token in URL | Referrer leakage | Set Referrer-Policy header |
| 2 - UI | Caching | CDN caches wrong data | force-dynamic, no-store |
| 2 - UI | i18n | Missing locale detection | Check Accept-Language |
| 3+ | Lifecycle | Tokens never expire | Add expiresAt field |

---

## Sources

**Security Advisories:**
- [CVE-2025-29927 Analysis - Datadog Security Labs](https://securitylabs.datadoghq.com/articles/nextjs-middleware-auth-bypass/)
- [CVE-2025-29927 - JFrog](https://jfrog.com/blog/cve-2025-29927-next-js-authorization-bypass/)

**Token Security:**
- [CUID Deprecated - GitHub](https://github.com/paralleldrive/cuid) - explains why CUID is insecure
- [CUID2 - GitHub](https://github.com/paralleldrive/cuid2) - secure replacement
- [Capability URLs Best Practices - W3C](https://www.w3.org/2001/tag/doc/capability-urls/)
- [Schneier on Unguessable URLs](https://www.schneier.com/blog/archives/2015/07/googles_unguess.html)

**Referrer Leakage:**
- [Referer Header Security - MDN](https://developer.mozilla.org/en-US/docs/Web/Privacy/Guides/Referer_header:_privacy_and_security_concerns)
- [Cross-domain Referer Leakage - PortSwigger](https://portswigger.net/kb/issues/00500400_cross-domain-referer-leakage)

**NextAuth & Next.js:**
- [Securing Pages and API Routes - NextAuth.js](https://next-auth.js.org/tutorials/securing-pages-and-api-routes)
- [Auth.js Protecting Routes](https://authjs.dev/getting-started/session-management/protecting)
- [Dynamic Routes - Next.js](https://nextjs.org/docs/pages/building-your-application/routing/dynamic-routes)
