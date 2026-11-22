'use client'

import { Modal, Form, Button, Alert } from 'react-bootstrap'
import { Typeahead } from 'react-bootstrap-typeahead'
import 'react-bootstrap-typeahead/css/Typeahead.css'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { DeleteConfirmModal } from './DeleteConfirmModal'
import { recipientLabel } from '@/lib/crediting'

type Sponsor = {
  id: string
  company: string | null
  salutation: string | null
  firstName: string | null
  lastName: string | null
  assignments?: Assignment[]
}

type Assignment = {
  memberId: string | null
  groupId: string | null
  member: { id: string; firstName: string; lastName: string } | null
  group: { id: string; name: string } | null
}

type Member = {
  id: string
  firstName: string
  lastName: string
}

type Group = {
  id: string
  name: string
  dissolvedAt?: string | null
}

/** Form value of a recipient: "m:<id>" for a member, "g:<id>" for a group. */
const assignmentValue = (a: { memberId: string | null; groupId: string | null }) =>
  a.memberId ? `m:${a.memberId}` : `g:${a.groupId}`

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
  type: 'MONETARY' | 'IN_KIND'
  amount: number | null
  description: string | null
  donationDate: Date
  note: string | null
  memberId: string | null
  groupId: string | null
  member?: { id: string; firstName: string; lastName: string } | null
  group?: { id: string; name: string } | null
}

type Props = {
  show: boolean
  donation: Donation | null
  sponsors: Sponsor[]
  members: Member[]
  groups: Group[]
  onHide: () => void
  onSave: () => void
}

