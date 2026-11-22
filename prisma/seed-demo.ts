/**
 * Demo data seed script.
 *
 * Populates a scratch SQLite database with entirely invented data for a
 * fictional Swiss club, so that README screenshots can be taken without
 * ever exposing real donor data.
 *
 * SAFETY: this script refuses to run unless DATABASE_URL is set explicitly
 * and does not look like it points at production. It clears whatever demo
 * database it is pointed at before seeding, so only ever point it at a
 * scratch path.
 *
 * Usage:
 *   DATABASE_URL="file:/path/to/demo.db" npx tsx prisma/seed-demo.ts
 */

import { PrismaClient } from '@prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { hash } from 'bcryptjs'
import { randomBytes } from 'crypto'

// ---------------------------------------------------------------------------
// Safety guard - never touch anything resembling production
// ---------------------------------------------------------------------------

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  console.error(
    '\nRefusing to run: DATABASE_URL is not set.\n' +
    'This script never falls back to a default database. Point it at a\n' +
    'scratch path explicitly, e.g.:\n\n' +
    '  DATABASE_URL="file:/scratch/moetiker/tmp/donorflow-demo/demo.db" npx tsx prisma/seed-demo.ts\n'
  )
  process.exit(1)
}

if (/prod/i.test(databaseUrl)) {
  console.error(
    `\nRefusing to run: DATABASE_URL ("${databaseUrl}") contains "prod".\n` +
    'This script clears the target database before seeding and must never\n' +
    'be pointed at a production database.\n'
  )
  process.exit(1)
}

console.log(`Seeding demo data into: ${databaseUrl}`)

// ---------------------------------------------------------------------------
// Prisma client (deliberately not the app's shared singleton from lib/db.ts,
// so this script has no dependency on process.env at import time beyond the
// guard above). Mirrors the adapter setup in lib/db.ts, including the
// statusToken auto-generation extension.
// ---------------------------------------------------------------------------

function generateStatusToken(): string {
  return randomBytes(24).toString('base64url')
}

const adapter = new PrismaBetterSqlite3(
  { url: databaseUrl },
  { timestampFormat: 'unixepoch-ms' }
)

const basePrisma = new PrismaClient({ adapter })

const prisma = basePrisma.$extends({
  query: {
    member: {
      async create({ args, query }) {
        if (!args.data.groupId && !args.data.statusToken) {
          args.data.statusToken = generateStatusToken()
        }
        return query(args)
      }
    },
    group: {
      async create({ args, query }) {
        if (!args.data.statusToken) {
          args.data.statusToken = generateStatusToken()
        }
        return query(args)
      }
    }
  }
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Simple deterministic PRNG so re-running the script produces stable data. */
function makeRng(seed: number) {
  let state = seed
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff
    return state / 0x7fffffff
  }
}
const rng = makeRng(42)

function pick<T>(arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)]
}

function randInt(min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min
}

function randomDateBetween(start: Date, end: Date): Date {
  const t = start.getTime() + rng() * (end.getTime() - start.getTime())
  return new Date(t)
}

// ---------------------------------------------------------------------------
// Fiscal years - computed from "today" so the current one always contains
// the current date, regardless of when the seed is run.
//
// The club's fiscal year runs 1 August - 31 July (typical for a Swiss
// music/sports club season), so the "current" year is well-defined even
// mid-year.
// ---------------------------------------------------------------------------

function fiscalYearBounds(now: Date, offsetYears: number) {
  // Fiscal year starts on Aug 1. If we're before Aug 1 this year, the
  // "current" fiscal year started last calendar year.
  const augFirstThisYear = new Date(now.getFullYear(), 7, 1)
  const startYear = now < augFirstThisYear ? now.getFullYear() - 1 : now.getFullYear()
  const start = new Date(startYear + offsetYears, 7, 1)
  const end = new Date(startYear + offsetYears + 1, 6, 31, 23, 59, 59)
  return { start, end, name: `Saison ${start.getFullYear()}/${end.getFullYear()}` }
}

const now = new Date()
const current = fiscalYearBounds(now, 0)
const previous = fiscalYearBounds(now, -1)

