'use client'

import { Container, Card, Table, Badge, ProgressBar, Alert } from 'react-bootstrap'
import { Navbar } from '@/components/Navbar'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useLocalizedFormatters } from '@/lib/i18n/formatters'

type Member = {
  id: string
  firstName: string
  lastName: string
}

type MemberStat = {
  member: Member
  target: number
  actual: number
  difference: number
  percentage: number
  donationCount: number
}

type ReportData = {
  currentYear: {
    id: string
    name: string
    startDate: string
    endDate: string
  } | null
  memberStats: MemberStat[]
  totalTarget: number
  totalActual: number
  overallPercentage: number
}

export default function ReportsPage() {
  const t = useTranslations('reports')
  const tCommon = useTranslations('common')
  const { formatCurrency } = useLocalizedFormatters()
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadReportData()
  }, [])

  async function loadReportData() {
    try {
      const response = await fetch('/api/reports')
      const result = await response.json()
      setData(result)
    } catch (error) {
      console.error('Error loading reports:', error)
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

  if (!data || !data.currentYear) {
    return (
      <>
        <Navbar />
        <Container>
          <h1 className="mb-4">{t('title')}</h1>
          <Alert variant="warning">
            {t('noActiveFiscalYear')}{' '}
            <Link href="/fiscal-years/new">{t('createFiscalYearFirst')}</Link>.
          </Alert>
        </Container>
      </>
    )
  }

  const { currentYear, memberStats, totalTarget, totalActual, overallPercentage } = data

  return (
    <>
      <Navbar />
      <Container>
        <h1 className="mb-4">{t('title')}</h1>

        <Alert variant="info" className="mb-4">
          <strong>{t('fiscalYear')}:</strong> {currentYear.name}
        </Alert>

        {/* Overall Summary */}
        <Card className="mb-4">
          <Card.Header>
            <h5 className="mb-0">{t('overallSummary')}</h5>
          </Card.Header>
          <Card.Body>
            <div className="row g-3">
              <div className="col-md-3">
                <div className="text-muted small">{t('targetTotal')}</div>
                <div className="h4">{formatCurrency(totalTarget)}</div>
              </div>
              <div className="col-md-3">
                <div className="text-muted small">{t('actualTotal')}</div>
                <div className="h4 text-success">{formatCurrency(totalActual)}</div>
              </div>
              <div className="col-md-3">
                <div className="text-muted small">{t('difference')}</div>
                <div className={`h4 ${totalActual >= totalTarget ? 'text-success' : 'text-danger'}`}>
                  {formatCurrency(totalActual - totalTarget)}
                </div>
              </div>
              <div className="col-md-3">
                <div className="text-muted small">{t('achievementRate')}</div>
                <div className="h4">{overallPercentage.toFixed(1)}%</div>
              </div>
            </div>
            <div className="mt-3">
              <ProgressBar
                now={overallPercentage}
                variant={overallPercentage >= 100 ? 'success' : overallPercentage >= 75 ? 'warning' : 'danger'}
                label={`${overallPercentage.toFixed(1)}%`}
              />
            </div>
          </Card.Body>
        </Card>

        {/* Member Details */}
        <Card>
          <Card.Header>
            <h5 className="mb-0">{t('memberDetails')}</h5>
          </Card.Header>
          <Card.Body>
            {memberStats.length === 0 ? (
              <div className="text-center py-4 text-muted">
                {t('noData')}
              </div>
            ) : (
              <Table responsive hover>
                <thead>
                  <tr>
                    <th>{t('member')}</th>
                    <th>{t('target')}</th>
                    <th>{t('actual')}</th>
                    <th>{t('difference')}</th>
                    <th>{t('achievement')}</th>
                    <th>{t('donations')}</th>
                  </tr>
                </thead>
                <tbody>
                  {memberStats.map((stat, idx) => (
                    <tr key={idx}>
                      <td>
                        <strong>{stat.member.firstName} {stat.member.lastName}</strong>
                      </td>
                      <td>{formatCurrency(stat.target)}</td>
                      <td className="text-success">{formatCurrency(stat.actual)}</td>
                      <td className={stat.difference >= 0 ? 'text-success' : 'text-danger'}>
                        {formatCurrency(stat.difference)}
                      </td>
                      <td>
                        <div className="d-flex align-items-center gap-2">
                          <div style={{ minWidth: '60px' }}>
                            <Badge
                              bg={stat.percentage >= 100 ? 'success' : stat.percentage >= 75 ? 'warning' : 'danger'}
                            >
                              {stat.percentage.toFixed(0)}%
                            </Badge>
                          </div>
                          <div className="flex-grow-1" style={{ minWidth: '100px' }}>
                            <ProgressBar
                              now={Math.min(stat.percentage, 100)}
                              variant={stat.percentage >= 100 ? 'success' : stat.percentage >= 75 ? 'warning' : 'danger'}
                              style={{ height: '8px' }}
                            />
                          </div>
                        </div>
                      </td>
                      <td>{stat.donationCount}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card.Body>
        </Card>
      </Container>
    </>
  )
}
