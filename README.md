# DonorFlow

Modern donation management system for clubs and organizations.

## Features

- **Member & Group Management**: Organize members, auto-create groups
- **Sponsor Assignment**: Assign to members or groups
- **Donation Tracking**: Record and track all donations
- **Fiscal Years & Targets**: Set goals, copy targets automatically
- **Performance Reports**: Real-time dashboard with PDF export
- **Multi-Language**: German, English, French, Italian
- **Import/Export**: Bulk import from CSV

## Tech Stack

- Next.js 15 (App Router), TypeScript
- SQLite + Prisma ORM
- React-Bootstrap 2.10
- NextAuth.js 4
- next-intl (i18n)

## Quick Start

### With mise (recommended)

```bash
curl https://mise.run | sh
mise install
mise run setup
mise run dev
```

### Without mise

```bash
npm install
npm run db:push
npm run db:seed
npm run dev
```

Access at http://localhost:7526 (login: `admin` / `admin`)

## Commands

```bash
# Development
npm run dev              # Start dev server
npm run build            # Build for production
npm start                # Start production server

# Database
npm run db:push          # Sync database schema
npm run db:studio        # Open Prisma Studio GUI
npm run db:seed          # Seed demo data

# With mise
mise run dev
mise run build
mise run setup
```

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for deployment options:
- VPS with PM2 + Nginx (recommended)
- Railway (simple)
- Docker

## Security Checklist

- Generate secure `NEXTAUTH_SECRET`: `openssl rand -base64 32`
- Change default admin password
- Enable HTTPS in production
- Regular database backups
- Never commit `.env` to git

## Database Model

See `database-model.svg` for entity relationships.

**Core entities**: User, Member, Group, Sponsor, Donation, MemberTarget, FiscalYear, Setting

**Business rules**:
- Sponsor → member OR group (exclusive)
- Targets per member per fiscal year
- Group target = sum of member targets
- New fiscal year copies previous targets

## Multi-Language Support

**Supported languages**: German, English, French, Italian

**Features**:
- Auto-detect browser language
- Language switcher in navigation
- Locale-aware number/date formatting
- Fallback to English for unsupported languages

**Number formats**:
- German (de-CH): CHF 1'000.00
- English (en-US): CHF 1,000.00
- French (fr-FR): CHF 1 000,00
- Italian (it-IT): CHF 1.000,00

---

Created by [Manuel Oetiker](mailto:manuel@oetiker.ch) • MIT License
