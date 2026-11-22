'use client'

import { Container, Card, Table, Badge, Button, ButtonGroup, Collapse, Alert } from 'react-bootstrap'
import { Navbar } from '@/components/Navbar'
import { DonationsModal } from '@/components/DonationsModal'
import { GroupEditModal } from '@/components/GroupEditModal'
import { GroupMembersModal } from '@/components/GroupMembersModal'
import { SponsorsModal } from '@/components/SponsorsModal'
import { DissolveGroupModal } from '@/components/DissolveGroupModal'
import { DeleteConfirmModal, useHandOverText } from '@/components/DeleteConfirmModal'
import type { HandOver } from '@/lib/club-pool'
import { LoadingState } from '@/components/LoadingState'
import { EmptyState } from '@/components/EmptyState'
import { SearchBar } from '@/components/SearchBar'
import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { useLocalizedFormatters } from '@/lib/i18n/formatters'
import { useCurrentFiscalYear } from '@/lib/useFiscalYear'

type Group = {
  id: string
  name: string
  statusToken?: string | null
  isClubPool?: boolean
  dissolvedAt?: string | null
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
  // The group's total: donations credited to the group and to its members
  donations?: Array<{
    amount: number | null
    fiscalYearId: string | null
  }>
  _count?: {
    sponsorAssignments: number
  }
}

