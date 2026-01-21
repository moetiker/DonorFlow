# Requirements: DonorFlow Status Links

**Defined:** 2026-01-21
**Core Value:** Members can quickly check their donation collection progress on mobile, without needing admin access.

## v1 Requirements

Requirements for the status link feature. Each maps to roadmap phases.

### Token Management

- [x] **TOKEN-01**: Groups have an auto-generated secret status token stored in database
- [x] **TOKEN-02**: Members without a group have an auto-generated secret status token
- [x] **TOKEN-03**: Tokens are static (generated once, never change)
- [ ] **TOKEN-04**: Admin can see and copy status link for any group in group list/detail
- [ ] **TOKEN-05**: Admin can see and copy status link for members without groups

### Status Page - Core Display

- [ ] **STAT-01**: Status page shows member's target amount for current fiscal year
- [ ] **STAT-02**: Status page shows total amount donated toward target
- [ ] **STAT-03**: Status page shows visual progress bar (donated vs target)
- [ ] **STAT-04**: Status page shows remaining amount needed to reach target

### Status Page - Sponsor Lists

- [ ] **LIST-01**: Status page lists sponsors who donated this year (name, amount, date)
- [ ] **LIST-02**: Status page lists sponsors who haven't donated yet this year
- [ ] **LIST-03**: LYBUNT: Sponsors who donated last year but not this year are visually highlighted
- [ ] **LIST-04**: Sponsor lists show company name or personal name (using existing display logic)

### Group Status Page

- [ ] **GROUP-01**: Group status link shows all members in the group
- [ ] **GROUP-02**: Group page shows each member's individual progress (target, donated, remaining)
- [ ] **GROUP-03**: Group page shows aggregate totals (all members combined)
- [ ] **GROUP-04**: Group page allows expanding each member to see their sponsor lists

### Technical Requirements

- [ ] **TECH-01**: Status pages accessible via token URL without authentication (e.g., /s/[token])
- [ ] **TECH-02**: Status pages are mobile-optimized (responsive, touch-friendly)
- [ ] **TECH-03**: Status pages support all 4 languages (de, en, fr, it)
- [ ] **TECH-04**: Status pages load fast (minimal JavaScript, simple data)
- [ ] **TECH-05**: Invalid tokens show friendly error page

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Enhancements

- **ENH-01**: Year-over-year comparison per sponsor ("Last year: CHF 100, This year: CHF 150")
- **ENH-02**: Print-friendly CSS styles for paper lists
- **ENH-03**: Sorting options for sponsor lists (by amount, by date, alphabetically)
- **ENH-04**: QR code generation for easy link sharing

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Regeneratable/revocable tokens | Static tokens sufficient; adds admin complexity |
| Member login system | Read-only links don't need user accounts |
| Donation editing via status page | All data entry through admin interface |
| Historical fiscal year selection | Current year is what matters for action |
| Sponsor contact info display | Privacy concern; not consented for display |
| Push notifications | Members check when convenient |
| Social sharing buttons | Private links, not public campaigns |
| Real-time updates | Page reload shows current data |
| Leaderboards/rankings | Could embarrass lower performers |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| TOKEN-01 | Phase 1: Foundation | Complete |
| TOKEN-02 | Phase 1: Foundation | Complete |
| TOKEN-03 | Phase 1: Foundation | Complete |
| TOKEN-04 | Phase 5: Admin Integration | Pending |
| TOKEN-05 | Phase 5: Admin Integration | Pending |
| STAT-01 | Phase 3: Member Status Page | Pending |
| STAT-02 | Phase 3: Member Status Page | Pending |
| STAT-03 | Phase 3: Member Status Page | Pending |
| STAT-04 | Phase 3: Member Status Page | Pending |
| LIST-01 | Phase 3: Member Status Page | Pending |
| LIST-02 | Phase 3: Member Status Page | Pending |
| LIST-03 | Phase 3: Member Status Page | Pending |
| LIST-04 | Phase 3: Member Status Page | Pending |
| GROUP-01 | Phase 4: Group Status Page | Pending |
| GROUP-02 | Phase 4: Group Status Page | Pending |
| GROUP-03 | Phase 4: Group Status Page | Pending |
| GROUP-04 | Phase 4: Group Status Page | Pending |
| TECH-01 | Phase 2: Public API | Pending |
| TECH-02 | Phase 3: Member Status Page | Pending |
| TECH-03 | Phase 3: Member Status Page | Pending |
| TECH-04 | Phase 3: Member Status Page | Pending |
| TECH-05 | Phase 2: Public API | Pending |

**Coverage:**
- v1 requirements: 22 total
- Mapped to phases: 22
- Unmapped: 0

---
*Requirements defined: 2026-01-21*
*Last updated: 2026-01-21 after roadmap creation*
