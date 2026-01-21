'use client'

import { useEffect, useState, use } from 'react'
import { Container, Card, ProgressBar, Table, Alert, Badge, Spinner, Accordion } from 'react-bootstrap'
import { NextIntlClientProvider } from 'next-intl'
import { useTranslations } from 'next-intl'
import { detectBrowserLocale } from '@/lib/i18n/utils'
import { type Locale } from '@/lib/i18n/config'

interface InKindDonation {
  description: string
  date: string
}

interface SponsorData {
  name: string
  donated: boolean
  donatedLastYear: boolean
  isLYBUNT: boolean
  totalAmount: number
  lastDonation: string | null
  inKindDonations: InKindDonation[]
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

  // Render sponsor tables for a member
  const renderSponsorTables = (sponsors: SponsorData[]) => {
    const donatedSponsors = sponsors.filter(s => s.donated)
    const notDonatedSponsors = sponsors.filter(s => !s.donated)

    // Collect all in-kind donations
    const allInKindDonations = sponsors.flatMap(s =>
      s.inKindDonations.map(d => ({ ...d, sponsorName: s.name }))
    )

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
                    {donatedSponsors.map((sponsor, index) => (
                      <tr key={index}>
                        <td className="align-middle">{sponsor.name}</td>
                        <td className="text-end align-middle">{formatCurrency(sponsor.totalAmount)}</td>
                        <td className="text-end align-middle d-none d-sm-table-cell">
                          {sponsor.lastDonation ? formatDate(sponsor.lastDonation) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
          </Card.Body>
        </Card>

        {/* In-Kind Donations */}
        {allInKindDonations.length > 0 && (
          <Card className="mb-3">
            <Card.Header className="bg-info text-white py-2">
              <h2 className="h6 mb-0">
                {t('inKindDonations')} ({allInKindDonations.length})
              </h2>
            </Card.Header>
            <Card.Body className="p-0">
              <div className="table-responsive">
                <Table className="mb-0" size="sm">
                  <thead>
                    <tr>
                      <th>{t('name')}</th>
                      <th>{t('description')}</th>
                      <th className="text-end d-none d-sm-table-cell">{t('date')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allInKindDonations.map((donation, index) => (
                      <tr key={index}>
                        <td className="align-middle">{donation.sponsorName}</td>
                        <td className="align-middle">{donation.description}</td>
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

        {/* Not Yet Donated Sponsors */}
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
              <div className="table-responsive">
                <Table className="mb-0" size="sm">
                  <thead>
                    <tr>
                      <th>{t('name')}</th>
                      <th className="text-end"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {notDonatedSponsors.map((sponsor, index) => (
                      <tr key={index} className={sponsor.isLYBUNT ? 'table-warning' : ''}>
                        <td className="align-middle">
                          {sponsor.name}
                          {sponsor.isLYBUNT && (
                            <Badge bg="warning" text="dark" className="ms-2 lybunt-badge">
                              {t('lybunt')}
                            </Badge>
                          )}
                        </td>
                        <td className="text-end align-middle">
                          {sponsor.isLYBUNT && (
                            <span className="text-warning d-sm-none">!</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
          </Card.Body>
        </Card>
      </>
    )
  }

  return (
    <Container className="py-3 status-page">
      {/* Header */}
      <Card className="mb-3 border-0 bg-primary text-white">
        <Card.Body className="py-3">
          <h1 className="h4 mb-1">{data.name}</h1>
          <small className="opacity-75">
            {t('fiscalYear')}: {data.fiscalYear.name}
          </small>
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
              {renderSponsorTables(data.groupSponsors)}
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
                    <div className="d-flex justify-content-between align-items-center w-100 me-2">
                      <strong>{member.name}</strong>
                      <span className="text-muted small">
                        {formatCurrency(member.progress.actual)} / {formatCurrency(member.progress.target)}
                      </span>
                    </div>
                  </Accordion.Header>
                  <Accordion.Body>
                    {member.sponsors.length === 0 ? (
                      <p className="text-muted text-center py-3 mb-0">{t('noSponsors')}</p>
                    ) : (
                      renderSponsorTables(member.sponsors)
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
          {data.sponsors && renderSponsorTables(data.sponsors)}
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
