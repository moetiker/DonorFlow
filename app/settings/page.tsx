'use client'

import { Container, Card, Form, Button, Alert, Badge, Spinner } from 'react-bootstrap'
import { Navbar } from '@/components/Navbar'
import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'

type MailSettings = {
  mailSmtpHost: string
  mailSmtpPort: string
  mailSmtpUser: string
  mailSmtpPassword: string
  mailFrom: string
  mailFromName: string
  mailReplyTo: string
}

const EMPTY_MAIL: MailSettings = {
  mailSmtpHost: '',
  mailSmtpPort: '587',
  mailSmtpUser: '',
  mailSmtpPassword: '',
  mailFrom: '',
  mailFromName: '',
  mailReplyTo: '',
}

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

  // Mail (SMTP) section — separate state and endpoint
  const [mail, setMail] = useState<MailSettings>(EMPTY_MAIL)
  const [mailPasswordSet, setMailPasswordSet] = useState(false)
  const [mailConfigured, setMailConfigured] = useState(false)
  const [mailSaving, setMailSaving] = useState(false)
  const [mailMsg, setMailMsg] = useState<{ variant: string; text: string } | null>(null)
  const [verifying, setVerifying] = useState(false)

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

    fetch('/api/settings/mail')
      .then(r => r.json())
      .then(data => {
        setMail({
          mailSmtpHost: data.mailSmtpHost || '',
          mailSmtpPort: data.mailSmtpPort || '587',
          mailSmtpUser: data.mailSmtpUser || '',
          mailSmtpPassword: '',
          mailFrom: data.mailFrom || '',
          mailFromName: data.mailFromName || '',
          mailReplyTo: data.mailReplyTo || '',
        })
        setMailPasswordSet(Boolean(data.passwordSet))
        setMailConfigured(Boolean(data.configured))
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const handleMailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMailMsg(null)
    setMailSaving(true)
    try {
      const response = await fetch('/api/settings/mail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mail),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(tErrors('saveFailed'))
      setMailConfigured(Boolean(data.configured))
      if (mail.mailSmtpPassword) setMailPasswordSet(true)
      setMail({ ...mail, mailSmtpPassword: '' })
      setMailMsg({ variant: 'success', text: t('saveSuccess') })
    } catch (err: any) {
      setMailMsg({ variant: 'danger', text: err.message })
    } finally {
      setMailSaving(false)
    }
  }

  const handleVerify = async () => {
    setMailMsg(null)
    setVerifying(true)
    try {
      const response = await fetch('/api/settings/mail/verify', { method: 'POST' })
      const data = await response.json()
      if (data.ok) {
        setMailMsg({ variant: 'success', text: t('testOk') })
      } else {
        setMailMsg({ variant: 'danger', text: `${t('testFailed')}: ${data.error || ''}` })
      }
    } catch {
      setMailMsg({ variant: 'danger', text: t('testFailed') })
    } finally {
      setVerifying(false)
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

        {/* Mail (SMTP) configuration */}
        <Card style={{ maxWidth: '600px' }} className="mt-4">
          <Card.Body>
            <div className="d-flex align-items-center gap-2 mb-3">
              <h5 className="mb-0">
                <i className="bi bi-envelope-at me-2"></i>
                {t('mailTitle')}
              </h5>
              <Badge bg={mailConfigured ? 'success' : 'secondary'}>
                {mailConfigured ? t('mailConfigured') : t('mailNotConfigured')}
              </Badge>
            </div>
            <p className="text-muted small">{t('mailHelp')}</p>

            {mailMsg && <Alert variant={mailMsg.variant}>{mailMsg.text}</Alert>}

            <Form onSubmit={handleMailSubmit}>
              <div className="row g-3">
                <Form.Group className="col-8">
                  <Form.Label>{t('smtpHost')}</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="mail.example.ch"
                    value={mail.mailSmtpHost}
                    onChange={(e) => setMail({ ...mail, mailSmtpHost: e.target.value })}
                    disabled={mailSaving}
                  />
                </Form.Group>
                <Form.Group className="col-4">
                  <Form.Label>{t('smtpPort')}</Form.Label>
                  <Form.Control
                    type="number"
                    value={mail.mailSmtpPort}
                    onChange={(e) => setMail({ ...mail, mailSmtpPort: e.target.value })}
                    disabled={mailSaving}
                  />
                </Form.Group>
              </div>

              <Form.Group className="mb-3 mt-3">
                <Form.Label>{t('smtpUser')}</Form.Label>
                <Form.Control
                  type="text"
                  autoComplete="off"
                  value={mail.mailSmtpUser}
                  onChange={(e) => setMail({ ...mail, mailSmtpUser: e.target.value })}
                  disabled={mailSaving}
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>{t('smtpPassword')}</Form.Label>
                <Form.Control
                  type="password"
                  autoComplete="new-password"
                  placeholder={mailPasswordSet ? '••••••••' : ''}
                  value={mail.mailSmtpPassword}
                  onChange={(e) => setMail({ ...mail, mailSmtpPassword: e.target.value })}
                  disabled={mailSaving}
                />
                <Form.Text className="text-muted">{t('smtpPasswordKeep')}</Form.Text>
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>{t('mailFrom')}</Form.Label>
                <Form.Control
                  type="email"
                  placeholder="info@example.ch"
                  value={mail.mailFrom}
                  onChange={(e) => setMail({ ...mail, mailFrom: e.target.value })}
                  disabled={mailSaving}
                />
              </Form.Group>

              <div className="row g-3">
                <Form.Group className="col-md-6">
                  <Form.Label>{t('mailFromName')}</Form.Label>
                  <Form.Control
                    type="text"
                    value={mail.mailFromName}
                    onChange={(e) => setMail({ ...mail, mailFromName: e.target.value })}
                    disabled={mailSaving}
                  />
                </Form.Group>
                <Form.Group className="col-md-6">
                  <Form.Label>{t('mailReplyTo')}</Form.Label>
                  <Form.Control
                    type="email"
                    value={mail.mailReplyTo}
                    onChange={(e) => setMail({ ...mail, mailReplyTo: e.target.value })}
                    disabled={mailSaving}
                  />
                </Form.Group>
              </div>

              <div className="d-flex gap-2 mt-4">
                <Button variant="primary" type="submit" disabled={mailSaving}>
                  {mailSaving ? tCommon('saving') : tCommon('save')}
                </Button>
                <Button variant="outline-secondary" type="button" onClick={handleVerify} disabled={verifying || !mailConfigured}>
                  {verifying ? <Spinner animation="border" size="sm" /> : <><i className="bi bi-plug me-1"></i>{t('testConnection')}</>}
                </Button>
              </div>
            </Form>
          </Card.Body>
        </Card>
      </Container>
    </>
  )
}
