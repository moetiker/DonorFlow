'use client'

import { Container, Card, Button, Table, Badge } from 'react-bootstrap'
import { Navbar } from '@/components/Navbar'
import { MemberModal } from '@/components/MemberModal'
import { MemberEditModal } from '@/components/MemberEditModal'
import { SponsorsModal } from '@/components/SponsorsModal'
import { DonationsModal } from '@/components/DonationsModal'
import { LoadingState } from '@/components/LoadingState'
import { EmptyState } from '@/components/EmptyState'
import { SearchBar } from '@/components/SearchBar'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useLocalizedFormatters } from '@/lib/i18n/formatters'
import { useCurrentFiscalYear } from '@/lib/useFiscalYear'

type Member = {
  id: string
  firstName: string
  lastName: string
  email?: string | null
  phone?: string | null
  statusToken?: string | null
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
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const router = useRouter()
  const { currentFiscalYearId } = useCurrentFiscalYear()
  const t = useTranslations('members')
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

  const handleCopyStatusLink = async (e: React.MouseEvent, memberId: string, token: string) => {
    e.stopPropagation()
    const url = `${window.location.origin}/s/${token}`
    try {
      await navigator.clipboard.writeText(url)
      setCopiedId(memberId)
      setTimeout(() => setCopiedId(null), 1500)
    } catch (error) {
      console.error('Failed to copy:', error)
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
          <SearchBar
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder={t('searchPlaceholder')}
            resultCount={{
              filtered: filteredMembers.length,
              total: members.length,
              label: t('title')
            }}
          />
        )}

        {loading ? (
          <LoadingState />
        ) : members.length === 0 ? (
          <EmptyState
            icon="person-x"
            title={t('emptyState')}
            description={t('emptyStateDescription')}
            actionLabel={t('emptyStateAction')}
            onAction={handleNewMember}
          />
        ) : (
          <Card>
            <Card.Body>
              <Table responsive>
                <thead>
                  <tr>
                    <th>{t('name')}</th>
                    <th>{t('sponsors')}</th>
                    <th>{t('status')}</th>
                    <th className="text-center">{t('statusLink')}</th>
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
                          {t('sponsorCount', { count: member._count.sponsors })}
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
                            <span className="text-muted">{t('noTarget')}</span>
                          )}
                        </td>
                        <td className="text-center">
                          {!member.groupId && member.statusToken ? (
                            <Button
                              size="sm"
                              variant="outline-secondary"
                              onClick={(e) => handleCopyStatusLink(e, member.id, member.statusToken!)}
                              title={t('copyStatusLink')}
                            >
                              <i className={`bi ${copiedId === member.id ? 'bi-clipboard-check-fill text-success' : 'bi-copy'}`}></i>
                            </Button>
                          ) : member.group ? (
                            <span className="text-muted small">{t('useGroupLink')}</span>
                          ) : (
                            <span className="text-muted">-</span>
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
          member={selectedMember ? { id: selectedMember.id, firstName: selectedMember.firstName, lastName: selectedMember.lastName, email: selectedMember.email, phone: selectedMember.phone, groupId: selectedMember.groupId, group: selectedMember.group } : null}
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
          fiscalYearId={currentFiscalYearId}
          onHide={() => {
            setShowDonationsModal(false)
            setSelectedMember(null)
          }}
        />
      </Container>
    </>
  )
}
