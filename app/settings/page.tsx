'use client'

import { Container, Card, Form, Button, Alert } from 'react-bootstrap'
import { Navbar } from '@/components/Navbar'
import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'

export default function SettingsPage() {
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [settings, setSettings] = useState({
    organizationName: 'Mein Verein',
    defaultTargetAmount: '1000',
    fiscalYearStartMonth: '7',
    fiscalYearStartDay: '1'
  })
  const t = useTranslations('settings')
  const tCommon = useTranslations('common')
  const tErrors = useTranslations('errors')

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(data => {
        if (data.organizationName) settings.organizationName = data.organizationName
        if (data.defaultTargetAmount) settings.defaultTargetAmount = data.defaultTargetAmount
        if (data.fiscalYearStartMonth) settings.fiscalYearStartMonth = data.fiscalYearStartMonth
        if (data.fiscalYearStartDay) settings.fiscalYearStartDay = data.fiscalYearStartDay
        setSettings({ ...settings })
      })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess(false)
    setLoading(true)

    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      })

      if (!response.ok) {
        throw new Error(tErrors('saveFailed'))
      }

      setSuccess(true)
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
        <h1 className="mb-4">{t('title')}</h1>

        <Card style={{ maxWidth: '600px' }}>
          <Card.Body>
            {success && <Alert variant="success">{t('saveSuccess')}</Alert>}
            {error && <Alert variant="danger">{error}</Alert>}

            <Form onSubmit={handleSubmit}>
              <h5 className="mb-3">{tCommon('general')}</h5>

              <Form.Group className="mb-3">
                <Form.Label>{t('organizationName')}</Form.Label>
                <Form.Control
                  type="text"
                  value={settings.organizationName}
                  onChange={(e) => setSettings({ ...settings, organizationName: e.target.value })}
                  disabled={loading}
                  required
                />
                <Form.Text className="text-muted">
                  {t('organizationNameHelp')}
                </Form.Text>
              </Form.Group>

              <hr className="my-4" />

              <h5 className="mb-3">{tCommon('defaults')}</h5>

              <Form.Group className="mb-3">
                <Form.Label>{t('defaultTargetAmount')}</Form.Label>
                <Form.Control
                  type="number"
                  step="0.01"
                  min="0"
                  value={settings.defaultTargetAmount}
                  onChange={(e) => setSettings({ ...settings, defaultTargetAmount: e.target.value })}
                  disabled={loading}
                />
                <Form.Text className="text-muted">
                  {t('defaultTargetAmountHelp')}
                </Form.Text>
              </Form.Group>

              <hr className="my-4" />

              <h5 className="mb-3">{t('fiscalYearSettings')}</h5>

              <Form.Group className="mb-3">
                <Form.Label>{tCommon('startMonth')}</Form.Label>
                <Form.Select
                  value={settings.fiscalYearStartMonth}
                  onChange={(e) => setSettings({ ...settings, fiscalYearStartMonth: e.target.value })}
                  disabled={loading}
                >
                  <option value="1">{tCommon('months.january')}</option>
                  <option value="2">{tCommon('months.february')}</option>
                  <option value="3">{tCommon('months.march')}</option>
                  <option value="4">{tCommon('months.april')}</option>
                  <option value="5">{tCommon('months.may')}</option>
                  <option value="6">{tCommon('months.june')}</option>
                  <option value="7">{tCommon('months.july')}</option>
                  <option value="8">{tCommon('months.august')}</option>
                  <option value="9">{tCommon('months.september')}</option>
                  <option value="10">{tCommon('months.october')}</option>
                  <option value="11">{tCommon('months.november')}</option>
                  <option value="12">{tCommon('months.december')}</option>
                </Form.Select>
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>{tCommon('startDay')}</Form.Label>
                <Form.Control
                  type="number"
                  min="1"
                  max="31"
                  value={settings.fiscalYearStartDay}
                  onChange={(e) => setSettings({ ...settings, fiscalYearStartDay: e.target.value })}
                  disabled={loading}
                />
                <Form.Text className="text-muted">
                  {t('fiscalYearHelp')}
                </Form.Text>
              </Form.Group>

              <div className="d-flex gap-2 mt-4">
                <Button variant="primary" type="submit" disabled={loading}>
                  {loading ? `${tCommon('saving')}` : `${t('title')} ${tCommon('save').toLowerCase()}`}
                </Button>
              </div>
            </Form>
          </Card.Body>
        </Card>
      </Container>
    </>
  )
}
