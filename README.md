# DonorFlow

Modern donation management system for clubs and organizations.

## Features

- **Member & Group Management**: Organize members, auto-create groups
- **Sponsor Assignment**: Assign to members or groups
- **Donation Tracking**: Record monetary and in-kind donations
- **In-Kind Donations**: Track non-monetary contributions with descriptions
- **Fiscal Years & Targets**: Set goals, copy targets automatically
- **Performance Reports**: Real-time dashboard with PDF export
- **Public Status Pages**: Shareable links for members/groups to view progress
- **Multi-Language**: German, English, French, Italian (auto-detect)
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

### Quick Deploy (Podman + systemd)

```bash
# Configure deployment target
cp deploy-config.example.sh deploy-config.production.sh
# Edit deploy-config.production.sh with your server details

# Deploy
./deploy.sh
```

The deploy script:
1. Bumps version and creates git tag
2. Builds in Podman container (reproducible Linux binaries)
3. Creates tar archive and uploads to server
4. Extracts with automatic backup of previous deployment
5. Preserves database, .env, and logs
6. Syncs database schema and generates status tokens
7. Restarts via systemd user service

### First-time Server Setup

```bash
# On the server, after first deploy:
mkdir -p ~/.config/systemd/user
cp ~/donorflow/current/donorflow.service ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable donorflow
loginctl enable-linger $USER
systemctl --user start donorflow
```

### Useful Commands

```bash
# View logs
journalctl --user -u donorflow -f

# Restart service
systemctl --user restart donorflow

# Check status
systemctl --user status donorflow
```

### Server Structure

```
~/donorflow/
├── current/           # Active deployment
│   ├── .next/
│   ├── prisma/prod.db
│   ├── .env
│   └── logs/
├── backup-*/          # Previous deployments (last 3 kept)
```

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
