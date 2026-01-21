# Phase 4: Group Status Page - Research

**Researched:** 2026-01-21
**Domain:** Next.js 15 App Router, React-Bootstrap UI, Public Status Pages
**Confidence:** HIGH

## Summary

This research investigates how to implement the Group Status Page that displays all members' progress in an expandable/collapsible format. The existing codebase already has:

1. A fully functional API endpoint (`/api/public/status/[token]`) that returns group data with sponsor information
2. A working member status page (`/app/s/[token]/page.tsx`) that can be adapted for groups
3. React-Bootstrap 2.10 components including Accordion for collapsible sections

The API already handles group tokens correctly (Phase 2 implementation) but currently returns group-level aggregates with target=0 as a placeholder. Phase 4 requires enhancing the API response to include individual member data with their targets and sponsor lists, then creating a UI that displays aggregate totals at the top and expandable member sections below.

**Primary recommendation:** Enhance the existing `buildGroupResponse()` function in `/api/public/status/[token]/route.ts` to include member-level data, then create a new group status component that reuses the existing status page styling and adds React-Bootstrap Accordion for member expansion.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 15.5.9+ | App Router framework | Already in use, handles dynamic routes with [token] segments |
| React-Bootstrap | 2.10.10 | UI components | Already in use for all UI, provides Accordion component |
| next-intl | 4.7.0 | Internationalization | Already configured, handles browser locale detection for public pages |
| Prisma | 7.2.0+ | Database ORM | Already configured, handles member/group/sponsor data queries |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Bootstrap Icons | 1.13.1 | Icon library | Already available for expand/collapse chevrons |
| clsx | 2.1.1 | CSS class utilities | Already available via `cn()` utility |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Accordion | Manual Collapse + useState | More control but reinvents existing solution, less accessible |
| Client Component | Server Component | Group status needs interactivity (accordion), so client-side is correct |

**Installation:**
No new packages needed - all required libraries already installed.

## Architecture Patterns

### Recommended Project Structure
```
app/
├── s/[token]/
│   └── page.tsx                    # Existing status page (member/group)
└── api/
    └── public/
        └── status/[token]/
            └── route.ts            # Existing API endpoint (enhance for Phase 4)
```

### Pattern 1: Enhanced API Response Structure
**What:** Extend the existing API endpoint to return member-level data for groups
**When to use:** When group token is detected, return both aggregate and per-member breakdown

**Current API structure** (from `/app/api/public/status/[token]/route.ts`):
```typescript
// Current group response (Phase 2/3):
{
  type: 'group',
  name: string,
  fiscalYear: { name, startDate, endDate } | null,
  progress: {
    target: 0,              // Placeholder from Phase 2
    actual: number,         // Sum of group-level sponsor donations
    percentage: 0
  },
  sponsors: SponsorData[]   // Group-level sponsors only
}
```

**Enhanced structure needed for Phase 4:**
```typescript
// Enhanced group response (Phase 4):
{
  type: 'group',
  name: string,
  fiscalYear: { name, startDate, endDate } | null,
  progress: {
    target: number,         // Sum of all member targets
    actual: number,         // Sum of all donations (members + group)
    percentage: number      // Calculated from target/actual
  },
  members: [                // NEW: Array of member data
    {
      id: string,
      name: string,
      progress: {
        target: number,     // Member's individual target
        actual: number,     // Member's donations
        percentage: number
      },
      sponsors: SponsorData[]  // Member's sponsors with LYBUNT flags
    }
  ],
  groupSponsors: SponsorData[]  // Group-level sponsors (existing)
}
```

**Implementation approach:**
```typescript
// In buildGroupResponse(), add member data query
const groupWithMembers = await prisma.group.findUnique({
  where: { statusToken: token },
  select: {
    id: true,
    name: true,
    members: {
      select: {
        id: true,
        firstName: true,
        lastName: true,
        memberTargets: {
          where: { fiscalYearId: currentFiscalYear?.id },
          select: { targetAmount: true }
        },
        sponsors: {
          select: {
            // Same sponsor/donation structure as existing member query
          }
        }
      }
    },
    sponsors: { /* existing group-level sponsor query */ }
  }
})
```

### Pattern 2: React-Bootstrap Accordion for Member Expansion
**What:** Use Accordion component to create collapsible member sections
**When to use:** When displaying list of members where each can expand to show sponsors

