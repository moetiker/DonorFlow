<div align="center">

<img src="app/icon.svg" width="88" alt="DonorFlow" />

# DonorFlow

**Donation management for clubs and associations — built for the people who actually collect.**

Track your patrons, set fiscal-year goals, watch the money come in live, and send every member a personalized donor letter with one click. Self-hosted, four languages, your data stays yours.

[Features](#what-it-does) · [Screenshots](#screenshots) · [Quick start](#quick-start) · [Deployment](#deployment)

`Next.js 16` · `TypeScript` · `Prisma + SQLite` · `NextAuth` · `React-Bootstrap` · `MIT`

</div>

---

Clubs — a Guggenmusig, a sports team, a music society — live on their **Gönner** (patrons). Members go out and collect donations every season, and someone has to keep track of who gave what, who still needs a visit, and whether the club will hit its target. DonorFlow is that someone.

- **Members collect, DonorFlow keeps score.** Every donation is credited to the right member or group, and everyone can see their own live progress toward their target.
- **One click, everyone informed.** Upload the season's donor letter once, pick your members, and DonorFlow emails each of them a personalized status, their patron list, and the letter — throttled so your mail server stays happy.
- **Share progress without logins.** Each member and group gets an unguessable link to a mobile-friendly status page — no account needed.

## Screenshots

<div align="center">
<img src="screenshots/login.png" width="620" alt="DonorFlow sign-in" />
</div>

|  |  |
|:--:|:--:|
| **Live dashboard** — the whole season at a glance | **Performance report** — per member & group, with PDF export |
| ![Dashboard](screenshots/dashboard.png) | ![Reports](screenshots/reports.png) |
| **Public status link** — mobile, shareable, no login | **Donor mailing** — pick members, preview, send |
| ![Status link](screenshots/status-link.png) | ![Mailing](screenshots/mailing.png) |

<div align="center">

**The email each member receives** — personalized, on-brand, and readable on a phone:

<img src="screenshots/email.png" width="360" alt="Donor email preview" />

</div>

## What it does

**Members & patrons**
- Organize members; auto-create groups (e.g. families or sections)
- Assign each sponsor to a member **or** a group (never both)
- Contact details and notes per sponsor

**Donations & targets**
- Record monetary **and** in-kind donations
- One target per member per fiscal year; group target = sum of members
- New fiscal year copies the previous year's targets automatically

**Insight & sharing**
- Real-time dashboard and performance reports with one-click **PDF export**
- Public, tokenized **status pages** per member and group — mobile-first
- Per-sponsor donation history and an address-list **CSV** download

**Donor mailing** ✨
- Upload one donor letter (PDF) per fiscal year
- Send a personalized email to selected members: their status summary + link, their patrons with last year's amounts, and the letter + address CSV attached
- Background sending at a configurable rate (emails/minute); resumes safely after a restart

**Everywhere**
- German, English, French, Italian — auto-detected, locale-aware numbers & dates
- Self-hosted on your own server; SQLite means no external database to run

## Tech Stack

- **Next.js 16** (App Router) + **TypeScript** (strict)
- **Prisma 7** ORM on **SQLite**
- **NextAuth.js** authentication · **React-Bootstrap** UI · **next-intl** i18n
- **nodemailer** for the donor mailing · **jsPDF** for report export

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
npm run dev
```

Then open http://localhost:7526 (default login: `admin` / `admin`).

### Commands

```bash
npm run dev        # Dev server (port 7526)
npm run build      # Production build
npm start          # Production server
npm run db:push    # Sync the database schema
npm run db:studio  # Prisma Studio GUI
```

## Deployment

Reproducible Podman build → tar → SSH to a systemd user service. Templates live in [`deploy/`](deploy/).

```bash
cp deploy/deploy-config.example.sh deploy/deploy-config.production.sh
# edit deploy/deploy-config.production.sh with your server details
./deploy.sh production
```

The script bumps the version, builds Linux binaries in a Podman container, uploads a tar, keeps the previous release as a backup, preserves the database/`.env`/logs, syncs the schema, and restarts the service. See [`deploy/`](deploy/) for the Dockerfile, systemd unit, and nginx examples.

## Database Model

```mermaid
erDiagram
    Group ||--o{ Member : "has"
    Member ||--o{ MemberTarget : "sets"
    FiscalYear ||--o{ MemberTarget : "for"
    Member ||--o{ Sponsor : "patron of"
    Group ||--o{ Sponsor : "patron of"
    Sponsor ||--o{ Donation : "gives"
    FiscalYear ||--o{ Donation : "in"
    Member ||--o{ Donation : "credited to"
    Group ||--o{ Donation : "credited to"
    FiscalYear ||--o| DonorLetter : "letter"
    FiscalYear ||--o{ MailJob : "mailing"

    Member { string firstName; string lastName; string email; string statusToken }
    Group { string name; string statusToken }
    Sponsor { string company; string firstName; string lastName; string street }
    Donation { enum type; float amount; datetime donationDate }
    MemberTarget { float targetAmount }
    FiscalYear { string name; datetime startDate; datetime endDate }
    DonorLetter { string fileName; bytes data }
    MailJob { string status; int total; int processed }
    User { string username }
    Setting { string key; string value }
```

`User` and `Setting` are standalone (authentication and key-value config).

**Business rules**: a sponsor belongs to a member **or** a group (exclusive) · targets are per member per fiscal year · a group's target is the sum of its members' · a new fiscal year copies the previous targets · one donor letter per fiscal year.

## Internationalization

German · English · French · Italian, auto-detected from the browser with a manual switcher. Numbers and dates are locale-aware:

| Locale | Amount |
|---|---|
| German (de-CH) | CHF 1'000.00 |
| English (en-US) | CHF 1,000.00 |
| French (fr-CH) | CHF 1 000.00 |
| Italian (it-CH) | CHF 1'000.00 |

---

<div align="center">

Created by [Manuel Oetiker](mailto:manuel@oetiker.ch) · MIT License

</div>
