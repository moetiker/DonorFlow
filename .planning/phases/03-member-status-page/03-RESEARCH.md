# Phase 3: Member Status Page - Research

**Researched:** 2026-01-21
**Domain:** Mobile-optimized public pages with Next.js 16 App Router, next-intl, React-Bootstrap
**Confidence:** HIGH

## Summary

Phase 3 implements mobile-optimized public status pages that display donation progress to members via capability URLs. The implementation builds on Phase 2's API endpoint and uses Next.js App Router with Server Components for minimal JavaScript, next-intl's client-side locale detection pattern (already in use), and React-Bootstrap's responsive components.

The key architectural decisions are: (1) use Server Components where possible to minimize JavaScript, with Client Components only for locale detection and interactive elements, (2) leverage the existing locale detection pattern from `lib/i18n/utils.ts` which uses browser language preferences and localStorage, (3) implement LYBUNT (Last Year But Unfortunately Not This Year) detection by querying previous fiscal year donations for each sponsor, and (4) use React-Bootstrap's ProgressBar component which includes built-in ARIA accessibility.

The codebase already has the infrastructure in place: middleware excludes `/s/` routes from authentication (Phase 2), the API at `/api/public/status/[token]` returns all necessary data, and next-intl is configured for client-side locale detection without URL segments. This phase focuses on creating the UI layer.

**Primary recommendation:** Create a Client Component at `app/s/[token]/page.tsx` that fetches data from the Phase 2 API, uses the existing locale detection pattern, and renders with React-Bootstrap components optimized for mobile.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js App Router | 16.1.4 | Page routing and server components | Already in use, App Router default in Next.js 16 |
| React Bootstrap | 2.10.10 | UI components (ProgressBar, Card, Table) | Already in use, mobile-responsive by default |
| next-intl | 4.7.0 | Internationalization | Already configured with client-side detection |
| Bootstrap | 5.3.8 | CSS framework with mobile-first design | Already in use, 6 breakpoints for responsive layouts |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `lib/i18n/utils.ts` | - | Browser locale detection (localStorage + navigator) | Public pages needing i18n without URL segments |
| `lib/i18n/formatters.ts` | - | Locale-aware currency/date formatting | Display monetary amounts and dates |
| React Server Components | React 19.2.3 | Reduce client JavaScript | Use by default, only mark 'use client' when needed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Client Component fetch | Server Component with API | Server Components can't use browser APIs (localStorage, navigator.language) |
| `/s/[token]` route | `/status/[token]` route | Shorter URLs better for mobile sharing via SMS/WhatsApp |
| React-Bootstrap ProgressBar | Custom CSS progress bar | Bootstrap includes ARIA attributes, mobile-tested |

**Installation:**
No new dependencies required - all libraries already installed.

## Architecture Patterns

### Recommended Project Structure
```
app/
├── s/                           # Public status pages (no auth)
│   └── [token]/
│       └── page.tsx            # Status page (Client Component)
lib/
├── i18n/
│   ├── utils.ts                # Existing: detectBrowserLocale()
│   └── formatters.ts           # Existing: useLocalizedFormatters()
messages/
├── de.json                      # Add 'status' namespace
├── en.json
├── fr.json
└── it.json
```

### Pattern 1: Client Component with Browser Locale Detection

**What:** Public pages that need internationalization without URL-based locale routing.

**When to use:** Status pages, public reports, any unauthenticated page needing i18n.

**Why this pattern:** The codebase already uses client-side locale detection via `detectBrowserLocale()` which checks localStorage → navigator.languages → default. This avoids needing `[locale]` URL segments while supporting all 4 languages.

**Example:**
```typescript
// Source: DonorFlow app/providers.tsx pattern
'use client'

import { useEffect, useState } from 'react'
import { NextIntlClientProvider } from 'next-intl'
import { detectBrowserLocale } from '@/lib/i18n/utils'
import { defaultLocale } from '@/lib/i18n/config'

export default function StatusPage({ params }: { params: Promise<{ token: string }> }) {
  const [locale, setLocale] = useState(defaultLocale)
  const [messages, setMessages] = useState(null)

  useEffect(() => {
    const detected = detectBrowserLocale()
    setLocale(detected)
    import(`@/messages/${detected}.json`).then(mod => setMessages(mod.default))
  }, [])

  if (!messages) return <div>Loading...</div>

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {/* Page content here */}
    </NextIntlClientProvider>
  )
}
```