**Example:**
```typescript
// Source: https://react-bootstrap.netlify.app/docs/components/accordion/
import { Accordion } from 'react-bootstrap'

<Accordion>
  {members.map((member, index) => (
    <Accordion.Item eventKey={index.toString()} key={member.id}>
      <Accordion.Header>
        <div className="d-flex justify-content-between w-100">
          <strong>{member.name}</strong>
          <span className="ms-3">
            {formatCurrency(member.progress.actual)} / {formatCurrency(member.progress.target)}
          </span>
        </div>
      </Accordion.Header>
      <Accordion.Body>
        {/* Member's sponsor table (reuse from existing status page) */}
        <Table size="sm">
          {/* Sponsor list here */}
        </Table>
      </Accordion.Body>
    </Accordion.Item>
  ))}
</Accordion>
```

**Key Accordion features:**
- `defaultActiveKey`: Control which item(s) are initially expanded (omit for all collapsed)
- `alwaysOpen`: Allow multiple members to be expanded simultaneously
- `eventKey`: Unique identifier for each accordion item (use member.id or index)
- `Accordion.Header`: The clickable toggle area
- `Accordion.Body`: The collapsible content area

### Pattern 3: Aggregate Calculation Logic
**What:** Calculate group totals by summing member targets and donations
**When to use:** When building group response, need both group-level and member-level aggregates

**Calculation approach** (based on existing code in `/app/groups/page.tsx` lines 117-171):
```typescript
// Calculate aggregate target (sum of all member targets)
let totalTarget = 0
members.forEach(member => {
  const currentTarget = member.memberTargets.find(mt =>
    mt.fiscalYearId === currentFiscalYear?.id
  )
  if (currentTarget) {
    totalTarget += currentTarget.targetAmount
  }
})

// Calculate aggregate donations (members + group)
let totalActual = 0
// Add member-level donations
members.forEach(member => {
  member.sponsors?.forEach(sponsor => {
    sponsor.donations
      .filter(d => d.fiscalYearId === currentFiscalYear?.id && d.type === 'MONETARY')
      .forEach(d => totalActual += d.amount ?? 0)
  })
})
// Add group-level donations
group.sponsors?.forEach(sponsor => {
  sponsor.donations
    .filter(d => d.fiscalYearId === currentFiscalYear?.id && d.type === 'MONETARY')
    .forEach(d => totalActual += d.amount ?? 0)
})
```

**Note:** The existing `/app/groups/page.tsx` already implements this pattern correctly. Reuse this logic in the API endpoint.

### Pattern 4: Reuse Existing Status Page Components
**What:** The member status page already has all necessary UI components (progress bars, sponsor tables, LYBUNT badges)
**When to use:** When building group status UI, extract reusable components or conditionally render based on type

**Current structure** (`/app/s/[token]/page.tsx`):
- Progress section with target/actual/remaining cards
- ProgressBar with color coding (success/info/warning/danger)
- Sponsor tables (donated vs not donated)
- LYBUNT badge styling
- Locale-aware formatting (currency, dates)
- Browser locale detection

**Adaptation approach:**
```typescript
// Option A: Conditional rendering in existing page
if (data.type === 'group') {
  return <GroupStatusView data={data} />
} else {
  return <MemberStatusView data={data} />
}

// Option B: Extract shared components
function ProgressCard({ progress, formatCurrency }) { /* ... */ }
function SponsorTable({ sponsors, formatCurrency, formatDate }) { /* ... */ }

// Use in both member and group views
```

### Anti-Patterns to Avoid

- **Don't create separate API endpoint for group status** - The existing `/api/public/status/[token]` already handles both members and groups via token lookup. Enhance it instead of duplicating.
- **Don't duplicate sponsor table rendering** - The existing status page has well-tested sponsor tables with LYBUNT detection. Reuse this code rather than reimplementing.
- **Don't use manual collapse state** - React-Bootstrap Accordion handles all collapse logic, state management, and accessibility. Don't reimplement with useState.
- **Don't query fiscal year multiple times** - The API already queries current and previous fiscal years once at the top. Pass fiscal year ID down to helper functions.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Collapsible sections | Manual collapse with useState | React-Bootstrap Accordion | Handles state, animations, accessibility (ARIA), keyboard navigation |
| Member/group aggregation | Custom sum logic in component | Prisma aggregation or existing calculateGroupStats() | Database-level aggregation is more efficient; existing client-side logic already tested |
| Sponsor LYBUNT detection | New detection logic | Existing calculateSponsorsProgress() | Already implemented correctly in Phase 3, handles previous fiscal year logic |
| Browser locale detection | Custom navigator.language parsing | Existing detectBrowserLocale() | Already handles fallback logic and locale mapping (de/en/fr/it) |
| Currency formatting | Custom formatters | useLocalizedFormatters() hook | Already handles Swiss CHF formatting with correct separators per locale |

