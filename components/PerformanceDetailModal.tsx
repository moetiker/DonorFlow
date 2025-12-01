'use client'

import { Modal, Table, Badge, Alert } from 'react-bootstrap'
import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useLocalizedFormatters } from '@/lib/i18n/formatters'

type Sponsor = {
  id: string
  company: string | null
  firstName: string | null
  lastName: string | null
}

type Donation = {
  id: string
  amount: number
  donationDate: Date
  note: string | null
  sponsor: Sponsor
}

type DetailData = {
  name: string
  type: 'member' | 'group'
  target: number
  actual: number
  difference: number
  percentage: number
  donations: Donation[]
  sponsors: Array<{
    sponsor: Sponsor
    totalAmount: number
    donationCount: number
  }>
  sponsorsWithoutDonations: Sponsor[]
}

type Props = {
  show: boolean
  memberId: string | null
  groupId: string | null
  onHide: () => void
}

export function PerformanceDetailModal({ show, memberId, groupId, onHide }: Props) {
  const t = useTranslations('reports')
  const tCommon = useTranslations('common')
  const tDonations = useTranslations('donations')
  const { formatCurrency, formatDate } = useLocalizedFormatters()
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<DetailData | null>(null)

  useEffect(() => {
    if (show && (memberId || groupId)) {
      loadDetailData()
    }
  }, [show, memberId, groupId])

  const loadDetailData = async () => {
    if (!memberId && !groupId) return

    setLoading(true)
    try {
      const endpoint = memberId
        ? `/api/members/${memberId}/donations`
        : `/api/groups/${groupId}/donations`

      const response = await fetch(endpoint)
      const donations: Donation[] = await response.json()

      // Get member/group name
      let name = ''
      let target = 0
      let type: 'member' | 'group' = memberId ? 'member' : 'group'

      if (memberId) {
        const memberResponse = await fetch(`/api/members?include=all`)
        const members = await memberResponse.json()
        const member = members.find((m: any) => m.id === memberId)
        if (member) {
          name = `${member.firstName} ${member.lastName}`
          // Get target for current fiscal year
          const targetResponse = await fetch(`/api/reports`)
          const reportData = await targetResponse.json()
          const memberStat = reportData.memberStats.find((s: any) => s.member.id === memberId)
          if (memberStat) {
            target = memberStat.target
          }
        }
      } else if (groupId) {
        const groupResponse = await fetch(`/api/groups?include=all`)
        const groups = await groupResponse.json()
        const group = groups.find((g: any) => g.id === groupId)
        if (group) {
          name = group.name
          // Get target for current fiscal year
          const targetResponse = await fetch(`/api/reports`)
          const reportData = await targetResponse.json()
          const groupStat = reportData.groupStats.find((s: any) => s.group.id === groupId)
          if (groupStat) {
            target = groupStat.target
          }
        }
      }

      // Calculate actual total
      const actual = donations.reduce((sum, d) => sum + d.amount, 0)
      const difference = actual - target
      const percentage = target > 0 ? (actual / target) * 100 : 0

      // Group donations by sponsor
      const sponsorMap = new Map<string, { sponsor: Sponsor; totalAmount: number; donationCount: number }>()

      donations.forEach(donation => {
        const key = donation.sponsor.id
        if (!sponsorMap.has(key)) {
          sponsorMap.set(key, {
            sponsor: donation.sponsor,
            totalAmount: 0,
            donationCount: 0
          })
        }
        const entry = sponsorMap.get(key)!
        entry.totalAmount += donation.amount
        entry.donationCount += 1
      })

      const sponsors = Array.from(sponsorMap.values()).sort((a, b) => b.totalAmount - a.totalAmount)

      // Get all sponsors assigned to this member/group who haven't donated
      const sponsorsResponse = await fetch('/api/sponsors?include=all')
      const allSponsors = await sponsorsResponse.json()

      const assignedSponsors = allSponsors.filter((s: any) => {
        if (memberId) {
          return s.memberId === memberId
        } else {
          return s.groupId === groupId
        }
      })

      const sponsorsWithoutDonations = assignedSponsors.filter((s: any) => {
        return !sponsorMap.has(s.id)
      })

      setData({
        name,
        type,
        target,
        actual,
        difference,
        percentage,
        donations: donations.sort((a, b) => new Date(b.donationDate).getTime() - new Date(a.donationDate).getTime()),
        sponsors,
        sponsorsWithoutDonations
      })
    } catch (error) {
      console.error('Error loading detail data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getSponsorDisplayName = (sponsor: Sponsor) => {
    if (sponsor.company) return sponsor.company
    const parts = [sponsor.firstName, sponsor.lastName].filter(Boolean)
    return parts.length > 0 ? parts.join(' ') : sponsor.id
  }

  return (
    <Modal show={show} onHide={onHide} size="xl">
      <Modal.Header closeButton>
        <Modal.Title>
          {data?.type === 'member' ? tCommon('member') : tCommon('group')}: {data?.name}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">{tCommon('loading')}</span>
            </div>
          </div>
        ) : data ? (
          <>
            {/* Summary */}
            <div className="row g-3 mb-4">
              <div className="col-md-3">
                <div className="text-muted small">{t('target')}</div>
                <div className="h5">{formatCurrency(data.target)}</div>
              </div>
              <div className="col-md-3">
                <div className="text-muted small">{t('actual')}</div>
                <div className={`h5 ${data.actual >= data.target ? 'text-success' : ''}`}>
                  {formatCurrency(data.actual)}
                </div>
              </div>
              <div className="col-md-3">
                <div className="text-muted small">{t('difference')}</div>
                <div className={`h5 ${data.difference >= 0 ? 'text-success' : 'text-danger'}`}>
                  {formatCurrency(data.difference)}
                </div>
              </div>
              <div className="col-md-3">
                <div className="text-muted small">{t('achievement')}</div>
                <div className="h5">{data.percentage.toFixed(1)}%</div>
              </div>
            </div>

            {/* Sponsors grouped by amount */}
            <h6 className="mb-3">{t('sponsorsByAmount')}</h6>
            <Table striped hover className="mb-4">
              <thead>
                <tr>
                  <th>{t('sponsor')}</th>
                  <th className="text-end">{t('totalAmount')}</th>
                  <th className="text-center">{tDonations('title')}</th>
                </tr>
              </thead>
              <tbody>
                {data.sponsors.map((entry, idx) => (
                  <tr key={idx}>
                    <td><strong>{getSponsorDisplayName(entry.sponsor)}</strong></td>
                    <td className="text-end">{formatCurrency(entry.totalAmount)}</td>
                    <td className="text-center">
                      <Badge bg="info">{entry.donationCount}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ height: '10px' }}>
                  <td colSpan={3} className="border-0 p-0"></td>
                </tr>
                <tr className="table-active">
                  <td><strong>{tCommon('total')}</strong></td>
                  <td className="text-end"><strong>{formatCurrency(data.actual)}</strong></td>
                  <td className="text-center">
                    <Badge bg="primary">{data.donations.length}</Badge>
                  </td>
                </tr>
              </tfoot>
            </Table>

            {/* All donations chronologically */}
            <h6 className="mb-3">{t('allDonations')}</h6>
            <Table striped hover>
              <thead>
                <tr>
                  <th>{tDonations('date')}</th>
                  <th>{tDonations('sponsor')}</th>
                  <th className="text-end">{tDonations('amount')}</th>
                  <th>{tDonations('note')}</th>
                </tr>
              </thead>
              <tbody>
                {data.donations.map((donation) => (
                  <tr key={donation.id}>
                    <td>{formatDate(donation.donationDate)}</td>
                    <td>{getSponsorDisplayName(donation.sponsor)}</td>
                    <td className="text-end"><strong>{formatCurrency(donation.amount)}</strong></td>
                    <td className="text-muted">{donation.note || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </Table>

            {data.donations.length === 0 && (
              <Alert variant="info" className="text-center">
                {tDonations('emptyState')}
              </Alert>
            )}

            {/* Sponsors without donations */}
            {data.sponsorsWithoutDonations.length > 0 && (
              <>
                <h6 className="mb-3 mt-4">{t('sponsorsWithoutDonations')}</h6>
                <Alert variant="warning">
                  <div className="small">
                    {data.sponsorsWithoutDonations.map((sponsor) => (
                      <div key={sponsor.id}>
                        <strong>{getSponsorDisplayName(sponsor)}</strong>
                      </div>
                    ))}
                  </div>
                </Alert>
              </>
            )}
          </>
        ) : null}
      </Modal.Body>
    </Modal>
  )
}
