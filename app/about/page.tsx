'use client'

import { Container, Card } from 'react-bootstrap'
import { Navbar } from '@/components/Navbar'

export default function AboutPage() {
  return (
    <>
      <Navbar />
      <Container>
        <h1 className="mb-4">About DonorFlow</h1>

        <Card className="mb-4">
          <Card.Body>
            <h5 className="mb-3">
              <i className="bi bi-info-circle me-2"></i>
              About
            </h5>
            <p className="mb-2">
              <strong>DonorFlow</strong> - Modern donation management system for clubs and organizations
            </p>
            <p className="mb-2">Version 0.1.0</p>
            <p className="mb-0">
              <a
                href="https://github.com/moetiker/DonorFlow"
                target="_blank"
                rel="noopener noreferrer"
                className="text-decoration-none"
              >
                <i className="bi bi-github me-2"></i>
                GitHub Repository
              </a>
            </p>
          </Card.Body>
        </Card>

        <Card className="mb-4">
          <Card.Body>
            <h5 className="mb-3">
              <i className="bi bi-person-badge me-2"></i>
              Creator
            </h5>
            <p className="mb-2">
              <strong>Manuel Oetiker</strong>
            </p>
            <p className="mb-0">
              <a
                href="mailto:manuel@oetiker.ch"
                className="text-decoration-none"
              >
                <i className="bi bi-envelope me-2"></i>
                manuel@oetiker.ch
              </a>
            </p>
          </Card.Body>
        </Card>

        <Card className="mb-4">
          <Card.Body>
            <h5 className="mb-3">
              <i className="bi bi-stack me-2"></i>
              Technology
            </h5>
            <p className="mb-2">Built with modern web technologies:</p>
            <ul className="mb-0">
              <li>Next.js 15 - React Framework</li>
              <li>TypeScript - Type-safe Programming</li>
              <li>Prisma - Database ORM</li>
              <li>NextAuth.js - Authentication</li>
              <li>React Bootstrap - UI Components</li>
              <li>SQLite - Database</li>
            </ul>
          </Card.Body>
        </Card>

        <Card className="mb-4">
          <Card.Body>
            <h5 className="mb-3">
              <i className="bi bi-shield-check me-2"></i>
              License
            </h5>
            <div className="bg-light p-3 rounded">
              <p className="mb-2"><strong>MIT License</strong></p>
              <p className="mb-0">
                Copyright (c) {new Date().getFullYear()} Manuel Oetiker
                <br />
                <br />
                Permission is hereby granted, free of charge, to any person obtaining a copy of this software
                and associated documentation files (the "Software"), to deal in the Software without restriction,
                including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense,
                and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so.
                <br />
                <br />
                THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.
              </p>
            </div>
          </Card.Body>
        </Card>
      </Container>
    </>
  )
}