### Pattern 2: Mobile-First Responsive Layout

**What:** Use Bootstrap's mobile-first grid system with responsive breakpoints.

**When to use:** All public pages, especially those accessed on mobile devices.

**Bootstrap 5.3 breakpoints:**
- `xs` (< 576px) - Phone portrait
- `sm` (≥ 576px) - Phone landscape
- `md` (≥ 768px) - Tablet
- `lg` (≥ 992px) - Desktop
- `xl` (≥ 1200px) - Large desktop
- `xxl` (≥ 1400px) - Extra large desktop

**Example:**
```typescript
// Source: React-Bootstrap responsive patterns
import { Container, Card, ProgressBar, Table } from 'react-bootstrap'

<Container className="py-3 py-md-4">
  <Card className="shadow-sm">
    <Card.Body className="p-3 p-md-4">
      {/* Card padding: 12px mobile, 24px desktop */}
      <h1 className="fs-4 fs-md-3 mb-3">{memberName}</h1>
      {/* Font size: smaller on mobile */}

      <ProgressBar
        now={percentage}
        label={`${percentage}%`}
        className="mb-3"
        style={{ height: '30px' }} // Touch-friendly height
      />

      {/* Table with horizontal scroll on mobile */}
      <div className="table-responsive">
        <Table striped hover>
          {/* Table content */}
        </Table>
      </div>
    </Card.Body>
  </Card>
</Container>
```

**Key mobile optimization classes:**
- `py-3 py-md-4`: Smaller padding on mobile
- `fs-4 fs-md-3`: Smaller font on mobile
- `table-responsive`: Horizontal scroll on mobile
- `d-none d-md-block`: Hide on mobile, show on desktop
- Touch-friendly heights (minimum 44px for tap targets)

### Pattern 3: LYBUNT Detection via Fiscal Year Comparison

**What:** Identify sponsors who donated last fiscal year but not this year.

**When to use:** Status pages showing sponsor lists, donor engagement tracking.

**How it works:**
1. Query current fiscal year donations (already in Phase 2 API response)
2. Query previous fiscal year to get list of sponsors who donated then
3. Compare: sponsors in previous year BUT NOT in current year = LYBUNT
4. Visual highlight: different styling (e.g., yellow background, warning icon)

**Implementation approach:**
```typescript
// Option A: Extend Phase 2 API to include LYBUNT flag
// API adds previousYear donations to response, page calculates LYBUNT

// Option B: Client-side calculation with additional API call
// Page fetches current year (Phase 2 API), then fetches previous year separately

// RECOMMENDED: Option A - extend API
// Reason: Single request, consistent LYBUNT logic, better mobile performance
```

**API extension needed:**
```typescript
// In app/api/public/status/[token]/route.ts
// Add query for previous fiscal year
const previousFiscalYear = await prisma.fiscalYear.findFirst({
  where: { endDate: { lt: currentFiscalYear.startDate } },
  orderBy: { endDate: 'desc' },
  take: 1
})

// For each sponsor, check if they donated in previous year
const donatedLastYear = sponsor.donations.some(d =>
  d.fiscalYearId === previousFiscalYear?.id
)

// Return in response
sponsors: sponsors.map(s => ({
  name: s.name,
  donated: s.donated,
  donatedLastYear: s.donatedLastYear,
  isLYBUNT: s.donatedLastYear && !s.donated, // Key flag
  totalAmount: s.totalAmount,
  lastDonation: s.lastDonation
}))
```

### Pattern 4: Accessible Progress Bars

**What:** React-Bootstrap ProgressBar with proper ARIA attributes for screen readers.

**When to use:** Displaying donation progress, goal completion, any percentage-based metric.

**React-Bootstrap automatic ARIA:**
```typescript
<ProgressBar
  now={percentage}           // Sets aria-valuenow
  min={0}                    // Sets aria-valuemin (default)
  max={100}                  // Sets aria-valuemax (default)
  label={`${percentage}%`}   // Visual label
  visuallyHidden={false}     // Show label (default: false)
  // Automatically includes role="progressbar"
/>
```

