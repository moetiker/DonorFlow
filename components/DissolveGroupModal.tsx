'use client'

import { Modal, Button, Form, Table, Alert, Spinner } from 'react-bootstrap'
import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { getSponsorDisplayName } from '@/lib/utils'

type GroupSponsor = {
  id: string
  company: string | null
  firstName: string | null
  lastName: string | null
  assignments: { memberId: string | null; groupId: string | null }[]
}

type Props = {
  show: boolean
  group: {
    id: string
    name: string
    members: { id: string; firstName: string; lastName: string }[]
  } | null
  onHide: () => void
  onDissolved: () => void
}

/** Key of one ticked sponsor-member pair. */
const pairKey = (sponsorId: string, memberId: string) => `${sponsorId}:${memberId}`

/**
 * Dialog for dissolving a group: a table of the group's sponsors against its
 * members, all pairs ticked by default. Sponsors left without a member (and
 * without any other assignment) go to the club pool.
 */
export function DissolveGroupModal({ show, group, onHide, onDissolved }: Props) {
  const t = useTranslations('groups')
  const tCommon = useTranslations('common')
  const tErrors = useTranslations('errors')
  const [sponsors, setSponsors] = useState<GroupSponsor[]>([])
  const [ticked, setTicked] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [dissolving, setDissolving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const members = group?.members ?? []

  useEffect(() => {
    // Wrapped in an async function so the load starts after the effect has
    // run, instead of updating state synchronously in it.
    const run = async () => {
      if (!show || !group) return
      setLoading(true)
      setError(null)
      try {
        const response = await fetch(`/api/groups/${group.id}/sponsors`)
        const data: GroupSponsor[] = response.ok ? await response.json() : []
        setSponsors(data)
        setTicked(new Set(data.flatMap(s => group.members.map(m => pairKey(s.id, m.id)))))
      } catch (err) {
        console.error('Error loading group sponsors:', err)
        setSponsors([])
        setError(tErrors('loadingFailed'))
      } finally {
        setLoading(false)
      }
    }
    void run()
  }, [show, group, tErrors])

  const toggle = (key: string) => {
    setTicked(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const chosenMembers = (sponsorId: string) =>
    members.filter(m => ticked.has(pairKey(sponsorId, m.id))).map(m => m.id)

  // Same rule as the server: no member ticked and no assignment besides this group
  const sponsorsToPool = sponsors.filter(
    s => chosenMembers(s.id).length === 0 && s.assignments.every(a => a.groupId === group?.id)
  ).length

  const handleDissolve = async () => {
    if (!group) return
    setDissolving(true)
    setError(null)
    try {
      const response = await fetch(`/api/groups/${group.id}/dissolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignments: sponsors.map(s => ({ sponsorId: s.id, memberIds: chosenMembers(s.id) }))
        })
      })
      if (response.ok) {
        onDissolved()
        onHide()
      } else {
        const data = await response.json()
        const known = ['groupAlreadyDissolved', 'notAGroupMember', 'noClubPool']
        setError(
          data.error === 'clubPoolLocked'
            ? t('clubPoolDissolveLocked')
            : known.includes(data.error) ? t(data.error) : data.error || tErrors('saveFailed')
        )
      }
    } catch (err) {
      console.error('Error dissolving group:', err)
      setError(tErrors('saveFailed'))
    } finally {
      setDissolving(false)
    }
  }

  return (
    <Modal show={show} onHide={onHide} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>{t('dissolveTitle', { name: group?.name ?? '' })}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {error && <Alert variant="danger">{error}</Alert>}
        <p>{t('dissolveIntro')}</p>
        {loading ? (
          <div className="text-center py-3">
            <Spinner animation="border" size="sm" />
          </div>
        ) : sponsors.length === 0 ? (
          <p className="text-muted mb-0">{t('dissolveNoSponsors')}</p>
        ) : (
          <>
            {members.length === 0 && <p className="text-muted">{t('dissolveNoMembers')}</p>}
            <Table responsive size="sm" className="align-middle">
              <thead>
                <tr>
                  <th>{t('sponsors')}</th>
                  {members.map(m => (
                    <th key={m.id} className="text-center">
                      {m.firstName} {m.lastName}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sponsors.map(s => (
                  <tr key={s.id}>
                    <td>{getSponsorDisplayName(s)}</td>
                    {members.map(m => {
                      const key = pairKey(s.id, m.id)
                      return (
                        <td key={m.id} className="text-center">
                          <Form.Check
                            type="checkbox"
                            className="d-inline-block"
                            checked={ticked.has(key)}
                            onChange={() => toggle(key)}
                            aria-label={`${getSponsorDisplayName(s)} – ${m.firstName} ${m.lastName}`}
                          />
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </Table>
          </>
        )}
      </Modal.Body>
      <Modal.Footer>
        <div className="me-auto text-muted small">
          {sponsorsToPool > 0 && t('dissolveSponsorsToPool', { count: sponsorsToPool })}
        </div>
        <Button variant="secondary" onClick={onHide} disabled={dissolving}>
          {tCommon('cancel')}
        </Button>
        <Button variant="danger" onClick={handleDissolve} disabled={dissolving || loading}>
          {dissolving ? t('dissolving') : t('dissolve')}
        </Button>
      </Modal.Footer>
    </Modal>
  )
}