// ---------------------------------------------------------------------------
// Invented Swiss street names / cities / postal codes for realistic addresses
// ---------------------------------------------------------------------------

const streets = [
  'Dorfstrasse', 'Bahnhofstrasse', 'Rebweg', 'Sonnhalde', 'Mühleweg',
  'Kirchgasse', 'Bergstrasse', 'Alpenblickweg', 'Gartenweg', 'Seestrasse',
  'Rosenweg', 'Talstrasse', 'Wiesenweg', 'Hauptstrasse', 'Feldweg'
]
const cities: { city: string; postalCode: string }[] = [
  { city: 'Muristal', postalCode: '3172' },
  { city: 'Rebbach', postalCode: '4562' },
  { city: 'Hügelsberg', postalCode: '8934' },
  { city: 'Talwil', postalCode: '6210' },
  { city: 'Bergrüti', postalCode: '9245' },
  { city: 'Seewangen', postalCode: '5417' },
  { city: 'Fluhwil', postalCode: '3855' },
  { city: 'Aumatt', postalCode: '4934' }
]

function randomAddress() {
  const loc = pick(cities)
  return {
    street: `${pick(streets)} ${randInt(1, 88)}`,
    postalCode: loc.postalCode,
    city: loc.city
  }
}

// ---------------------------------------------------------------------------
// Invented people / entities, matching the register of the previous demo
// data ("Bläser-Crew", "Garage Widmer AG", etc.) without reusing it.
// ---------------------------------------------------------------------------

const memberFirstNames = [
  'Lukas', 'Nina', 'Fabian', 'Selina', 'Mirko', 'Anja', 'Tobias', 'Corinne',
  'Reto', 'Larissa', 'Simon', 'Jasmin', 'Pascal', 'Fiona'
]
const memberLastNames = [
  'Zimmermann', 'Baumann', 'Steiner', 'Frei', 'Marti', 'Lehmann', 'Huber',
  'Graf', 'Wyss', 'Kunz', 'Brunner', 'Egger', 'Schnyder', 'Amrein'
]

const sponsorCompanies = [
  'Bäckerei Rutz', 'Garage Zellweger AG', 'Coiffeur Style & Schnitt',
  'Metzgerei Hofer', 'Elektro Bösch GmbH', 'Malerei Vontobel',
  'Restaurant Zum Löwen', 'Treuhand Berner & Partner', 'Sanitär Imhof AG',
  'Optik Reusser', 'Gärtnerei Wildblume', 'Druckerei Aegerter',
  'Physiotherapie Bewegt', 'Käserei Alpenglück', 'Autospritzwerk Keller'
]
const sponsorFirstNames = [
  'Peter', 'Monika', 'Hans', 'Doris', 'Werner', 'Ruth', 'Kurt', 'Silvia',
  'Beat', 'Verena', 'Urs', 'Trudi', 'Roger', 'Marlies', 'Christoph',
  'Yvonne', 'Daniel', 'Karin'
]
const sponsorLastNames = [
  'Widmer', 'Meier', 'Keller', 'Baumgartner', 'Stucki', 'Rüegg', 'Moser',
  'Wenger', 'Fankhauser', 'Bühler', 'Schenk', 'Iseli', 'Gerber', 'Trüb',
  'Von Arx', 'Christen'
]
const salutations = ['Herr', 'Frau', 'Fam.']

const groupNames = [
  'Bläser-Ensemble', 'Schlagzeug-Team', 'Familie Steiner-Frei',
  'Jungmusikanten', 'Vorstand', 'Fahnengruppe'
]

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