export default function GroupsPage() {
  const [allGroups, setAllGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showMembersModal, setShowMembersModal] = useState(false)
  const [showSponsorsModal, setShowSponsorsModal] = useState(false)
  const [showDonationsModal, setShowDonationsModal] = useState(false)
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [dissolveTarget, setDissolveTarget] = useState<{
    id: string
    name: string
    members: { id: string; firstName: string; lastName: string }[]
  } | null>(null)
  const [showDissolvedGroups, setShowDissolvedGroups] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Group | null>(null)
  const [deleteImpact, setDeleteImpact] = useState<(HandOver & { poolName: string }) | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [dissolvedNotice, setDissolvedNotice] = useState<string | null>(null)
  const t = useTranslations('groups')
  const tMembers = useTranslations('members')
  const tCommon = useTranslations('common')
  const tErrors = useTranslations('errors')
  const handOverText = useHandOverText()
  const { formatCurrency, formatDate } = useLocalizedFormatters()

  // Dissolved groups are listed in their own collapsed section
  const groups = allGroups.filter(g => !g.dissolvedAt)
  const dissolvedGroups = allGroups.filter(g => g.dissolvedAt)
  const { currentFiscalYearId } = useCurrentFiscalYear()

  // Does not switch the spinner on itself: the initial load starts with
  // loading=true, and reloads are triggered from event handlers that set it.
  const loadGroups = useCallback(async () => {
    try {
      const response = await fetch('/api/groups?include=all,dissolved')
      const data = await response.json()
      setAllGroups(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error loading groups:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  const reloadGroups = () => {
    setLoading(true)
    void loadGroups()
  }

  useEffect(() => {
    // Wrapped in an async function so the load starts after the effect has
    // run, instead of updating state synchronously inside it.
    const run = async () => {
      await loadGroups()
    }
    void run()

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
  }, [loadGroups])

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

  const handleDissolveClick = () => {
    if (!selectedGroup) return
    setDissolveTarget({
      id: selectedGroup.id,
      name: selectedGroup.name,
      members: (selectedGroup.members || []).map(m => ({
        id: m.id,
        firstName: m.firstName,
        lastName: m.lastName
      }))
    })
    setShowEditModal(false)
    setSelectedGroup(null)
  }

  const handleDeleteDissolvedClick = async (group: Group) => {
    setDeleteTarget(group)
    setDeleteError(null)
    setDeleteImpact(null)
    try {
      const response = await fetch(`/api/groups/${group.id}/impact`)
      if (response.ok) {
        setDeleteImpact(await response.json())
      }
    } catch (error) {
      console.error('Error loading delete impact:', error)
    }
  }

  const handleDeleteDissolved = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    setDeleteError(null)
    try {
      const response = await fetch(`/api/groups/${deleteTarget.id}`, { method: 'DELETE' })
      if (response.ok) {
        setDeleteTarget(null)
        reloadGroups()
      } else {
        const data = await response.json()
        setDeleteError(
          data.error === 'noClubPool' || data.error === 'clubPoolLocked'
            ? t(data.error)
            : tErrors('deleteFailed')
        )
      }
    } catch (error) {
      console.error('Error deleting group:', error)
      setDeleteError(tErrors('deleteFailed'))
    } finally {
      setDeleting(false)
    }
  }

  const handleCopyStatusLink = async (e: React.MouseEvent, groupId: string, token: string) => {
    e.stopPropagation()
    const url = `${window.location.origin}/s/${token}`
    try {
      await navigator.clipboard.writeText(url)
      setCopiedId(groupId)
      setTimeout(() => setCopiedId(null), 1500)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
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
    if (group.donations) {
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
        const allDonations = group.donations
        if (allDonations.length > 0) {
          currentFiscalYearId = allDonations[0].fiscalYearId ?? undefined
        }
      }

      if (currentFiscalYearId) {
        group.donations
          .filter(d => d.fiscalYearId === currentFiscalYearId)
          .forEach(d => {
            totalAchieved += d.amount || 0
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

        {dissolvedNotice && (
          <Alert variant="success" dismissible onClose={() => setDissolvedNotice(null)}>
            {dissolvedNotice}
          </Alert>
        )}

        {!loading && groups.length > 0 && (
          <SearchBar
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder={t('searchPlaceholder')}
            resultCount={{
              filtered: filteredGroups.length,
              total: groups.length,
              label: t('title')
            }}
          />
        )}

        {loading ? (
          <LoadingState />
        ) : groups.length === 0 ? (
          <EmptyState
            icon="people-fill"
            title={t('emptyState')}
            description={t('emptyStateDescription')}
          />
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
                    <th className="text-center">{t('statusLink')}</th>
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
                          {group.isClubPool && (
                            <Badge bg="info" className="ms-2">
                              {t('clubPool')}
                            </Badge>
                          )}
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
                          <strong>{group._count?.sponsorAssignments || 0}</strong> {t('sponsors')}
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
                        <td className="text-center">
                          {group.statusToken ? (
                            <ButtonGroup size="sm">
                              <Button
                                variant="outline-secondary"
                                onClick={(e) => handleCopyStatusLink(e, group.id, group.statusToken!)}
                                title={t('copyStatusLink')}
                              >
                                <i className={`bi ${copiedId === group.id ? 'bi-clipboard-check-fill text-success' : 'bi-copy'}`}></i>
                              </Button>
                              <Button
                                as="a"
                                variant="outline-secondary"
                                href={`/api/public/status/${group.statusToken}/export?format=csv`}
                                onClick={(e) => e.stopPropagation()}
                                title={tCommon('downloadCsv')}
                                aria-label={tCommon('downloadCsv')}
                              >
                                <i className="bi bi-filetype-csv fs-6 text-primary"></i>
                              </Button>
                              <Button
                                as="a"
                                variant="outline-secondary"
                                href={`/api/public/status/${group.statusToken}/export?format=xlsx`}
                                onClick={(e) => e.stopPropagation()}
                                title={tCommon('downloadExcel')}
                                aria-label={tCommon('downloadExcel')}
                              >
                                <i className="bi bi-file-earmark-excel fs-6 text-success"></i>
                              </Button>
                              <Button
                                as="a"
                                variant="outline-secondary"
                                href={`/api/public/status/${group.statusToken}/export?format=pdf`}
                                target="_blank"
                                rel="noopener"
                                onClick={(e) => e.stopPropagation()}
                                title={tCommon('downloadPdf')}
                                aria-label={tCommon('downloadPdf')}
                              >
                                <i className="bi bi-file-earmark-pdf fs-6 text-danger"></i>
                              </Button>
                            </ButtonGroup>
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

        {!loading && dissolvedGroups.length > 0 && (
          <Card className="mt-4">
            <Card.Header
              onClick={() => setShowDissolvedGroups(v => !v)}
              style={{ cursor: 'pointer' }}
              aria-expanded={showDissolvedGroups}
              aria-controls="dissolved-groups"
            >
              <i className={`bi ${showDissolvedGroups ? 'bi-chevron-down' : 'bi-chevron-right'} me-2`}></i>
              {t('dissolvedGroups')} ({dissolvedGroups.length})
            </Card.Header>
            <Collapse in={showDissolvedGroups}>
              <div id="dissolved-groups">
                <Card.Body>
                  <Table responsive className="mb-0">
                    <thead>
                      <tr>
                        <th>{t('name')}</th>
                        <th>{t('dissolvedOn')}</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {dissolvedGroups.map(group => (
                        <tr key={group.id} id={`group-${group.id}`} className="align-middle">
                          <td>{group.name}</td>
                          <td>{group.dissolvedAt ? formatDate(group.dissolvedAt) : '-'}</td>
                          <td className="text-end">
                            <Button
                              variant="outline-danger"
                              size="sm"
                              onClick={() => handleDeleteDissolvedClick(group)}
                            >
                              {tCommon('delete')}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </Card.Body>
              </div>
            </Collapse>
          </Card>
        )}

        <DeleteConfirmModal
          show={deleteTarget !== null}
          title={`${tCommon('delete')} ${t('group')}`}
          message={t('deleteConfirm')}
          detail={deleteImpact ? handOverText(deleteImpact) : null}
          error={deleteError}
          onConfirm={handleDeleteDissolved}
          onCancel={() => setDeleteTarget(null)}
          deleting={deleting}
        />

        <DissolveGroupModal
          show={dissolveTarget !== null}
          group={dissolveTarget}
          onHide={() => setDissolveTarget(null)}
          onDissolved={() => {
            if (dissolveTarget) setDissolvedNotice(t('dissolvedNotice', { name: dissolveTarget.name }))
            reloadGroups()
          }}
        />

        <GroupEditModal
          show={showEditModal}
          group={selectedGroup ? {
            id: selectedGroup.id,
            name: selectedGroup.name,
            isClubPool: selectedGroup.isClubPool,
            dissolved: Boolean(selectedGroup.dissolvedAt)
          } : null}
          onDissolve={handleDissolveClick}
          onHide={() => {
            setShowEditModal(false)
            setSelectedGroup(null)
          }}
          onSave={() => {
            reloadGroups()
            setShowEditModal(false)
            setSelectedGroup(null)
          }}
          onDelete={() => {
            reloadGroups()
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
          fiscalYearId={currentFiscalYearId}
          onHide={() => {
            setShowDonationsModal(false)
            setSelectedGroup(null)
          }}
        />
      </Container>
    </>
  )
}
