/**
 * Mobile-friendly HTML email for the donor mailing.
 * Table-based, inline styles, single column, max-width 600px — the layout
 * pattern email clients (incl. mobile) render reliably.
 */

type EmailLocale = 'de' | 'en' | 'fr' | 'it'

// Guggemusig Müüs brand orange (email header)
const BRAND_ORANGE = '#EA7600'

export type StatusEmailData = {
  firstName: string
  orgName: string
  fiscalYearName: string
  statusUrl: string
  progress: { target: number; collected: number; remaining: number; percentage: number }
  sponsors: { name: string; lastYearAmount: number }[]
  previousYearName: string | null
  groupInfo: { name: string; memberNames: string[] } | null
  attachmentsNote: boolean
  locale?: EmailLocale
}

const LOCALE_MAP: Record<EmailLocale, string> = {
  de: 'de-CH',
  en: 'en-US',
  fr: 'fr-CH',
  it: 'it-CH',
}

const STRINGS: Record<EmailLocale, Record<string, string>> = {
  de: {
    subject: 'Gönnerbrief {org} – {year}',
    greeting: 'Hallo {name}',
    intro: 'Im Anhang findest du unseren Gönnerbrief für das Vereinsjahr {year}. Hier dein aktueller Spendenstand:',
    groupLine: 'Du bist in der Gruppe {group} – gemeinsam mit {members}.',
    groupLineSolo: 'Du bist in der Gruppe {group}.',
    target: 'Ziel',
    collected: 'Gesammelt',
    remaining: 'Offen',
    ofTarget: '{pct}% des Ziels erreicht',
    button: 'Meinen Status ansehen',
    attachments: 'Angehängt: Gönnerbrief (PDF) und deine Adressliste (CSV).',
    sponsorsTitle: 'Deine Gönner',
    sponsorsLastYear: 'Vorjahr {year}',
    footer: 'Diese E-Mail wurde automatisch von {org} versendet.',
  },
  en: {
    subject: 'Donor letter {org} – {year}',
    greeting: 'Hi {name}',
    intro: 'Please find our donor letter for the {year} season attached. Here is your current donation status:',
    groupLine: 'You are in the group {group} – together with {members}.',
    groupLineSolo: 'You are in the group {group}.',
    target: 'Target',
    collected: 'Collected',
    remaining: 'Open',
    ofTarget: '{pct}% of target reached',
    button: 'View my status',
    attachments: 'Attached: the donor letter (PDF) and your address list (CSV).',
    sponsorsTitle: 'Your patrons',
    sponsorsLastYear: 'Prev. year {year}',
    footer: 'This email was sent automatically by {org}.',
  },
  fr: {
    subject: 'Lettre aux donateurs {org} – {year}',
    greeting: 'Salut {name}',
    intro: 'Vous trouverez en pièce jointe notre lettre aux donateurs pour la saison {year}. Voici votre état actuel des dons :',
    groupLine: 'Tu fais partie du groupe {group} – avec {members}.',
    groupLineSolo: 'Tu fais partie du groupe {group}.',
    target: 'Objectif',
    collected: 'Récolté',
    remaining: 'Restant',
    ofTarget: '{pct}% de l’objectif atteint',
    button: 'Voir mon statut',
    attachments: 'En pièce jointe : la lettre aux donateurs (PDF) et ta liste d’adresses (CSV).',
    sponsorsTitle: 'Tes donateurs',
    sponsorsLastYear: 'Année préc. {year}',
    footer: 'Cet e-mail a été envoyé automatiquement par {org}.',
  },
  it: {
    subject: 'Lettera ai donatori {org} – {year}',
    greeting: 'Ciao {name}',
    intro: 'In allegato trovi la nostra lettera ai donatori per la stagione {year}. Ecco lo stato attuale delle donazioni:',
    groupLine: 'Fai parte del gruppo {group} – insieme a {members}.',
    groupLineSolo: 'Fai parte del gruppo {group}.',
    target: 'Obiettivo',
    collected: 'Raccolto',
    remaining: 'Aperto',
    ofTarget: '{pct}% dell’obiettivo raggiunto',
    button: 'Vedi il mio stato',
    attachments: 'In allegato: la lettera ai donatori (PDF) e il tuo elenco indirizzi (CSV).',
    sponsorsTitle: 'I tuoi donatori',
    sponsorsLastYear: 'Anno prec. {year}',
    footer: 'Questa e-mail è stata inviata automaticamente da {org}.',
  },
}

