# Feature Landscape: Donation Status Pages

**Domain:** Member/Fundraiser donation tracking status pages
**Researched:** 2026-01-21
**Context:** DonorFlow adding token-based public status links for members to view their donation collection progress

## Table Stakes

Features users expect. Missing = status page feels incomplete or unusable.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Progress indicator (target vs collected) | Core purpose of a status page; users need to see how close they are to goal | Low | Visual progress bar/thermometer highly effective per research |
| List of donors who donated this year | Members need to know who has already contributed to thank them | Low | Name and amount minimum; date optional |
| List of donors who haven't donated yet | Members need to know who to follow up with | Low | Essential for actionable status tracking |
| Current fiscal year total | Basic metric - total amount collected | Low | Sum of donations, already calculable from data |
| Mobile-optimized display | Members check on phones "in the field" while visiting sponsors | Medium | Responsive design, touch-friendly, readable fonts |
| Language support | DonorFlow already supports 4 languages; status pages must match | Low | Reuse existing i18n infrastructure |
| Fast load time | Status check is quick glance, not deep analysis | Low | Simple data, minimal JS |

## Differentiators

Features that add value beyond basic functionality. Not expected, but appreciated.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| LYBUNT highlighting (Last Year But Unfortunately Not This Year) | Shows donors who gave last year but not yet this year - prime follow-up targets | Medium | Requires comparing current vs previous fiscal year; HIGH VALUE for member action |
| Progress visualization (thermometer/bar) | Visual progress is more motivating than raw numbers | Low | Research shows progress bars increase engagement |
| Last donation date per sponsor | Helps members time follow-ups appropriately | Low | Already tracked in Donation model |
| Group aggregate view | Group leaders see all members' progress at once | Medium | Already in requirements; differentiates from member-only view |
| Donation amount sorting | Largest donors at top, or most recent first | Low | Simple sort options enhance usability |
| Year-over-year comparison for each sponsor | "Last year: CHF 100, This year: CHF 150" shows trajectory | Medium | Useful context for approaching sponsors |
| Print-friendly view | Members may want paper list when visiting sponsors | Low | CSS print styles |

## Anti-Features

Features to explicitly NOT include. Common mistakes that add complexity without proportional value.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Donor contact information on public page | Privacy concern; sponsors didn't consent to public display of phone/email | Only show name (or company name if applicable) |
| Donation editing capability | Violates read-only principle; increases security scope | All editing through authenticated admin interface |
| Historical fiscal year selection | Adds UI complexity; current year is what matters for action | Always show current fiscal year |
| Leaderboards ranking members | Could create unhealthy competition or embarrass lower performers | Group view shows individual progress without ranking |
| Social sharing buttons | Status page is private link for member use, not public campaign | Keep link shareable but don't encourage broadcast |
| Real-time updates / live refresh | Overkill for status checking; adds complexity | Page reload shows current data |
| Donation amount entry by members | Scope creep; members should report to admin who enters data | Status page is read-only |
| Push notifications | Members check when convenient; notifications add mobile app complexity | Simple web page, no PWA features |
| Regeneratable/revocable tokens | Per PROJECT.md - static tokens sufficient; adds admin burden | Simple static tokens in database |
| Gamification (badges, achievements) | Enterprise donation tracking, not consumer fundraising | Clean, professional status display |
| Donor messages/thank-you notes | Adds write capability and complexity | Out of scope; handled through other channels |
| Recurring donation tracking | DonorFlow tracks individual donations, not subscriptions | Show each donation as received |

## Feature Dependencies

```
Token generation → Status page access
  ↓
Current fiscal year lookup → Target retrieval
  ↓
Sponsor list for member/group → Donation lookup per sponsor
  ↓
Previous year donation lookup → LYBUNT identification
```

**Critical path:**
1. Token storage (schema change)
2. Public route bypassing auth
3. Basic status display (target, donated, remaining)
4. Sponsor lists (donated / not donated)
5. LYBUNT highlighting (previous year comparison)

## MVP Recommendation

For MVP, prioritize all table stakes plus key differentiators:

**Must have (Phase 1):**
1. Progress indicator with target vs collected
2. List of sponsors who donated (name, amount)
3. List of sponsors who haven't donated
4. Mobile-optimized responsive display
5. Multi-language support

**Should have (Phase 1 or early Phase 2):**
1. LYBUNT highlighting - extremely actionable for members
2. Progress bar/thermometer visualization
3. Group aggregate view

**Defer to post-MVP:**
- Year-over-year comparison per sponsor: Nice but not essential
- Print-friendly view: Can be added later
- Donation amount sorting: Basic order is sufficient initially

## Privacy Considerations

Based on research, status pages should:

| Aspect | Recommendation | Rationale |
|--------|---------------|-----------|
| Sponsor names | Show (first name, last name or company) | Members need to identify who to thank/follow up |
| Donation amounts | Show | Members need to track progress toward target |
| Sponsor contact info | Do NOT show | Privacy - not consented for public display |
| Donation dates | Show | Helps with follow-up timing |
| Sponsor notes | Do NOT show | May contain private admin notes |
| Anonymous option | NOT needed | Status pages are private links, not public campaigns |

The status page is accessed via secret token, not truly public. The audience is the member who collected these donations. This is more like an internal dashboard than a public fundraising page.

## Data Already Available in DonorFlow

Current schema supports all table stakes features:

| Feature Need | Data Source | Available |
|--------------|-------------|-----------|
| Member target | MemberTarget table | Yes |
| Current fiscal year | FiscalYear table | Yes |
| Sponsors for member | Sponsor.memberId | Yes |
| Sponsors for group | Sponsor.groupId | Yes |
| Donations this year | Donation.fiscalYearId | Yes |
| Donation amounts | Donation.amount | Yes |
| Donation dates | Donation.donationDate | Yes |
| Sponsor names | Sponsor.firstName/lastName/company | Yes |

**Schema additions needed:**
- `Member.statusToken` - for member-level status links
- `Group.statusToken` - for group-level status links

## Sources

Research based on:
- [Donorbox - Donation Page Best Practices](https://donorbox.org/nonprofit-blog/donation-page-best-practices)
- [Givebutter - LYBUNT and SYBUNT](https://givebutter.com/blog/lybunt-and-sybunt)
- [Kindful - LYBUNT SYBUNT Reports](https://kindful.com/nonprofit-glossary/lybunt-sybunt-reports/)
- [CauseVox - Fundraising Thermometer](https://www.causevox.com/fundraising-thermometer/)
- [Givebutter - Fundraising Thermometer](https://givebutter.com/features/fundraising-thermometer)
- [Funraise - Peer-to-Peer Fundraising](https://www.funraise.org/features/peer-to-peer-fundraising)
- [RallyUp - Anonymous Donations](https://rallyup.com/learn/understand-anonymous-donations/)
- [DonorPerfect - Fundraising Dashboards](https://www.donorperfect.com/nonprofit-technology-blog/fundraising-software/fundraising-dashboard/)
- [Neon One - Donation Page Best Practices](https://neonone.com/resources/blog/nonprofit-donation-page-best-practices/)
- [GoFundMe - Donation Page Examples](https://pro.gofundme.com/c/blog/donation-page-examples/)

---

**Confidence:** HIGH - Features are well-established patterns in donation tracking domain. DonorFlow's existing data model supports all recommended features with minimal schema changes.
