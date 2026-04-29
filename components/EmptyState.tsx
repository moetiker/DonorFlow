'use client'

import { Card, Button } from 'react-bootstrap'

type EmptyStateProps = {
  /** Bootstrap icon name (without 'bi-' prefix) */
  icon: string
  /** Main heading text */
  title: string
  /** Description text (optional) */
  description?: string
  /** Action button label (optional) */
  actionLabel?: string
  /** Action button click handler (optional) */
  onAction?: () => void
  /** Wrap in a Card component (default: true) */
  card?: boolean
}

/**
 * Reusable empty state component with icon, title, description, and action
 *
 * @example
 * <EmptyState
 *   icon="person-x"
 *   title={t('emptyState')}
 *   description={t('emptyStateDescription')}
 *   actionLabel={t('emptyStateAction')}
 *   onAction={handleNewMember}
 * />
 */
export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  card = true
}: EmptyStateProps) {
  const content = (
    <div className="text-center py-5">
      <i className={`bi bi-${icon} fs-1 text-muted mb-3 d-block`}></i>
      <h5>{title}</h5>
      {description && <p className="text-muted">{description}</p>}
      {actionLabel && onAction && (
        <Button variant="primary" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  )

  if (card) {
    return (
      <Card>
        <Card.Body>{content}</Card.Body>
      </Card>
    )
  }

  return content
}
