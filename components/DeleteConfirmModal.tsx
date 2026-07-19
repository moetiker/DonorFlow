'use client'

import { Modal, Button, Alert } from 'react-bootstrap'
import { useTranslations } from 'next-intl'

type Props = {
  show: boolean
  title: string
  message: string
  detail?: string | null
  error?: string | null
  onConfirm: () => void
  onCancel: () => void
  deleting?: boolean
}

export function DeleteConfirmModal({ show, title, message, detail, error, onConfirm, onCancel, deleting = false }: Props) {
  const tCommon = useTranslations('common')

  return (
    <Modal show={show} onHide={onCancel}>
      <Modal.Header closeButton>
        <Modal.Title>{title}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {error && <Alert variant="danger">{error}</Alert>}
        <p>{message}</p>
        {detail && <p className="text-muted mb-0">{detail}</p>}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onCancel} disabled={deleting}>
          {tCommon('cancel')}
        </Button>
        <Button variant="danger" onClick={onConfirm} disabled={deleting}>
          {deleting ? tCommon('deleting') : tCommon('delete')}
        </Button>
      </Modal.Footer>
    </Modal>
  )
}