**Key insight:** This phase is primarily about composition and enhancement rather than new implementation. The API endpoint exists, the UI components exist, the calculation logic exists. The task is to wire them together with appropriate data structures and an accordion UI.

## Common Pitfalls

### Pitfall 1: Forgetting to Include Members in Group Query
**What goes wrong:** API returns group data but no member information, resulting in empty member list
**Why it happens:** The existing `buildGroupResponse()` only queries `group.sponsors`, not `group.members`
**How to avoid:** When detecting group token, use query with `members` include (similar to `/api/groups?include=all`)
**Warning signs:** Group status page loads but shows "No members" or only displays group-level sponsors

### Pitfall 2: Double-Counting Donations in Aggregates
**What goes wrong:** Donations appear twice in totals (once for member, once for group)
**Why it happens:** Donations have both `memberId` AND `groupId` in some cases, or querying donations through multiple relations
**How to avoid:**
- Members' donations have `memberId` set (and `groupId` may also be set)
- Group-level donations have `groupId` set but `memberId` is null
- Filter group-level sponsors to only count donations where `memberId` is null
**Warning signs:** Aggregate total is higher than sum of individual member totals plus displayed group sponsors

### Pitfall 3: Accordion Header Styling Breaking Layout
**What goes wrong:** Member name and progress stats don't align properly in accordion header
**Why it happens:** Accordion.Header has limited styling control; default flexbox may not work as expected
**How to avoid:** Use `d-flex justify-content-between w-100` inside Accordion.Header, test on mobile widths
**Warning signs:** Stats overlap member name, or accordion headers have inconsistent heights

### Pitfall 4: Not Handling Members Without Targets
**What goes wrong:** Members without targets for current fiscal year break aggregate calculation or don't display
**Why it happens:** Assuming all members have a target for the current fiscal year
**How to avoid:**
- Default to `targetAmount: 0` when `memberTargets.find()` returns undefined
- Display members with 0 target but still show their actual donations
- Calculate percentage as 0 when target is 0 (avoid division by zero)
**Warning signs:** Missing members in list, or "NaN%" in progress display

### Pitfall 5: LYBUNT Detection Not Working for Group Members
**What goes wrong:** LYBUNT badges don't appear for members' sponsors in group view
**Why it happens:** LYBUNT detection requires both current and previous fiscal year donations, which may not be included in query
**How to avoid:** Ensure member sponsor query includes donations from both fiscal years (same as line 84-91 in existing route.ts)
**Warning signs:** No LYBUNT badges appear even when sponsors donated last year but not this year

### Pitfall 6: Token Security in URL Structure
**What goes wrong:** Thinking you need authentication for group status pages
**Why it happens:** Confusion between authenticated admin pages and public capability-URL pages
**How to avoid:**
- Public status pages at `/s/[token]` are intentionally unauthenticated
- Security is via capability URL (32-char token = 192 bits entropy)
- Use existing `withPublicApiRoute` wrapper (not `withApiRoute`)
- Return 404 (not 401/403) for invalid tokens to avoid information disclosure
**Warning signs:** Adding auth checks, redirecting to login, exposing whether token exists

## Code Examples

Verified patterns from official sources:

### React-Bootstrap Accordion Basic Usage
```typescript
// Source: https://react-bootstrap.netlify.app/docs/components/accordion/
import { Accordion } from 'react-bootstrap'

function MemberAccordion() {
  return (
    <Accordion defaultActiveKey="0">
      <Accordion.Item eventKey="0">
        <Accordion.Header>Accordion Item #1</Accordion.Header>
        <Accordion.Body>
          Lorem ipsum dolor sit amet
        </Accordion.Body>
      </Accordion.Item>
      <Accordion.Item eventKey="1">
        <Accordion.Header>Accordion Item #2</Accordion.Header>
        <Accordion.Body>
          Lorem ipsum dolor sit amet
        </Accordion.Body>
      </Accordion.Item>
    </Accordion>
  )
}
```