async function main() {
  console.log('Clearing existing demo data...')
  // Delete in FK-safe order.
  await prisma.donation.deleteMany()
  await prisma.donorLetter.deleteMany()
  await prisma.mailJob.deleteMany()
  await prisma.memberTarget.deleteMany()
  await prisma.sponsorAssignment.deleteMany()
  await prisma.sponsor.deleteMany()
  await prisma.member.deleteMany()
  await prisma.group.deleteMany()
  await prisma.fiscalYear.deleteMany()
  await prisma.setting.deleteMany()
  await prisma.user.deleteMany()

  console.log('Creating login user...')
  const passwordHash = await hash('demo1234', 10)
  await prisma.user.create({
    data: {
      username: 'demo',
      passwordHash,
      name: 'Demo Admin'
    }
  })

  console.log('Creating settings...')
  await prisma.setting.createMany({
    data: [
      { key: 'organizationName', value: 'Musikverein Alpenklang' },
      { key: 'defaultTargetAmount', value: '500' },
      { key: 'fiscalYearStartMonth', value: '8' },
      { key: 'fiscalYearStartDay', value: '1' }
    ]
  })

  console.log('Creating fiscal years...')
  const fyPrevious = await prisma.fiscalYear.create({
    data: { name: previous.name, startDate: previous.start, endDate: previous.end }
  })
  const fyCurrent = await prisma.fiscalYear.create({
    data: { name: current.name, startDate: current.start, endDate: current.end }
  })
  console.log(`  previous: ${fyPrevious.name} (${previous.start.toISOString()} - ${previous.end.toISOString()})`)
  console.log(`  current:  ${fyCurrent.name} (${current.start.toISOString()} - ${current.end.toISOString()})`)

  console.log('Creating groups...')
  const groups = []
  for (let i = 0; i < groupNames.length; i++) {
    const group = await prisma.group.create({
      data: {
        name: groupNames[i],
        isClubPool: i === groupNames.length - 1 // last group ("Fahnengruppe") is the club pool
      }
    })
    groups.push(group)
  }

  console.log('Creating members...')
  const usedNames = new Set<string>()
  const members = []
  const targetMemberCount = 13
  for (let i = 0; i < targetMemberCount; i++) {
    let firstName: string, lastName: string, key: string
    do {
      firstName = pick(memberFirstNames)
      lastName = pick(memberLastNames)
      key = `${firstName} ${lastName}`
    } while (usedNames.has(key))
    usedNames.add(key)

    // First 9 members get a group, remaining ones are ungrouped and get
    // their own status link.
    const groupId = i < 9 ? groups[i % (groups.length - 1)].id : null

    const member = await prisma.member.create({
      data: {
        firstName,
        lastName,
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`,
        phone: `079 ${randInt(100, 999)} ${randInt(10, 99)} ${randInt(10, 99)}`,
        groupId
      }
    })
    members.push(member)
  }

  console.log('Creating member targets for both fiscal years...')
  for (const member of members) {
    const baseTarget = pick([300, 400, 500, 600, 800])
    await prisma.memberTarget.create({
      data: { memberId: member.id, fiscalYearId: fyPrevious.id, targetAmount: baseTarget }
    })
    await prisma.memberTarget.create({
      data: { memberId: member.id, fiscalYearId: fyCurrent.id, targetAmount: baseTarget }
    })
  }

  console.log('Creating sponsors...')
  const sponsors: { id: string; memberId: string | null; groupId: string | null }[] = []
  const totalSponsors = 32
  const usedSponsorNames = new Set<string>()
  for (let i = 0; i < totalSponsors; i++) {
    const isCompany = i % 4 === 0 // roughly a quarter are companies
    const hasFullAddress = i % 6 !== 0 // most get a full address, some don't
    const addr = hasFullAddress ? randomAddress() : {}

    let data: {
      company?: string | null
      salutation?: string | null
      firstName?: string | null
      lastName?: string | null
      street?: string | null
      postalCode?: string | null
      city?: string | null
      phone?: string | null
      email?: string | null
    }

    if (isCompany) {
      let company = pick(sponsorCompanies)
      if (usedSponsorNames.has(company)) {
        company = `${company} ${randInt(2, 9)}`
      }
      usedSponsorNames.add(company)
      data = {
        company,
        email: hasFullAddress ? `info@${company.toLowerCase().replace(/[^a-z0-9]+/g, '')}.example.com` : null,
        phone: hasFullAddress ? `0${randInt(21, 91)} ${randInt(200, 999)} ${randInt(10, 99)} ${randInt(10, 99)}` : null,
        ...addr
      }
    } else {
      let firstName: string, lastName: string, key: string
      do {
        firstName = pick(sponsorFirstNames)
        lastName = pick(sponsorLastNames)
        key = `${firstName} ${lastName}`
      } while (usedSponsorNames.has(key))
      usedSponsorNames.add(key)
      data = {
        salutation: pick(salutations),
        firstName,
        lastName,
        email: hasFullAddress ? `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com` : null,
        phone: hasFullAddress ? `07${randInt(6, 9)} ${randInt(100, 999)} ${randInt(10, 99)} ${randInt(10, 99)}` : null,
        ...addr
      }
    }

    // One recipient per sponsor here: a member or a group (each assignment is
    // one or the other). Roughly 60% member-assigned, 40% group-assigned.
    // A second recipient is added further below for one sponsor.
    const assignToMember = rng() < 0.6
    const memberId = assignToMember ? pick(members).id : null
    const groupId = assignToMember ? null : pick(groups).id

    const sponsor = await prisma.sponsor.create({
      data: { ...data, assignments: { create: { memberId, groupId } } }
    })
    sponsors.push({ id: sponsor.id, memberId, groupId })
  }

  console.log('Creating donations...')

  // Group sponsors by the member/group they belong to. List order mirrors
  // sponsor creation order, which is deterministic for the fixed rng seed
  // above - that lets the hand-tuned plans below address sponsors by
  // position ("this member's first sponsor", etc.) instead of by id.
  const sponsorsByMember = new Map<string, typeof sponsors>()
  const sponsorsByGroup = new Map<string, typeof sponsors>()
  for (const s of sponsors) {
    if (s.memberId) {
      const list = sponsorsByMember.get(s.memberId) ?? []
      list.push(s)
      sponsorsByMember.set(s.memberId, list)
    } else if (s.groupId) {
      const list = sponsorsByGroup.get(s.groupId) ?? []
      list.push(s)
      sponsorsByGroup.set(s.groupId, list)
    }
  }

  const inKindDescriptions = [
    'Kuchen für den Vereinsanlass', 'Getränke für das Sommerfest',
    'Blumenschmuck für die Bühne', 'Druckkosten Programmheft',
    'Werkzeugspende für das Vereinslokal', 'Transportdienst mit Lieferwagen'
  ]

  let donationCount = 0

  /**
   * Applies a hand-tuned donation plan to an ordered sponsor list.
   *
   * `currentYearAmounts[i]` lists the current-fiscal-year MONETARY donation
   * amounts for `sponsorList[i]` (an empty/missing entry means that sponsor
   * gives nothing this year - which is what creates "not yet donated"
   * sponsors on the status pages). Sponsors with no current-year donation
   * always get a previous-year donation, so they become "Nachfassen"
   * (LYBUNT) candidates. Sponsors who did donate this year also get a
   * previous-year donation about half the time, modelling ordinary repeat
   * donors without turning every non-donor into a follow-up case.
   *
   * Amounts are chosen by the caller and are not scaled here, so totals
   * stay exactly as planned - this function only decides *whether* a given
   * sponsor also gets previous-year history.
   */
  async function applyDonationPlan(sponsorList: typeof sponsors, currentYearAmounts: number[][]) {
    for (let i = 0; i < sponsorList.length; i++) {
      const sponsor = sponsorList[i]
      const amounts = currentYearAmounts[i] ?? []

      for (const amount of amounts) {
        await prisma.donation.create({
          data: {
            sponsorId: sponsor.id,
            memberId: sponsor.memberId,
            groupId: sponsor.groupId,
            type: 'MONETARY',
            amount,
            donationDate: randomDateBetween(current.start, now),
            fiscalYearId: fyCurrent.id
          }
        })
        donationCount++
      }

      const donatedThisYear = amounts.length > 0
      if (!donatedThisYear || rng() < 0.5) {
        await prisma.donation.create({
          data: {
            sponsorId: sponsor.id,
            memberId: sponsor.memberId,
            groupId: sponsor.groupId,
            type: 'MONETARY',
            amount: randInt(30, 250),
            donationDate: randomDateBetween(previous.start, previous.end),
            fiscalYearId: fyPrevious.id
          }
        })
        donationCount++
      }
    }
  }

  /** Adds a single in-kind donation on top of an existing plan, for variety. */
  async function addInKind(sponsorList: typeof sponsors, index: number, year: 'current' | 'previous') {
    const sponsor = sponsorList[index]
    if (!sponsor) return
    const range = year === 'current' ? { start: current.start, end: now } : { start: previous.start, end: previous.end }
    await prisma.donation.create({
      data: {
        sponsorId: sponsor.id,
        memberId: sponsor.memberId,
        groupId: sponsor.groupId,
        type: 'IN_KIND',
        description: pick(inKindDescriptions),
        donationDate: randomDateBetween(range.start, range.end),
        fiscalYearId: year === 'current' ? fyCurrent.id : fyPrevious.id
      }
    })
    donationCount++
  }

  // --- Member-level donations ----------------------------------------------
  // Individual sponsors attributed directly to a member. This drives the
  // members overview progress bars, and - for the four ungrouped members,
  // who are the only ones with an individual public status link - the
  // status page and the performance report's "members" table.
  //
  // Note: a grouped member's own donations do NOT roll up into their
  // group's figures (see group-level section below); they only affect that
  // member's row in the members overview.
  //
  // Four members end up at 0% below because they have zero sponsors at all
  // (Mirko Amrein, Lukas Frei, Lukas Huber, Selina Marti) - a realistic
  // "hasn't found any sponsors yet" case, and not something a donation plan
  // can change.
  const memberPlans: number[][][] = [
    [[150]],                    // members[0] Reto Graf         (target 300, 2 sponsors) -> 50%
    [[480]],                    // members[1] Larissa Graf       (target 800, 1 sponsor)  -> 60%
    [],                         // members[2] Mirko Amrein       (target 800, 0 sponsors) -> 0%
    [[300], [220], []],         // members[3] Selina Baumann     (target 400, 3 sponsors) -> 130%
    [[400], [350], [210], []],  // members[4] Tobias Frei        (target 800, 4 sponsors) -> 120%
    [[420]],                    // members[5] Fiona Egger        (target 400, 1 sponsor)  -> 105%
    [],                         // members[6] Lukas Frei         (target 500, 0 sponsors) -> 0%
    [[150]],                    // members[7] Corinne Zimmermann (target 300, 1 sponsor)  -> 50%
    [[270]],                    // members[8] Larissa Egger      (target 300, 1 sponsor)  -> 90%
    [[150, 120], []],           // members[9] Anja Schnyder      (target 300, 2 sponsors) -> 90%
    [],                         // members[10] Lukas Huber       (target 400, 0 sponsors) -> 0%
    [],                         // members[11] Selina Marti      (target 500, 0 sponsors) -> 0%
    [[200], [160], []]          // members[12] Jasmin Wyss       (target 800, 3 sponsors) -> 45%
  ]

  for (let i = 0; i < members.length; i++) {
    const memberSponsors = sponsorsByMember.get(members[i].id) ?? []
    await applyDonationPlan(memberSponsors, memberPlans[i] ?? [])
  }

  // A couple of in-kind donations layered on top of sponsors who already
  // gave money this year, so the "not yet donated" split is unaffected.
  await addInKind(sponsorsByMember.get(members[4].id) ?? [], 0, 'current') // Tobias Frei's first sponsor
  await addInKind(sponsorsByMember.get(members[7].id) ?? [], 0, 'current') // Corinne Zimmermann's sponsor

  // --- Group-level donations ------------------------------------------------
  // Sponsors attributed directly to a group. This is what the performance
  // report and dashboard total actually use for "group achievement" -
  // donations from a group's own members' personal sponsors do not count
  // here, only sponsors assigned straight to the group.
  //
  // Spread across the 5 real groups: two at/above 100%, two in the 40-80%
  // range, one clearly lagging around 15% - none at zero, per the club-pool
  // exception below.
  //
  // groups[0] Bläser-Ensemble has only one group-assigned sponsor, so it
  // cannot both donate (required, to keep the group off zero) and leave a
  // sponsor undonated (which would be needed for a "not yet donated" /
  // follow-up entry on that group's status page). Groups 1-4 below each
  // keep at least one sponsor undonated instead, so use one of those for a
  // "Nachfassen" screenshot.
  const groupPlans: number[][][] = [
    [[105]],                     // groups[0] Bläser-Ensemble       (target 700,  1 sponsor)  -> 15%
    [[300, 285], []],            // groups[1] Schlagzeug-Team       (target 1300, 2 sponsors) -> 45% (49% with the extra CHF 50 below)
    [[400, 400, 300], []],       // groups[2] Familie Steiner-Frei  (target 1100, 2 sponsors) -> 100%
    [[200], [100, 85], [], []],  // groups[3] Jungmusikanten        (target 700,  4 sponsors) -> 55%
    [[450, 350], []],            // groups[4] Vorstand              (target 800,  2 sponsors) -> 100%
    []                           // groups[5] Fahnengruppe (club pool - no members/target, so it
                                  // stays at 0 current-year actual and is filtered out of the
                                  // report entirely, matching its role as an orphan-sponsor bucket
                                  // rather than a "real" group)
  ]

  for (let i = 0; i < groups.length; i++) {
    const groupSponsors = sponsorsByGroup.get(groups[i].id) ?? []
    await applyDonationPlan(groupSponsors, groupPlans[i] ?? [])
  }

  // A couple more in-kind donations among group sponsors, again layered on
  // top of existing money donations (or, for the club pool, on a sponsor
  // that already gets a guaranteed previous-year-only donation).
  await addInKind(sponsorsByGroup.get(groups[2].id) ?? [], 0, 'current')  // Familie Steiner-Frei's donor
  await addInKind(sponsorsByGroup.get(groups[3].id) ?? [], 1, 'current')  // Jungmusikanten's second donor
  await addInKind(sponsorsByGroup.get(groups[5].id) ?? [], 0, 'previous') // club pool, previous year only

  // --- A sponsor with two recipients ---------------------------------------
  // Tobias Frei's first sponsor also supports Schlagzeug-Team. The group gets
  // its own CHF 50; Tobias Frei's figures stay as planned above, since each
  // donation counts only for its own recipient.
  const twoRecipientSponsor = (sponsorsByMember.get(members[4].id) ?? [])[0]
  if (twoRecipientSponsor) {
    await prisma.sponsorAssignment.create({
      data: { sponsorId: twoRecipientSponsor.id, groupId: groups[1].id }
    })
    await prisma.donation.create({
      data: {
        sponsorId: twoRecipientSponsor.id,
        groupId: groups[1].id,
        type: 'MONETARY',
        amount: 50,
        donationDate: randomDateBetween(current.start, now),
        fiscalYearId: fyCurrent.id
      }
    })
    donationCount++
  }

  // --- A dissolved group ----------------------------------------------------
  // "Theatergruppe" was dissolved: it has no members, its old status link
  // shows the dissolved page, and its previous-year donation stays credited
  // to it. Its sponsor was handed over to the club pool.
  const dissolvedGroup = await prisma.group.create({
    data: { name: 'Theatergruppe', dissolvedAt: randomDateBetween(previous.end, now) }
  })
  const handedOverSponsor = await prisma.sponsor.create({
    data: {
      salutation: 'Frau',
      firstName: 'Verena',
      lastName: 'Kohler',
      ...randomAddress(),
      assignments: { create: { groupId: groups[groups.length - 1].id } }
    }
  })
  await prisma.donation.create({
    data: {
      sponsorId: handedOverSponsor.id,
      groupId: dissolvedGroup.id,
      type: 'MONETARY',
      amount: 120,
      donationDate: randomDateBetween(previous.start, previous.end),
      fiscalYearId: fyPrevious.id
    }
  })
  donationCount++

  console.log(`Created ${donationCount} donations.`)
  console.log('Demo data seeded successfully.')
}

main()
  .catch((error) => {
    console.error('Error seeding demo data:', error)
    process.exit(1)
  })
  .finally(async () => {
    await basePrisma.$disconnect()
  })
