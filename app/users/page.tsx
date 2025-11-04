'use client'

import { Container, Card, Table, Button } from 'react-bootstrap'
import { Navbar } from '@/components/Navbar'
import { UserModal } from '@/components/UserModal'
import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useLocalizedFormatters } from '@/lib/i18n/formatters'

type User = {
  id: string
  username: string
  name: string | null
  createdAt: Date
  updatedAt: Date
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const t = useTranslations('users')
  const tCommon = useTranslations('common')
  const { formatDate } = useLocalizedFormatters()

  const loadUsers = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/users')
      const data = await response.json()
      setUsers(data)
    } catch (error) {
      console.error('Error loading users:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [])

  const handleRowClick = (user: User) => {
    setSelectedUser(user)
    setShowModal(true)
  }

  const handleNewUser = () => {
    setSelectedUser(null)
    setShowModal(true)
  }

  const handleModalClose = () => {
    setShowModal(false)
    setSelectedUser(null)
  }

  const handleSave = () => {
    loadUsers()
  }

  return (
    <>
      <Navbar />
      <Container>
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h1>{t('title')}</h1>
          <Button variant="primary" onClick={handleNewUser}>
            <i className="bi bi-person-plus me-2"></i>
            {t('newUser')}
          </Button>
        </div>

        {loading ? (
          <Card>
            <Card.Body className="text-center py-5">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">{tCommon('loading')}</span>
              </div>
            </Card.Body>
          </Card>
        ) : users.length === 0 ? (
          <Card>
            <Card.Body className="text-center py-5">
              <i className="bi bi-people fs-1 text-muted mb-3 d-block"></i>
              <h5>{t('emptyState')}</h5>
              <p className="text-muted">{t('emptyState')}</p>
              <Button variant="primary" onClick={handleNewUser}>
                {t('newUser')}
              </Button>
            </Card.Body>
          </Card>
        ) : (
          <Card>
            <Card.Body>
              <Table responsive hover>
                <thead>
                  <tr>
                    <th>{t('username')}</th>
                    <th>{t('name')}</th>
                    <th>{tCommon('created')}</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr
                      key={user.id}
                      onClick={() => handleRowClick(user)}
                      style={{ cursor: 'pointer' }}
                      className="align-middle"
                    >
                      <td>
                        <strong>{user.username}</strong>
                      </td>
                      <td className="text-muted">{user.name || '-'}</td>
                      <td className="text-muted">
                        {formatDate(user.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        )}

        <UserModal
          show={showModal}
          user={selectedUser}
          onHide={handleModalClose}
          onSave={handleSave}
        />
      </Container>
    </>
  )
}
