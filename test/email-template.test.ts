import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renderStatusEmail, type StatusEmailData } from '../lib/email-template'

/**
 * The mailing page sends two kinds of mail from one template: the donor letter
 * mail (with attachments and the apéro call to action) and the reminder, which
 * carries nothing but the current standing and the status link. These tests pin
 * down what each variant may and may not contain — sending a reminder that
 * announces attachments it does not have would be visible to every member.
 */

const STATUS_URL = 'https://example.org/s/token123'

function mailData(overrides: Partial<StatusEmailData> = {}): StatusEmailData {
  return {
    firstName: 'Jasmin',
    orgName: 'Musikverein Alpenklang',
    fiscalYearName: 'Saison 2026/2027',
    statusUrl: STATUS_URL,
    progress: { target: 800, collected: 360, remaining: 440, percentage: 45 },
    sponsors: [
      { name: 'Muster AG', lastYearAmount: 200 },
      { name: 'Familie Weber', lastYearAmount: 0 },
    ],
    previousYearName: 'Saison 2025/2026',
    groupInfo: null,
    attachmentsNote: true,
    locale: 'de',
    ...overrides,
  }
}

test('the letter variant is unchanged and keeps its apéro call to action', () => {
  const mail = renderStatusEmail(mailData())

  assert.equal(mail.subject, 'Gönner:innen-Brief Musikverein Alpenklang')
  assert.match(mail.html, /Apéro/)
  assert.match(mail.text, /Apéro/)
  assert.match(mail.html, /Angehängt/)
  assert.match(mail.text, /Angehängt/)
})

test('the letter variant is the default when no variant is given', () => {
  const explicit = renderStatusEmail(mailData({ variant: 'letter' }))
  const implicit = renderStatusEmail(mailData())

  assert.equal(implicit.subject, explicit.subject)
  assert.equal(implicit.html, explicit.html)
  assert.equal(implicit.text, explicit.text)
})

test('the reminder announces the standing, not a letter', () => {
  const mail = renderStatusEmail(mailData({ variant: 'reminder' }))

  assert.equal(mail.subject, 'Dein Gönner:innen-Stand – Musikverein Alpenklang')
  assert.match(mail.html, /Saison 2026\/2027/, 'names the fiscal year it reports on')
  assert.match(mail.text, /Zwischenstand/)
})

test('the reminder carries no apéro call to action and no attachments note', () => {
  const mail = renderStatusEmail(mailData({ variant: 'reminder' }))

  // attachmentsNote is deliberately true above: the variant, not the flag,
  // decides — the runner attaches nothing to a reminder.
  for (const rendered of [mail.html, mail.text]) {
    assert.doesNotMatch(rendered, /Apéro/)
    assert.doesNotMatch(rendered, /Angehängt/)
    assert.doesNotMatch(rendered, /Doris/, 'the letter-only contact person stays out')
  }
})

test('the reminder keeps the figures, the status link and the patron list', () => {
  const mail = renderStatusEmail(mailData({ variant: 'reminder' }))

  assert.ok(mail.html.includes(STATUS_URL), 'the status button links to the status page')
  assert.ok(mail.text.includes(STATUS_URL))
  // Intl formats currency with a non-breaking space, hence \s
  assert.match(mail.text, /Ziel: CHF\s800/)
  assert.match(mail.text, /Gesammelt: CHF\s360/)
  assert.match(mail.text, /Offen: CHF\s440/)
  assert.match(mail.text, /45% des Ziels erreicht/)
  assert.match(mail.html, /Muster AG/)
  assert.match(mail.text, /Muster AG: CHF\s200/)
  assert.match(mail.text, /Familie Weber: –/, 'a patron without a previous amount shows a dash')
})

test('the reminder renders in every supported locale', () => {
  const expected = {
    de: 'Dein Gönner:innen-Stand – Musikverein Alpenklang',
    en: 'Your patron standing – Musikverein Alpenklang',
    fr: 'Le point sur tes donateurs – Musikverein Alpenklang',
    it: 'Il tuo stato donatori – Musikverein Alpenklang',
  } as const

  for (const [locale, subject] of Object.entries(expected)) {
    const mail = renderStatusEmail(
      mailData({ variant: 'reminder', locale: locale as keyof typeof expected })
    )
    assert.equal(mail.subject, subject, `subject for ${locale}`)
    assert.ok(mail.html.includes(STATUS_URL), `status link for ${locale}`)
    assert.doesNotMatch(mail.html, /\{\w+\}/, `no unresolved placeholder for ${locale}`)
  }
})

test('the group line survives in the reminder', () => {
  const mail = renderStatusEmail(
    mailData({
      variant: 'reminder',
      groupInfo: { name: 'Vorstand', memberNames: ['Tobias', 'Anja'] },
    })
  )

  assert.match(mail.text, /Gruppe Vorstand – gemeinsam mit Tobias, Anja/)
})
