# DonorFlow — Status Links

## What This Is

A mobile-optimized public view system for DonorFlow that allows members and groups to check their donation status via secret shareable links — without logging in. Members see their target, which sponsors donated, which haven't, and which donated last year but not yet this year.

## Core Value

Members can quickly check their donation collection progress on mobile, without needing admin access.

## Requirements

### Validated

These capabilities exist in the current DonorFlow system:

- ✓ Members can be created and managed — existing
- ✓ Groups can be created with members assigned — existing
- ✓ Sponsors can be assigned to members or groups — existing
- ✓ Donations can be recorded with amounts and dates — existing
- ✓ Fiscal years track donation periods with targets — existing
- ✓ Member targets define collection goals per fiscal year — existing
- ✓ Dashboard shows donation statistics — existing
- ✓ Reports can be generated and exported — existing
- ✓ Multi-language support (de/en/fr/it) — existing
- ✓ Authentication via username/password — existing

### Active

New requirements for the status link feature:

- [ ] Groups have an auto-generated secret token for their status link
- [ ] Members without a group have an auto-generated secret token
- [ ] Status page shows member's target for current fiscal year
- [ ] Status page lists sponsors who donated this year (with amounts)
- [ ] Status page lists sponsors who haven't donated yet
- [ ] Status page highlights sponsors who donated last year but not this year
- [ ] Status page shows progress (total donated vs target)
- [ ] Group status page shows all members' status in one view
- [ ] Status pages are mobile-optimized (responsive, touch-friendly)
- [ ] Status pages work without authentication (public via token)
- [ ] Admin can see/copy status links for groups and members
- [ ] Status pages support all 4 languages
- [ ] Links are static (token doesn't change)

### Out of Scope

- Regeneratable/revocable links — static tokens are sufficient for this use case
- Member login system — links are read-only, no need for member accounts
- Editing donations via status page — admin handles all data entry
- Historical fiscal year selection — always shows current year
- Push notifications — members check when they want
- Offline support/PWA — simple web view is sufficient

## Context

DonorFlow is an existing donation management application used by organizations to track sponsors, members, and their donation targets. The system is built with Next.js 15, SQLite/Prisma, and supports German, English, French, and Italian.

Currently, only administrators can see donation progress. Members who collect donations have no way to check their status without asking an admin. This feature gives them self-service access via a simple shareable link.

The application already has:
- Complete CRUD for all entities (members, groups, sponsors, donations)
- Fiscal year and target tracking
- Multi-language UI with next-intl
- Responsive Bootstrap-based design

## Constraints

- **Tech stack**: Must use existing Next.js/Prisma/Bootstrap stack — no new frameworks
- **Database**: SQLite — tokens stored in existing Member/Group tables
- **Authentication**: Public routes must bypass NextAuth middleware
- **Mobile-first**: Status pages optimized for phone screens
- **Languages**: Must support all 4 existing locales (de/en/fr/it)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Token-based URLs without login | Simplicity — members just click a link | — Pending |
| Static tokens (not regeneratable) | Simpler implementation, tokens aren't highly sensitive | — Pending |
| Read-only status pages | Data entry stays in admin, reduces complexity | — Pending |
| Group-level and member-level links | Matches existing org structure (some members in groups, some solo) | — Pending |

---
*Last updated: 2026-01-21 after initialization*
