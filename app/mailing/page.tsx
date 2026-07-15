'use client'

import { Container, Card, Button, Form, Table, Alert, Badge, Spinner, Modal, InputGroup, ProgressBar } from 'react-bootstrap'
import { Navbar } from '@/components/Navbar'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'

type FiscalYear = {
  id: string
  name: string
  donorLetter?: { fileName: string; size: number } | null
}

type Recipient = {
  id: string
  name: string
  email: string | null
  groupName: string | null
}

type SendResult = {
  memberId: string
  name?: string
  email?: string | null
  status: 'sent' | 'skipped' | 'failed'
  error?: string
}

export default function MailingPage() {
  const t = useTranslations('mailing')
  const tCommon = useTranslations('common')

  const [fiscalYears, setFiscalYears] = useState<FiscalYear[]>([])
  const [selectedFy, setSelectedFy] = useState<string>('')
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [onlyWithEmail, setOnlyWithEmail] = useState(true)
  const [loading, setLoading] = useState(true)

  const [previewHtml, setPreviewHtml] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [sending, setSending] = useState(false)
  const [results, setResults] = useState<SendResult[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [jobId, setJobId] = useState<string | null>(null)
  const [jobTotal, setJobTotal] = useState(0)
  const [processed, setProcessed] = useState(0)

  useEffect(() => {
    if (!jobId) return
    let active = true
    const poll = async () => {
      try {
        const res = await fetch(`/api/mailing/job/${jobId}`)
        const data = await res.json()
        if (!active) return
        setProcessed(data.processed ?? 0)
        setResults(data.results ?? [])
        if (data.status === 'done') {
          setSending(false)
          setJobId(null)
        }
      } catch {
        // keep polling; transient errors are fine
      }
    }
    poll()
    const interval = setInterval(poll, 4000)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [jobId])

  useEffect(() => {
    Promise.all([
      fetch('/api/fiscal-years').then((r) => r.json()),
      fetch('/api/mailing/recipients').then((r) => r.json()),
    ])
      .then(([fys, recs]) => {
        setFiscalYears(fys)
        setRecipients(recs)
        if (Array.isArray(fys) && fys.length > 0) setSelectedFy(fys[0].id)
      })
      .catch(() => setError(t('loadError')))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const currentFy = fiscalYears.find((f) => f.id === selectedFy)
  const hasLetter = Boolean(currentFy?.donorLetter)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return recipients.filter((r) => {
      if (onlyWithEmail && !r.email) return false
      if (!q) return true
      return r.name.toLowerCase().includes(q) || (r.groupName ?? '').toLowerCase().includes(q)
    })
  }, [recipients, search, onlyWithEmail])

  const selectableIds = filtered.filter((r) => r.email).map((r) => r.id)
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selected.has(id))
  const selectedWithEmail = recipients.filter((r) => selected.has(r.id) && r.email).length

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev)
      if (allSelected) selectableIds.forEach((id) => next.delete(id))
      else selectableIds.forEach((id) => next.add(id))
      return next
    })
  }

  async function handlePreview() {
    const firstId = [...selected].find((id) => recipients.find((r) => r.id === id)?.email)
    if (!firstId) return
    setPreviewLoading(true)
    setPreviewHtml(null)
    try {
      const res = await fetch('/api/mailing/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId: firstId, fiscalYearId: selectedFy }),
      })
      const data = await res.json()
      if (res.ok) setPreviewHtml(data.html)
      else setError(data.error || t('previewError'))
    } catch {
      setError(t('previewError'))
    } finally {
      setPreviewLoading(false)
    }
  }

  async function handleSend() {
    setShowConfirm(false)
    setSending(true)
    setResults(null)
    setError(null)
    setProcessed(0)
    try {
      const res = await fetch('/api/mailing/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fiscalYearId: selectedFy, memberIds: [...selected] }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error === 'mail_not_configured' ? t('notConfigured') : data.error === 'no_letter' ? t('letterMissing') : t('sendError'))
        setSending(false)
        return
      }
      setJobTotal(data.total ?? selected.size)
      setJobId(data.jobId) // starts polling
    } catch {
      setError(t('sendError'))
      setSending(false)
    }
  }

  if (loading) {
    return (
      <>
        <Navbar />
        <Container>
          <div className="text-center py-5"><Spinner animation="border" /></div>
        </Container>
      </>
    )
  }

  return (
    <>
      <Navbar />
      <Container className="pb-5">
        <h1 className="mb-1">{t('title')}</h1>
        <p className="text-muted">{t('subtitle')}</p>

        {error && <Alert variant="danger" dismissible onClose={() => setError(null)}>{error}</Alert>}

        {/* Step 1: fiscal year + letter */}
        <Card className="mb-3">
          <Card.Body>
            <div className="row g-3 align-items-end">
              <Form.Group className="col-md-5">
                <Form.Label className="fw-semibold">{t('fiscalYear')}</Form.Label>
                <Form.Select value={selectedFy} onChange={(e) => { setSelectedFy(e.target.value); setResults(null) }}>
                  {fiscalYears.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </Form.Select>
              </Form.Group>
              <div className="col-md-7">
                {hasLetter ? (
                  <Alert variant="success" className="mb-0 py-2">
                    <i className="bi bi-file-earmark-pdf me-2"></i>
                    {t('letterPresent')}: <strong>{currentFy?.donorLetter?.fileName}</strong>
                  </Alert>
                ) : (
                  <Alert variant="warning" className="mb-0 py-2">
                    <i className="bi bi-exclamation-triangle me-2"></i>
                    {t('letterMissing')}{' '}
                    <Link href="/fiscal-years">{t('letterMissingLink')}</Link>
                  </Alert>
                )}
              </div>
            </div>
          </Card.Body>
        </Card>

        {/* Step 2: recipients */}
        <Card className="mb-3">
          <Card.Header className="d-flex justify-content-between align-items-center flex-wrap gap-2">
            <strong>{t('recipients')}</strong>
            <Badge bg="primary">{t('selectedCount', { count: selectedWithEmail })}</Badge>
          </Card.Header>
          <Card.Body>
            <div className="d-flex gap-3 align-items-center mb-3 flex-wrap">
              <InputGroup style={{ maxWidth: 320 }}>
                <InputGroup.Text><i className="bi bi-search"></i></InputGroup.Text>
                <Form.Control placeholder={t('search')} value={search} onChange={(e) => setSearch(e.target.value)} />
              </InputGroup>
              <Form.Check
                type="switch"
                id="onlyWithEmail"
                label={t('onlyWithEmail')}
                checked={onlyWithEmail}
                onChange={(e) => setOnlyWithEmail(e.target.checked)}
              />
            </div>

            <div className="table-responsive" style={{ maxHeight: 360, overflowY: 'auto' }}>
              <Table hover size="sm" className="mb-0">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>
                      <Form.Check type="checkbox" checked={allSelected} onChange={toggleAll} aria-label={t('selectAll')} />
                    </th>
                    <th>{t('name')}</th>
                    <th>{t('group')}</th>
                    <th>{t('email')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id} className={!r.email ? 'text-muted' : ''}>
                      <td>
                        <Form.Check
                          type="checkbox"
                          checked={selected.has(r.id)}
                          disabled={!r.email}
                          onChange={() => toggle(r.id)}
                        />
                      </td>
                      <td>{r.name}</td>
                      <td>{r.groupName ?? '—'}</td>
                      <td>
                        {r.email ? r.email : <Badge bg="secondary">{t('noEmail')}</Badge>}
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={4} className="text-center text-muted py-3">{t('noRecipients')}</td></tr>
                  )}
                </tbody>
              </Table>
            </div>
          </Card.Body>
        </Card>

        {/* Step 3: actions */}
        <div className="d-flex gap-2 flex-wrap">
          <Button
            variant="outline-secondary"
            disabled={selectedWithEmail === 0 || previewLoading}
            onClick={handlePreview}
          >
            {previewLoading ? <Spinner animation="border" size="sm" /> : <><i className="bi bi-eye me-1"></i>{t('preview')}</>}
          </Button>
          <Button
            variant="primary"
            disabled={selectedWithEmail === 0 || !hasLetter || sending}
            onClick={() => setShowConfirm(true)}
          >
            {sending ? <><Spinner animation="border" size="sm" className="me-2" />{t('sending')}</> : <><i className="bi bi-send me-1"></i>{t('send')}</>}
          </Button>
        </div>

        {/* Progress */}
        {sending && (
          <Card className="mt-3">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-center mb-2">
                <strong>{t('sendingProgress', { processed, total: jobTotal })}</strong>
                <Spinner animation="border" size="sm" />
              </div>
              <ProgressBar now={jobTotal ? (processed / jobTotal) * 100 : 0} />
              <p className="text-muted small mt-2 mb-0">
                <i className="bi bi-info-circle me-1"></i>{t('batchInfo')}
              </p>
            </Card.Body>
          </Card>
        )}

        {/* Results */}
        {results && (
          <Card className="mt-3">
            <Card.Header><strong>{t('resultTitle')}</strong></Card.Header>
            <Card.Body className="p-0">
              <Table className="mb-0" size="sm">
                <tbody>
                  {results.map((r) => (
                    <tr key={r.memberId}>
                      <td>{r.name ?? r.memberId}</td>
                      <td className="text-muted">{r.email}</td>
                      <td className="text-end">
                        {r.status === 'sent' && <Badge bg="success">{t('statusSent')}</Badge>}
                        {r.status === 'skipped' && <Badge bg="secondary">{t('statusSkipped')}</Badge>}
                        {r.status === 'failed' && <Badge bg="danger" title={r.error}>{t('statusFailed')}</Badge>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        )}
      </Container>

      {/* Preview modal (mobile width) */}
      <Modal show={previewHtml !== null} onHide={() => setPreviewHtml(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title className="h6">{t('previewTitle')}</Modal.Title>
        </Modal.Header>
        <Modal.Body className="d-flex justify-content-center bg-body-secondary">
          <iframe
            title="email-preview"
            srcDoc={previewHtml ?? ''}
            style={{ width: 380, height: 560, border: '1px solid #dee2e6', borderRadius: 8, background: '#fff' }}
          />
        </Modal.Body>
      </Modal>

      {/* Send confirmation */}
      <Modal show={showConfirm} onHide={() => setShowConfirm(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title className="h6">{t('sendConfirmTitle')}</Modal.Title>
        </Modal.Header>
        <Modal.Body>{t('sendConfirmMessage', { count: selectedWithEmail })}</Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowConfirm(false)}>{tCommon('cancel')}</Button>
          <Button variant="primary" onClick={handleSend}>
            <i className="bi bi-send me-1"></i>{t('send')}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  )
}