**Color variants based on progress:**
```typescript
<ProgressBar
  now={percentage}
  variant={
    percentage >= 100 ? 'success' :   // Green for complete
    percentage >= 75 ? 'info' :        // Blue for nearly there
    percentage >= 50 ? 'warning' :     // Yellow for halfway
    'danger'                            // Red for far from goal
  }
  label={`${percentage}%`}
/>
```

### Pattern 5: Minimal JavaScript with Server Components

**What:** Use Client Components only where absolutely necessary, keep most rendering server-side.

**When to use:** All Next.js App Router pages by default.

**Decision tree:**
```
Does component need browser APIs (localStorage, navigator)?
├─ YES → Client Component ('use client')
└─ NO → Server Component (default)

Does component need React hooks (useState, useEffect)?
├─ YES → Client Component
└─ NO → Server Component

Does component need interactivity (onClick, onChange)?
├─ YES → Client Component
└─ NO → Server Component
```

**For status page:**
- **Client Component needed:** Root page component (needs locale detection, fetch)
- **Server Components:** None (public pages need client-side locale detection)
- **Compromise:** Minimize JavaScript by avoiding heavy libraries, using CSS for styling

**Performance optimization:**
```typescript
// Heavy operation: fetching translations
// Optimize with dynamic imports and caching
const [messages, setMessages] = useState<any>(null)

useEffect(() => {
  // Browser caches this import across page loads
  import(`@/messages/${locale}.json`).then(mod => {
    setMessages(mod.default)
  })
}, [locale])
```

### Anti-Patterns to Avoid

- **Using Server Components for public i18n pages:** Can't access browser locale APIs (navigator.language, localStorage)
- **Not using React-Bootstrap's responsive utilities:** Custom media queries when Bootstrap has built-in responsive classes
- **Calculating LYBUNT on every render:** Should be calculated once in API or memoized
- **Hardcoding currency/date formats:** Use `useLocalizedFormatters()` for locale-aware formatting
- **Not testing on actual mobile devices:** Desktop responsive mode doesn't catch touch target size issues

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Locale detection from browser | Custom Accept-Language parsing | `detectBrowserLocale()` from lib/i18n/utils | Already handles navigator.languages priority, regional variants |
| Currency formatting | String manipulation with regex | `useLocalizedFormatters().formatCurrency()` | Handles Swiss apostrophe separator, regional formats |
| Date formatting | Date string manipulation | `useLocalizedFormatters().formatDate()` | Handles DD.MM.YYYY vs MM/DD/YYYY variations |
| Responsive breakpoints | Custom CSS media queries | Bootstrap responsive classes (py-3 py-md-4) | Mobile-first, tested across devices |
| Progress bar accessibility | DIV with custom ARIA | React-Bootstrap ProgressBar | ARIA attributes built-in, screen-reader tested |
| LYBUNT calculation | Complex client-side comparison | API endpoint calculation | Single source of truth, better performance |

**Key insight:** The codebase already has robust i18n infrastructure that works without URL-based locale routing. Phase 3 should leverage this existing pattern rather than introducing next-intl middleware or locale URL segments.

## Common Pitfalls

### Pitfall 1: Trying to Use Server Components for Public Pages

**What goes wrong:** Page can't access browser locale (navigator.language, localStorage) for i18n.

**Why it happens:** Assumption that Server Components are always better because they reduce JavaScript.

**How to avoid:** Accept that public pages with client-side locale detection need Client Components. The codebase already uses this pattern in `app/providers.tsx`.

**Warning signs:** Errors like "navigator is not defined" or "localStorage is not defined" during SSR.

### Pitfall 2: Not Accounting for Missing Fiscal Year

**What goes wrong:** Page crashes or shows empty state when no current fiscal year exists.

**Why it happens:** Assuming a current fiscal year always exists.

**How to avoid:** Phase 2 API returns `fiscalYear: null` when none exists. UI should handle this gracefully.

**Example:**
```typescript
if (!data.fiscalYear) {
  return <Alert variant="info">No active fiscal year</Alert>
}
```

### Pitfall 3: LYBUNT Calculation on Every Render

**What goes wrong:** Performance degrades as sponsor lists grow, redundant calculations.

**Why it happens:** Not memoizing or pre-calculating LYBUNT status.

**How to avoid:** Calculate LYBUNT in API endpoint (preferred) or use `useMemo` in component.

**Warning signs:** Sluggish rendering with large sponsor lists (>50 sponsors).

