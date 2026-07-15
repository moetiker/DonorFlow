'use client'

import { Container, Card, Button, Table, Badge, Spinner, Alert } from 'react-bootstrap'
import { Navbar } from '@/components/Navbar'
import { DeleteConfirmModal } from '@/components/DeleteConfirmModal'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useLocalizedFormatters } from '@/lib/i18n/formatters'

type DonorLetter = {
  fileName: string
  size: number
  uploadedAt: string
}

type FiscalYear = {
  id: string
  name: string
  startDate: string
  endDate: string
  _count: {
    memberTargets: number
  }
  donorLetter?: DonorLetter | null
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
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<FiscalYear | null>(null)
  const [deleting, setDeleting] = useState(false)
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

  async function handleUpload(id: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError(null)
    setUploadingId(id)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`/api/fiscal-years/${id}/letter`, { method: 'POST', body: formData })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.error || t('letterUploadError'))
      } else {
        await loadFiscalYears()
      }
    } catch {
      setError(t('letterUploadError'))
    } finally {
      setUploadingId(null)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await fetch(`/api/fiscal-years/${deleteTarget.id}/letter`, { method: 'DELETE' })
      await loadFiscalYears()
      setDeleteTarget(null)
    } catch {
      setError(t('letterUploadError'))
    } finally {
      setDeleting(false)
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

        {error && (
          <Alert variant="danger" dismissible onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

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
                    <th>{t('donorLetter')}</th>
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
                          {uploadingId === year.id ? (
                            <Spinner animation="border" size="sm" />
                          ) : year.donorLetter ? (
                            <div className="d-flex align-items-center gap-1">
                              <a
                                href={`/api/fiscal-years/${year.id}/letter`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-sm btn-outline-secondary"
                                title={year.donorLetter.fileName}
                              >
                                <i className="bi bi-file-earmark-pdf"></i> PDF
                              </a>
                              <label className="btn btn-sm btn-outline-primary mb-0" title={t('letterReplace')}>
                                <i className="bi bi-arrow-repeat"></i>
                                <input
                                  type="file"
                                  accept="application/pdf"
                                  hidden
                                  onChange={(e) => handleUpload(year.id, e)}
                                />
                              </label>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-danger"
                                title={t('letterRemove')}
                                onClick={() => setDeleteTarget(year)}
                              >
                                <i className="bi bi-trash"></i>
                              </button>
                            </div>
                          ) : (
                            <label className="btn btn-sm btn-outline-primary mb-0">
                              <i className="bi bi-upload me-1"></i> {t('letterUpload')}
                              <input
                                type="file"
                                accept="application/pdf"
                                hidden
                                onChange={(e) => handleUpload(year.id, e)}
                              />
                            </label>
                          )}
                        </td>
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

        <DeleteConfirmModal
          show={deleteTarget !== null}
          title={t('letterRemoveTitle')}
          message={t('letterRemoveMessage', { year: deleteTarget?.name ?? '' })}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          deleting={deleting}
        />
      </Container>
    </>
  )
}