function fill(tpl: string, vars: Record<string, string | number>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''))
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function renderStatusEmail(data: StatusEmailData): {
  subject: string
  html: string
  text: string
} {
  const locale = data.locale && STRINGS[data.locale] ? data.locale : 'de'
  const s = STRINGS[locale]
  const intlLocale = LOCALE_MAP[locale]
  const money = (n: number) =>
    new Intl.NumberFormat(intlLocale, {
      style: 'currency',
      currency: 'CHF',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(n)

  const vars = { org: data.orgName, year: data.fiscalYearName, name: data.firstName, pct: data.progress.percentage }
  const subject = fill(s.subject, vars)
  const pct = Math.min(100, Math.max(0, data.progress.percentage))

  // Optional group line (other members, first names only)
  const groupText = data.groupInfo
    ? data.groupInfo.memberNames.length > 0
      ? fill(s.groupLine, { group: data.groupInfo.name, members: data.groupInfo.memberNames.join(', ') })
      : fill(s.groupLineSolo, { group: data.groupInfo.name })
    : ''
  const groupHtml = groupText
    ? `<p style="margin:0 0 18px;font-size:14px;line-height:1.5;color:#414d5b;background:#fff6ec;border-left:3px solid ${BRAND_ORANGE};padding:10px 12px;border-radius:6px;">
         ${escapeHtml(groupText)}
       </p>`
    : ''

  // Optional sponsor list with previous-year amounts
  const sponsorRows = data.sponsors
    .map(
      (sp) => `<tr>
        <td style="padding:7px 0;border-bottom:1px solid #edf0f4;font-size:14px;color:#414d5b;">${escapeHtml(sp.name)}</td>
        <td align="right" style="padding:7px 0;border-bottom:1px solid #edf0f4;font-size:14px;font-weight:600;color:#16202c;white-space:nowrap;">${sp.lastYearAmount > 0 ? escapeHtml(money(sp.lastYearAmount)) : '–'}</td>
      </tr>`
    )
    .join('')
  const sponsorsHeading = data.previousYearName
    ? `${s.sponsorsTitle} · ${fill(s.sponsorsLastYear, { year: data.previousYearName })}`
    : s.sponsorsTitle
  const sponsorsHtml =
    data.sponsors.length > 0
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:26px 0 0;">
           <tr><td style="padding-bottom:8px;font-size:14px;font-weight:700;color:#16202c;">${escapeHtml(sponsorsHeading)}</td></tr>
         </table>
         <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${sponsorRows}</table>`
      : ''

  const html = `<!doctype html>
<html lang="${locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f9;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;">
  <tr>
    <td align="center" style="padding:24px 12px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background:#ffffff;border-radius:12px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
        <!-- header -->
        <tr>
          <td style="background:${BRAND_ORANGE};padding:20px 28px;color:#ffffff;font-size:19px;font-weight:800;letter-spacing:-0.01em;">
            ${escapeHtml(data.orgName)}
          </td>
        </tr>
        <!-- body -->
        <tr>
          <td style="padding:28px;color:#1f2a37;">
            <p style="margin:0 0 12px;font-size:18px;font-weight:700;color:#16202c;">${escapeHtml(fill(s.greeting, vars))}</p>
            <p style="margin:0 0 18px;font-size:15px;line-height:1.55;color:#414d5b;">${escapeHtml(fill(s.intro, vars))}</p>
            ${groupHtml}

            <!-- stats -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;">
              <tr>
                <td width="33%" align="center" style="padding:12px 6px;background:#f6f8fb;border-radius:8px;">
                  <div style="font-size:13px;color:#77828f;">${escapeHtml(s.target)}</div>
                  <div style="font-size:20px;font-weight:700;color:#16202c;padding-top:4px;">${escapeHtml(money(data.progress.target))}</div>
                </td>
                <td width="8">&nbsp;</td>
                <td width="33%" align="center" style="padding:12px 6px;background:#eaf3ec;border-radius:8px;">
                  <div style="font-size:13px;color:#5c7a63;">${escapeHtml(s.collected)}</div>
                  <div style="font-size:20px;font-weight:700;color:#1a7a3c;padding-top:4px;">${escapeHtml(money(data.progress.collected))}</div>
                </td>
                <td width="8">&nbsp;</td>
                <td width="33%" align="center" style="padding:12px 6px;background:#fbeaea;border-radius:8px;">
                  <div style="font-size:13px;color:#8a5c5c;">${escapeHtml(s.remaining)}</div>
                  <div style="font-size:20px;font-weight:700;color:#b02a2a;padding-top:4px;">${escapeHtml(money(data.progress.remaining))}</div>
                </td>
              </tr>
            </table>

            <!-- progress bar -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 6px;">
              <tr>
                <td style="background:#e6ebf2;border-radius:999px;padding:0;">
                  <table role="presentation" width="${pct}%" cellpadding="0" cellspacing="0" style="min-width:8px;">
                    <tr><td style="background:${BRAND_ORANGE};border-radius:999px;height:12px;line-height:12px;font-size:0;">&nbsp;</td></tr>
                  </table>
                </td>
              </tr>
            </table>
            <p style="margin:0 0 24px;font-size:13px;color:#77828f;">${escapeHtml(fill(s.ofTarget, vars))}</p>

            <!-- button -->
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 8px;">
              <tr>
                <td align="center" style="background:${BRAND_ORANGE};border-radius:8px;">
                  <a href="${escapeHtml(data.statusUrl)}" target="_blank"
                     style="display:inline-block;padding:14px 26px;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;">
                    ${escapeHtml(s.button)} &rarr;
                  </a>
                </td>
              </tr>
            </table>

            ${sponsorsHtml}

            ${data.attachmentsNote ? `<p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#77828f;">📎 ${escapeHtml(s.attachments)}</p>` : ''}
          </td>
        </tr>
        <!-- footer -->
        <tr>
          <td style="padding:18px 28px;background:#f6f8fb;color:#9aa4b0;font-size:12px;line-height:1.5;">
            ${escapeHtml(fill(s.footer, vars))}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`

  const textLines = [
    fill(s.greeting, vars),
    '',
    fill(s.intro, vars),
  ]
  if (groupText) {
    textLines.push('', groupText)
  }
  textLines.push(
    '',
    `${s.target}: ${money(data.progress.target)}`,
    `${s.collected}: ${money(data.progress.collected)}`,
    `${s.remaining}: ${money(data.progress.remaining)}`,
    fill(s.ofTarget, vars),
    '',
    `${s.button}: ${data.statusUrl}`
  )
  if (data.sponsors.length > 0) {
    textLines.push('', sponsorsHeading)
    for (const sp of data.sponsors) {
      textLines.push(`  ${sp.name}: ${sp.lastYearAmount > 0 ? money(sp.lastYearAmount) : '–'}`)
    }
  }
  if (data.attachmentsNote) textLines.push('', s.attachments)
  textLines.push('', fill(s.footer, vars))

  return { subject, html, text: textLines.join('\n') }
}