### Pitfall 4: Non-Touch-Friendly Tap Targets

**What goes wrong:** Small UI elements are hard to tap on mobile devices.

**Why it happens:** Designing for desktop mouse precision instead of finger taps.

**How to avoid:**
- Minimum 44px height/width for tap targets (Apple/Google guidelines)
- Adequate spacing between interactive elements (8px minimum)
- Progress bars should be at least 30px tall

**Warning signs:** User testing reveals difficulty tapping buttons or links on mobile.

### Pitfall 5: Not Testing Locale-Specific Formatting

**What goes wrong:** Currency shows as "$1,000" instead of "CHF 1'000" for Swiss German locale.

**Why it happens:** Using default Intl formatters without locale-specific configuration.

**How to avoid:** The codebase's `useLocalizedFormatters()` already maps locales correctly:
- `de` → `de-CH` (Swiss German: apostrophe thousands separator)
- `en` → `en-US` (comma thousands separator)
- `fr` → `fr-FR` (space thousands separator)
- `it` → `it-IT` (dot thousands separator)

**Verification:** Test with browser language set to each supported locale.

### Pitfall 6: Showing PII on Public Pages

**What goes wrong:** Email, phone, address visible to anyone with status link.

**Why it happens:** Directly displaying sponsor data from API without filtering.

**How to avoid:** Phase 2 API already filters PII. UI should only display:
- Sponsor name (company or firstName/lastName)
- Donation amount and date
- LYBUNT status

**Warning signs:** Sponsor email or phone numbers visible in page source.

## Code Examples

### Complete Status Page Structure

