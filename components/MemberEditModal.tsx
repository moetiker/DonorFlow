'use client'

import { Modal, Button, Form } from 'react-bootstrap'
import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { DeleteConfirmModal } from './DeleteConfirmModal'

type Group = {
  id: string
  name: string
}

type Props = {
  show: boolean
  member: {
    id: string
    firstName: string
    lastName: string
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
  const tErrors = useTranslations('errors')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [selectedGroupId, setSelectedGroupId] = useState<string>('')
  const [groups, setGroups] = useState<Group[]>([])
  const [saving, setSaving] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (member) {
      setFirstName(member.firstName)
      setLastName(member.lastName)
      // Get current group if member is in one
      setSelectedGroupId(member.groupId || '')
    }
  }, [member])

  useEffect(() => {
    // Load available groups
    if (show) {
      loadGroups()
    }
  }, [show])

  const loadGroups = async () => {
    try {
      const response = await fetch('/api/groups')
      const data = await response.json()
      setGroups(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error loading groups:', error)
      setGroups([])
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
          groupId: selectedGroupId || null
        })
      })

      if (response.ok) {
        onSave()
        onHide()
      } else {
        const data = await response.json()
        setError(data.error || tErrors('saveFailed'))
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
      }
    } catch (error) {
      console.error('Error deleting member:', error)
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
        </Modal.Body>
        <Modal.Footer>
          <div className="me-auto">
            <Button variant="danger" onClick={() => setShowDeleteConfirm(true)} disabled={saving}>
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
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
        deleting={deleting}
      />
    </Modal>
  )
}
