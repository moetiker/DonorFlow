'use client'

import { useEffect, useState, use, Fragment } from 'react'
import { Container, Card, ProgressBar, Table, Alert, Spinner, Accordion } from 'react-bootstrap'
import { NextIntlClientProvider } from 'next-intl'
import { useTranslations } from 'next-intl'
import { detectBrowserLocale } from '@/lib/i18n/utils'
import { type Locale } from '@/lib/i18n/config'

interface InKindDonation {
  description: string
  date: string
}

interface DonationHistoryEntry {
  date: string
  type: 'MONETARY' | 'IN_KIND'
  amount: number | null
  description: string | null
  fiscalYearName: string
}

interface SponsorData {
  name: string
  phone: string | null
  email: string | null
  donated: boolean
  donatedLastYear: boolean
  isLYBUNT: boolean
  totalAmount: number
  lastDonation: string | null
  inKindDonations: InKindDonation[]
  history: DonationHistoryEntry[]
}

interface MemberData {
  id: string
  name: string
  progress: {
    target: number
    actual: number
    percentage: number
  }
  sponsors: SponsorData[]
}

interface StatusData {
  type: 'member' | 'group'
  name: string
  fiscalYear: {
    name: string
    startDate: string
    endDate: string
  } | null
  progress: {
    target: number
    actual: number
    percentage: number
  }
  sponsors?: SponsorData[]
  members?: MemberData[]
  groupSponsors?: SponsorData[]
}

interface PageProps {
  params: Promise<{ token: string }>
}

