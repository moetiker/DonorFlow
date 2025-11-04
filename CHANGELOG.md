# Changelog

All notable changes to DonorFlow will be documented in this file.

## [0.2.1] - 2025-11-03

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

## [0.2.0] - 2025-11-03

### Added
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

## [0.1.0] - 2025-11-02

### Added
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
