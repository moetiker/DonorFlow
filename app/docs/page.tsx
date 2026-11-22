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
            <h5 className="mb-0">Sponsors, Groups and the Club Pool</h5>
          </Card.Header>
          <Card.Body>
            <h6>Sponsor assignment</h6>
            <p className="text-muted">
              A sponsor can be assigned to several recipients, each a member or a group. Every
              donation is credited to exactly one of them, chosen when the donation is entered, and
              stays with that recipient when the sponsor&apos;s assignments change later.
            </p>
            <h6>Joining a group</h6>
            <p className="text-muted">
              When a member with sponsors is put into a group, the member dialog offers to move the
              member&apos;s sponsors to the group (ticked by default). Past donations stay credited to
              the member. Leaving or switching groups never moves the group&apos;s sponsors.
            </p>
            <h6>Deleting a member or group</h6>
            <p className="text-muted">
              Donations credited to the deleted member or group go to the sponsor&apos;s remaining
              recipient if it has exactly one, otherwise to the club pool. Sponsors left without any
              recipient are assigned to the club pool. The club pool itself cannot be deleted; mark
              another group as the club pool first.
            </p>
            <h6>Dissolving a group</h6>
            <p className="text-muted mb-0">
              &quot;Dissolve&quot; in the group dialog hands the group&apos;s sponsors to its members:
              each sponsor goes to all members unless unticked. A sponsor ticked for no member and
              without any other recipient goes to the club pool. The members leave the group, but the
              donations credited to the group stay with it, so past reports still show it, marked
              &quot;(dissolved)&quot;. Dissolved groups can no longer be chosen for sponsors, donations
              or members and are listed in the collapsed &quot;Dissolved groups&quot; section of the
              groups page, where they can still be deleted.
            </p>
          </Card.Body>
        </Card>

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
