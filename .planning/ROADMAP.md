# Roadmap: DonorFlow Status Links

## Overview

This roadmap delivers token-based public status links for DonorFlow, enabling members to check their donation collection progress via shareable URLs without logging in. The journey progresses from database foundation (token storage), through public API infrastructure, to mobile-optimized status pages, and finally admin integration for link management. Five phases deliver all 22 v1 requirements in dependency order.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation** - Database schema for tokens, secure generation utility
- [ ] **Phase 2: Public API** - Token validation endpoint, middleware bypass for public routes
- [ ] **Phase 3: Member Status Page** - Mobile-first UI showing progress and sponsor lists
- [ ] **Phase 4: Group Status Page** - Aggregate view for all members in a group
- [ ] **Phase 5: Admin Integration** - Link visibility and copy functionality in admin UI

## Phase Details

### Phase 1: Foundation
**Goal**: Tokens exist in database and can be securely generated
**Depends on**: Nothing (first phase)
**Requirements**: TOKEN-01, TOKEN-02, TOKEN-03
**Success Criteria** (what must be TRUE):
  1. Groups have a statusToken field that auto-generates on creation
  2. Members without a group have a statusToken field that auto-generates on creation
  3. Tokens are 32-character URL-safe strings (192 bits entropy)
  4. Existing groups and members can have tokens generated via migration/seed
**Plans**: 1 plan

Plans:
- [ ] 01-01-PLAN.md - Token generation utility, schema update, Prisma extension, backfill script

### Phase 2: Public API
**Goal**: Public endpoints respond to token requests without authentication
**Depends on**: Phase 1
**Requirements**: TECH-01, TECH-05
**Success Criteria** (what must be TRUE):
  1. GET /api/public/status/[token] returns member/group data for valid tokens
  2. Invalid tokens return 404 with user-friendly error (not 401/403)
  3. Public routes bypass NextAuth middleware (no login redirect)
  4. API returns only safe fields (no PII like email, phone, address)
**Plans**: TBD

Plans:
- [ ] 02-01: TBD

### Phase 3: Member Status Page
**Goal**: Members can view their donation progress on mobile via status link
**Depends on**: Phase 2
**Requirements**: STAT-01, STAT-02, STAT-03, STAT-04, LIST-01, LIST-02, LIST-03, LIST-04, TECH-02, TECH-03, TECH-04
**Success Criteria** (what must be TRUE):
  1. Status page shows target amount, total donated, remaining amount, and progress bar
  2. Status page lists sponsors who donated (company/name, amount, date)
  3. Status page lists sponsors who haven't donated yet
  4. Sponsors who donated last year but not this year are visually highlighted (LYBUNT)
  5. Page is mobile-optimized (works well on phone screens)
  6. Page supports all 4 languages (de, en, fr, it) based on browser preference
  7. Page loads fast with minimal JavaScript
**Plans**: TBD

Plans:
- [ ] 03-01: TBD

### Phase 4: Group Status Page
**Goal**: Group leaders can see all members' progress in one view
**Depends on**: Phase 3
**Requirements**: GROUP-01, GROUP-02, GROUP-03, GROUP-04
**Success Criteria** (what must be TRUE):
  1. Group status page shows list of all members in the group
  2. Each member shows individual target, donated, remaining amounts
  3. Page shows aggregate totals (combined target, donated, remaining)
  4. Each member section can expand to show their sponsor lists
**Plans**: TBD

Plans:
- [ ] 04-01: TBD

### Phase 5: Admin Integration
**Goal**: Admins can view and share status links from existing UI
**Depends on**: Phase 1 (tokens exist), Phase 3/4 (pages work)
**Requirements**: TOKEN-04, TOKEN-05
**Success Criteria** (what must be TRUE):
  1. Group detail/list shows status link with copy-to-clipboard button
  2. Member detail (for members without groups) shows status link with copy button
  3. Links can be copied with one click
**Plans**: TBD

Plans:
- [ ] 05-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 0/1 | Ready to execute | - |
| 2. Public API | 0/TBD | Not started | - |
| 3. Member Status Page | 0/TBD | Not started | - |
| 4. Group Status Page | 0/TBD | Not started | - |
| 5. Admin Integration | 0/TBD | Not started | - |

---
*Roadmap created: 2026-01-21*
*Last updated: 2026-01-21*
