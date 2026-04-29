'use client'

import { Card } from 'react-bootstrap'
import { useTranslations } from 'next-intl'

type LoadingStateProps = {
  /** Wrap in a Card component (default: true) */
  card?: boolean
}

/**
 * Reusable loading spinner component
 *
 * @example
 * {loading ? <LoadingState /> : <Content />}
 */
export function LoadingState({ card = true }: LoadingStateProps) {
  const tCommon = useTranslations('common')

  const spinner = (
    <div className="text-center py-5">
      <div className="spinner-border text-primary" role="status">
        <span className="visually-hidden">{tCommon('loading')}</span>
      </div>
    </div>
  )

  if (card) {
    return (
      <Card>
        <Card.Body>{spinner}</Card.Body>
      </Card>
    )
  }

  return spinner
}