```typescript
// Source: DonorFlow conventions + React-Bootstrap patterns
// File: app/s/[token]/page.tsx

'use client'

import { useEffect, useState } from 'react'
import { Container, Card, ProgressBar, Table, Alert, Spinner } from 'react-bootstrap'
import { NextIntlClientProvider, useTranslations } from 'next-intl'
import { detectBrowserLocale } from '@/lib/i18n/utils'
import { useLocalizedFormatters } from '@/lib/i18n/formatters'
import { defaultLocale } from '@/lib/i18n/config'

interface StatusData {
  type: 'member' | 'group'
  name: string
  fiscalYear: {
    name: string
    startDate: string
    endDate: string
  } | null
  progress: {
    target: number
    actual: number
    percentage: number
  }
  sponsors: Array<{
    name: string
    donated: boolean
    totalAmount: number
    lastDonation: string | null
    isLYBUNT?: boolean // Added in API for LYBUNT detection
  }>
}

export default function StatusPage({ params }: { params: Promise<{ token: string }> }) {
  const [locale, setLocale] = useState(defaultLocale)
  const [messages, setMessages] = useState<any>(null)
  const [data, setData] = useState<StatusData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [token, setToken] = useState<string | null>(null)

  // Resolve params
  useEffect(() => {
    params.then(p => setToken(p.token))
  }, [params])

  // Load locale and messages
  useEffect(() => {
    const detected = detectBrowserLocale()
    setLocale(detected)
    import(`@/messages/${detected}.json`)
      .then(mod => setMessages(mod.default))
      .catch(() => import(`@/messages/${defaultLocale}.json`)
        .then(mod => setMessages(mod.default)))
  }, [])

  // Fetch status data
  useEffect(() => {
    if (!token || !messages) return

    fetch(`/api/public/status/${token}`)
      .then(res => {
        if (!res.ok) throw new Error('Not found')
        return res.json()
      })
      .then(data => setData(data))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [token, messages])

  // Loading state
  if (!messages || loading) {
    return (
      <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: '100vh' }}>
        <Spinner animation="border" variant="primary" />
      </Container>
    )
  }

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <StatusPageContent data={data} error={error} />
    </NextIntlClientProvider>
  )
}

function StatusPageContent({ data, error }: { data: StatusData | null; error: string | null }) {
  const t = useTranslations('status')
  const tCommon = useTranslations('common')
  const { formatCurrency, formatDate } = useLocalizedFormatters()

  if (error || !data) {
    return (
      <Container className="py-3 py-md-5">
        <Alert variant="danger">{t('notFound')}</Alert>
      </Container>
    )
  }

  const { name, fiscalYear, progress, sponsors } = data
  const donatedSponsors = sponsors.filter(s => s.donated)
  const notDonatedSponsors = sponsors.filter(s => !s.donated)
  const lybuntSponsors = notDonatedSponsors.filter(s => s.isLYBUNT)

  return (
    <Container className="py-3 py-md-4" style={{ maxWidth: '800px' }}>
      <Card className="shadow-sm mb-4">
        <Card.Body className="p-3 p-md-4">
          <h1 className="fs-4 fs-md-3 mb-3">{name}</h1>

          {fiscalYear && (
            <p className="text-muted mb-3">
              {t('fiscalYear')}: {fiscalYear.name}
            </p>
          )}

          {/* Progress Section */}
          <div className="mb-4">
            <div className="d-flex justify-content-between mb-2">
              <span>{t('target')}:</span>
              <strong>{formatCurrency(progress.target)}</strong>
            </div>
            <div className="d-flex justify-content-between mb-2">
              <span>{t('actual')}:</span>
              <strong className={progress.actual >= progress.target ? 'text-success' : ''}>
                {formatCurrency(progress.actual)}
              </strong>
            </div>
            <div className="d-flex justify-content-between mb-3">
              <span>{t('remaining')}:</span>
              <strong>{formatCurrency(Math.max(0, progress.target - progress.actual))}</strong>
            </div>

            <ProgressBar
              now={Math.min(progress.percentage, 100)}
              label={`${progress.percentage}%`}
              variant={
                progress.percentage >= 100 ? 'success' :
                progress.percentage >= 75 ? 'info' :
                progress.percentage >= 50 ? 'warning' : 'danger'
              }
              style={{ height: '30px' }}
            />
          </div>

          {/* Donors Who Donated */}
          {donatedSponsors.length > 0 && (
            <div className="mb-4">
              <h2 className="fs-5 mb-3">{t('sponsorsWhoDonatyed')}</h2>
              <div className="table-responsive">
                <Table striped hover className="mb-0">
                  <thead>
                    <tr>
                      <th>{t('name')}</th>
                      <th className="text-end">{t('amount')}</th>
                      <th className="d-none d-md-table-cell text-end">{t('date')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {donatedSponsors.map((sponsor, idx) => (
                      <tr key={idx}>
                        <td>{sponsor.name}</td>
                        <td className="text-end">{formatCurrency(sponsor.totalAmount)}</td>
                        <td className="d-none d-md-table-cell text-end">
                          {sponsor.lastDonation ? formatDate(sponsor.lastDonation) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </div>
          )}

          {/* Donors Who Haven't Donated Yet */}
          {notDonatedSponsors.length > 0 && (
            <div>
              <h2 className="fs-5 mb-3">{t('sponsorsWhoHaventDonated')}</h2>
              <Table striped className="mb-0">
                <tbody>
                  {notDonatedSponsors.map((sponsor, idx) => (
                    <tr
                      key={idx}
                      className={sponsor.isLYBUNT ? 'table-warning' : ''}
                    >
                      <td>
                        {sponsor.name}
                        {sponsor.isLYBUNT && (
                          <span className="ms-2 badge bg-warning text-dark">
                            <i className="bi bi-exclamation-triangle me-1"></i>
                            {t('lybunt')}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </Card.Body>
      </Card>

      {/* Footer */}
      <div className="text-center text-muted small">
        <p className="mb-0">{t('footer')}</p>
      </div>
    </Container>
  )
}
```

### Translation Keys Required

```json
// messages/en.json - Add to 'status' namespace
{
  "status": {
    "notFound": "Status page not found",
    "fiscalYear": "Fiscal year",
    "target": "Target",
    "actual": "Collected",
    "remaining": "Remaining",
    "sponsorsWhoDonated": "Donors who donated this year",
    "sponsorsWhoHaventDonated": "Donors who haven't donated yet",
    "name": "Name",
    "amount": "Amount",
    "date": "Date",
    "lybunt": "Donated last year",
    "footer": "Thank you for your support!"
  }
}
```

### Mobile-Optimized CSS Enhancements

