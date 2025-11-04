'use client'

import { Container, Card, Button, Table, Badge, Form, InputGroup } from 'react-bootstrap'
import { Navbar } from '@/components/Navbar'
import { MemberModal } from '@/components/MemberModal'
import { MemberEditModal } from '@/components/MemberEditModal'
import { SponsorsModal } from '@/components/SponsorsModal'
import { DonationsModal } from '@/components/DonationsModal'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useLocalizedFormatters } from '@/lib/i18n/formatters'

type Member = {
  id: string
  firstName: string
  lastName: string
  groupId?: string | null
  group?: { id: string; name: string } | null
  memberTargets?: Array<{
    targetAmount: number
    fiscalYear: {
      id: string
      startDate: string
      endDate: string
    }
  }>
  sponsors?: Array<{
    donations: Array<{
      amount: number
      fiscalYearId: string
    }>
  }>
  _count: {
    sponsors: number
  }
}

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showSponsorsModal, setShowSponsorsModal] = useState(false)
  const [showDonationsModal, setShowDonationsModal] = useState(false)
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const router = useRouter()
  const t = useTranslations('members')
  const tCommon = useTranslations('common')
  const { formatCurrency } = useLocalizedFormatters()

  const loadMembers = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/members?include=all')
      const data = await response.json()
      setMembers(data)
    } catch (error) {
      console.error('Error loading members:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMembers()
  }, [])

  const handleNewMember = () => {
    setSelectedMember(null)
    setShowModal(true)
  }

  const handleModalClose = () => {
    setShowModal(false)
    setSelectedMember(null)
  }

  const handleSave = () => {
    loadMembers()
  }

  const handleNameClick = (e: React.MouseEvent, member: Member) => {
    e.stopPropagation()
    setSelectedMember(member)
    setShowEditModal(true)
  }

  const handleSponsorsClick = (e: React.MouseEvent, member: Member) => {
    e.stopPropagation()
    setSelectedMember(member)
    setShowSponsorsModal(true)
  }

  const handleStatusClick = (e: React.MouseEvent, member: Member) => {
    e.stopPropagation()

    if (member.group) {
      // Navigate to groups page
      router.push(`/groups?highlight=${member.group.id}`)
    } else {
      // Show donations modal
      setSelectedMember(member)
      setShowDonationsModal(true)
    }
  }

  const calculateDonationStats = (member: Member) => {
    // Get current fiscal year
    const now = new Date()
    const currentTarget = member.memberTargets?.find(mt => {
      const start = new Date(mt.fiscalYear.startDate)
      const end = new Date(mt.fiscalYear.endDate)
      return now >= start && now <= end
    })

    // Get the current fiscal year ID from either target or from any donation
    let currentFiscalYearId: string | undefined
    if (currentTarget) {
      currentFiscalYearId = currentTarget.fiscalYear.id
    } else {
      // If no target, try to find fiscal year from donations
      const allDonations = member.sponsors?.flatMap(s => s.donations) || []
      if (allDonations.length > 0) {
        // For now, just use the fiscalYearId from any donation
        currentFiscalYearId = allDonations[0].fiscalYearId
      }
    }

    if (!currentFiscalYearId) {
      return { achieved: 0, target: 0 }
    }

    // Sum all donations for this member in the current fiscal year
    const achieved = member.sponsors?.reduce((sum, sponsor) => {
      const yearDonations = sponsor.donations
        .filter(d => d.fiscalYearId === currentFiscalYearId)
        .reduce((donSum, don) => donSum + don.amount, 0)
      return sum + yearDonations
    }, 0) || 0

    return {
      achieved,
      target: currentTarget?.targetAmount || 0
    }
  }

  // Filter members based on search term
  const filteredMembers = members.filter(member => {
    if (!searchTerm) return true

    const searchLower = searchTerm.toLowerCase()
    const name = `${member.firstName} ${member.lastName}`.toLowerCase()
    const groupName = member.group?.name.toLowerCase() || ''

    return name.includes(searchLower) || groupName.includes(searchLower)
  })

  return (
    <>
      <Navbar />
      <Container>
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h1>{t('title')}</h1>
          <Button variant="primary" onClick={handleNewMember}>
            <i className="bi bi-plus-circle me-2"></i>
            {t('newMember')}
          </Button>
        </div>

        {!loading && members.length > 0 && (
          <Card className="mb-3">
            <Card.Body>
              <InputGroup>
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
              {searchTerm && (
                <small className="text-muted mt-2 d-block">
                  {t('sponsorCount', { count: filteredMembers.length })} von {members.length}
                </small>
              )}
            </Card.Body>
          </Card>
        )}

        {loading ? (
          <Card>
            <Card.Body className="text-center py-5">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">{tCommon('loading')}</span>
              </div>
            </Card.Body>
          </Card>
        ) : members.length === 0 ? (
          <Card>
            <Card.Body className="text-center py-5">
              <i className="bi bi-person-x fs-1 text-muted mb-3 d-block"></i>
              <h5>{t('emptyState')}</h5>
              <p className="text-muted">{t('emptyStateDescription')}</p>
              <Button variant="primary" onClick={handleNewMember}>
                {t('emptyStateAction')}
              </Button>
            </Card.Body>
          </Card>
        ) : (
          <Card>
            <Card.Body>
              <Table responsive>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Gönner</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMembers.map((member) => {
                    const stats = calculateDonationStats(member)

                    return (
                      <tr key={member.id} className="align-middle">
                        <td
                          onClick={(e) => handleNameClick(e, member)}
                          style={{ cursor: 'pointer' }}
                          className="text-primary"
                        >
                          <strong>{member.firstName} {member.lastName}</strong>
                          {member.group && (
                            <div>
                              <Badge bg="info" className="me-1" style={{ fontSize: '0.7rem' }}>
                                {member.group.name}
                              </Badge>
                            </div>
                          )}
                        </td>
                        <td
                          onClick={(e) => handleSponsorsClick(e, member)}
                          style={{ cursor: 'pointer' }}
                          className="text-primary"
                        >
                          <strong>{member._count.sponsors}</strong> Gönner
                        </td>
                        <td
                          onClick={(e) => handleStatusClick(e, member)}
                          style={{ cursor: 'pointer' }}
                          className="text-primary"
                        >
                          {stats.target > 0 ? (
                            <>
                              <strong className={stats.achieved >= stats.target ? 'text-success' : 'text-warning'}>
                                {formatCurrency(stats.achieved)}
                              </strong>
                              {' / '}
                              <span className="text-muted">{formatCurrency(stats.target)}</span>
                            </>
                          ) : (
                            <span className="text-muted">Keine Vorgabe</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        )}

        <MemberModal
          show={showModal}
          member={selectedMember}
          onHide={handleModalClose}
          onSave={handleSave}
        />

        <MemberEditModal
          show={showEditModal}
          member={selectedMember ? { id: selectedMember.id, firstName: selectedMember.firstName, lastName: selectedMember.lastName, groupId: selectedMember.groupId, group: selectedMember.group } : null}
          onHide={() => {
            setShowEditModal(false)
            setSelectedMember(null)
          }}
          onSave={() => {
            loadMembers()
            setShowEditModal(false)
            setSelectedMember(null)
          }}
          onDelete={() => {
            loadMembers()
            setShowEditModal(false)
            setSelectedMember(null)
          }}
        />

        <SponsorsModal
          show={showSponsorsModal}
          entityId={selectedMember?.id || null}
          entityName={selectedMember ? `${selectedMember.firstName} ${selectedMember.lastName}` : ''}
          entityType="member"
          onHide={() => {
            setShowSponsorsModal(false)
            setSelectedMember(null)
          }}
        />

        <DonationsModal
          show={showDonationsModal}
          entityId={selectedMember?.id || null}
          entityName={selectedMember ? `${selectedMember.firstName} ${selectedMember.lastName}` : ''}
          entityType="member"
          onHide={() => {
            setShowDonationsModal(false)
            setSelectedMember(null)
          }}
        />
      </Container>
    </>
  )
}
