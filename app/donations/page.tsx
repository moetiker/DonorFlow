'use client'

import { Container, Card, Button, Table, Form, InputGroup, Badge, ButtonGroup } from 'react-bootstrap'
import { Navbar } from '@/components/Navbar'
import { DonationModal } from '@/components/DonationModal'
import { LoadingState } from '@/components/LoadingState'
import { EmptyState } from '@/components/EmptyState'
import { useState, useEffect } from 'react'
import { getSponsorDisplayName } from '@/lib/utils'
import { useTranslations } from 'next-intl'
import { useLocalizedFormatters } from '@/lib/i18n/formatters'

type Donation = {
  id: string
  sponsorId: string
  type: 'MONETARY' | 'IN_KIND'
  amount: number | null
  description: string | null
  donationDate: Date
  note: string | null
  memberId: string | null
  groupId: string | null
  sponsor: {
    company: string | null
    salutation: string | null
    firstName: string | null
    lastName: string | null
    member?: { id: string; firstName: string; lastName: string }
    group?: { id: string; name: string }
  }
  member?: { id: string; firstName: string; lastName: string }
  group?: { id: string; name: string }
}

type Sponsor = {
  id: string
  company: string | null
  salutation: string | null
  firstName: string | null
  lastName: string | null
  member?: { id: string; firstName: string; lastName: string }
  group?: { id: string; name: string }
}

type Member = {
  id: string
  firstName: string
  lastName: string
}

type Group = {
  id: string
  name: string
}