export function DonationModal({ show, donation, sponsors, members, groups, onHide, onSave }: Props) {
  const t = useTranslations('donations')
  const tCommon = useTranslations('common')
  const tErrors = useTranslations('errors')
  const tValidation = useTranslations('validation')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [formData, setFormData] = useState({
    sponsorId: '',
    type: 'MONETARY' as 'MONETARY' | 'IN_KIND',
    amount: '',
    description: '',
    donationDate: new Date().toISOString().split('T')[0],
    note: '',
    recipient: ''
  })
  const [selectedSponsor, setSelectedSponsor] = useState<Sponsor[]>([])

  // Reset the form while rendering instead of in an effect, so the fields for a
  // newly opened (or switched) donation are correct on the very first render.
  // The lookup lists are part of the trigger because the typeahead selections
  // can only be resolved once they have arrived.
  const [formSource, setFormSource] = useState({ show, donation, sponsors, members, groups })
  if (formSource.show !== show ||
    formSource.donation !== donation ||
    formSource.sponsors !== sponsors ||
    formSource.members !== members ||
    formSource.groups !== groups) {
    setFormSource({ show, donation, sponsors, members, groups })
    if (donation) {
      setFormData({
        sponsorId: donation.sponsorId,
        type: donation.type || 'MONETARY',
        amount: donation.amount?.toString() || '',
        description: donation.description || '',
        donationDate: new Date(donation.donationDate).toISOString().split('T')[0],
        note: donation.note || '',
        recipient: donation.memberId
          ? `m:${donation.memberId}`
          : donation.groupId ? `g:${donation.groupId}` : ''
      })
      // Set typeahead selection
      const sponsor = sponsors.find(s => s.id === donation.sponsorId)
      setSelectedSponsor(sponsor ? [sponsor] : [])
    } else {
      setFormData({
        sponsorId: '',
        type: 'MONETARY',
        amount: '',
        description: '',
        donationDate: new Date().toISOString().split('T')[0],
        note: '',
        recipient: ''
      })
      setSelectedSponsor([])
    }
    setError('')
    setShowDeleteConfirm(false)
  }

  // A sponsor with exactly one recipient pre-fills it; with several the user
  // must choose, so no recipient is pre-selected.
  const handleSponsorChange = (selected: any[]) => {
    if (selected.length > 0) {
      const sponsor = selected[0] as Sponsor
      setSelectedSponsor([sponsor])
      setFormData(prev => {
        const newData = { ...prev, sponsorId: sponsor.id }
        if (!donation) {
          const assignments = sponsor.assignments ?? []
          newData.recipient = assignments.length === 1 ? assignmentValue(assignments[0]) : ''
        }
        return newData
      })
    } else {
      setSelectedSponsor([])
      setFormData(prev => ({ ...prev, sponsorId: '' }))
    }
  }

  // The sponsor's recipients come first, then every other member and group.
  // Dissolved groups are not offered, except the one the donation already has.
  const sponsorOptions = (selectedSponsor[0]?.assignments ?? []).map(a => ({
    value: assignmentValue(a),
    label: recipientLabel(a)
  }))
  const sponsorValues = new Set(sponsorOptions.map(o => o.value))
  const otherOptions = [
    ...members.map(m => ({
      value: `m:${m.id}`,
      label: recipientLabel({ member: m, group: null })
    })),
    ...groups
      .filter(g => !g.dissolvedAt || donation?.groupId === g.id)
      .map(g => ({ value: `g:${g.id}`, label: recipientLabel({ member: null, group: g }) }))
  ].filter(o => !sponsorValues.has(o.value))

  // Keep the donation's stored recipient selectable even if it is not offered
  // above (e.g. a member or group missing from the lists).
  const knownValues = new Set([...sponsorValues, ...otherOptions.map(o => o.value)])
  const storedRecipient = donation && formData.recipient && !knownValues.has(formData.recipient)
    ? [{
        value: formData.recipient,
        label: recipientLabel({
          member: donation.member ?? null,
          group: donation.group ?? { name: '' }
        })
      }]
    : []

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const payload: Record<string, unknown> = {
        sponsorId: formData.sponsorId,
        type: formData.type,
        donationDate: formData.donationDate,
        note: formData.note || null,
        memberId: formData.recipient.startsWith('m:') ? formData.recipient.slice(2) : null,
        groupId: formData.recipient.startsWith('g:') ? formData.recipient.slice(2) : null
      }

      // Add type-specific fields
      if (formData.type === 'MONETARY') {
        payload.amount = parseFloat(formData.amount)
        payload.description = null
      } else {
        payload.description = formData.description
        payload.amount = null
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
        throw new Error(
          data.error === 'groupDissolved' ? tValidation('groupDissolved') : data.error || tErrors('saveFailed')
        )
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

      setShowDeleteConfirm(false)
      onSave()
      onHide()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Get display name for deletion confirmation
  const getDonationDisplayName = () => {
    if (!donation) return ''
    const sponsor = sponsors.find(s => s.id === donation.sponsorId)
    return sponsor ? getSponsorDisplayName(sponsor) : ''
  }

  return (
    <>
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
            <Typeahead
              id="sponsor-typeahead"
              labelKey={(option) => {
                const sponsor = option as Sponsor
                const name = getSponsorDisplayName(sponsor)
                const labels = (sponsor.assignments ?? []).map(recipientLabel)
                return labels.length > 0 ? `${name} (${labels.join(', ')})` : name
              }}
              options={sponsors}
              selected={selectedSponsor}
              onChange={handleSponsorChange}
              placeholder={t('selectSponsor')}
              disabled={loading}
              autoFocus
              emptyLabel={t('noResults')}
            />
          </Form.Group>

          <hr className="my-4" />

          <Form.Group className="mb-3">
            <Form.Label>{t('assignment')} *</Form.Label>
            <Form.Text className="d-block mb-2 text-muted">
              {t('assignmentHelp')}
            </Form.Text>

            <Form.Select
              aria-label={t('assignment')}
              value={formData.recipient}
              onChange={(e) => setFormData({ ...formData, recipient: e.target.value })}
              disabled={loading}
              required
            >
              <option value="">-- {t('selectRecipient')} --</option>
              {sponsorOptions.length > 0 && (
                <optgroup label={t('sponsorRecipients')}>
                  {sponsorOptions.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </optgroup>
              )}
              {storedRecipient.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
              <optgroup label={sponsorOptions.length > 0 ? t('otherRecipients') : t('assignment')}>
                {otherOptions.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </optgroup>
            </Form.Select>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>{t('donationType')} *</Form.Label>
            <div className="d-flex gap-3">
              <Form.Check
                type="radio"
                id="type-monetary"
                label={t('monetary')}
                checked={formData.type === 'MONETARY'}
                onChange={() => setFormData({ ...formData, type: 'MONETARY' })}
                disabled={loading || !!donation}
              />
              <Form.Check
                type="radio"
                id="type-inkind"
                label={t('inKind')}
                checked={formData.type === 'IN_KIND'}
                onChange={() => setFormData({ ...formData, type: 'IN_KIND' })}
                disabled={loading || !!donation}
              />
            </div>
            <Form.Text className="text-muted">
              {formData.type === 'MONETARY'
                ? t('monetaryHelp')
                : t('inKindHelp')
              }
            </Form.Text>
          </Form.Group>

          {formData.type === 'MONETARY' ? (
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
          ) : (
            <Form.Group className="mb-3">
              <Form.Label>{t('description')} *</Form.Label>
              <Form.Control
                type="text"
                placeholder={t('placeholderDescription')}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                required
                disabled={loading}
                maxLength={200}
              />
            </Form.Group>
          )}

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
              <Button variant="primary" type="submit" disabled={loading || !formData.recipient}>
                {loading ? tCommon('saving') : tCommon('save')}
              </Button>
            </div>
          </div>
        </Modal.Footer>
      </Form>
    </Modal>

    <DeleteConfirmModal
      show={showDeleteConfirm}
      title={t('deleteDonation')}
      message={t('deleteDonationConfirm', { name: getDonationDisplayName() })}
      onCancel={() => setShowDeleteConfirm(false)}
      onConfirm={handleDelete}
      deleting={loading}
    />
    </>
  )
}