### Accordion with Always Open (Multiple Sections)
```typescript
// Source: https://react-bootstrap.netlify.app/docs/components/accordion/
// Allows multiple accordion items to stay open simultaneously
<Accordion defaultActiveKey={['0']} alwaysOpen>
  {members.map((member, idx) => (
    <Accordion.Item eventKey={idx.toString()} key={member.id}>
      <Accordion.Header>{member.name}</Accordion.Header>
      <Accordion.Body>{/* content */}</Accordion.Body>
    </Accordion.Item>
  ))}
</Accordion>
```

### Prisma Query for Group with Members
```typescript
// Based on existing patterns in /app/api/groups/route.ts and /app/api/public/status/[token]/route.ts
const groupWithMembers = await prisma.group.findUnique({
  where: { statusToken: token },
  select: {
    id: true,
    name: true,
    members: {
      orderBy: { lastName: 'asc' },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        memberTargets: currentFiscalYear ? {
          where: { fiscalYearId: currentFiscalYear.id },
          select: { targetAmount: true }
        } : { take: 0 },
        sponsors: {
          select: {
            id: true,
            company: true,
            firstName: true,
            lastName: true,
            donations: {
              where: {
                type: 'MONETARY',
                fiscalYearId: {
                  in: [
                    currentFiscalYear?.id,
                    previousFiscalYear?.id
                  ].filter((id): id is string => id !== undefined && id !== null)
                }
              },
              select: {
                id: true,
                amount: true,
                donationDate: true,
                fiscalYearId: true
              },
              orderBy: { donationDate: 'desc' }
            }
          }
        }
      }
    },
    sponsors: {
      // Group-level sponsors (same as existing query)
      where: {
        // Only sponsors directly assigned to group (not members)
        memberId: null
      },
      select: { /* same as existing */ }
    }
  }
})
```

