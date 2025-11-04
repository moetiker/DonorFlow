'use client'

import { Container, Card, Table, Form, Alert, Button, InputGroup } from 'react-bootstrap'
import { Navbar } from '@/components/Navbar'
import { TargetModal } from '@/components/TargetModal'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useLocalizedFormatters } from '@/lib/i18n/formatters'

type Member = {
  id: string
  firstName: string
  lastName: string
}

type Target = {
  id: string
  memberId: string
  targetAmount: number
  fiscalYearId: string
  member: Member
}

type FiscalYear = {
  id: string
  name: string
  startDate: string
  endDate: string
}

type TargetsData = {
  fiscalYear: FiscalYear
  targets: Target[]
  allYears: FiscalYear[]
}

export default function TargetsPage() {
  const searchParams = useSearchParams()
  const yearParam = searchParams.get('year')

  const [data, setData] = useState<TargetsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [selectedTarget, setSelectedTarget] = useState<Target | null>(null)
  const [creating, setCreating] = useState(false)
  const [defaultAmount, setDefaultAmount] = useState(100)
  const t = useTranslations('targets')
  const tCommon = useTranslations('common')
  const tFiscalYears = useTranslations('fiscalYears')
  const { formatCurrency } = useLocalizedFormatters()

  const loadData = async () => {
    setLoading(true)
    try {
      const url = yearParam ? `/api/targets?year=${yearParam}` : '/api/targets'
      const response = await fetch(url)
      const result = await response.json()
      setData(result)
    } catch (error) {
      console.error('Error loading targets:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [yearParam])

  const handleRowClick = (target: Target) => {
    setSelectedTarget(target)
    setShowModal(true)
  }

  const handleModalClose = () => {
    setShowModal(false)
    setSelectedTarget(null)
  }

  const handleSave = () => {
    loadData()
  }

  const handleBulkCreate = async () => {
    if (!data?.fiscalYear) return

    if (!confirm(t('createAllConfirm', { amount: defaultAmount }))) {
      return
    }

    setCreating(true)
    try {
      const response = await fetch('/api/targets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fiscalYearId: data.fiscalYear.id,
          defaultAmount
        })
      })

      const result = await response.json()

      if (response.ok) {
        alert(result.message)
        loadData()
      } else {
        alert(`${tCommon('error')}: ${result.error}`)
      }
    } catch (error) {
      console.error('Error creating targets:', error)
      alert(t('createAllConfirm'))
    } finally {
      setCreating(false)
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

  if (!data) {
    return (
      <>
        <Navbar />
        <Container>
          <h1 className="mb-4">{t('title')}</h1>
          <Alert variant="warning">
            {t('emptyState')}
          </Alert>
        </Container>
      </>
    )
  }

  const { fiscalYear, targets, allYears } = data
  const totalTarget = targets.reduce((sum, t) => sum + t.targetAmount, 0)

  return (
    <>
      <Navbar />
      <Container>
        <h1 className="mb-4">{t('title')}</h1>

        <Card className="mb-4">
          <Card.Body>
            <Form.Group>
              <Form.Label>{t('fiscalYear')}</Form.Label>
              <Form.Select
                value={fiscalYear.id}
                onChange={(e) => {
                  window.location.href = `/targets?year=${e.target.value}`
                }}
              >
                {allYears.map(year => (
                  <option key={year.id} value={year.id}>
                    {year.name}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
          </Card.Body>
        </Card>

        {/* Bulk Create Targets */}
        <Card className="mb-4">
          <Card.Header>
            <h5 className="mb-0">{t('createAll')}</h5>
          </Card.Header>
          <Card.Body>
            <Form.Group className="mb-3">
              <Form.Label>{t('defaultAmount')}</Form.Label>
              <InputGroup>
                <Form.Control
                  type="number"
                  value={defaultAmount}
                  onChange={(e) => setDefaultAmount(Number(e.target.value))}
                  min="0"
                  step="10"
                />
                <Button
                  variant="primary"
                  onClick={handleBulkCreate}
                  disabled={creating}
                >
                  {creating ? `${t('createAll')}...` : t('createAll')}
                </Button>
              </InputGroup>
              <Form.Text className="text-muted">
                {t('emptyStateDescription')}
              </Form.Text>
            </Form.Group>
          </Card.Body>
        </Card>

        <Card>
          <Card.Header>
            <div className="d-flex justify-content-between align-items-center">
              <h5 className="mb-0">{t('title')} {fiscalYear.name}</h5>
              <span className="text-muted">
                {tCommon('total')}: <strong>{formatCurrency(totalTarget)}</strong>
              </span>
            </div>
          </Card.Header>
          <Card.Body>
            {targets.length === 0 ? (
              <div className="text-center py-4 text-muted">
                {t('emptyState')}
              </div>
            ) : (
              <Table responsive hover>
                <thead>
                  <tr>
                    <th>{t('member')}</th>
                    <th>{t('target')}</th>
                  </tr>
                </thead>
                <tbody>
                  {targets.map((target) => (
                    <tr
                      key={target.id}
                      onClick={() => handleRowClick(target)}
                      style={{ cursor: 'pointer' }}
                      className="align-middle"
                    >
                      <td>
                        <strong>
                          {target.member.firstName} {target.member.lastName}
                        </strong>
                      </td>
                      <td>{formatCurrency(target.targetAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card.Body>
        </Card>

        <TargetModal
          show={showModal}
          target={selectedTarget}
          onHide={handleModalClose}
          onSave={handleSave}
        />
      </Container>
    </>
  )
}
