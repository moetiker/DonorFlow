'use client'

import { Modal, Table, Badge, Button } from 'react-bootstrap'
import { DonationModal } from './DonationModal'
import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { useLocalizedFormatters } from '@/lib/i18n/formatters'
import { recipientLabel } from '@/lib/crediting'

type Donation = {
  id: string
  type: 'MONETARY' | 'IN_KIND'
  amount: number | null
  description: string | null
  donationDate: Date
  note: string | null
  sponsorId: string
  memberId: string | null
  groupId: string | null
  // The donation's own recipient
  member?: { id: string; firstName: string; lastName: string } | null
  group?: { id: string; name: string } | null
}

type Assignment = {
  memberId: string | null
  groupId: string | null
  member: { id: string; firstName: string; lastName: string } | null
  group: { id: string; name: string } | null
}

type Sponsor = {
  id: string
  company: string | null
  salutation: string | null
  firstName: string | null
  lastName: string | null
  assignments?: Assignment[]
}

type Member = {
  id: string
  firstName: string
  lastName: string
}

type Group = {
  id: string
  name: string
  dissolvedAt?: string | null
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
  const [members, setMembers] = useState<Member[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(false)
  const [showDonationModal, setShowDonationModal] = useState(false)
  const [selectedDonation, setSelectedDonation] = useState<Donation | null>(null)

  const loadDonations = useCallback(async () => {
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
  }, [sponsorId])

  const loadSponsors = useCallback(async () => {
    try {
      const response = await fetch('/api/sponsors?include=all')
      const data = await response.json()
      setSponsors(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error loading sponsors:', error)
      setSponsors([])
    }
  }, [])

  const loadMembers = useCallback(async () => {
    try {
      const response = await fetch('/api/members')
      const data = await response.json()
      setMembers(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error loading members:', error)
      setMembers([])
    }
  }, [])

  const loadGroups = useCallback(async () => {
    try {
      // Dissolved groups too: a donation may already be credited to one
      const response = await fetch('/api/groups?include=dissolved')
      const data = await response.json()
      setGroups(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error loading groups:', error)
      setGroups([])
    }
  }, [])

  useEffect(() => {
    // Wrapped in an async function so the loads start after the effect has
    // run, instead of updating state synchronously inside it.
    const run = async () => {
      if (show && sponsorId) {
        await Promise.all([loadDonations(), loadSponsors(), loadMembers(), loadGroups()])
      }
    }
    void run()
  }, [show, sponsorId, loadDonations, loadSponsors, loadMembers, loadGroups])

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

  const totalAmount = donations.reduce((sum, d) => sum + (d.amount || 0), 0)

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
                      <th>{t('assignment')}</th>
                      <th>{t('type')}</th>
                      <th>{t('amountOrDescription')}</th>
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
                        <td>
                          {recipientLabel(
                            { member: donation.member ?? null, group: donation.group ?? null },
                            tCommon('group')
                          )}
                        </td>
                        <td>
                          <Badge bg={donation.type === 'MONETARY' ? 'success' : 'info'}>
                            {donation.type === 'MONETARY' ? t('monetary') : t('inKind')}
                          </Badge>
                        </td>
                        <td>
                          {donation.type === 'MONETARY' ? (
                            <strong>{formatCurrency(donation.amount || 0)}</strong>
                          ) : (
                            <em>{donation.description || '-'}</em>
                          )}
                        </td>
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
        members={members}
        groups={groups}
        onHide={() => {
          setShowDonationModal(false)
          setSelectedDonation(null)
        }}
        onSave={handleDonationSave}
      />
    </>
  )
}
