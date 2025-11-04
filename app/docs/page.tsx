'use client'

import { Container, Card, Row, Col } from 'react-bootstrap'
import { Navbar } from '@/components/Navbar'
import Link from 'next/link'

export default function DocsPage() {
  return (
    <>
      <Navbar />
      <Container>
        <h1 className="mb-4">Dokumentation</h1>

        <Row className="g-4">
          <Col md={6}>
            <Card className="h-100">
              <Card.Body>
                <div className="d-flex align-items-start">
                  <div className="bg-primary bg-opacity-10 p-3 rounded me-3">
                    <i className="bi bi-book fs-2 text-primary"></i>
                  </div>
                  <div className="flex-grow-1">
                    <h5 className="card-title">README</h5>
                    <p className="card-text text-muted">
                      Quick start guide, features overview, and basic setup instructions.
                    </p>
                    <a
                      href="https://github.com/moetiker/DonorFlow/blob/main/README.md"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-sm btn-outline-primary"
                    >
                      <i className="bi bi-github me-2"></i>
                      View on GitHub
                    </a>
                  </div>
                </div>
              </Card.Body>
            </Card>
          </Col>

          <Col md={6}>
            <Card className="h-100">
              <Card.Body>
                <div className="d-flex align-items-start">
                  <div className="bg-success bg-opacity-10 p-3 rounded me-3">
                    <i className="bi bi-cloud-upload fs-2 text-success"></i>
                  </div>
                  <div className="flex-grow-1">
                    <h5 className="card-title">Deployment Guide</h5>
                    <p className="card-text text-muted">
                      Production deployment options: Docker, VPS, Railway, Vercel.
                    </p>
                    <a
                      href="https://github.com/moetiker/DonorFlow/blob/main/DEPLOYMENT.md"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-sm btn-outline-success"
                    >
                      <i className="bi bi-github me-2"></i>
                      View on GitHub
                    </a>
                  </div>
                </div>
              </Card.Body>
            </Card>
          </Col>

          <Col md={6}>
            <Card className="h-100">
              <Card.Body>
                <div className="d-flex align-items-start">
                  <div className="bg-warning bg-opacity-10 p-3 rounded me-3">
                    <i className="bi bi-file-text fs-2 text-warning"></i>
                  </div>
                  <div className="flex-grow-1">
                    <h5 className="card-title">Project Definition</h5>
                    <p className="card-text text-muted">
                      Technical documentation, data model, and architecture overview.
                    </p>
                    <a
                      href="https://github.com/moetiker/DonorFlow/blob/main/PROJECT_DEFINITION.md"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-sm btn-outline-warning"
                    >
                      <i className="bi bi-github me-2"></i>
                      View on GitHub
                    </a>
                  </div>
                </div>
              </Card.Body>
            </Card>
          </Col>

          <Col md={6}>
            <Card className="h-100">
              <Card.Body>
                <div className="d-flex align-items-start">
                  <div className="bg-info bg-opacity-10 p-3 rounded me-3">
                    <i className="bi bi-diagram-3 fs-2 text-info"></i>
                  </div>
                  <div className="flex-grow-1">
                    <h5 className="card-title">Database Model</h5>
                    <p className="card-text text-muted">
                      Visual diagram of all database entities and their relationships.
                    </p>
                    <Link
                      href="/database-model.svg"
                      target="_blank"
                      className="btn btn-sm btn-outline-info"
                    >
                      <i className="bi bi-eye me-2"></i>
                      View Diagram
                    </Link>
                  </div>
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>

        <Card className="mt-4">
          <Card.Header>
            <h5 className="mb-0">Quick Links</h5>
          </Card.Header>
          <Card.Body>
            <Row>
              <Col md={6}>
                <h6 className="text-muted mb-3">Getting Started</h6>
                <ul className="list-unstyled">
                  <li className="mb-2">
                    <i className="bi bi-arrow-right-circle me-2 text-primary"></i>
                    <Link href="/">Dashboard Overview</Link>
                  </li>
                  <li className="mb-2">
                    <i className="bi bi-arrow-right-circle me-2 text-primary"></i>
                    <Link href="/fiscal-years">Create Fiscal Year</Link>
                  </li>
                  <li className="mb-2">
                    <i className="bi bi-arrow-right-circle me-2 text-primary"></i>
                    <Link href="/members">Manage Members</Link>
                  </li>
                  <li className="mb-2">
                    <i className="bi bi-arrow-right-circle me-2 text-primary"></i>
                    <Link href="/sponsors">Add Sponsors</Link>
                  </li>
                </ul>
              </Col>
              <Col md={6}>
                <h6 className="text-muted mb-3">Features</h6>
                <ul className="list-unstyled">
                  <li className="mb-2">
                    <i className="bi bi-check-circle me-2 text-success"></i>
                    Member & Group Management
                  </li>
                  <li className="mb-2">
                    <i className="bi bi-check-circle me-2 text-success"></i>
                    Donation Tracking
                  </li>
                  <li className="mb-2">
                    <i className="bi bi-check-circle me-2 text-success"></i>
                    Performance Reports with PDF Export
                  </li>
                  <li className="mb-2">
                    <i className="bi bi-check-circle me-2 text-success"></i>
                    Multi-User Support
                  </li>
                </ul>
              </Col>
            </Row>
          </Card.Body>
        </Card>

        <Card className="mt-4">
          <Card.Body>
            <h6 className="mb-3">Support & Resources</h6>
            <p className="text-muted mb-3">
              For questions, issues, or feature requests, please refer to the documentation or contact your system administrator.
            </p>
            <div className="d-flex gap-2">
              <span className="badge bg-secondary">Version 1.0.0</span>
              <span className="badge bg-secondary">Next.js 15</span>
              <span className="badge bg-secondary">TypeScript</span>
              <span className="badge bg-secondary">SQLite</span>
            </div>
          </Card.Body>
        </Card>
      </Container>
    </>
  )
}
