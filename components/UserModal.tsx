'use client'

import { Modal, Button, Form, Alert } from 'react-bootstrap'
import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'

type User = {
  id: string
  username: string
  name: string | null
  createdAt: Date
  updatedAt: Date
}

type Props = {
  show: boolean
  user: User | null
  onHide: () => void
  onSave: () => void
}

export function UserModal({ show, user, onHide, onSave }: Props) {
  const t = useTranslations('users')
  const tCommon = useTranslations('common')
  const tErrors = useTranslations('errors')
  const tValidation = useTranslations('validation')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  useEffect(() => {
    if (show) {
      if (user) {
        setUsername(user.username)
        setName(user.name || '')
        setPassword('')
      } else {
        setUsername('')
        setPassword('')
        setName('')
      }
      setError(null)
      setShowDeleteConfirm(false)
      setShowPassword(false)
    }
  }, [show, user])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!username.trim()) {
      setError(tValidation('usernameRequired'))
      return
    }

    if (!user && !password) {
      setError(tValidation('required'))
      return
    }

    if (password && password.length < 6) {
      setError(tValidation('passwordMinLength'))
      return
    }

    setSubmitting(true)

    try {
      const method = user ? 'PUT' : 'POST'
      const url = user ? `/api/users/${user.id}` : '/api/users'

      const body: any = {
        username: username.trim(),
        name: name.trim() || null
      }

      // Only include password if provided
      if (password) {
        body.password = password
      }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || tErrors('saveFailed'))
        setSubmitting(false)
        return
      }

      onSave()
      onHide()
    } catch (err) {
      console.error('Error saving user:', err)
      setError(tErrors('saveFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!user) return

    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || tErrors('deleteFailed'))
        setSubmitting(false)
        setShowDeleteConfirm(false)
        return
      }

      onSave()
      onHide()
    } catch (err) {
      console.error('Error deleting user:', err)
      setError(tErrors('deleteFailed'))
      setSubmitting(false)
      setShowDeleteConfirm(false)
    }
  }

  return (
    <Modal show={show} onHide={onHide} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>
          {user ? t('editUser') : t('newUser')}
        </Modal.Title>
      </Modal.Header>

      <Form onSubmit={handleSubmit}>
        <Modal.Body>
          {error && (
            <Alert variant="danger" dismissible onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {showDeleteConfirm && (
            <Alert variant="warning">
              <Alert.Heading>{t('deleteConfirm')}</Alert.Heading>
              <p>{t('deleteConfirm')}</p>
              <div className="d-flex gap-2">
                <Button
                  variant="danger"
                  size="sm"
                  onClick={handleDelete}
                  disabled={submitting}
                >
                  {tCommon('yes')}, {tCommon('delete')}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  {tCommon('cancel')}
                </Button>
              </div>
            </Alert>
          )}

          <Form.Group className="mb-3">
            <Form.Label>{t('username')} *</Form.Label>
            <Form.Control
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>
              {t('password')} {user ? '' : '*'}
            </Form.Label>
            <div className="input-group">
              <Form.Control
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={tValidation('passwordMinLength')}
                required={!user}
                minLength={6}
              />
              <Button
                variant="outline-secondary"
                onClick={() => setShowPassword(!showPassword)}
              >
                <i className={`bi bi-eye${showPassword ? '-slash' : ''}`}></i>
              </Button>
            </div>
            {!user && (
              <Form.Text className="text-muted">
                {tValidation('passwordMinLength')}
              </Form.Text>
            )}
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>{t('name')} (optional)</Form.Label>
            <Form.Control
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Form.Group>
        </Modal.Body>

        <Modal.Footer>
          <div className="d-flex justify-content-between w-100">
            <div>
              {user && !showDeleteConfirm && (
                <Button
                  variant="danger"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={submitting}
                >
                  <i className="bi bi-trash me-2"></i>
                  {tCommon('delete')}
                </Button>
              )}
            </div>
            <div className="d-flex gap-2">
              <Button variant="secondary" onClick={onHide} disabled={submitting}>
                {tCommon('cancel')}
              </Button>
              <Button variant="primary" type="submit" disabled={submitting}>
                {submitting ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    {tCommon('saving')}
                  </>
                ) : (
                  <>
                    <i className="bi bi-check-lg me-2"></i>
                    {tCommon('save')}
                  </>
                )}
              </Button>
            </div>
          </div>
        </Modal.Footer>
      </Form>
    </Modal>
  )
}
