'use client'

import { Modal, Form, Button, Alert } from 'react-bootstrap'
import { Typeahead } from 'react-bootstrap-typeahead'
import 'react-bootstrap-typeahead/css/Typeahead.css'
import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { DeleteConfirmModal } from './DeleteConfirmModal'

type Sponsor = {
  id: string
  company: string | null
  salutation: string | null
  firstName: string | null
  lastName: string | null
  member?: { id: string; firstName: string; lastName: string }
  group?: { id: string; name: string }
}

type Member = {
  id: string
  firstName: string
  lastName: string
}

type Group = {
  id: string
  name: string
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
  type: 'MONETARY' | 'IN_KIND'
  amount: number | null
  description: string | null
  donationDate: Date
  note: string | null
  memberId: string | null
  groupId: string | null
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
    memberId: '',
    groupId: ''
  })
  const [selectedSponsor, setSelectedSponsor] = useState<Sponsor[]>([])
  const [selectedMember, setSelectedMember] = useState<Member[]>([])
  const [selectedGroup, setSelectedGroup] = useState<Group[]>([])

  useEffect(() => {
    if (donation) {
      setFormData({
        sponsorId: donation.sponsorId,
        type: donation.type || 'MONETARY',
        amount: donation.amount?.toString() || '',
        description: donation.description || '',
        donationDate: new Date(donation.donationDate).toISOString().split('T')[0],
        note: donation.note || '',
        memberId: donation.memberId || '',
        groupId: donation.groupId || ''
      })
      // Set typeahead selections
      const sponsor = sponsors.find(s => s.id === donation.sponsorId)
      setSelectedSponsor(sponsor ? [sponsor] : [])
      const member = members.find(m => m.id === donation.memberId)
      setSelectedMember(member ? [member] : [])
      const group = groups.find(g => g.id === donation.groupId)
      setSelectedGroup(group ? [group] : [])
    } else {
      setFormData({
        sponsorId: '',
        type: 'MONETARY',
        amount: '',
        description: '',
        donationDate: new Date().toISOString().split('T')[0],
        note: '',
        memberId: '',
        groupId: ''
      })
      setSelectedSponsor([])
      setSelectedMember([])
      setSelectedGroup([])
    }
    setError('')
    setShowDeleteConfirm(false)
  }, [donation, show, sponsors, members, groups])

  // Auto-populate member/group when sponsor is selected
  const handleSponsorChange = (selected: any[]) => {
    if (selected.length > 0) {
      const sponsor = selected[0] as Sponsor
      setSelectedSponsor([sponsor])
      setFormData(prev => {
        const newData = { ...prev, sponsorId: sponsor.id }

        // Auto-fill member/group from sponsor if fields are empty and not editing
        if (!donation && !prev.memberId && !prev.groupId) {
          if (sponsor.member) {
            newData.memberId = sponsor.member.id
            newData.groupId = ''
            setSelectedMember([sponsor.member])
            setSelectedGroup([])
          } else if (sponsor.group) {
            newData.groupId = sponsor.group.id
            newData.memberId = ''
            setSelectedGroup([sponsor.group])
            setSelectedMember([])
          }
        }

        return newData
      })
    } else {
      setSelectedSponsor([])
      setFormData(prev => ({ ...prev, sponsorId: '' }))
    }
  }

  const handleMemberChange = (selected: any[]) => {
    if (selected.length > 0) {
      const member = selected[0] as Member
      setSelectedMember([member])
      setSelectedGroup([])
      setFormData(prev => ({ ...prev, memberId: member.id, groupId: '' }))
    } else {
      setSelectedMember([])
      setFormData(prev => ({ ...prev, memberId: '' }))
    }
  }

  const handleGroupChange = (selected: any[]) => {
    if (selected.length > 0) {
      const group = selected[0] as Group
      setSelectedGroup([group])
      setSelectedMember([])
      setFormData(prev => ({ ...prev, groupId: group.id, memberId: '' }))
    } else {
      setSelectedGroup([])
      setFormData(prev => ({ ...prev, groupId: '' }))
    }
  }

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
        memberId: formData.memberId || null,
        groupId: formData.groupId || null
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
                const assignment = sponsor.member
                  ? ` (${sponsor.member.firstName} ${sponsor.member.lastName})`
                  : sponsor.group
                    ? ` (${sponsor.group.name})`
                    : ''
                return name + assignment
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

            <div className="row">
              <div className="col-md-6">
                <Form.Label className="text-muted small">{tCommon('member')}</Form.Label>
                <Typeahead
                  id="member-typeahead"
                  labelKey={(option) => {
                    const member = option as Member
                    return `${member.firstName} ${member.lastName}`
                  }}
                  options={members}
                  selected={selectedMember}
                  onChange={handleMemberChange}
                  placeholder={`-- ${tCommon('member')} --`}
                  disabled={loading || selectedGroup.length > 0}
                  emptyLabel={t('noResults')}
                />
              </div>

              <div className="col-md-6">
                <Form.Label className="text-muted small">{tCommon('group')}</Form.Label>
                <Typeahead
                  id="group-typeahead"
                  labelKey={(option) => {
                    const group = option as Group
                    return group.name
                  }}
                  options={groups}
                  selected={selectedGroup}
                  onChange={handleGroupChange}
                  placeholder={`-- ${tCommon('group')} --`}
                  disabled={loading || selectedMember.length > 0}
                  emptyLabel={t('noResults')}
                />
              </div>
            </div>
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
              <Button variant="primary" type="submit" disabled={loading}>
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