### Reusable Sponsor Table Component Pattern
```typescript
// Extract from existing /app/s/[token]/page.tsx (lines 220-240)
function SponsorTable({
  sponsors,
  title,
  emptyMessage,
  formatCurrency,
  formatDate
}: {
  sponsors: SponsorData[]
  title: string
  emptyMessage: string
  formatCurrency: (n: number) => string
  formatDate: (d: string) => string
}) {
  return (
    <Card className="mb-3">
      <Card.Header className="bg-success text-white py-2">
        <h2 className="h6 mb-0">{title} ({sponsors.length})</h2>
      </Card.Header>
      <Card.Body className="p-0">
        {sponsors.length === 0 ? (
          <p className="text-muted text-center py-3 mb-0">{emptyMessage}</p>
        ) : (
          <div className="table-responsive">
            <Table className="mb-0" size="sm">
              <thead>
                <tr>
                  <th>{t('name')}</th>
                  <th className="text-end">{t('amount')}</th>
                  <th className="text-end d-none d-sm-table-cell">{t('date')}</th>
                </tr>
              </thead>
              <tbody>
                {sponsors.map((sponsor, index) => (
                  <tr key={index} className={sponsor.isLYBUNT ? 'table-warning' : ''}>
                    <td className="align-middle">
                      {sponsor.name}
                      {sponsor.isLYBUNT && (
                        <Badge bg="warning" text="dark" className="ms-2">
                          LYBUNT
                        </Badge>
                      )}
                    </td>
                    <td className="text-end align-middle">
                      {formatCurrency(sponsor.totalAmount)}
                    </td>
                    <td className="text-end align-middle d-none d-sm-table-cell">
                      {sponsor.lastDonation ? formatDate(sponsor.lastDonation) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </Card.Body>
    </Card>
  )
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate group/member endpoints | Unified token-based endpoint | Phase 2 (implemented) | Single API handles both types, token determines response |
| Static group target (0) | Calculated aggregate target | Phase 4 (this phase) | Group progress now shows real target sum |
| No member breakdown | Member-level data in group response | Phase 4 (this phase) | Group leaders see individual progress |
| Manual collapse components | React-Bootstrap Accordion | Standard pattern | Accessibility, animations, state management built-in |

**Deprecated/outdated:**
- Manual collapse: React-Bootstrap < 1.0 used separate `Collapse` and `Toggle` components with manual state. Version 2.10 uses `Accordion` component with built-in state management.
- Server Components for interactive pages: Next.js 15 requires 'use client' for components using hooks (useState, useEffect) or event handlers.

## Open Questions

Things that couldn't be fully resolved:

1. **Should group-level sponsors be shown separately or integrated into member list?**
   - What we know: Group-level sponsors exist (assigned to group, not individual members). These show up in the current Phase 3 implementation.
   - What's unclear: UI/UX decision - separate section for group sponsors, or show at top/bottom of member list?
   - Recommendation: Show group-level sponsors as a separate non-collapsible section above the member accordion. This makes it clear these are group donations not attributed to any member. Use same table styling as member sponsor tables.

2. **Should accordion items be collapsed by default or have first member expanded?**
   - What we know: Accordion supports `defaultActiveKey` to control initial state
   - What's unclear: User expectation - see overview first, or dive into first member?
   - Recommendation: Start fully collapsed (omit `defaultActiveKey`). This shows the aggregate totals first, which is the primary use case ("How is the group doing overall?"). Group leaders can expand members they want to investigate. Consider adding `alwaysOpen` prop to allow multiple members to be expanded simultaneously.

3. **How to handle members without any sponsors?**
   - What we know: Members can exist without sponsors assigned
   - What's unclear: Should they appear in the group status page accordion?
   - Recommendation: Include all members in the group regardless of sponsor count. Show "No sponsors assigned" message in accordion body. This gives complete group visibility and helps identify members who need sponsor assignment.

4. **Mobile accordion behavior - should it work differently?**
   - What we know: Existing status page has mobile optimizations (see `/app/globals.css` lines 105-135)
   - What's unclear: Do accordions need special mobile handling?
   - Recommendation: React-Bootstrap Accordion is mobile-friendly by default. Reuse existing `.status-page` CSS class for consistent mobile styling. Test accordion header height on mobile with long names.

## Sources

### Primary (HIGH confidence)
- React-Bootstrap Accordion Documentation: https://react-bootstrap.netlify.app/docs/components/accordion/
- DonorFlow codebase (analyzed files):
  - `/app/api/public/status/[token]/route.ts` - Existing API implementation
  - `/app/s/[token]/page.tsx` - Existing status page UI
  - `/app/groups/page.tsx` - Group aggregate calculation pattern
  - `/lib/utils.ts` - Display name functions
  - `/lib/i18n/formatters.ts` - Locale-aware formatting
  - `/prisma/schema.prisma` - Data model
  - `/messages/en.json` - Translation keys
  - `/app/globals.css` - Status page styling

### Secondary (MEDIUM confidence)
- Pluralsight React-Bootstrap Accordion Guide: https://www.pluralsight.com/guides/use-bootstrap-accordion-with-react
- GeeksforGeeks React-Bootstrap Accordion: https://www.geeksforgeeks.org/react-bootstrap-accordion-component/
- Next.js 15 Dynamic Routes: https://thelinuxcode.com/nextjs-dynamic-route-segments-in-the-app-router-2026-guide/
- Next.js Official App Router Docs: https://nextjs.org/docs/app

### Tertiary (LOW confidence)
- None - all findings verified with codebase or official documentation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already installed and configured in the codebase
- Architecture: HIGH - Existing patterns identified and verified in codebase
- Pitfalls: HIGH - Based on code analysis of existing implementation and common React-Bootstrap accordion issues
- Code examples: HIGH - Extracted from official React-Bootstrap docs and existing codebase

**Research date:** 2026-01-21
**Valid until:** 2026-02-21 (30 days - stable stack, no fast-moving dependencies)

**Research coverage:**
- ✅ API endpoint structure and data flow
- ✅ Existing UI components and reusability
- ✅ React-Bootstrap Accordion component usage
- ✅ Aggregate calculation patterns
- ✅ Translation keys and i18n approach
- ✅ Mobile responsive patterns
- ✅ Security considerations (capability URLs, 404 responses)
- ✅ LYBUNT detection in group context
- ✅ Member target handling (including missing targets)
