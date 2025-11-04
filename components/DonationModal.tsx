'use client'

import { Modal, Form, Button, Alert } from 'react-bootstrap'
import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'

type Sponsor = {
  id: string
  company: string | null
  salutation: string | null
  firstName: string | null
  lastName: string | null
  member?: { firstName: string; lastName: string }
  group?: { name: string }
}

// Helper function to display sponsor name
function getSponsorDisplayName(sponsor: Sponsor) {
  if (sponsor.company) {
    return sponsor.company
  }
  const parts = [sponsor.firstName, sponsor.lastName].filter(Boolean)
  return parts.length > 0 ? parts.join(' ') : sponsor.id // Fallback to ID if no name
}

type Donation = {
  id: string
  sponsorId: string
  amount: number
  donationDate: Date
  note: string | null
}

type Props = {
  show: boolean
  donation: Donation | null
  sponsors: Sponsor[]
  onHide: () => void
  onSave: () => void
}

export function DonationModal({ show, donation, sponsors, onHide, onSave }: Props) {
  const t = useTranslations('donations')
  const tCommon = useTranslations('common')
  const tErrors = useTranslations('errors')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    sponsorId: '',
    amount: '',
    donationDate: new Date().toISOString().split('T')[0],
    note: ''
  })

  useEffect(() => {
    if (donation) {
      setFormData({
        sponsorId: donation.sponsorId,
        amount: donation.amount.toString(),
        donationDate: new Date(donation.donationDate).toISOString().split('T')[0],
        note: donation.note || ''
      })
    } else {
      setFormData({
        sponsorId: '',
        amount: '',
        donationDate: new Date().toISOString().split('T')[0],
        note: ''
      })
    }
    setError('')
  }, [donation, show])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const payload = {
        sponsorId: formData.sponsorId,
        amount: parseFloat(formData.amount),
        donationDate: formData.donationDate,
        note: formData.note || null
      }

      const url = donation ? `/api/donations/${donation.id}` : '/api/donations'
      const method = donation ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || tErrors('saveFailed'))
      }

      onSave()
      onHide()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!donation) return
    if (!confirm(t('deleteConfirm'))) return

    setLoading(true)
    setError('')

    try {
      const response = await fetch(`/api/donations/${donation.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || tErrors('deleteFailed'))
      }

      onSave()
      onHide()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal show={show} onHide={onHide} backdrop="static">
      <Modal.Header closeButton>
        <Modal.Title>
          {donation ? t('editDonation') : t('newDonation')}
        </Modal.Title>
      </Modal.Header>

      <Form onSubmit={handleSubmit}>
        <Modal.Body>
          {error && <Alert variant="danger">{error}</Alert>}

          <Form.Group className="mb-3">
            <Form.Label>{t('sponsor')} *</Form.Label>
            <Form.Select
              value={formData.sponsorId}
              onChange={(e) => setFormData({ ...formData, sponsorId: e.target.value })}
              required
              disabled={loading}
              autoFocus
            >
              <option value="">{t('selectSponsor')}</option>
              {sponsors.map(s => (
                <option key={s.id} value={s.id}>
                  {getSponsorDisplayName(s)}
                  {s.member && ` (${s.member.firstName} ${s.member.lastName})`}
                  {s.group && ` (${s.group.name})`}
                </option>
              ))}
            </Form.Select>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>{t('amount')} (CHF) *</Form.Label>
            <Form.Control
              type="number"
              step="0.01"
              min="0"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              required
              disabled={loading}
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>{t('date')} *</Form.Label>
            <Form.Control
              type="date"
              value={formData.donationDate}
              onChange={(e) => setFormData({ ...formData, donationDate: e.target.value })}
              required
              disabled={loading}
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>{t('note')}</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              placeholder={t('placeholderNote')}
              value={formData.note}
              onChange={(e) => setFormData({ ...formData, note: e.target.value })}
              disabled={loading}
            />
          </Form.Group>
        </Modal.Body>

        <Modal.Footer>
          <div className="d-flex justify-content-between w-100">
            <div>
              {donation && (
                <Button
                  variant="danger"
                  onClick={handleDelete}
                  disabled={loading}
                >
                  <i className="bi bi-trash me-2"></i>
                  {tCommon('delete')}
                </Button>
              )}
            </div>
            <div className="d-flex gap-2">
              <Button variant="secondary" onClick={onHide} disabled={loading}>
                {tCommon('cancel')}
              </Button>
              <Button variant="primary" type="submit" disabled={loading}>
                {loading ? tCommon('saving') : tCommon('save')}
              </Button>
            </div>
          </div>
        </Modal.Footer>
      </Form>
    </Modal>
  )
}
