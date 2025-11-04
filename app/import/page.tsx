'use client'

import { Container, Card, Form, Button, Alert, Tabs, Tab } from 'react-bootstrap'
import { Navbar } from '@/components/Navbar'
import { useState } from 'react'
import { useTranslations } from 'next-intl'

export default function ImportPage() {
  const [activeTab, setActiveTab] = useState<string>('members')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState<string>('')
  const [error, setError] = useState<string>('')
  const t = useTranslations('import')
  const tCommon = useTranslations('common')
  const tMembers = useTranslations('members')
  const tSponsors = useTranslations('sponsors')

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
      setError('')
      setSuccess('')
    }
  }

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) {
      setError(t('selectFile'))
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', activeTab)

      const response = await fetch('/api/import', {
        method: 'POST',
        body: formData
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || t('uploadSuccess'))
      }

      setSuccess(t('uploadSuccess', { count: data.count }))
      setFile(null)
      if (e.target instanceof HTMLFormElement) {
        e.target.reset()
      }
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
          <h1>{t('title')}</h1>
          <p className="text-muted">
            {t('description')}
          </p>
        </div>

        <Card>
          <Card.Body>
            <Tabs
              activeKey={activeTab}
              onSelect={(k) => setActiveTab(k || 'members')}
              className="mb-4"
            >
              <Tab eventKey="members" title={tMembers('title')}>
                <div className="py-3">
                  <h5>{t('importMembers')}</h5>
                  <p className="text-muted small">
                    {t('membersFormat')}
                  </p>
                </div>
              </Tab>
              <Tab eventKey="sponsors" title={tSponsors('title')}>
                <div className="py-3">
                  <h5>{t('importSponsors')}</h5>
                  <p className="text-muted small">
                    {t('sponsorsFormat')}
                  </p>
                </div>
              </Tab>
            </Tabs>

            {success && <Alert variant="success">{success}</Alert>}
            {error && <Alert variant="danger">{error}</Alert>}

            <Form onSubmit={handleImport}>
              <Form.Group className="mb-3">
                <Form.Label>{t('selectFile')}</Form.Label>
                <Form.Control
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  disabled={loading}
                  required
                />
                <Form.Text className="text-muted">
                  {t('csvOnly')}
                </Form.Text>
              </Form.Group>

              <Alert variant="info">
                <i className="bi bi-info-circle me-2"></i>
                <strong>{tCommon('important')}:</strong> {t('utf8Required')}
              </Alert>

              <div className="d-flex gap-2">
                <Button
                  variant="primary"
                  type="submit"
                  disabled={loading || !file}
                >
                  {loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      {t('importButton')}...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-upload me-2"></i>
                      {t('importButton')}
                    </>
                  )}
                </Button>
                {file && (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setFile(null)
                      setError('')
                      setSuccess('')
                    }}
                    disabled={loading}
                  >
                    {tCommon('cancel')}
                  </Button>
                )}
              </div>
            </Form>
          </Card.Body>
        </Card>

        <Card className="mt-4">
          <Card.Header>
            <h5 className="mb-0">{t('csvFormat')}</h5>
          </Card.Header>
          <Card.Body>
            <h6>{tMembers('title')}</h6>
            <pre className="bg-light p-3 rounded">
{`Nachname;Vorname;Adresse;PLZ;Ort;Telefon;E-Mail
Lastname1;Firstname1;Street 1;1000;City1;+00 00 000 00 00;member1@example.com
Lastname2;Firstname2;Street 2;2000;City2;+00 00 000 00 00;member2@example.com`}
            </pre>

            <h6 className="mt-4">{tSponsors('title')}</h6>
            <pre className="bg-light p-3 rounded">
{`Firma,Anrede,Vorname,Name,Strasse,PLZ,Ort,Telefon,E-Mail,Betrag
Company A,Mr,John,Doe,Street 1,1000,City1,+00 00 000 00 00,contact@example.com,CHF 500.00
,Ms,Jane,Smith,Street 2,2000,City2,+00 00 000 00 00;contact2@example.com,CHF 200.00`}
            </pre>
          </Card.Body>
        </Card>
      </Container>
    </>
  )
}
