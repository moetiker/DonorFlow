'use client'

import { Modal, Form, Button, Alert } from 'react-bootstrap'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { DeleteConfirmModal } from './DeleteConfirmModal'
import { recipientLabel } from '@/lib/crediting'
import { getMemberDisplayName } from '@/lib/utils'

type Member = { id: string; firstName: string; lastName: string }
type Group = { id: string; name: string; dissolvedAt?: string | null }

type Assignment = {
  id?: string
  memberId: string | null
  groupId: string | null
  member: { id: string; firstName: string; lastName: string } | null
  group: { id: string; name: string } | null
}

/** One recipient row in the form; `value` is "m:<id>" or "g:<id>". */
type RecipientRow = { value: string; label: string }

type Sponsor = {
  id: string
  company: string | null
  salutation: string | null
  firstName: string | null
  lastName: string | null
  street: string | null
  postalCode: string | null
  city: string | null
  phone: string | null
  email: string | null
  notes: string | null
  assignments: Assignment[]
}

type Props = {
  show: boolean
  sponsor: Sponsor | null
  members: Member[]
  groups: Group[]
  onHide: () => void
  onSave: () => void
}

export function SponsorModal({ show, sponsor, members, groups, onHide, onSave }: Props) {
  const t = useTranslations('sponsors')
  const tCommon = useTranslations('common')
  const tErrors = useTranslations('errors')
  const tDonations = useTranslations('donations')
  const tValidation = useTranslations('validation.errors')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [addDonation, setAddDonation] = useState(false)
  const [formData, setFormData] = useState({
    company: '',
    salutation: '',
    firstName: '',
    lastName: '',
    street: '',
    postalCode: '',
    city: '',
    phone: '',
    email: '',
    notes: '',
  })
  const [recipients, setRecipients] = useState<RecipientRow[]>([])
  const [pendingRecipient, setPendingRecipient] = useState('')
  const [donationData, setDonationData] = useState({
    amount: '',
    donationDate: new Date().toISOString().split('T')[0],
    note: ''
  })

  // Reset the form while rendering instead of in an effect, so the fields for
  // a newly opened (or switched) sponsor are correct on the very first render.
  const [formSource, setFormSource] = useState({ show, sponsor })
  if (formSource.show !== show || formSource.sponsor !== sponsor) {
    setFormSource({ show, sponsor })
    if (sponsor) {
      setFormData({
        company: sponsor.company || '',
        salutation: sponsor.salutation || '',
        firstName: sponsor.firstName || '',
        lastName: sponsor.lastName || '',
        street: sponsor.street || '',
        postalCode: sponsor.postalCode || '',
        city: sponsor.city || '',
        phone: sponsor.phone || '',
        email: sponsor.email || '',
        notes: sponsor.notes || '',
      })
      setRecipients((sponsor.assignments ?? []).map(a => ({
        value: a.memberId ? `m:${a.memberId}` : `g:${a.groupId}`,
        label: recipientLabel(a)
      })))
    } else {
      setRecipients([])
      setFormData({
        company: '',
        salutation: '',
        firstName: '',
        lastName: '',
        street: '',
        postalCode: '',
        city: '',
        phone: '',
        email: '',
        notes: ''
      })
    }
    setPendingRecipient('')
    setError('')
    setShowDeleteConfirm(false)
    setAddDonation(false)
    setDonationData({
      amount: '',
      donationDate: new Date().toISOString().split('T')[0],
      note: ''
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const payload = {
        company: formData.company || null,
        salutation: formData.salutation || null,
        firstName: formData.firstName || null,
        lastName: formData.lastName || null,
        street: formData.street || null,
        postalCode: formData.postalCode || null,
        city: formData.city || null,
        phone: formData.phone || null,
        email: formData.email || null,
        notes: formData.notes || null,
        assignments: recipients.map(r =>
          r.value.startsWith('m:')
            ? { memberId: r.value.slice(2) }
            : { groupId: r.value.slice(2) }
        )
      }

      const url = sponsor ? `/api/sponsors/${sponsor.id}` : '/api/sponsors'
      const method = sponsor ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(
          data.error === 'groupDissolved' ? tValidation('groupDissolved') : data.error || tErrors('saveFailed')
        )
      }

      const sponsorResult = await response.json()
      const sponsorId = sponsor ? sponsor.id : sponsorResult.id

      // Create donation if checkbox is checked and it's a new sponsor
      if (!sponsor && addDonation && donationData.amount) {
        const donationPayload = {
          sponsorId,
          amount: parseFloat(donationData.amount),
          donationDate: donationData.donationDate,
          note: donationData.note || null,
          // The first donation is credited to the first listed recipient
          memberId: recipients[0].value.startsWith('m:') ? recipients[0].value.slice(2) : null,
          groupId: recipients[0].value.startsWith('g:') ? recipients[0].value.slice(2) : null
        }

        const donationResponse = await fetch('/api/donations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(donationPayload)
        })

        if (!donationResponse.ok) {
          const data = await donationResponse.json()
          throw new Error(data.error || tErrors('saveFailed'))
        }
      }

      onSave()
      onHide()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const addRecipient = () => {
    if (!pendingRecipient || recipients.some(r => r.value === pendingRecipient)) return
    const id = pendingRecipient.slice(2)
    const label = pendingRecipient.startsWith('m:')
      ? recipientLabel({ member: members.find(m => m.id === id) ?? null, group: null })
      : recipientLabel({ member: null, group: groups.find(g => g.id === id) ?? null })
    setRecipients([...recipients, { value: pendingRecipient, label }])
    setPendingRecipient('')
  }

  const availableMembers = members.filter(m => !recipients.some(r => r.value === `m:${m.id}`))
  const availableGroups = groups.filter(
    g => !g.dissolvedAt && !recipients.some(r => r.value === `g:${g.id}`)
  )

  const handleDelete = async () => {
    if (!sponsor) return

    setLoading(true)
    setError('')

    try {
      const response = await fetch(`/api/sponsors/${sponsor.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || tErrors('deleteFailed'))
      }

      setShowDeleteConfirm(false)
      onSave()
      onHide()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
    <Modal show={show} onHide={onHide} backdrop="static">
      <Modal.Header closeButton>
        <Modal.Title>
          {sponsor ? t('editSponsor') : t('newSponsor')}
        </Modal.Title>
      </Modal.Header>

      <Form onSubmit={handleSubmit}>
        <Modal.Body>
          {error && <Alert variant="danger">{error}</Alert>}

          {/* Firma */}
          <Form.Group className="mb-3">
            <Form.Label>{t('company')}</Form.Label>
            <Form.Control
              type="text"
              placeholder={t('placeholderCompany')}
              value={formData.company}
              onChange={(e) => setFormData({ ...formData, company: e.target.value })}
              disabled={loading}
              autoFocus
            />
          </Form.Group>

          {/* Anrede + Name in zwei Spalten */}
          <div className="row">
            <div className="col-md-4">
              <Form.Group className="mb-3">
                <Form.Label>{t('salutation')}</Form.Label>
                <Form.Select
                  value={formData.salutation}
                  onChange={(e) => setFormData({ ...formData, salutation: e.target.value })}
                  disabled={loading}
                >
                  <option value="">--</option>
                  <option value="Herr">Herr</option>
                  <option value="Frau">Frau</option>
                  <option value="Familie">Familie</option>
                </Form.Select>
              </Form.Group>
            </div>
            <div className="col-md-4">
              <Form.Group className="mb-3">
                <Form.Label>{t('firstName')}</Form.Label>
                <Form.Control
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  disabled={loading}
                />
              </Form.Group>
            </div>
            <div className="col-md-4">
              <Form.Group className="mb-3">
                <Form.Label>{t('lastName')}</Form.Label>
                <Form.Control
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  disabled={loading}
                />
              </Form.Group>
            </div>
          </div>

          {/* Adresse */}
          <Form.Group className="mb-3">
            <Form.Label>{t('street')}</Form.Label>
            <Form.Control
              type="text"
              placeholder={t('placeholderStreet')}
              value={formData.street}
              onChange={(e) => setFormData({ ...formData, street: e.target.value })}
              disabled={loading}
            />
          </Form.Group>

          <div className="row">
            <div className="col-md-4">
              <Form.Group className="mb-3">
                <Form.Label>{t('postalCode')}</Form.Label>
                <Form.Control
                  type="text"
                  placeholder={t('placeholderPostalCode')}
                  value={formData.postalCode}
                  onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                  disabled={loading}
                />
              </Form.Group>
            </div>
            <div className="col-md-8">
              <Form.Group className="mb-3">
                <Form.Label>{t('city')}</Form.Label>
                <Form.Control
                  type="text"
                  placeholder={t('placeholderCity')}
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  disabled={loading}
                />
              </Form.Group>
            </div>
          </div>

          {/* Kontakt */}
          <div className="row">
            <div className="col-md-6">
              <Form.Group className="mb-3">
                <Form.Label>{t('phone')}</Form.Label>
                <Form.Control
                  type="tel"
                  placeholder={t('placeholderPhone')}
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  disabled={loading}
                />
              </Form.Group>
            </div>
            <div className="col-md-6">
              <Form.Group className="mb-3">
                <Form.Label>{t('email')}</Form.Label>
                <Form.Control
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  disabled={loading}
                />
              </Form.Group>
            </div>
          </div>

          {/* Kommentare */}
          <Form.Group className="mb-3">
            <Form.Label>{t('notes')}</Form.Label>
            <Form.Control
              as="textarea"
              rows={2}
              placeholder={t('placeholderNotes')}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              disabled={loading}
            />
          </Form.Group>

          <hr />

          <Form.Group className="mb-3">
            <Form.Label>{t('assignedTo')} *</Form.Label>
            {recipients.length === 0 && (
              <div className="text-muted small mb-2">{t('recipientRequiredHint')}</div>
            )}
            <ul className="list-group mb-2">
              {recipients.map(r => (
                <li
                  key={r.value}
                  className="list-group-item d-flex justify-content-between align-items-center"
                >
                  <span>{r.label}</span>
                  <Button
                    variant="outline-danger"
                    size="sm"
                    aria-label={t('removeRecipient')}
                    onClick={() => setRecipients(recipients.filter(x => x.value !== r.value))}
                    disabled={loading}
                  >
                    <i className="bi bi-x-lg"></i>
                  </Button>
                </li>
              ))}
            </ul>
            <div className="d-flex gap-2">
              <Form.Select
                aria-label={t('selectRecipient')}
                value={pendingRecipient}
                onChange={(e) => setPendingRecipient(e.target.value)}
                disabled={loading}
              >
                <option value="">-- {t('selectRecipient')} --</option>
                <optgroup label={t('recipientMembers')}>
                  {availableMembers.map(m => (
                    <option key={m.id} value={`m:${m.id}`}>
                      {getMemberDisplayName(m)}
                    </option>
                  ))}
                </optgroup>
                <optgroup label={t('recipientGroups')}>
                  {availableGroups.map(g => (
                    <option key={g.id} value={`g:${g.id}`}>
                      {g.name}
                    </option>
                  ))}
                </optgroup>
              </Form.Select>
              <Button
                variant="outline-primary"
                onClick={addRecipient}
                disabled={loading || !pendingRecipient}
              >
                <i className="bi bi-plus-lg me-1"></i>
                {t('addRecipient')}
              </Button>
            </div>
          </Form.Group>

          {/* Optional first donation - only show for new sponsors */}
          {!sponsor && (
            <>
              <hr className="my-4" />

              <Form.Group className="mb-3">
                <Form.Check
                  type="checkbox"
                  id="addDonation"
                  label={t('addFirstDonation')}
                  checked={addDonation}
                  onChange={(e) => setAddDonation(e.target.checked)}
                  disabled={loading}
                />
              </Form.Group>

              {addDonation && (
                <>
                  <div className="row">
                    <div className="col-md-6">
                      <Form.Group className="mb-3">
                        <Form.Label>{tDonations('amount')} (CHF) *</Form.Label>
                        <Form.Control
                          type="number"
                          step="0.01"
                          min="0"
                          value={donationData.amount}
                          onChange={(e) => setDonationData({ ...donationData, amount: e.target.value })}
                          required={addDonation}
                          disabled={loading}
                        />
                      </Form.Group>
                    </div>
                    <div className="col-md-6">
                      <Form.Group className="mb-3">
                        <Form.Label>{tDonations('date')} *</Form.Label>
                        <Form.Control
                          type="date"
                          value={donationData.donationDate}
                          onChange={(e) => setDonationData({ ...donationData, donationDate: e.target.value })}
                          required={addDonation}
                          disabled={loading}
                        />
                      </Form.Group>
                    </div>
                  </div>

                  <Form.Group className="mb-3">
                    <Form.Label>{tDonations('note')}</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={2}
                      placeholder={tDonations('placeholderNote')}
                      value={donationData.note}
                      onChange={(e) => setDonationData({ ...donationData, note: e.target.value })}
                      disabled={loading}
                    />
                  </Form.Group>
                </>
              )}
            </>
          )}
        </Modal.Body>

        <Modal.Footer>
          <div className="d-flex justify-content-between w-100">
            <div>
              {sponsor && (
                <Button
                  variant="danger"
                  onClick={() => setShowDeleteConfirm(true)}
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
              <Button variant="primary" type="submit" disabled={loading || recipients.length === 0}>
                {loading ? tCommon('saving') : tCommon('save')}
              </Button>
            </div>
          </div>
        </Modal.Footer>
      </Form>
    </Modal>

    <DeleteConfirmModal
      show={showDeleteConfirm}
      title={t('deleteSponsor')}
      message={t('deleteSponsorConfirm', { name: formData.company || `${formData.firstName} ${formData.lastName}`.trim() || '' })}
      onCancel={() => setShowDeleteConfirm(false)}
      onConfirm={handleDelete}
      deleting={loading}
    />
    </>
  )
}
