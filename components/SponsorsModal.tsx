'use client'

import { Modal, Table, Badge } from 'react-bootstrap'
import { useState, useEffect } from 'react'
import { getSponsorDisplayName } from '@/lib/utils'

type Sponsor = {
  id: string
  company: string | null
  salutation: string | null
  firstName: string | null
  lastName: string | null
  city: string | null
}

type Props = {
  show: boolean
  entityId: string | null
  entityName: string
  entityType: 'member' | 'group'
  onHide: () => void
}

export function SponsorsModal({ show, entityId, entityName, entityType, onHide }: Props) {
  const [sponsors, setSponsors] = useState<Sponsor[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (show && entityId) {
      loadSponsors()
    }
  }, [show, entityId])

  const loadSponsors = async () => {
    if (!entityId) return

    setLoading(true)
    try {
      const endpoint = entityType === 'member'
        ? `/api/members/${entityId}/sponsors`
        : `/api/groups/${entityId}/sponsors`

      const response = await fetch(endpoint)
      const data = await response.json()
      setSponsors(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error loading sponsors:', error)
      setSponsors([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal show={show} onHide={onHide} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>Gönner: {entityName}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Laden...</span>
            </div>
          </div>
        ) : sponsors.length === 0 ? (
          <div className="text-center py-5 text-muted">
            <i className="bi bi-inbox fs-1 mb-3 d-block"></i>
            <p>Keine Gönner vorhanden</p>
          </div>
        ) : (
          <>
            <div className="mb-3">
              <Badge bg="info" className="fs-6">
                {sponsors.length} Gönner
              </Badge>
            </div>
            <Table striped hover>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Ort</th>
                </tr>
              </thead>
              <tbody>
                {sponsors.map((sponsor) => (
                  <tr key={sponsor.id}>
                    <td><strong>{getSponsorDisplayName(sponsor)}</strong></td>
                    <td className="text-muted">{sponsor.city || '-'}</td>
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