```css
/* Add to app/globals.css for mobile optimizations */

/* Ensure text is readable on mobile */
@media (max-width: 576px) {
  h1 { font-size: 1.5rem; }
  h2 { font-size: 1.25rem; }

  /* Larger tap targets on mobile */
  .btn {
    min-height: 44px;
    padding: 12px 20px;
  }

  /* Table font size */
  .table {
    font-size: 0.875rem;
  }

  /* Progress bar label readability */
  .progress {
    font-size: 0.875rem;
  }
}

/* LYBUNT highlight */
.table-warning {
  background-color: #fff3cd !important;
}

/* Touch-friendly spacing */
.table tbody tr {
  height: 44px; /* Minimum touch target */
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| URL-based locale routing (`/en/`, `/de/`) | Client-side browser detection (localStorage + navigator) | Project inception | No locale in URL, simpler sharing |
| Server Components for all pages | Client Components when browser APIs needed | Next.js 13+ | Accept Client Components for public i18n pages |
| Custom responsive breakpoints | Bootstrap 5.3 mobile-first grid | Bootstrap 5.0+ | Standard 6 breakpoints, consistent behavior |
| Manual ARIA on progress bars | React-Bootstrap automatic ARIA | - | Better accessibility out-of-box |
| LYBUNT as post-processing | LYBUNT calculated in API | Modern CRM pattern | Single source of truth, better performance |

**Deprecated/outdated:**
- Pages Router i18n config (doesn't work with App Router)
- next-intl middleware with locale URL segments (project uses client-side detection)
- Custom progress bar implementations (React-Bootstrap provides accessible version)

## Open Questions

1. **LYBUNT definition with multiple fiscal years**
   - What we know: LYBUNT means donated last fiscal year but not this year
   - What's unclear: If there are gaps in fiscal years (2023 exists, 2024 missing, 2025 exists), which is "last year"?
   - Recommendation: Define "last year" as most recent fiscal year before current year (orderBy endDate desc, take 1)

2. **Showing monetary amounts to anonymous users**
   - What we know: Phase 2 API includes donation amounts in response
   - What's unclear: Is it acceptable to show how much each sponsor donated?
   - Recommendation: Show total amount and progress, but make individual sponsor amounts optional (could add privacy toggle in Phase 4)

3. **Handling expired status tokens**
   - What we know: Schema has statusTokenExpiry field but not implemented
   - What's unclear: Should Phase 3 check expiry or wait for Phase 5+?
   - Recommendation: Ignore expiry in Phase 3, API returns 404 for expired tokens (implemented in Phase 5)

## Sources

### Primary (HIGH confidence)
- DonorFlow codebase - `app/providers.tsx`, `lib/i18n/utils.ts`, `lib/i18n/formatters.ts`
- DonorFlow Phase 2 research - API structure and response format
- [Next.js App Router: Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components) - Component types
- [React Bootstrap ProgressBar](https://react-bootstrap.github.io/docs/components/progress) - Accessibility features
- [Bootstrap v5.3 Progress](https://getbootstrap.com/docs/5.3/components/progress/) - ARIA attributes
- [next-intl Middleware](https://next-intl.dev/docs/routing/middleware) - Locale detection priority

### Secondary (MEDIUM confidence)
- [LYBUNT and SYBUNT Explained - Neon One](https://neonone.com/resources/blog/lybunts-and-sybunts-explained/) - LYBUNT definition and importance
- [What Are LYBUNT & SYBUNT Reports? - Kindful](https://kindful.com/nonprofit-glossary/lybunt-sybunt-reports/) - Implementation patterns
- [React Bootstrap Mobile Optimization](https://codemanbd.com/creating-responsive-websites-with-react-and-bootstrap-5/) - Mobile-first patterns
- [Next.js Best Practices 2025 - RaftLabs](https://www.raftlabs.com/blog/building-with-next-js-best-practices-and-benefits-for-performance-first-teams/) - Server Components best practices

### Tertiary (LOW confidence)
- WebSearch results on donation progress bars - UI patterns (no specific technical implementation verified)

## Metadata

**Confidence breakdown:**
- Client-side i18n pattern: HIGH - Already implemented in codebase (app/providers.tsx)
- React-Bootstrap mobile responsiveness: HIGH - Bootstrap 5.3 official docs, tested patterns
- LYBUNT calculation: MEDIUM - Standard fundraising pattern, implementation approach not verified
- Server vs Client Components: HIGH - Official Next.js docs, project already uses pattern

**Research date:** 2026-01-21
**Valid until:** 2026-02-21 (30 days - stable patterns, Next.js 16 and React-Bootstrap 2.10 are current stable versions)
