'use client'

import { Modal, Form, Button } from 'react-bootstrap'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { getMemberDisplayName } from '@/lib/utils'

type Member = { id: string; firstName: string; lastName: string }
type Group = { id: string; name: string }

type Props = {
  show: boolean
  /** Members that are not assigned yet. */
  members: Member[]
  /** Active groups that are not assigned yet. */
  groups: Group[]
  onCancel: () => void
  /** Called with the chosen values ("m:<id>" or "g:<id>"). */
  onConfirm: (values: string[]) => void
}

/**
 * Picker dialog for adding one or more recipients (members or groups) to a sponsor.
 */
export function RecipientPickerModal({ show, members, groups, onCancel, onConfirm }: Props) {
  const t = useTranslations('sponsors')
  const tCommon = useTranslations('common')
  const [selected, setSelected] = useState<string[]>([])
  const [filter, setFilter] = useState('')

  // Start with an empty selection every time the dialog opens.
  const [lastShow, setLastShow] = useState(show)
  if (lastShow !== show) {
    setLastShow(show)
    if (show) {
      setSelected([])
      setFilter('')
    }
  }

  const toggle = (value: string) => {
    setSelected(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value])
  }

  const needle = filter.trim().toLowerCase()
  const visibleMembers = members.filter(m => getMemberDisplayName(m).toLowerCase().includes(needle))
  const visibleGroups = groups.filter(g => g.name.toLowerCase().includes(needle))
  const nothingAvailable = members.length === 0 && groups.length === 0

  return (
    <Modal show={show} onHide={onCancel} backdrop="static" scrollable className="recipient-picker" backdropClassName="recipient-picker-backdrop">
      <Modal.Header closeButton>
        <Modal.Title>{t('addRecipient')}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {nothingAvailable ? (
          <div className="text-muted">{t('noRecipientsAvailable')}</div>
        ) : (
          <>
            <Form.Control
              type="search"
              className="mb-3"
              placeholder={tCommon('search')}
              aria-label={tCommon('search')}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              autoFocus
            />
            {visibleMembers.length > 0 && (
              <>
                <h6 className="text-muted">{t('recipientMembers')}</h6>
                {visibleMembers.map(m => (
                  <Form.Check
                    key={m.id}
                    type="checkbox"
                    id={`pick-m-${m.id}`}
                    label={getMemberDisplayName(m)}
                    checked={selected.includes(`m:${m.id}`)}
                    onChange={() => toggle(`m:${m.id}`)}
                  />
                ))}
              </>
            )}
            {visibleGroups.length > 0 && (
              <>
                <h6 className="text-muted mt-3">{t('recipientGroups')}</h6>
                {visibleGroups.map(g => (
                  <Form.Check
                    key={g.id}
                    type="checkbox"
                    id={`pick-g-${g.id}`}
                    label={g.name}
                    checked={selected.includes(`g:${g.id}`)}
                    onChange={() => toggle(`g:${g.id}`)}
                  />
                ))}
              </>
            )}
          </>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onCancel}>
          {tCommon('cancel')}
        </Button>
        <Button variant="primary" onClick={() => onConfirm(selected)} disabled={selected.length === 0}>
          {tCommon('ok')}
        </Button>
      </Modal.Footer>
    </Modal>
  )
}
