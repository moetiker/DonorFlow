'use client'

import { Modal, Form, Button, Alert } from 'react-bootstrap'
import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'

type Member = {
  id: string
  firstName: string
  lastName: string
}

type Target = {
  id: string
  memberId: string
  fiscalYearId: string
  targetAmount: number
  member: Member
}

type Props = {
  show: boolean
  target: Target | null
  onHide: () => void
  onSave: () => void
}

export function TargetModal({ show, target, onHide, onSave }: Props) {
  const t = useTranslations('targets')
  const tCommon = useTranslations('common')
  const tErrors = useTranslations('errors')
  const tValidation = useTranslations('validation')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [targetAmount, setTargetAmount] = useState('')

  useEffect(() => {
    if (target) {
      setTargetAmount(target.targetAmount.toString())
    } else {
      setTargetAmount('')
    }
    setError('')
  }, [target, show])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const amount = parseFloat(targetAmount)

      if (isNaN(amount) || amount < 0) {
        throw new Error(tValidation('targetAmountPositive'))
      }

      const response = await fetch(`/api/targets/${target?.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetAmount: amount })
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

  if (!target) return null

  return (
    <Modal show={show} onHide={onHide} backdrop="static">
      <Modal.Header closeButton>
        <Modal.Title>{tCommon('edit')} {t('target')}</Modal.Title>
      </Modal.Header>

      <Form onSubmit={handleSubmit}>
        <Modal.Body>
          {error && <Alert variant="danger">{error}</Alert>}

          <Form.Group className="mb-3">
            <Form.Label>{t('member')}</Form.Label>
            <Form.Control
              type="text"
              value={`${target.member.firstName} ${target.member.lastName}`}
              disabled
              readOnly
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>{t('target')} (CHF) *</Form.Label>
            <Form.Control
              type="number"
              step="0.01"
              min="0"
              value={targetAmount}
              onChange={(e) => setTargetAmount(e.target.value)}
              required
              disabled={loading}
              autoFocus
            />
          </Form.Group>
        </Modal.Body>

        <Modal.Footer>
          <Button variant="secondary" onClick={onHide} disabled={loading}>
            {tCommon('cancel')}
          </Button>
          <Button variant="primary" type="submit" disabled={loading}>
            {loading ? tCommon('saving') : tCommon('save')}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  )
}