export default function DonationsPage() {
  const [donations, setDonations] = useState<Donation[]>([])
  const [sponsors, setSponsors] = useState<Sponsor[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [selectedDonation, setSelectedDonation] = useState<Donation | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'MONETARY' | 'IN_KIND'>('ALL')
  const t = useTranslations('donations')
  const { formatCurrency, formatDate } = useLocalizedFormatters()

  const loadData = async () => {
    setLoading(true)
    try {
      const typeParam = typeFilter !== 'ALL' ? `&type=${typeFilter}` : ''
      const [donationsRes, sponsorsRes, membersRes, groupsRes] = await Promise.all([
        fetch(`/api/donations?include=all${typeParam}`),
        fetch('/api/sponsors?include=all'),
        fetch('/api/members'),
        fetch('/api/groups')
      ])

      const [donationsData, sponsorsData, membersData, groupsData] = await Promise.all([
        donationsRes.json(),
        sponsorsRes.json(),
        membersRes.json(),
        groupsRes.json()
      ])

      // Ensure data is an array
      setDonations(Array.isArray(donationsData) ? donationsData : [])
      setSponsors(Array.isArray(sponsorsData) ? sponsorsData : [])
      setMembers(Array.isArray(membersData) ? membersData : [])
      setGroups(Array.isArray(groupsData) ? groupsData : [])
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [typeFilter])

  const handleRowClick = (donation: Donation) => {
    setSelectedDonation(donation)
    setShowModal(true)
  }

  const handleNewDonation = () => {
    setSelectedDonation(null)
    setShowModal(true)
  }

  const handleModalClose = () => {
    setShowModal(false)
    setSelectedDonation(null)
  }

  const handleSave = () => {
    loadData()
  }

  // Filter donations based on search term
  const filteredDonations = donations.filter(donation => {
    if (!searchTerm) return true

    const searchLower = searchTerm.toLowerCase()
    const sponsorName = getSponsorDisplayName(donation.sponsor).toLowerCase()
    const memberName = donation.sponsor.member
      ? `${donation.sponsor.member.firstName} ${donation.sponsor.member.lastName}`.toLowerCase()
      : ''
    const groupName = donation.sponsor.group ? donation.sponsor.group.name.toLowerCase() : ''
    const note = (donation.note || '').toLowerCase()
    const description = (donation.description || '').toLowerCase()

    return sponsorName.includes(searchLower) ||
           memberName.includes(searchLower) ||
           groupName.includes(searchLower) ||
           note.includes(searchLower) ||
           description.includes(searchLower)
  })

  return (
    <>
      <Navbar />
      <Container>
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h1>{t('title')}</h1>
          <Button variant="primary" onClick={handleNewDonation}>
            <i className="bi bi-plus-circle me-2"></i>
            {t('newDonation')}
          </Button>
        </div>

        {!loading && (
          <Card className="mb-3">
            <Card.Body>
              <div className="d-flex flex-column flex-md-row gap-3 align-items-md-center">
                <ButtonGroup>
                  <Button
                    variant={typeFilter === 'ALL' ? 'primary' : 'outline-primary'}
                    onClick={() => setTypeFilter('ALL')}
                    size="sm"
                  >
                    {t('allDonations')}
                  </Button>
                  <Button
                    variant={typeFilter === 'MONETARY' ? 'success' : 'outline-success'}
                    onClick={() => setTypeFilter('MONETARY')}
                    size="sm"
                  >
                    <i className="bi bi-cash me-1"></i>
                    {t('monetary')}
                  </Button>
                  <Button
                    variant={typeFilter === 'IN_KIND' ? 'info' : 'outline-info'}
                    onClick={() => setTypeFilter('IN_KIND')}
                    size="sm"
                  >
                    <i className="bi bi-gift me-1"></i>
                    {t('inKind')}
                  </Button>
                </ButtonGroup>

                {donations.length > 0 && (
                  <InputGroup className="flex-grow-1">
                    <InputGroup.Text>
                      <i className="bi bi-search"></i>
                    </InputGroup.Text>
                    <Form.Control
                      type="text"
                      placeholder={t('searchPlaceholder')}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    {searchTerm && (
                      <Button variant="outline-secondary" onClick={() => setSearchTerm('')}>
                        <i className="bi bi-x"></i>
                      </Button>
                    )}
                  </InputGroup>
                )}
              </div>
              {searchTerm && (
                <small className="text-muted mt-2 d-block">
                  {filteredDonations.length} von {donations.length} {t('title')}
                </small>
              )}
            </Card.Body>
          </Card>
        )}

        {loading ? (
          <LoadingState />
        ) : donations.length === 0 ? (
          <EmptyState
            icon="cash-coin"
            title={t('emptyState')}
            description={t('emptyStateDescription')}
            actionLabel={t('emptyStateAction')}
            onAction={handleNewDonation}
          />
        ) : (
          <Card>
            <Card.Body>
              <Table responsive hover>
                <thead>
                  <tr>
                    <th>{t('date')}</th>
                    <th>{t('type')}</th>
                    <th>{t('sponsor')}</th>
                    <th>{t('assignedTo')}</th>
                    <th>{t('amountOrDescription')}</th>
                    <th>{t('note')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDonations.map((donation) => (
                    <tr
                      key={donation.id}
                      onClick={() => handleRowClick(donation)}
                      style={{ cursor: 'pointer' }}
                      className="align-middle"
                    >
                      <td>{formatDate(donation.donationDate)}</td>
                      <td>
                        {donation.type === 'MONETARY' ? (
                          <Badge bg="success">{t('monetary')}</Badge>
                        ) : (
                          <Badge bg="info">{t('inKind')}</Badge>
                        )}
                      </td>
                      <td><strong>{getSponsorDisplayName(donation.sponsor)}</strong></td>
                      <td className="text-muted">
                        {donation.member && (
                          <>{donation.member.firstName} {donation.member.lastName}</>
                        )}
                        {donation.group && (
                          <>{donation.group.name}</>
                        )}
                      </td>
                      <td>
                        {donation.type === 'MONETARY' ? (
                          <strong className="text-success">{formatCurrency(donation.amount || 0)}</strong>
                        ) : (
                          <span className="text-muted">{donation.description}</span>
                        )}
                      </td>
                      <td className="text-muted">{donation.note || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        )}

        <DonationModal
          show={showModal}
          donation={selectedDonation}
          sponsors={sponsors}
          members={members}
          groups={groups}
          onHide={handleModalClose}
          onSave={handleSave}
        />
      </Container>
    </>
  )
}
