'use client'

import { Container, Card, Table, Badge, Button, Form, InputGroup } from 'react-bootstrap'
import { Navbar } from '@/components/Navbar'
import { DonationsModal } from '@/components/DonationsModal'
import { GroupEditModal } from '@/components/GroupEditModal'
import { GroupMembersModal } from '@/components/GroupMembersModal'
import { SponsorsModal } from '@/components/SponsorsModal'
import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useLocalizedFormatters } from '@/lib/i18n/formatters'

type Group = {
  id: string
  name: string
  members?: Array<{
    id: string
    firstName: string
    lastName: string
    memberTargets?: Array<{
      targetAmount: number
      fiscalYear: {
        id: string
        startDate: string
        endDate: string
      }
    }>
  }>
  sponsors?: Array<{
    donations: Array<{
      amount: number
      fiscalYearId: string
    }>
  }>
  _count?: {
    sponsors: number
  }
}

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showMembersModal, setShowMembersModal] = useState(false)
  const [showSponsorsModal, setShowSponsorsModal] = useState(false)
  const [showDonationsModal, setShowDonationsModal] = useState(false)
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const t = useTranslations('groups')
  const tCommon = useTranslations('common')
  const tMembers = useTranslations('members')
  const { formatCurrency } = useLocalizedFormatters()

  const loadGroups = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/groups?include=all')
      const data = await response.json()
      setGroups(data)
    } catch (error) {
      console.error('Error loading groups:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadGroups()

    // Check for highlight parameter
    const params = new URLSearchParams(window.location.search)
    const highlightId = params.get('highlight')
    if (highlightId) {
      // Scroll to the highlighted group after a short delay
      setTimeout(() => {
        const element = document.getElementById(`group-${highlightId}`)
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' })
          element.classList.add('table-warning')
          setTimeout(() => {
            element.classList.remove('table-warning')
          }, 2000)
        }
      }, 100)
    }
  }, [])

  const handleNameClick = (e: React.MouseEvent, group: Group) => {
    e.stopPropagation()
    setSelectedGroup(group)
    setShowEditModal(true)
  }

  const handleMembersClick = (e: React.MouseEvent, group: Group) => {
    e.stopPropagation()
    setSelectedGroup(group)
    setShowMembersModal(true)
  }

  const handleSponsorsClick = (e: React.MouseEvent, group: Group) => {
    e.stopPropagation()
    setSelectedGroup(group)
    setShowSponsorsModal(true)
  }

  const handleStatusClick = (e: React.MouseEvent, group: Group) => {
    e.stopPropagation()
    setSelectedGroup(group)
    setShowDonationsModal(true)
  }

  const handleNewGroup = () => {
    setSelectedGroup(null)
    setShowEditModal(true)
  }

  const calculateGroupStats = (group: Group) => {
    // Get current fiscal year
    const now = new Date()

    // Calculate total target for all members in the group
    const members = group.members || []
    let totalTarget = 0

    members.forEach(member => {
      const currentTarget = member.memberTargets?.find(mt => {
        const start = new Date(mt.fiscalYear.startDate)
        const end = new Date(mt.fiscalYear.endDate)
        return now >= start && now <= end
      })
      if (currentTarget) {
        totalTarget += currentTarget.targetAmount
      }
    })

    // Calculate total donations for the group in current fiscal year
    let totalAchieved = 0
    if (group.sponsors) {
      // Find current fiscal year from any member's targets
      let currentFiscalYearId = members
        .flatMap(m => m.memberTargets || [])
        .find(mt => {
          const start = new Date(mt.fiscalYear.startDate)
          const end = new Date(mt.fiscalYear.endDate)
          return now >= start && now <= end
        })?.fiscalYear.id

      // If no target found, try to get fiscal year from donations
      if (!currentFiscalYearId) {
        const allDonations = group.sponsors.flatMap(s => s.donations)
        if (allDonations.length > 0) {
          currentFiscalYearId = allDonations[0].fiscalYearId
        }
      }

      if (currentFiscalYearId) {
        group.sponsors.forEach(sponsor => {
          sponsor.donations
            .filter(d => d.fiscalYearId === currentFiscalYearId)
            .forEach(d => {
              totalAchieved += d.amount
            })
        })
      }
    }

    return {
      achieved: totalAchieved,
      target: totalTarget
    }
  }

  // Filter groups based on search term
  const filteredGroups = groups.filter(group => {
    if (!searchTerm) return true

    const searchLower = searchTerm.toLowerCase()
    const groupName = group.name.toLowerCase()
    const memberNames = group.members
      ?.map(m => `${m.firstName} ${m.lastName}`.toLowerCase())
      .join(' ') || ''

    return groupName.includes(searchLower) || memberNames.includes(searchLower)
  })

  return (
    <>
      <Navbar />
      <Container>
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h1>{t('title')}</h1>
          <Button variant="primary" onClick={handleNewGroup}>
            <i className="bi bi-plus-circle me-2"></i>
            {t('newGroup')}
          </Button>
        </div>

        {!loading && groups.length > 0 && (
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
                  {filteredGroups.length} von {groups.length} {t('title')}
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
        ) : groups.length === 0 ? (
          <Card>
            <Card.Body className="text-center py-5">
              <i className="bi bi-people-fill fs-1 text-muted mb-3 d-block"></i>
              <h5>{t('emptyState')}</h5>
              <p className="text-muted">
                {t('emptyStateDescription')}
              </p>
            </Card.Body>
          </Card>
        ) : (
          <Card>
            <Card.Body>
              <Table responsive>
                <thead>
                  <tr>
                    <th>{t('name')}</th>
                    <th>{t('members')}</th>
                    <th>{t('sponsors')}</th>
                    <th>{t('status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredGroups.map((group) => {
                    const members = group.members || []
                    const stats = calculateGroupStats(group)

                    return (
                      <tr key={group.id} id={`group-${group.id}`} className="align-middle">
                        <td
                          onClick={(e) => handleNameClick(e, group)}
                          style={{ cursor: 'pointer' }}
                          className="text-primary"
                        >
                          <strong>{group.name}</strong>
                        </td>
                        <td
                          onClick={(e) => handleMembersClick(e, group)}
                          style={{ cursor: 'pointer' }}
                          className="text-primary"
                        >
                          {members.length > 0 ? (
                            <>
                              <strong>{members.length}</strong> {t('members')}
                              <div className="d-flex flex-wrap gap-1 mt-1">
                                {members.map((member) => (
                                  <Badge key={member.id} bg="secondary" style={{ fontSize: '0.7rem' }}>
                                    {member.firstName} {member.lastName}
                                  </Badge>
                                ))}
                              </div>
                            </>
                          ) : (
                            <span className="text-muted">{t('noMembers')}</span>
                          )}
                        </td>
                        <td
                          onClick={(e) => handleSponsorsClick(e, group)}
                          style={{ cursor: 'pointer' }}
                          className="text-primary"
                        >
                          <strong>{group._count?.sponsors || 0}</strong> {t('sponsors')}
                        </td>
                        <td
                          onClick={(e) => handleStatusClick(e, group)}
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
                            <span className="text-muted">{tMembers('noTarget')}</span>
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

        <GroupEditModal
          show={showEditModal}
          group={selectedGroup ? { id: selectedGroup.id, name: selectedGroup.name } : null}
          onHide={() => {
            setShowEditModal(false)
            setSelectedGroup(null)
          }}
          onSave={() => {
            loadGroups()
            setShowEditModal(false)
            setSelectedGroup(null)
          }}
          onDelete={() => {
            loadGroups()
            setShowEditModal(false)
            setSelectedGroup(null)
          }}
        />

        <GroupMembersModal
          show={showMembersModal}
          groupId={selectedGroup?.id || null}
          groupName={selectedGroup?.name || ''}
          members={selectedGroup?.members || []}
          onHide={() => {
            setShowMembersModal(false)
            setSelectedGroup(null)
          }}
        />

        <SponsorsModal
          show={showSponsorsModal}
          entityId={selectedGroup?.id || null}
          entityName={selectedGroup?.name || ''}
          entityType="group"
          onHide={() => {
            setShowSponsorsModal(false)
            setSelectedGroup(null)
          }}
        />

        <DonationsModal
          show={showDonationsModal}
          entityId={selectedGroup?.id || null}
          entityName={selectedGroup?.name || ''}
          entityType="group"
          onHide={() => {
            setShowDonationsModal(false)
            setSelectedGroup(null)
          }}
        />
      </Container>
    </>
  )
}
