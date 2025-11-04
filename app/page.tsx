'use client'

import { Container, Row, Col, Card, ProgressBar } from 'react-bootstrap'
import { Navbar } from '@/components/Navbar'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useOrganization } from '@/lib/useOrganization'
import { useTranslations } from 'next-intl'
import { useLocalizedFormatters } from '@/lib/i18n/formatters'

type Stats = {
  memberCount: number
  groupCount: number
  sponsorCount: number
  donationCount: number
  donationSum: number
  currentYear: { id: string; name: string } | null
  performance: {
    totalTarget: number
    totalActual: number
    memberActual: number
    groupActual: number
    unassignedTotal: number
    difference: number
    percentage: number
  }
}

export default function DashboardPage() {
  const { organizationName } = useOrganization()
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const t = useTranslations('dashboard')
  const tCommon = useTranslations('common')
  const tErrors = useTranslations('errors')
  const { formatCurrency } = useLocalizedFormatters()

  useEffect(() => {
    fetchStats()
  }, [])

  async function fetchStats() {
    try {
      const response = await fetch('/api/dashboard/stats')
      const data = await response.json()
      setStats(data)
    } catch (error) {
      console.error('Error fetching stats:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <>
        <Navbar />
        <Container>
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">{tCommon('loading')}</span>
            </div>
          </div>
        </Container>
      </>
    )
  }

  if (!stats) {
    return (
      <>
        <Navbar />
        <Container>
          <div className="alert alert-danger">{tErrors('loadingFailed')}</div>
        </Container>
      </>
    )
  }

  return (
    <>
      <Navbar />
      <Container>
        <div className="d-flex align-items-center justify-content-between mb-4">
          <h1 className="mb-0">{t('title')}</h1>
          <span className="text-muted">{organizationName}</span>
        </div>

        {stats.currentYear && (
          <div className="alert alert-info mb-4">
            <i className="bi bi-calendar-check me-2"></i>
            {t('currentFiscalYear')}: <strong>{stats.currentYear.name}</strong>
          </div>
        )}

        {!stats.currentYear && (
          <div className="alert alert-warning mb-4">
            <i className="bi bi-exclamation-triangle me-2"></i>
            {t('noActiveFiscalYear')}{' '}
            <Link href="/fiscal-years" className="alert-link">
              {t('createFiscalYear')}
            </Link>
            .
          </div>
        )}

        <Row className="g-4">
          <Col md={6} lg={3}>
            <Card className="h-100">
              <Card.Body>
                <div className="d-flex align-items-center">
                  <div className="flex-shrink-0">
                    <div className="bg-primary bg-opacity-10 p-3 rounded">
                      <i className="bi bi-person fs-3 text-primary"></i>
                    </div>
                  </div>
                  <div className="flex-grow-1 ms-3">
                    <h6 className="text-muted mb-1">{t('memberCount')}</h6>
                    <h3 className="mb-0">{stats.memberCount}</h3>
                  </div>
                </div>
              </Card.Body>
              <Card.Footer className="bg-transparent">
                <Link href="/members" className="text-decoration-none">
                  {t('manage')} <i className="bi bi-arrow-right"></i>
                </Link>
              </Card.Footer>
            </Card>
          </Col>

          <Col md={6} lg={3}>
            <Card className="h-100">
              <Card.Body>
                <div className="d-flex align-items-center">
                  <div className="flex-shrink-0">
                    <div className="bg-success bg-opacity-10 p-3 rounded">
                      <i className="bi bi-people-fill fs-3 text-success"></i>
                    </div>
                  </div>
                  <div className="flex-grow-1 ms-3">
                    <h6 className="text-muted mb-1">{t('groupCount')}</h6>
                    <h3 className="mb-0">{stats.groupCount}</h3>
                  </div>
                </div>
              </Card.Body>
              <Card.Footer className="bg-transparent">
                <Link href="/groups" className="text-decoration-none">
                  {t('manage')} <i className="bi bi-arrow-right"></i>
                </Link>
              </Card.Footer>
            </Card>
          </Col>

          <Col md={6} lg={3}>
            <Card className="h-100">
              <Card.Body>
                <div className="d-flex align-items-center">
                  <div className="flex-shrink-0">
                    <div className="bg-danger bg-opacity-10 p-3 rounded">
                      <i className="bi bi-heart fs-3 text-danger"></i>
                    </div>
                  </div>
                  <div className="flex-grow-1 ms-3">
                    <h6 className="text-muted mb-1">{t('sponsorCount')}</h6>
                    <h3 className="mb-0">{stats.sponsorCount}</h3>
                  </div>
                </div>
              </Card.Body>
              <Card.Footer className="bg-transparent">
                <Link href="/sponsors" className="text-decoration-none">
                  {t('manage')} <i className="bi bi-arrow-right"></i>
                </Link>
              </Card.Footer>
            </Card>
          </Col>

          <Col md={6} lg={3}>
            <Card className="h-100">
              <Card.Body>
                <div className="d-flex align-items-center">
                  <div className="flex-shrink-0">
                    <div className="bg-warning bg-opacity-10 p-3 rounded">
                      <i className="bi bi-cash-coin fs-3 text-warning"></i>
                    </div>
                  </div>
                  <div className="flex-grow-1 ms-3">
                    <h6 className="text-muted mb-1">{t('donationsCurrent')}</h6>
                    <h3 className="mb-0">{stats.donationCount}</h3>
                    <small className="text-muted">{formatCurrency(stats.donationSum)}</small>
                  </div>
                </div>
              </Card.Body>
              <Card.Footer className="bg-transparent">
                <Link href="/donations" className="text-decoration-none">
                  {t('manage')} <i className="bi bi-arrow-right"></i>
                </Link>
              </Card.Footer>
            </Card>
          </Col>
        </Row>

        {/* Performance Overview */}
        {stats.currentYear && stats.performance.totalTarget > 0 && (
          <Row className="mt-4">
            <Col>
              <Card>
                <Card.Header className="d-flex justify-content-between align-items-center">
                  <h5 className="mb-0">{t('performanceOverview')}</h5>
                  <Link href="/reports/performance" className="btn btn-sm btn-outline-primary">
                    {t('details')} <i className="bi bi-arrow-right"></i>
                  </Link>
                </Card.Header>
                <Card.Body>
                  <Row className="g-3 mb-3">
                    <Col md={3}>
                      <div className="text-muted small">{t('targetTotal')}</div>
                      <div className="h4">{formatCurrency(stats.performance.totalTarget)}</div>
                    </Col>
                    <Col md={3}>
                      <div className="text-muted small">{t('actualTotal')}</div>
                      <div className={`h4 ${stats.performance.totalActual >= stats.performance.totalTarget ? 'text-success' : 'text-warning'}`}>
                        {formatCurrency(stats.performance.totalActual)}
                      </div>
                      <div className="small text-muted">
                        {t('membersLabel')}: {formatCurrency(stats.performance.memberActual)}<br />
                        {t('groupsLabel')}: {formatCurrency(stats.performance.groupActual)}
                        {stats.performance.unassignedTotal > 0 && (
                          <><br />{t('unassignedLabel')}: {formatCurrency(stats.performance.unassignedTotal)}</>
                        )}
                      </div>
                    </Col>
                    <Col md={3}>
                      <div className="text-muted small">{t('difference')}</div>
                      <div className={`h4 ${stats.performance.difference >= 0 ? 'text-success' : 'text-danger'}`}>
                        {formatCurrency(stats.performance.difference)}
                      </div>
                    </Col>
                    <Col md={3}>
                      <div className="text-muted small">{t('achievement')}</div>
                      <div className="h4">{stats.performance.percentage.toFixed(1)}%</div>
                    </Col>
                  </Row>
                  <ProgressBar
                    now={Math.min(stats.performance.percentage, 100)}
                    variant={
                      stats.performance.totalActual >= stats.performance.totalTarget ? 'success' :
                      stats.performance.percentage >= 75 ? 'warning' : 'danger'
                    }
                    style={{ height: '30px' }}
                    label={`${stats.performance.percentage.toFixed(1)}%`}
                  />
                </Card.Body>
              </Card>
            </Col>
          </Row>
        )}

        <Row className="mt-4">
          <Col lg={6}>
            <Card>
              <Card.Header>
                <h5 className="mb-0">{t('quickAccess')}</h5>
              </Card.Header>
              <Card.Body>
                <div className="list-group list-group-flush">
                  <Link href="/donations" className="list-group-item list-group-item-action">
                    <i className="bi bi-plus-circle me-2 text-primary"></i>
                    {t('newDonation')}
                  </Link>
                  <Link href="/members" className="list-group-item list-group-item-action">
                    <i className="bi bi-person-plus me-2 text-primary"></i>
                    {t('newMember')}
                  </Link>
                  <Link href="/sponsors" className="list-group-item list-group-item-action">
                    <i className="bi bi-heart-fill me-2 text-primary"></i>
                    {t('newSponsor')}
                  </Link>
                  <Link href="/reports" className="list-group-item list-group-item-action">
                    <i className="bi bi-graph-up me-2 text-primary"></i>
                    {t('viewReportsAction')}
                  </Link>
                </div>
              </Card.Body>
            </Card>
          </Col>

          <Col lg={6}>
            <Card>
              <Card.Header>
                <h5 className="mb-0">{t('gettingStarted')}</h5>
              </Card.Header>
              <Card.Body>
                <ol className="mb-0">
                  <li className="mb-2">
                    <Link href="/fiscal-years">{t('step1')}</Link>
                  </li>
                  <li className="mb-2">
                    <Link href="/members">{t('step2')}</Link>
                  </li>
                  <li className="mb-2">
                    <Link href="/targets">{t('step3')}</Link>
                  </li>
                  <li className="mb-2">
                    <Link href="/sponsors">{t('step4')}</Link>
                  </li>
                  <li>
                    <Link href="/donations">{t('step5')}</Link>
                  </li>
                </ol>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>
    </>
  )
}
