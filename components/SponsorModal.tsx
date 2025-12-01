'use client'

import { Modal, Form, Button, Alert } from 'react-bootstrap'
import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'

type Member = { id: string; firstName: string; lastName: string }
type Group = { id: string; name: string }

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
  memberId: string | null
  groupId: string | null
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
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
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
    assignmentType: 'member' as 'member' | 'group',
    memberId: '',
    groupId: ''
  })
  const [donationData, setDonationData] = useState({
    amount: '',
    donationDate: new Date().toISOString().split('T')[0],
    note: ''
  })

  useEffect(() => {
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
        assignmentType: sponsor.memberId ? 'member' : 'group',
        memberId: sponsor.memberId || '',
        groupId: sponsor.groupId || ''
      })
    } else {
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
        notes: '',
        assignmentType: 'member',
        memberId: '',
        groupId: ''
      })
    }
    setError('')
    setAddDonation(false)
    setDonationData({
      amount: '',
      donationDate: new Date().toISOString().split('T')[0],
      note: ''
    })
  }, [sponsor, show])

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
        memberId: formData.assignmentType === 'member' ? formData.memberId : null,
        groupId: formData.assignmentType === 'group' ? formData.groupId : null
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
        throw new Error(data.error || tErrors('saveFailed'))
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
          memberId: formData.assignmentType === 'member' ? formData.memberId : null,
          groupId: formData.assignmentType === 'group' ? formData.groupId : null
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

  const handleDelete = async () => {
    if (!sponsor) return
    if (!confirm(t('deleteConfirm'))) return

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
            <div className="mb-2">
              <Form.Check
                type="radio"
                id="assignmentMember"
                label={t('assignToMember')}
                checked={formData.assignmentType === 'member'}
                onChange={() => setFormData({ ...formData, assignmentType: 'member' })}
                disabled={loading}
              />
              <Form.Check
                type="radio"
                id="assignmentGroup"
                label={t('assignToGroup')}
                checked={formData.assignmentType === 'group'}
                onChange={() => setFormData({ ...formData, assignmentType: 'group' })}
                disabled={loading}
              />
            </div>
          </Form.Group>

          {formData.assignmentType === 'member' && (
            <Form.Group className="mb-3">
              <Form.Label>{tCommon('member')} *</Form.Label>
              <Form.Select
                value={formData.memberId}
                onChange={(e) => setFormData({ ...formData, memberId: e.target.value })}
                required
                disabled={loading}
              >
                <option value="">-- {tCommon('member')} --</option>
                {members.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.firstName} {m.lastName}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
          )}

          {formData.assignmentType === 'group' && (
            <Form.Group className="mb-3">
              <Form.Label>{tCommon('group')} *</Form.Label>
              <Form.Select
                value={formData.groupId}
                onChange={(e) => setFormData({ ...formData, groupId: e.target.value })}
                required
                disabled={loading}
              >
                <option value="">-- {tCommon('group')} --</option>
                {groups.map(g => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
          )}

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