// Inner component that uses translations
function StatusPageContent({ token }: { token: string }) {
  const t = useTranslations('status')
  const [data, setData] = useState<StatusData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [locale, setLocale] = useState<Locale>('de')
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  const toggleHistory = (key: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  useEffect(() => {
    // Detect browser locale
    const detectedLocale = detectBrowserLocale()
    setLocale(detectedLocale)
  }, [])

  useEffect(() => {
    async function fetchStatus() {
      try {
        const response = await fetch(`/api/public/status/${token}`)
        if (!response.ok) {
          if (response.status === 404) {
            setError('notFound')
          } else {
            setError('generic')
          }
          return
        }
        const statusData = await response.json()
        setData(statusData)
      } catch (err) {
        console.error('Error fetching status:', err)
        setError('generic')
      } finally {
        setLoading(false)
      }
    }

    fetchStatus()
  }, [token])

  // Format currency based on locale
  const formatCurrency = (amount: number): string => {
    const localeMap: Record<Locale, string> = {
      de: 'de-CH',
      en: 'en-US',
      fr: 'fr-FR',
      it: 'it-IT'
    }
    return new Intl.NumberFormat(localeMap[locale], {
      style: 'currency',
      currency: 'CHF',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  // Format date based on locale
  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr)
    const localeMap: Record<Locale, string> = {
      de: 'de-CH',
      en: 'en-US',
      fr: 'fr-FR',
      it: 'it-IT'
    }
    return new Intl.DateTimeFormat(localeMap[locale], {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(date)
  }

  if (loading) {
    return (
      <Container className="py-4 text-center">
        <Spinner animation="border" role="status" className="mb-3" />
        <p className="text-muted">{t('loading')}</p>
      </Container>
    )
  }

  if (error === 'notFound') {
    return (
      <Container className="py-4">
        <Alert variant="warning">
          <Alert.Heading>{t('notFound')}</Alert.Heading>
          <p className="mb-0">{t('notFoundDescription')}</p>
        </Alert>
      </Container>
    )
  }

  if (error || !data) {
    return (
      <Container className="py-4">
        <Alert variant="danger">
          <Alert.Heading>{t('notFound')}</Alert.Heading>
          <p className="mb-0">{t('notFoundDescription')}</p>
        </Alert>
      </Container>
    )
  }

  if (!data.fiscalYear) {
    return (
      <Container className="py-4">
        <Alert variant="info">
          <Alert.Heading>{t('noFiscalYear')}</Alert.Heading>
          <p className="mb-0">{t('noFiscalYearDescription')}</p>
        </Alert>
      </Container>
    )
  }

  const remaining = Math.max(0, data.progress.target - data.progress.actual)

  // Collect ALL in-kind donations across all sponsors (group + members)
  const collectAllInKindDonations = () => {
    const allDonations: { description: string; date: string; sponsorName: string; memberName?: string }[] = []

    if (data.type === 'group') {
      // Group sponsors
      data.groupSponsors?.forEach(sponsor => {
        sponsor.inKindDonations.forEach(d => {
          allDonations.push({ ...d, sponsorName: sponsor.name })
        })
      })
      // Member sponsors
      data.members?.forEach(member => {
        member.sponsors.forEach(sponsor => {
          sponsor.inKindDonations.forEach(d => {
            allDonations.push({ ...d, sponsorName: sponsor.name, memberName: member.name })
          })
        })
      })
    } else {
      // Member view - just their sponsors
      data.sponsors?.forEach(sponsor => {
        sponsor.inKindDonations.forEach(d => {
          allDonations.push({ ...d, sponsorName: sponsor.name })
        })
      })
    }

    return allDonations.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }

  const allInKindDonations = collectAllInKindDonations()

  // Determine progress bar color
  const getProgressVariant = (percentage: number) => {
    if (percentage >= 100) return 'success'
    if (percentage >= 75) return 'info'
    if (percentage >= 50) return 'warning'
    return 'danger'
  }

  // Render the expandable donation-history detail row for a sponsor
  const renderHistoryRow = (sponsor: SponsorData, rowKey: string, colSpan: number) => {
    if (!expandedRows.has(rowKey) || sponsor.history.length === 0) return null
    return (
      <tr>
        <td colSpan={colSpan} className="p-0 border-0">
          <div className="px-3 py-2 bg-light">
            <div className="small fw-bold text-muted mb-1">{t('donationHistory')}</div>
            <Table size="sm" borderless className="mb-0">
              <thead>
                <tr className="small text-muted">
                  <th>{t('date')}</th>
                  <th className="text-end">{t('amount')}</th>
                  <th className="text-end">{t('fiscalYear')}</th>
                </tr>
              </thead>
              <tbody>
                {sponsor.history.map((h, i) => (
                  <tr key={i}>
                    <td className="align-middle">{formatDate(h.date)}</td>
                    <td className="text-end align-middle">
                      {h.type === 'IN_KIND'
                        ? <>🎁 {h.description || '-'}</>
                        : formatCurrency(h.amount ?? 0)}
                    </td>
                    <td className="text-end align-middle text-muted small">
                      {h.fiscalYearName || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </td>
      </tr>
    )
  }

  // Render one "not yet donated" sponsor as a mobile row: name + last-donation
  // hint on the left, a touch-sized call/email button on the right. No expanding.
  const renderNotDonatedRow = (sponsor: SponsorData, rowKey: string) => {
    const lastMonetary = sponsor.history.find(h => h.type === 'MONETARY' && h.amount != null)
    const meta = lastMonetary
      ? t('lastDonated', {
          amount: formatCurrency(lastMonetary.amount ?? 0),
          year: lastMonetary.fiscalYearName || '—'
        })
      : t('neverDonated')
    const tel = sponsor.phone?.replace(/\s+/g, '')

    return (
      <div key={rowKey} className="d-flex align-items-center gap-2 px-3 border-top not-donated-row">
        <div className="flex-grow-1 min-w-0">
          <div className="fw-semibold text-truncate">{sponsor.name}</div>
          <div className="small text-muted">{meta}</div>
        </div>
        {tel ? (
          <a
            href={`tel:${tel}`}
            className="btn btn-outline-secondary rounded-circle contact-btn flex-shrink-0"
            aria-label={t('callSponsor', { name: sponsor.name })}
          >
            <i className="bi bi-telephone" />
          </a>
        ) : sponsor.email ? (
          <a
            href={`mailto:${sponsor.email}`}
            className="btn btn-outline-secondary rounded-circle contact-btn flex-shrink-0"
            aria-label={t('emailSponsor', { name: sponsor.name })}
          >
            <i className="bi bi-envelope" />
          </a>
        ) : null}
      </div>
    )
  }

  // Render sponsor tables for a member (in-kind donations are shown in top-level section)
  const renderSponsorTables = (sponsors: SponsorData[], keyPrefix: string) => {
    const donatedSponsors = sponsors.filter(s => s.donated)
    const notDonatedSponsors = sponsors.filter(s => !s.donated)
    // Variant B: "follow up" (donated last year) first, then everyone else.
    const followUpSponsors = notDonatedSponsors.filter(s => s.isLYBUNT)
    const otherSponsors = notDonatedSponsors.filter(s => !s.isLYBUNT)

    return (
      <>
        {/* Donated Sponsors */}
        <Card className="mb-3">
          <Card.Header className="bg-success text-white py-2">
            <h2 className="h6 mb-0">
              {t('sponsorsWhoDonated')} ({donatedSponsors.length})
            </h2>
          </Card.Header>
          <Card.Body className="p-0">
            {donatedSponsors.length === 0 ? (
              <p className="text-muted text-center py-3 mb-0">{t('noDonationsYet')}</p>
            ) : (
              <div className="table-responsive">
                <Table className="mb-0" size="sm">
                  <thead>
                    <tr>
                      <th>{t('name')}</th>
                      <th className="text-end">{t('amount')}</th>
                      <th className="text-end d-none d-sm-table-cell">{t('date')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {donatedSponsors.map((sponsor, index) => {
                      const rowKey = `${keyPrefix}-d-${index}`
                      const hasHistory = sponsor.history.length > 0
                      const isOpen = expandedRows.has(rowKey)
                      return (
                        <Fragment key={index}>
                          <tr
                            onClick={hasHistory ? () => toggleHistory(rowKey) : undefined}
                            style={hasHistory ? { cursor: 'pointer' } : undefined}
                          >
                            <td className="align-middle">
                              {hasHistory && (
                                <i className={`bi bi-chevron-${isOpen ? 'down' : 'right'} me-1 small`} />
                              )}
                              {sponsor.name}
                            </td>
                            <td className="text-end align-middle">{formatCurrency(sponsor.totalAmount)}</td>
                            <td className="text-end align-middle d-none d-sm-table-cell">
                              {sponsor.lastDonation ? formatDate(sponsor.lastDonation) : '-'}
                            </td>
                          </tr>
                          {renderHistoryRow(sponsor, rowKey, 3)}
                        </Fragment>
                      )
                    })}
                  </tbody>
                </Table>
              </div>
            )}
          </Card.Body>
        </Card>

        {/* Not Yet Donated Sponsors — Variant B: grouped by urgency, no expanding */}
        <Card className="mb-3">
          <Card.Header className="bg-secondary text-white py-2">
            <h2 className="h6 mb-0">
              {t('sponsorsNotYetDonated')} ({notDonatedSponsors.length})
            </h2>
          </Card.Header>
          <Card.Body className="p-0">
            {notDonatedSponsors.length === 0 ? (
              <p className="text-success text-center py-3 mb-0 fw-bold">{t('allDonated')}</p>
            ) : (
              <>
                {followUpSponsors.length > 0 && (
                  <>
                    <div className="px-3 py-1 small fw-bold text-uppercase bg-warning-subtle text-warning-emphasis">
                      {t('followUp')} ({followUpSponsors.length})
                    </div>
                    {followUpSponsors.map((sponsor, index) =>
                      renderNotDonatedRow(sponsor, `${keyPrefix}-fu-${index}`)
                    )}
                  </>
                )}
                {otherSponsors.length > 0 && (
                  <>
                    <div className="px-3 py-1 small fw-bold text-uppercase bg-light text-muted">
                      {t('others')} ({otherSponsors.length})
                    </div>
                    {otherSponsors.map((sponsor, index) =>
                      renderNotDonatedRow(sponsor, `${keyPrefix}-ot-${index}`)
                    )}
                  </>
                )}
              </>
            )}
          </Card.Body>
        </Card>
      </>
    )
  }

  return (
    <Container className="py-3 status-page">
      {/* Header */}
      <Card className="mb-3 border-0 text-white" style={{ backgroundColor: '#EA7600' }}>
        <Card.Body className="py-3 d-flex justify-content-between align-items-center flex-wrap gap-2">
          <div>
            <h1 className="h4 mb-1">{data.name}</h1>
            <small className="opacity-75">
              {t('fiscalYear')}: {data.fiscalYear.name}
            </small>
          </div>
          <a
            href={`/api/public/status/${token}/export`}
            className="btn btn-light btn-sm text-nowrap"
          >
            <i className="bi bi-download me-1" />
            {t('csvDownload')}
          </a>
        </Card.Body>
      </Card>

      {/* Progress Section */}
      <Card className="mb-3">
        <Card.Body>
          <div className="d-flex justify-content-between mb-2">
            <div className="text-center flex-fill">
              <div className="h5 mb-0">{formatCurrency(data.progress.target)}</div>
              <small className="text-muted">{t('target')}</small>
            </div>
            <div className="text-center flex-fill">
              <div className="h5 mb-0 text-success">{formatCurrency(data.progress.actual)}</div>
              <small className="text-muted">{t('collected')}</small>
            </div>
            <div className="text-center flex-fill">
              <div className="h5 mb-0 text-danger">{formatCurrency(remaining)}</div>
              <small className="text-muted">{t('remaining')}</small>
            </div>
          </div>

          <ProgressBar
            now={Math.min(data.progress.percentage, 100)}
            variant={getProgressVariant(data.progress.percentage)}
            className="mb-2"
            style={{ height: '1.5rem' }}
          />

          <div className="text-center">
            <strong>{data.progress.percentage}%</strong>{' '}
            <span className="text-muted">{t('progress')}</span>
          </div>
        </Card.Body>
      </Card>

      {/* In-Kind Donations Summary - shown prominently if any exist */}
      {allInKindDonations.length > 0 && (
        <Card className="mb-3 border-info">
          <Card.Header className="bg-info text-white">
            <h2 className="h5 mb-0">
              🎁 {t('inKindDonations')} ({allInKindDonations.length})
            </h2>
          </Card.Header>
          <Card.Body className="p-0">
            <div className="table-responsive">
              <Table className="mb-0" hover>
                <thead className="table-light">
                  <tr>
                    <th>{t('name')}</th>
                    <th>{t('description')}</th>
                    {data.type === 'group' && <th className="d-none d-md-table-cell">{t('from')}</th>}
                    <th className="text-end d-none d-sm-table-cell">{t('date')}</th>
                  </tr>
                </thead>
                <tbody>
                  {allInKindDonations.map((donation, index) => (
                    <tr key={index}>
                      <td className="align-middle">{donation.sponsorName}</td>
                      <td className="align-middle fw-medium">{donation.description}</td>
                      {data.type === 'group' && (
                        <td className="align-middle text-muted d-none d-md-table-cell">
                          {donation.memberName || t('groupDirect')}
                        </td>
                      )}
                      <td className="text-end align-middle d-none d-sm-table-cell">
                        {formatDate(donation.date)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </Card.Body>
        </Card>
      )}

      {/* Member or Group View */}
      {data.type === 'group' ? (
        <>
          {/* Group-level sponsors section */}
          {data.groupSponsors && data.groupSponsors.length > 0 && (
            <>
              <h3 className="h5 mt-4 mb-3">{t('groupSponsors')}</h3>
              {renderSponsorTables(data.groupSponsors, 'group')}
            </>
          )}

          {/* Members section */}
          <h3 className="h5 mt-4 mb-3">{t('groupMembers')}</h3>
          {!data.members || data.members.length === 0 ? (
            <Alert variant="info">{t('noMembers')}</Alert>
          ) : (
            <Accordion alwaysOpen>
              {data.members.map((member) => (
                <Accordion.Item key={member.id} eventKey={member.id}>
                  <Accordion.Header>
                    <strong>{member.name}</strong>
                  </Accordion.Header>
                  <Accordion.Body>
                    {member.sponsors.length === 0 ? (
                      <p className="text-muted text-center py-3 mb-0">{t('noSponsors')}</p>
                    ) : (
                      renderSponsorTables(member.sponsors, `member-${member.id}`)
                    )}
                  </Accordion.Body>
                </Accordion.Item>
              ))}
            </Accordion>
          )}
        </>
      ) : (
        <>
          {/* Member view - show sponsors directly */}
          {data.sponsors && renderSponsorTables(data.sponsors, 'member')}
        </>
      )}

      {/* Footer */}
      <p className="text-center text-muted small mb-0">
        {t('footer')} {data.name}
      </p>
    </Container>
  )
}

// Main page component that loads messages dynamically
export default function StatusPage({ params }: PageProps) {
  const { token } = use(params)
  const [messages, setMessages] = useState<Record<string, unknown> | null>(null)
  const [locale, setLocale] = useState<Locale>('de')

  useEffect(() => {
    async function loadMessages() {
      const detectedLocale = detectBrowserLocale()
      setLocale(detectedLocale)

      try {
        const msgs = await import(`@/messages/${detectedLocale}.json`)
        setMessages(msgs.default)
      } catch {
        // Fallback to German
        const msgs = await import('@/messages/de.json')
        setMessages(msgs.default)
      }
    }

    loadMessages()
  }, [])

  if (!messages) {
    return (
      <Container className="py-4 text-center">
        <Spinner animation="border" role="status" />
      </Container>
    )
  }

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <StatusPageContent token={token} />
    </NextIntlClientProvider>
  )
}
