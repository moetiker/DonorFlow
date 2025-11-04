'use client'

import { Modal, Form, Button, Alert } from 'react-bootstrap'
import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'

type Member = {
  id: string
  firstName: string
  lastName: string
}

type Props = {
  show: boolean
  member: Member | null
  onHide: () => void
  onSave: () => void
}

export function MemberModal({ show, member, onHide, onSave }: Props) {
  const t = useTranslations('members')
  const tCommon = useTranslations('common')
  const tErrors = useTranslations('errors')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: ''
  })

  useEffect(() => {
    if (member) {
      setFormData({
        firstName: member.firstName,
        lastName: member.lastName
      })
    } else {
      setFormData({
        firstName: '',
        lastName: ''
      })
    }
    setError('')
  }, [member, show])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const url = member ? `/api/members/${member.id}` : '/api/members'
      const method = member ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
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
    if (!member) return
    if (!confirm(t('deleteConfirm'))) return

    setLoading(true)
    setError('')

    try {
      const response = await fetch(`/api/members/${member.id}`, {
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
          {member ? t('editMember') : t('newMember')}
        </Modal.Title>
      </Modal.Header>

      <Form onSubmit={handleSubmit}>
        <Modal.Body>
          {error && <Alert variant="danger">{error}</Alert>}

          <Form.Group className="mb-3">
            <Form.Label>{t('firstName')} *</Form.Label>
            <Form.Control
              type="text"
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              required
              disabled={loading}
              autoFocus
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>{t('lastName')} *</Form.Label>
            <Form.Control
              type="text"
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              required
              disabled={loading}
            />
          </Form.Group>
        </Modal.Body>

        <Modal.Footer>
          <div className="d-flex justify-content-between w-100">
            <div>
              {member && (
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
