'use client'

import { Modal, Table, Badge } from 'react-bootstrap'
import { useState, useEffect } from 'react'
import { getSponsorDisplayName } from '@/lib/utils'
import { useTranslations } from 'next-intl'
import { useLocalizedFormatters } from '@/lib/i18n/formatters'

type Donation = {
  id: string
  amount: number
  donationDate: string
  note: string | null
  sponsor: {
    company: string | null
    salutation: string | null
    firstName: string | null
    lastName: string | null
  }
}

type Props = {
  show: boolean
  entityId: string | null
  entityName: string
  entityType: 'member' | 'group'
  onHide: () => void
}

export function DonationsModal({ show, entityId, entityName, entityType, onHide }: Props) {
  const t = useTranslations('donations')
  const tCommon = useTranslations('common')
  const { formatCurrency, formatDate } = useLocalizedFormatters()
  const [donations, setDonations] = useState<Donation[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (show && entityId) {
      loadDonations()
    }
  }, [show, entityId])

  const loadDonations = async () => {
    if (!entityId) return

    setLoading(true)
    try {
      const endpoint = entityType === 'member'
        ? `/api/members/${entityId}/donations`
        : `/api/groups/${entityId}/donations`

      const response = await fetch(endpoint)
      const data = await response.json()
      setDonations(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error loading donations:', error)
      setDonations([])
    } finally {
      setLoading(false)
    }
  }

  const totalAmount = donations.reduce((sum, d) => sum + d.amount, 0)

  return (
    <Modal show={show} onHide={onHide} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>{t('title')}: {entityName}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">{tCommon('loading')}</span>
            </div>
          </div>
        ) : donations.length === 0 ? (
          <div className="text-center py-5 text-muted">
            <i className="bi bi-inbox fs-1 mb-3 d-block"></i>
            <p>{t('emptyState')}</p>
          </div>
        ) : (
          <>
            <div className="mb-3">
              <strong>{tCommon('total')}:</strong>{' '}
              <Badge bg="success" className="fs-6 ms-2">
                {formatCurrency(totalAmount)}
              </Badge>
            </div>
            <Table striped hover>
              <thead>
                <tr>
                  <th>{t('date')}</th>
                  <th>{t('sponsor')}</th>
                  <th className="text-end">{t('amount')}</th>
                  <th>{t('note')}</th>
                </tr>
              </thead>
              <tbody>
                {donations.map((donation) => (
                  <tr key={donation.id}>
                    <td>{formatDate(donation.donationDate)}</td>
                    <td>{getSponsorDisplayName(donation.sponsor)}</td>
                    <td className="text-end">
                      <strong className="text-success">
                        {formatCurrency(donation.amount)}
                      </strong>
                    </td>
                    <td className="text-muted">{donation.note || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </>
        )}
      </Modal.Body>
    </Modal>
  )
}
