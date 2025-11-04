'use client'

import { Modal, Button } from 'react-bootstrap'
import { useTranslations } from 'next-intl'

type Props = {
  show: boolean
  title: string
  message: string
  onConfirm: () => void
  onCancel: () => void
  deleting?: boolean
}

export function DeleteConfirmModal({ show, title, message, onConfirm, onCancel, deleting = false }: Props) {
  const tCommon = useTranslations('common')

  return (
    <Modal show={show} onHide={onCancel}>
      <Modal.Header closeButton>
        <Modal.Title>{title}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p>{message}</p>
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
