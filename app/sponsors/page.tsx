'use client'

import { Container, Card, Button, Table, Badge, Form, InputGroup } from 'react-bootstrap'
import { Navbar } from '@/components/Navbar'
import { SponsorModal } from '@/components/SponsorModal'
import { SponsorDonationsModal } from '@/components/SponsorDonationsModal'
import { useState, useEffect } from 'react'
import { getSponsorDisplayName } from '@/lib/utils'
import { useTranslations } from 'next-intl'
import { useLocalizedFormatters } from '@/lib/i18n/formatters'

type Sponsor = {
  id: string
  company: string | null
  salutation: string | null
  firstName: string | null
  lastName: string | null
  street: string | null
  postalCode: string | null
  city: string | null
  phone: string | null
  email: string | null
  notes: string | null
  memberId: string | null
  groupId: string | null
  member?: { firstName: string; lastName: string }
  group?: { name: string }
  _count: { donations: number }
}

type Member = { id: string; firstName: string; lastName: string }
type Group = { id: string; name: string }

// Helper function to display address
function getSponsorAddress(sponsor: Sponsor) {
  const parts = [sponsor.street, sponsor.postalCode && sponsor.city ? `${sponsor.postalCode} ${sponsor.city}` : null].filter(Boolean)
  return parts.length > 0 ? parts.join(', ') : '-'
}

export default function SponsorsPage() {
  const [sponsors, setSponsors] = useState<Sponsor[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showDonationsModal, setShowDonationsModal] = useState(false)
  const [selectedSponsor, setSelectedSponsor] = useState<Sponsor | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [exporting, setExporting] = useState(false)
  const t = useTranslations('sponsors')
  const tCommon = useTranslations('common')
  const tErrors = useTranslations('errors')
  const { formatCurrency } = useLocalizedFormatters()

  const loadData = async () => {
    setLoading(true)
    try {
      const [sponsorsRes, membersRes, groupsRes] = await Promise.all([
        fetch('/api/sponsors?include=all'),
        fetch('/api/members'),
        fetch('/api/groups')
      ])

      const [sponsorsData, membersData, groupsData] = await Promise.all([
        sponsorsRes.json(),
        membersRes.json(),
        groupsRes.json()
      ])

      // Ensure data is an array
      setSponsors(Array.isArray(sponsorsData) ? sponsorsData : [])
      setMembers(Array.isArray(membersData) ? membersData : [])
      setGroups(Array.isArray(groupsData) ? groupsData : [])
    } catch (error) {
      console.error('Error loading data:', error)
      setSponsors([])
      setMembers([])
      setGroups([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleRowClick = (e: React.MouseEvent, sponsor: Sponsor) => {
    // If clicking on donations count, show donations modal
    if ((e.target as HTMLElement).closest('.donations-cell')) {
      setSelectedSponsor(sponsor)
      setShowDonationsModal(true)
    } else {
      // Otherwise show sponsor edit modal
      setSelectedSponsor(sponsor)
      setShowModal(true)
    }
  }

  const handleNewSponsor = () => {
    setSelectedSponsor(null)
    setShowModal(true)
  }

  const handleModalClose = () => {
    setShowModal(false)
    setSelectedSponsor(null)
  }

  const handleSave = () => {
    loadData()
  }

  const handleExportCSV = async () => {
    setExporting(true)
    try {
      const response = await fetch('/api/sponsors/export')
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `Goenner_Export_${new Date().toISOString().split('T')[0]}.csv`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)
      } else {
        console.error('Export failed:', response.statusText)
        alert(tErrors('exportFailed'))
      }
    } catch (error) {
      console.error('Error exporting CSV:', error)
      alert(tErrors('exportFailed'))
    } finally {
      setExporting(false)
    }
  }

  // Filter sponsors based on search term
  const filteredSponsors = sponsors.filter(sponsor => {
    if (!searchTerm) return true

    const searchLower = searchTerm.toLowerCase()
    const name = getSponsorDisplayName(sponsor).toLowerCase()
    const city = (sponsor.city || '').toLowerCase()
    const memberName = sponsor.member
      ? `${sponsor.member.firstName} ${sponsor.member.lastName}`.toLowerCase()
      : ''
    const groupName = sponsor.group ? sponsor.group.name.toLowerCase() : ''

    return name.includes(searchLower) ||
           city.includes(searchLower) ||
           memberName.includes(searchLower) ||
           groupName.includes(searchLower)
  })

  return (
    <>
      <Navbar />
      <Container>
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h1>{t('title')}</h1>
          <div className="d-flex gap-2">
            <Button
              variant="outline-success"
              onClick={handleExportCSV}
              disabled={exporting || sponsors.length === 0}
            >
              {exporting ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                  {tCommon('export')}...
                </>
              ) : (
                <>
                  <i className="bi bi-download me-2"></i>
                  {tCommon('export')}
                </>
              )}
            </Button>
            <Button variant="primary" onClick={handleNewSponsor}>
              <i className="bi bi-plus-circle me-2"></i>
              {t('newSponsor')}
            </Button>
          </div>
        </div>

        {!loading && sponsors.length > 0 && (
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
                  {filteredSponsors.length} von {sponsors.length} {t('title')}
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
        ) : sponsors.length === 0 ? (
          <Card>
            <Card.Body className="text-center py-5">
              <i className="bi bi-heart-fill fs-1 text-muted mb-3 d-block"></i>
              <h5>{t('emptyState')}</h5>
              <p className="text-muted">{t('emptyStateDescription')}</p>
              <Button variant="primary" onClick={handleNewSponsor}>
                {t('emptyStateAction')}
              </Button>
            </Card.Body>
          </Card>
        ) : (
          <Card>
            <Card.Body>
              <Table responsive hover>
                <thead>
                  <tr>
                    <th>{t('name')}</th>
                    <th>{t('city')}</th>
                    <th>{t('assignedTo')}</th>
                    <th>{t('donations')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSponsors.map((sponsor) => (
                    <tr
                      key={sponsor.id}
                      onClick={(e) => handleRowClick(e, sponsor)}
                      style={{ cursor: 'pointer' }}
                      className="align-middle"
                    >
                      <td><strong>{getSponsorDisplayName(sponsor)}</strong></td>
                      <td className="text-muted">{sponsor.city || '-'}</td>
                      <td>
                        {sponsor.member && (
                          <>
                            <Badge bg="success" className="me-1">{tCommon('member')}</Badge>
                            <small>{sponsor.member.firstName} {sponsor.member.lastName}</small>
                          </>
                        )}
                        {sponsor.group && (
                          <>
                            <Badge bg="info" className="me-1">{tCommon('group')}</Badge>
                            <small>{sponsor.group.name}</small>
                          </>
                        )}
                      </td>
                      <td className="donations-cell">
                        <span className="text-primary">
                          <i className="bi bi-coin me-1"></i>
                          <strong>{sponsor._count.donations}</strong> {t('donations')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        )}

        <SponsorModal
          show={showModal}
          sponsor={selectedSponsor}
          members={members}
          groups={groups}
          onHide={handleModalClose}
          onSave={handleSave}
        />

        <SponsorDonationsModal
          show={showDonationsModal}
          sponsorId={selectedSponsor?.id || null}
          sponsorName={selectedSponsor ? getSponsorDisplayName(selectedSponsor) : ''}
          onHide={() => {
            setShowDonationsModal(false)
            setSelectedSponsor(null)
            loadData() // Reload to update donation counts
          }}
        />
      </Container>
    </>
  )
}
