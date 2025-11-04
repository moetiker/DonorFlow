'use client'

import { Modal, Table, Badge, Button } from 'react-bootstrap'
import { DonationModal } from './DonationModal'
import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useLocalizedFormatters } from '@/lib/i18n/formatters'

type Donation = {
  id: string
  amount: number
  donationDate: Date
  note: string | null
  sponsorId: string
}

type Sponsor = {
  id: string
  company: string | null
  salutation: string | null
  firstName: string | null
  lastName: string | null
  member?: { firstName: string; lastName: string }
  group?: { name: string }
}

type Props = {
  show: boolean
  sponsorId: string | null
  sponsorName: string
  onHide: () => void
}

function getSponsorDisplayName(sponsor: Sponsor, unknownText: string = 'Unknown') {
  if (sponsor.company) return sponsor.company
  const parts = [sponsor.firstName, sponsor.lastName].filter(Boolean)
  return parts.length > 0 ? parts.join(' ') : unknownText
}

export function SponsorDonationsModal({ show, sponsorId, sponsorName, onHide }: Props) {
  const t = useTranslations('donations')
  const tCommon = useTranslations('common')
  const { formatCurrency, formatDate } = useLocalizedFormatters()
  const [donations, setDonations] = useState<Donation[]>([])
  const [sponsors, setSponsors] = useState<Sponsor[]>([])
  const [loading, setLoading] = useState(false)
  const [showDonationModal, setShowDonationModal] = useState(false)
  const [selectedDonation, setSelectedDonation] = useState<Donation | null>(null)

  useEffect(() => {
    if (show && sponsorId) {
      loadDonations()
      loadSponsors()
    }
  }, [show, sponsorId])

  const loadDonations = async () => {
    if (!sponsorId) return

    setLoading(true)
    try {
      const response = await fetch(`/api/sponsors/${sponsorId}/donations`)
      const data = await response.json()
      setDonations(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error loading donations:', error)
      setDonations([])
    } finally {
      setLoading(false)
    }
  }

  const loadSponsors = async () => {
    try {
      const response = await fetch('/api/sponsors?include=all')
      const data = await response.json()
      setSponsors(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error loading sponsors:', error)
      setSponsors([])
    }
  }

  const handleNewDonation = () => {
    setSelectedDonation(null)
    setShowDonationModal(true)
  }

  const handleEditDonation = (donation: Donation) => {
    setSelectedDonation(donation)
    setShowDonationModal(true)
  }

  const handleDonationSave = () => {
    loadDonations()
    setShowDonationModal(false)
    setSelectedDonation(null)
  }

  const totalAmount = donations.reduce((sum, d) => sum + d.amount, 0)

  return (
    <>
      <Modal show={show} onHide={onHide} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>{t('title')}: {sponsorName}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">{tCommon('loading')}</span>
              </div>
            </div>
          ) : (
            <>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <div>
                  <Badge bg="info" className="fs-6 me-2">
                    {donations.length} {t('title')}
                  </Badge>
                  <Badge bg="success" className="fs-6">
                    {tCommon('total')}: {formatCurrency(totalAmount)}
                  </Badge>
                </div>
                <Button variant="primary" size="sm" onClick={handleNewDonation}>
                  <i className="bi bi-plus-circle me-2"></i>
                  {t('newDonation')}
                </Button>
              </div>

              {donations.length === 0 ? (
                <div className="text-center py-5 text-muted">
                  <i className="bi bi-inbox fs-1 mb-3 d-block"></i>
                  <p>{t('emptyState')}</p>
                </div>
              ) : (
                <Table striped hover>
                  <thead>
                    <tr>
                      <th>{t('date')}</th>
                      <th>{t('amount')}</th>
                      <th>{t('note')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {donations.map((donation) => (
                      <tr
                        key={donation.id}
                        onClick={() => handleEditDonation(donation)}
                        style={{ cursor: 'pointer' }}
                      >
                        <td>{formatDate(donation.donationDate)}</td>
                        <td><strong>{formatCurrency(donation.amount)}</strong></td>
                        <td className="text-muted">{donation.note || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </>
          )}
        </Modal.Body>
      </Modal>

      <DonationModal
        show={showDonationModal}
        donation={selectedDonation}
        sponsors={sponsors}
        onHide={() => {
          setShowDonationModal(false)
          setSelectedDonation(null)
        }}
        onSave={handleDonationSave}
      />
    </>
  )
}
