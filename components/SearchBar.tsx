'use client'

import { Card, Form, InputGroup, Button } from 'react-bootstrap'

type SearchBarProps = {
  /** Current search value */
  value: string
  /** Change handler */
  onChange: (value: string) => void
  /** Placeholder text */
  placeholder: string
  /** Result count to display (optional) */
  resultCount?: {
    filtered: number
    total: number
    /** Label for the items (e.g., "Mitglieder") */
    label: string
  }
}

/**
 * Reusable search bar component with clear button and result count
 *
 * @example
 * <SearchBar
 *   value={searchTerm}
 *   onChange={setSearchTerm}
 *   placeholder={t('searchPlaceholder')}
 *   resultCount={{
 *     filtered: filteredMembers.length,
 *     total: members.length,
 *     label: t('title')
 *   }}
 * />
 */
export function SearchBar({ value, onChange, placeholder, resultCount }: SearchBarProps) {
  return (
    <Card className="mb-3">
      <Card.Body>
        <InputGroup>
          <InputGroup.Text>
            <i className="bi bi-search"></i>
          </InputGroup.Text>
          <Form.Control
            type="text"
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
          {value && (
            <Button variant="outline-secondary" onClick={() => onChange('')}>
              <i className="bi bi-x"></i>
            </Button>
          )}
        </InputGroup>
        {resultCount && value && (
          <small className="text-muted mt-2 d-block">
            {resultCount.filtered} von {resultCount.total} {resultCount.label}
          </small>
        )}
      </Card.Body>
    </Card>
  )
}
