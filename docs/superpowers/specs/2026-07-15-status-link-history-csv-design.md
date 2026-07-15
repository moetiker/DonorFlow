# Status Link: Donation History & Address CSV — Design

**Date:** 2026-07-15
**Status:** Approved

## Goal

Extend the public status link (`/s/[token]`) with two capabilities:

1. **Per-sponsor donation history** — show each sponsor's full donation history
   (all fiscal years), expandable per row.
2. **Address CSV download** — allow downloading a CSV of the sponsors shown on
   this link, including full address/contact details.

## Context

The status link is a public capability URL (no login). Anyone holding the
32-character token (192 bits entropy) can open the page. Today the page shows
only sponsor **names** and **amounts** — no address or contact data.

Relevant existing code:
- Page: `app/s/[token]/page.tsx` (client component, next-intl, browser-locale)
- API: `app/api/public/status/[token]/route.ts` (`withPublicApiRoute`)
- Admin CSV export (reference): `app/api/sponsors/export/route.ts`
- Sponsor model fields: `company, salutation, firstName, lastName, street,
  postalCode, city, phone, email, notes`, plus `memberId`/`groupId` assignment.

## Decisions

- **CSV scope:** only the sponsors belonging to this link
  (member → its sponsors; group → group-level sponsors + every member's sponsors).
- **Privacy:** full addresses are delivered **only via the CSV endpoint**, never
  added to the page JSON. The HTML page keeps showing names/amounts. Access is
  gated solely by the unguessable token — consciously accepted.
- **History display:** full history per sponsor, all years, expandable.
- **CSV headers:** German (consistent with the existing admin export).
- **CSV contents:** address/contact fields + donation summary (count, sum);
  no per-donation history in the CSV.

## Design

### 1. Donation history (page + API)

**API — `app/api/public/status/[token]/route.ts`:**
- Fetch donations attributed to the member/group **across all fiscal years**
  (drop the `fiscalYearId: { in: fiscalYearIds }` restriction for the history
  build). Keep `currentFiscalYear`/`previousFiscalYear` ids for totals and
  LYBUNT, computed in JS by comparing `donation.fiscalYearId`.
- Add `fiscalYear: { select: { name: true } }` to the donation `select` so each
  historical donation carries its year name.
- Extend each sponsor object with:
  ```ts
  history: { date: string; type: 'MONETARY' | 'IN_KIND';
             amount: number | null; description: string | null;
             fiscalYearName: string }[]   // sorted date desc
  ```
- `calculateSponsorsProgressFromDonations` keeps computing `totalAmount`,
  `lastDonation`, `donated`, `donatedLastYear`, `isLYBUNT` from the
  current/previous-year subset; `history` is built from the full set.

**Page — `app/s/[token]/page.tsx`:**
- Add `history` to the `SponsorData` interface.
- Make each sponsor row with `history.length > 0` **expandable** (toggle button /
  collapsible detail row) showing a compact table: Date, Type (💰/🎁), Amount or
  Description, Fiscal Year. Applies in both the "donated" and "not yet donated"
  tables (a LYBUNT sponsor has prior-year history but no current-year donation).

### 2. Address CSV (new endpoint + button)

**Endpoint — `app/api/public/status/[token]/export/route.ts` (new):**
- Validate token (exactly 32 chars) like the status route; same response headers
  (`Referrer-Policy: no-referrer`, `Cache-Control: private`, plus CSV headers).
- Resolve member (by `statusToken`) or group; collect sponsors:
  - member → `member.sponsors`
  - group → `group.sponsors` + each `group.members[].sponsors`
- Include each sponsor's donations for a summary (count + monetary sum).
- Columns (German): `Firma, Anrede, Vorname, Nachname, Strasse, PLZ, Ort,
  Telefon, E-Mail, Notizen, Zugeordnet zu, Anzahl Spenden, Spendensumme`.
  For a group link, `Zugeordnet zu` = the member's name or "Gruppe".
- `Content-Disposition: attachment; filename="Goenner_<Name>_<YYYY-MM-DD>.csv"`.
- Return 404 (with security headers) for unknown/invalid tokens.

**Shared util — `lib/csv.ts` (new):**
- Extract `escapeCSV` (currently duplicated inline in the admin export) into
  `lib/csv.ts`; use it from both the admin export and the new endpoint.

**Page:**
- Add a "Adressliste als CSV" button in the header linking to
  `/api/public/status/${token}/export` (plain download anchor).

### 3. i18n

- New UI labels (history toggle, column headers, CSV button) added to
  `messages/{de,en,fr,it}.json` under the `status` namespace.
- CSV column headers stay German (server-side, matches existing export).

## Security / Privacy

- Address/contact data is **never** placed in the status JSON — only in the CSV
  response body. This keeps PII out of the easily-inspected page payload.
- Both endpoints keep `Referrer-Policy: no-referrer` and `Cache-Control: private`.
- Access remains gated by the unguessable per-entity token.

## Testing

- Build + full TypeScript check (`npm run build`).
- Browser walkthrough (chrome-devtools MCP):
  - Member link: expand a sponsor's history; download CSV; verify addresses.
  - Group link: history across members; CSV includes group + member sponsors
    with correct `Zugeordnet zu`.
  - Sponsor with no donations shows no history expander.
  - Locale detection still works; no console errors.

## Out of Scope

- Localized CSV headers.
- Per-donation history inside the CSV.
- Any change to authenticated admin pages beyond the `escapeCSV` extraction.
