'use client'

import { Modal, Button, Form } from 'react-bootstrap'
import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { DeleteConfirmModal } from './DeleteConfirmModal'

type Props = {
  show: boolean
  group: { id: string; name: string } | null
  onHide: () => void
  onSave: () => void
  onDelete?: () => void
}

export function GroupEditModal({ show, group, onHide, onSave, onDelete }: Props) {
  const t = useTranslations('groups')
  const tCommon = useTranslations('common')
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (group) {
      setName(group.name)
    } else {
      setName('')
    }
  }, [group])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    setSaving(true)
    try {
      const isEdit = !!group
      const url = isEdit ? `/api/groups/${group.id}` : '/api/groups'
      const method = isEdit ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() })
      })

      if (response.ok) {
        onSave()
        onHide()
        setName('')
      }
    } catch (error) {
      console.error('Error saving group:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!group) return

    setDeleting(true)
    try {
      const response = await fetch(`/api/groups/${group.id}`, {
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
      console.error('Error deleting group:', error)
    } finally {
      setDeleting(false)
    }
  }

  const isEdit = !!group

  return (
    <Modal show={show} onHide={onHide}>
      <Modal.Header closeButton>
        <Modal.Title>{isEdit ? t('editGroup') : t('newGroup')}</Modal.Title>
      </Modal.Header>
      <Form onSubmit={handleSubmit}>
        <Modal.Body>
          <Form.Group className="mb-3">
            <Form.Label>{t('name')}</Form.Label>
            <Form.Control
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          {isEdit && (
            <div className="me-auto">
              <Button variant="danger" onClick={() => setShowDeleteConfirm(true)} disabled={saving}>
                {tCommon('delete')}
              </Button>
            </div>
          )}
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
        title={`${tCommon('delete')} ${t('group')}`}
        message={t('deleteConfirm')}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
        deleting={deleting}
      />
    </Modal>
  )
}