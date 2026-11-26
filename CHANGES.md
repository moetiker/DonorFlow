# Changelog

All notable changes to DonorFlow are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
except that the first subsection is called `New` rather than `Added`. The release
workflow matches on `### New`; renaming it silently drops the section from the
release notes.

This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### New

### Changed

### Fixed

## 0.6.23 - 2026-11-26

### Changed

- Updated nodemailer to 10.6.1, next-intl to 4.15.3, react-bootstrap-typeahead to 6.4.2 and TypeScript to 6.0.3.

## 0.6.22 - 2026-11-26

### Changed

- Dependencies are installed with pnpm (`pnpm install`) instead of npm; the server build uses pnpm as well.
- Releases are made on GitHub through "Create release PR"; the version is no longer raised by the deployment.

## 0.6.21 - 2026-11-26

### New

- A patron can support several members and groups at once. Every donation is credited to exactly one member or group; the donation form pre-fills it from the patron's assignments.
- Groups can be dissolved. Their members are released, and their donations stay in the reports and club totals.
- One group can be flagged as the club pool. Patrons left without a recipient are handed over to it.
- Member mailing: the season's letter (PDF) with status link and address list, or a reminder with the current figures that lists only the patrons who already paid. Sending runs in throttled batches and resumes after a restart.
- Address lists as CSV, Excel and PDF on the status page and from the members and groups overviews.
- Fiscal years can be renamed.
- Demo seed for screenshots and local trials (`db:seed`, login `demo` / `demo1234`).

### Changed

- Status pages, exports, reports and the mailing count only a recipient's own donations; group status pages list only group-assigned patrons and group donors.
- When a member or group is deleted, its donations go to the patron's remaining recipient, or to the club pool when none is left. Deleting says what is handed over.
- The "not yet donated" list on status pages is grouped and highlights patrons who gave last year.
- New theme and app icon; the login page shows the club name.
- Next.js 16.4.6 and Nodemailer 10.1.4, with further dependency updates that close known advisories.

### Fixed

- Spreadsheet formulas in CSV exports are neutralised.
- Findings of a security review are fixed.

## 0.6.0 - 2026-05-11

### New
- **CSV Import API**: New import endpoint with upsert logic for bulk data updates
- **Member Contact Fields**: Email and phone fields added to member forms
- **Fiscal Year Filters**: Fiscal year selector added to performance reports, shares reports, and donations modal on groups page
- **Performance Detail Modal**: Deeper analytics view for donation performance
- **Sponsors Without Donations**: Feature to identify sponsors who haven't donated

### Changed
- Replace browser `confirm()` dialogs with DeleteConfirmModal throughout the application
- Extract `useCurrentFiscalYear` hook to eliminate code duplication
- Consolidate UI components for better consistency
- Update Next.js to 16.x and all dependencies to latest versions

### Fixed
- Build: Add dummy DATABASE_URL for Prisma generate in Docker
- Deploy: Use prod.db as default for status token generation
- UI: Separate in-kind donations section in status page and detail modal
- Status: Respect donation-level assignment overrides
- Add missing translation keys (groups.group)

### Removed
- Local development files from repository (now gitignored):
  - `.mise.toml`, `.deployignore`, `backup-setup.sh`
  - `sync-db.sh`, `deploy.sh`, `ecosystem.config.js`
- `.planning/` directory from repository (now gitignored)

### Technical
- Remove dead code and improve UserModal consistency
- Clean up repository structure for better maintainability

## 0.5.0 - 2026-01-22

### New
- **In-Kind Donations (Sachspenden)**
  - New donation type for non-monetary contributions
  - Description field for in-kind donations
  - Dedicated section in status pages and detail modals
  - Included in performance reports and PDF export

- **Public Status Pages**
  - Shareable links for members and groups to view their donation progress
  - Mobile-optimized responsive design
  - Auto-detect browser language (de, en, fr, it)
  - LYBUNT (Last Year But Unfortunately Not This) detection highlights
  - Group view with accordion for member details
  - Progress bars with color-coded achievement levels

- **Status Link Management**
  - Copy-to-clipboard buttons on members and groups pages
  - Auto-generated secure tokens for each member/group
  - Public API endpoints for status data

- **New Deployment System**
  - Podman-based container builds for reproducible Linux binaries
  - Atomic deployments with automatic backup/rollback
  - Switched from pm2 to systemd user service
  - Automatic version bumping with git tags
  - Database preserved across deployments
  - Schema auto-sync on deploy

### Changed
- Donation model now supports assignment override (can differ from sponsor's default)
- Status pages respect donation-level assignment overrides

### Technical
- Added `Dockerfile.build` for Podman builds
- New `deploy.sh` script with Podman + systemd support
- `ecosystem.config.js` uses `__dirname` for portable paths
- Added `.env.production.example` template
- Deployment structure changed to `/path/current/` with backups

## 0.2.1 - 2025-11-03

### Changed
- **Performance Reports**: Group donations report now shows same columns as member report
  - Added Target, Actual, Difference, and Achievement columns to group stats
  - Group targets calculated as sum of member targets
  - Unified table structure for easier comparison
- **Achievement Calculation**: Members/groups without targets (target = 0) now show 100% achievement
- **Sorting**: Both member and group reports now sorted by achievement percentage (highest first)

### Fixed
- Group donations report table structure consistency
- Achievement percentage logic for zero targets

## 0.2.0 - 2025-11-03

### New
- **Multi-language support** (German, English, French, Italian)
  - Browser language auto-detection
  - Language switcher in navigation
  - Locale-aware number formatting (CHF with locale-specific separators)
  - Locale-aware date formatting
  - Fallback to English for unsupported languages
- **i18n infrastructure**
  - next-intl integration
  - Translation files for all 4 languages (~340 keys each)
  - Locale-aware formatters utility
  - localStorage + cookie persistence

### Changed
- All UI components updated with translation support
- Number formatting now respects locale (de-CH uses apostrophe separator)
- Date formatting adapts to locale
- Navigation now includes language switcher dropdown

### Technical
- Added `next-intl@^3.0.0` dependency
- Created i18n configuration files
- Updated all pages and modals with useTranslations hooks
- Implemented locale detection logic with regional support (de-AT, de-DE, de-CH → de)

## 0.1.0 - 2025-11-02

### New
- Initial release of DonorFlow
- Member management with groups
- Sponsor assignment (to member or group)
- Donation tracking
- Fiscal year management
- Target setting per member per fiscal year
- Performance dashboard
- PDF report generation
- User authentication with NextAuth.js
- CSV import for members and sponsors
- Settings page for organization configuration

### Technical
- Next.js 15 with App Router
- TypeScript
- SQLite database with Prisma ORM
- React-Bootstrap 2.10 UI
- NextAuth.js 4 authentication
- jsPDF + html2canvas for PDF export
- mise for Node.js version management

---

**Format**: [Major.Minor.Patch]
**Types**: Added, Changed, Deprecated, Removed, Fixed, Security
