'use client'

import { signOut, useSession } from 'next-auth/react'
import { Navbar as BSNavbar, Container, Nav, NavDropdown } from 'react-bootstrap'
import Link from 'next/link'
import { useOrganization } from '@/lib/useOrganization'
import { useTranslations } from 'next-intl'
import { LanguageSwitcher } from './LanguageSwitcher'

export function Navbar() {
  const { data: session } = useSession()
  const { organizationName } = useOrganization()
  const t = useTranslations('nav')

  if (!session) return null

  return (
    <BSNavbar bg="dark" variant="dark" expand="lg" className="mb-4">
      <Container fluid>
        <BSNavbar.Brand as={Link} href="/">
          <i className="bi bi-piggy-bank me-2"></i>
          <div className="d-inline-block">
            <div>{organizationName}</div>
            <div style={{ fontSize: '0.7rem', opacity: 0.8, marginTop: '-2px' }}>{t('poweredBy')}</div>
          </div>
        </BSNavbar.Brand>
        <BSNavbar.Toggle aria-controls="navbar-nav" />
        <BSNavbar.Collapse id="navbar-nav">
          <Nav className="me-auto">
            <Nav.Link as={Link} href="/">
              <i className="bi bi-house me-1"></i>
              {t('dashboard')}
            </Nav.Link>

            <NavDropdown title={<><i className="bi bi-people me-1"></i>{t('masterData')}</>} id="stammdaten-dropdown">
              <NavDropdown.Item as={Link} href="/members">
                <i className="bi bi-person me-2"></i>
                {t('members')}
              </NavDropdown.Item>
              <NavDropdown.Item as={Link} href="/groups">
                <i className="bi bi-people-fill me-2"></i>
                {t('groups')}
              </NavDropdown.Item>
              <NavDropdown.Item as={Link} href="/sponsors">
                <i className="bi bi-heart me-2"></i>
                {t('sponsors')}
              </NavDropdown.Item>
            </NavDropdown>

            <Nav.Link as={Link} href="/donations">
              <i className="bi bi-cash-coin me-1"></i>
              {t('donations')}
            </Nav.Link>

            <NavDropdown title={<><i className="bi bi-clipboard-data me-1"></i>{t('reports')}</>} id="reports-dropdown">
              <NavDropdown.Item as={Link} href="/reports/performance">
                <i className="bi bi-graph-up me-2"></i>
                {t('performance')}
              </NavDropdown.Item>
              <NavDropdown.Item as={Link} href="/reports/shares">
                <i className="bi bi-pie-chart me-2"></i>
                {t('shares')}
              </NavDropdown.Item>
            </NavDropdown>

            <NavDropdown title={<><i className="bi bi-gear me-1"></i>{t('administration')}</>} id="verwaltung-dropdown">
              <NavDropdown.Item as={Link} href="/fiscal-years">
                <i className="bi bi-calendar-range me-2"></i>
                {t('fiscalYears')}
              </NavDropdown.Item>
              <NavDropdown.Item as={Link} href="/targets">
                <i className="bi bi-clipboard-check me-2"></i>
                {t('targets')}
              </NavDropdown.Item>
              <NavDropdown.Divider />
              <NavDropdown.Item as={Link} href="/users">
                <i className="bi bi-people me-2"></i>
                {t('users')}
              </NavDropdown.Item>
              <NavDropdown.Item as={Link} href="/import">
                <i className="bi bi-upload me-2"></i>
                {t('importData')}
              </NavDropdown.Item>
              <NavDropdown.Item as={Link} href="/settings">
                <i className="bi bi-sliders me-2"></i>
                {t('settings')}
              </NavDropdown.Item>
            </NavDropdown>
          </Nav>

          <Nav>
            <LanguageSwitcher />
            <NavDropdown
              title={<><i className="bi bi-person-circle me-1"></i>{session.user?.name || 'User'}</>}
              id="user-dropdown"
              align="end"
            >
              <NavDropdown.Item as={Link} href="/docs">
                <i className="bi bi-book me-2"></i>
                {t('documentation')}
              </NavDropdown.Item>
              <NavDropdown.Item as={Link} href="/about">
                <i className="bi bi-info-circle me-2"></i>
                {t('about')}
              </NavDropdown.Item>
              <NavDropdown.Divider />
              <NavDropdown.Item onClick={() => signOut()}>
                <i className="bi bi-box-arrow-right me-2"></i>
                {t('logout')}
              </NavDropdown.Item>
            </NavDropdown>
          </Nav>
        </BSNavbar.Collapse>
      </Container>
    </BSNavbar>
  )
}
