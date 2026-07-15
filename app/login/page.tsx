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
        background:
          'radial-gradient(1100px 560px at 50% -12%, rgba(255,206,106,0.18), transparent 60%), linear-gradient(135deg, #16233d 0%, #21407a 100%)'
      }}
    >
      <Card style={{ width: '100%', maxWidth: '400px', boxShadow: '0 24px 60px -20px rgba(0,0,0,0.55)', border: 'none', borderRadius: '1rem' }}>
        <Card.Body className="p-4">
          <div className="text-center mb-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icon.svg"
              alt="DonorFlow"
              width={76}
              height={76}
              style={{ borderRadius: 18, boxShadow: '0 8px 24px rgba(16,35,61,0.35)' }}
            />
          </div>
          <h1 className="text-center mb-2" style={{
            fontSize: '2.4rem',
            fontWeight: 800,
            letterSpacing: '-0.02em',
            background: 'linear-gradient(120deg, #16233d 0%, #ea7600 130%)',
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
              variant="primary"
              className="w-100"
              disabled={loading}
              style={{ padding: '12px', fontSize: '1.05rem' }}
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
