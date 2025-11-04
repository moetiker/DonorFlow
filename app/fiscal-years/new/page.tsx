'use client'

import { Container, Card, Form, Button, Alert } from 'react-bootstrap'
import { Navbar } from '@/components/Navbar'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'

export default function NewFiscalYearPage() {
  const router = useRouter()
  const t = useTranslations('fiscalYears')
  const tCommon = useTranslations('common')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    name: '',
    startDate: '',
    endDate: '',
    copyPreviousTargets: true
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch('/api/fiscal-years', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || t('createError'))
      }

      router.push('/fiscal-years')
      router.refresh()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Navbar />
      <Container>
        <div className="mb-4">
          <h1>{t('create')}</h1>
        </div>

        <Card style={{ maxWidth: '600px' }}>
          <Card.Body>
            {error && <Alert variant="danger">{error}</Alert>}

            <Form onSubmit={handleSubmit}>
              <Form.Group className="mb-3">
                <Form.Label>{t('name')} *</Form.Label>
                <Form.Control
                  type="text"
                  placeholder={t('namePlaceholder')}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  disabled={loading}
                />
                <Form.Text className="text-muted">
                  {t('nameHelp')}
                </Form.Text>
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>{t('startDateLabel')} *</Form.Label>
                <Form.Control
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  required
                  disabled={loading}
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>{t('endDateLabel')} *</Form.Label>
                <Form.Control
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  required
                  disabled={loading}
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Check
                  type="checkbox"
                  id="copyTargets"
                  label={t('copyTargets')}
                  checked={formData.copyPreviousTargets}
                  onChange={(e) => setFormData({ ...formData, copyPreviousTargets: e.target.checked })}
                  disabled={loading}
                />
                <Form.Text className="text-muted">
                  {t('copyTargetsHelp')}
                </Form.Text>
              </Form.Group>

              <div className="d-flex gap-2">
                <Button variant="primary" type="submit" disabled={loading}>
                  {loading ? t('creating') : t('emptyStateAction')}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => router.back()}
                  disabled={loading}
                >
                  {tCommon('cancel')}
                </Button>
              </div>
            </Form>
          </Card.Body>
        </Card>
      </Container>
    </>
  )
}
