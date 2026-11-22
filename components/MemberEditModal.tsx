'use client'

import { Modal, Button, Form, Alert } from 'react-bootstrap'
import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import type { HandOver } from '@/lib/club-pool'
import { getSponsorDisplayName } from '@/lib/utils'
import { DeleteConfirmModal, useHandOverText } from './DeleteConfirmModal'

type Group = {
  id: string
  name: string
}

type MemberSponsor = {
  id: string
  company: string | null
  firstName: string | null
  lastName: string | null
}

type Props = {
  show: boolean
  member: {
    id: string
    firstName: string
    lastName: string
    email?: string | null
    phone?: string | null
    groupId?: string | null
    group?: { id: string; name: string } | null
  } | null
  onHide: () => void
  onSave: () => void
  onDelete?: () => void
}

export function MemberEditModal({ show, member, onHide, onSave, onDelete }: Props) {
  const t = useTranslations('members')
  const tCommon = useTranslations('common')
  const handOverText = useHandOverText()
  const tErrors = useTranslations('errors')
  const tGroups = useTranslations('groups')
  const tValidation = useTranslations('validation')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [selectedGroupId, setSelectedGroupId] = useState<string>('')
  const [groups, setGroups] = useState<Group[]>([])
  const [memberSponsors, setMemberSponsors] = useState<MemberSponsor[]>([])
  const [moveSponsors, setMoveSponsors] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleteImpact, setDeleteImpact] = useState<(HandOver & { poolName: string }) | null>(null)

  // Fill the form while rendering instead of in an effect, so the fields for a
  // newly selected member are correct on the very first render.
  const [formSource, setFormSource] = useState(member)
  if (formSource !== member) {
    setFormSource(member)
    if (member) {
      setFirstName(member.firstName)
      setLastName(member.lastName)
      setEmail(member.email || '')
      setPhone(member.phone || '')
      // Get current group if member is in one
      setSelectedGroupId(member.groupId || '')
      setMoveSponsors(true)
      setMemberSponsors([])
    }
  }

  // Joining a (different) group: offer to take the member's sponsors along
  const joinsGroup = selectedGroupId !== '' && selectedGroupId !== (member?.groupId || '')
  const offerMoveSponsors = joinsGroup && memberSponsors.length > 0

  const loadGroups = useCallback(async () => {
    try {
      const response = await fetch('/api/groups')
      const data = await response.json()
      setGroups(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error loading groups:', error)
      setGroups([])
    }
  }, [])

  useEffect(() => {
    // Load available groups. Wrapped in an async function so the load starts
    // after the effect has run, instead of updating state synchronously in it.
    const run = async () => {
      if (show) {
        await loadGroups()
      }
    }
    void run()
  }, [show, loadGroups])

  const memberId = member?.id
  useEffect(() => {
    // The member's own sponsors, listed when the member joins a group
    const run = async () => {
      if (!show || !memberId) return
      try {
        const response = await fetch(`/api/members/${memberId}/sponsors`)
        const data = response.ok ? await response.json() : []
        setMemberSponsors(Array.isArray(data) ? data : [])
      } catch (error) {
        console.error('Error loading member sponsors:', error)
        setMemberSponsors([])
      }
    }
    void run()
  }, [show, memberId])

  const loadDeleteImpact = async () => {
    if (!member) return

    setDeleteImpact(null)
    try {
      const response = await fetch(`/api/members/${member.id}/impact`)
      if (response.ok) {
        setDeleteImpact(await response.json())
      }
    } catch (error) {
      console.error('Error loading delete impact:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!member) return

    setError(null)
    setSaving(true)
    try {
      const response = await fetch(`/api/members/${member.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName,
          lastName,
          email: email || null,
          phone: phone || null,
          groupId: selectedGroupId || null,
          moveSponsorsToGroup: offerMoveSponsors && moveSponsors
        })
      })

      if (response.ok) {
        onSave()
        onHide()
      } else {
        const data = await response.json()
        setError(data.error === 'groupDissolved' ? tValidation('groupDissolved') : data.error || tErrors('saveFailed'))
      }
    } catch (error) {
      console.error('Error updating member:', error)
      setError(tErrors('saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!member) return

    setError(null)
    setDeleting(true)
    try {
      const response = await fetch(`/api/members/${member.id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setShowDeleteConfirm(false)
        onHide()
        if (onDelete) {
          onDelete()
        } else {
          onSave() // Fallback to refresh
        }
      } else {
        const data = await response.json()
        if (data.error === 'noClubPool' || data.error === 'clubPoolLocked') {
          setError(tGroups(data.error))
        } else {
          setError(tErrors('deleteFailed'))
        }
      }
    } catch (error) {
      console.error('Error deleting member:', error)
      setError(tErrors('deleteFailed'))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Modal show={show} onHide={onHide}>
      <Modal.Header closeButton>
        <Modal.Title>{t('editMember')}</Modal.Title>
      </Modal.Header>
      <Form onSubmit={handleSubmit}>
        <Modal.Body>
          <Form.Group className="mb-3">
            <Form.Label>{t('firstName')}</Form.Label>
            <Form.Control
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>{t('lastName')}</Form.Label>
            <Form.Control
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>{t('email')}</Form.Label>
            <Form.Control
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>{t('phone')}</Form.Label>
            <Form.Control
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>{t('group')}</Form.Label>
            <Form.Select
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
            >
              <option value="">-</option>
              {groups.map(group => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
          {offerMoveSponsors && (
            <Form.Group className="mb-3">
              <Form.Check
                type="checkbox"
                id="move-sponsors-to-group"
                label={t('moveSponsorsToGroup')}
                checked={moveSponsors}
                onChange={(e) => setMoveSponsors(e.target.checked)}
              />
              <Form.Text className="text-muted">
                {memberSponsors.map(getSponsorDisplayName).join(', ')}
              </Form.Text>
            </Form.Group>
          )}
          {error && !showDeleteConfirm && <Alert variant="danger" className="mb-0">{error}</Alert>}
        </Modal.Body>
        <Modal.Footer>
          <div className="me-auto">
            <Button
              variant="danger"
              onClick={() => {
                setError(null)
                setShowDeleteConfirm(true)
                loadDeleteImpact()
              }}
              disabled={saving}
            >
              {tCommon('delete')}
            </Button>
          </div>
          <Button variant="secondary" onClick={onHide}>
            {tCommon('cancel')}
          </Button>
          <Button variant="primary" type="submit" disabled={saving}>
            {saving ? tCommon('saving') : tCommon('save')}
          </Button>
        </Modal.Footer>
      </Form>

      <DeleteConfirmModal
        show={showDeleteConfirm}
        title={`${tCommon('delete')} ${tCommon('member')}`}
        message={t('deleteConfirm')}
        detail={deleteImpact ? handOverText(deleteImpact) : null}
        error={error}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
        deleting={deleting}
      />
    </Modal>
  )
}
