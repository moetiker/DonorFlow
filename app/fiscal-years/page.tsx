'use client'

import { Container, Card, Button, Table, Badge } from 'react-bootstrap'
import { Navbar } from '@/components/Navbar'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useLocalizedFormatters } from '@/lib/i18n/formatters'

type FiscalYear = {
  id: string
  name: string
  startDate: string
  endDate: string
  _count: {
    memberTargets: number
  }
}

function getYearStatus(startDate: string, endDate: string) {
  const now = new Date()
  const start = new Date(startDate)
  const end = new Date(endDate)
  if (now < start) return 'future'
  if (now > end) return 'past'
  return 'current'
}

export default function FiscalYearsPage() {
  const [fiscalYears, setFiscalYears] = useState<FiscalYear[]>([])
  const [loading, setLoading] = useState(true)
  const t = useTranslations('fiscalYears')
  const tCommon = useTranslations('common')
  const tTargets = useTranslations('targets')
  const { formatDate } = useLocalizedFormatters()

  useEffect(() => {
    loadFiscalYears()
  }, [])

  async function loadFiscalYears() {
    try {
      const response = await fetch('/api/fiscal-years')
      const data = await response.json()
      setFiscalYears(data)
    } catch (error) {
      console.error('Error loading fiscal years:', error)
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

  return (
    <>
      <Navbar />
      <Container>
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h1>{t('title')}</h1>
          <Link href="/fiscal-years/new">
            <Button variant="primary">
              <i className="bi bi-plus-circle me-2"></i>
              {t('new')}
            </Button>
          </Link>
        </div>

        {fiscalYears.length === 0 ? (
          <Card>
            <Card.Body className="text-center py-5">
              <i className="bi bi-calendar-x fs-1 text-muted mb-3 d-block"></i>
              <h5>{t('emptyState')}</h5>
              <p className="text-muted">{t('emptyStateDescription')}</p>
              <Link href="/fiscal-years/new">
                <Button variant="primary">{t('emptyStateAction')}</Button>
              </Link>
            </Card.Body>
          </Card>
        ) : (
          <Card>
            <Card.Body>
              <Table responsive hover>
                <thead>
                  <tr>
                    <th>{t('name')}</th>
                    <th>{t('period')}</th>
                    <th>{t('status')}</th>
                    <th>{t('targets')}</th>
                    <th>{t('actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {fiscalYears.map((year) => {
                    const status = getYearStatus(year.startDate, year.endDate)
                    return (
                      <tr key={year.id}>
                        <td><strong>{year.name}</strong></td>
                        <td>
                          {formatDate(year.startDate)} - {formatDate(year.endDate)}
                        </td>
                        <td>
                          {status === 'current' && (
                            <Badge bg="success">{t('current')}</Badge>
                          )}
                          {status === 'future' && (
                            <Badge bg="info">{t('future')}</Badge>
                          )}
                          {status === 'past' && (
                            <Badge bg="secondary">{t('past')}</Badge>
                          )}
                        </td>
                        <td>{year._count.memberTargets} {tTargets('target')}</td>
                        <td>
                          <Link href={`/targets?year=${year.id}`} className="btn btn-sm btn-outline-primary me-2">
                            <i className="bi bi-clipboard-check"></i> {tTargets('title')}
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        )}
      </Container>
    </>
  )
}
