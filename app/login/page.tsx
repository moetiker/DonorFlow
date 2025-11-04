'use client'

import { signIn } from 'next-auth/react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Container, Card, Form, Button, Alert } from 'react-bootstrap'
import { useOrganization } from '@/lib/useOrganization'
import { useTranslations } from 'next-intl'
import packageJson from '../../package.json'

export default function LoginPage() {
  const router = useRouter()
  const { organizationName } = useOrganization()
  const t = useTranslations('login')
  const tErrors = useTranslations('errors')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const result = await signIn('credentials', {
        username,
        password,
        redirect: false
      })

      if (result?.error) {
        setError(t('error'))
      } else {
        router.push('/')
        router.refresh()
      }
    } catch (err) {
      setError(tErrors('generic'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Container
      className="d-flex align-items-center justify-content-center"
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      }}
    >
      <Card style={{ width: '100%', maxWidth: '400px', boxShadow: '0 10px 40px rgba(0,0,0,0.2)', border: 'none' }}>
        <Card.Body className="p-4">
          <div className="text-center mb-4">
            <i className="bi bi-piggy-bank" style={{ fontSize: '4rem', color: '#667eea' }}></i>
          </div>
          <h1 className="text-center mb-2" style={{
            fontSize: '2.5rem',
            fontWeight: 'bold',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            DonorFlow
          </h1>
          <h5 className="text-center text-muted mb-2">{organizationName}</h5>
          <p className="text-center text-muted small mb-4">{t('subtitle')}</p>

          {error && <Alert variant="danger">{error}</Alert>}

          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3" controlId="username">
              <Form.Label>{t('username')}</Form.Label>
              <Form.Control
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                disabled={loading}
              />
            </Form.Group>

            <Form.Group className="mb-3" controlId="password">
              <Form.Label>{t('password')}</Form.Label>
              <Form.Control
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </Form.Group>

            <Button
              type="submit"
              className="w-100"
              disabled={loading}
              style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                border: 'none',
                padding: '12px',
                fontSize: '1.1rem',
                fontWeight: '500'
              }}
            >
              {loading ? t('loggingIn') : t('login')}
            </Button>
          </Form>

          <div className="text-center mt-4">
            <small style={{ color: '#6c757d' }}>Version {packageJson.version}</small>
          </div>
        </Card.Body>
      </Card>
    </Container>
  )
}
