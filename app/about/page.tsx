'use client'

import { Container } from 'react-bootstrap'
import { Navbar } from '@/components/Navbar'
import packageJson from '@/package.json'

const features = [
  { icon: 'bi-people', title: 'Members & groups', desc: 'organise and auto-group' },
  { icon: 'bi-heart', title: 'Patrons', desc: 'assign to member or group' },
  { icon: 'bi-cash-coin', title: 'Donations', desc: 'monetary & in-kind' },
  { icon: 'bi-bullseye', title: 'Targets', desc: 'per fiscal year, auto-carried' },
  { icon: 'bi-graph-up', title: 'Reports', desc: 'dashboards with PDF export' },
  { icon: 'bi-link-45deg', title: 'Status links', desc: 'public progress pages' },
  { icon: 'bi-translate', title: '4 languages', desc: 'DE / EN / FR / IT' },
  { icon: 'bi-filetype-csv', title: 'CSV', desc: 'bulk import & export' },
]

export default function AboutPage() {
  return (
    <>
      <Navbar />
      <Container className="about-page py-4">
        <div className="about-shell">
          {/* Identity rail */}
          <aside className="about-rail">
            <span className="about-mark">
              <i className="bi bi-piggy-bank"></i>
            </span>
            <h1 className="about-name">DonorFlow</h1>
            <p className="about-de">Gönnerverwaltung für Vereine</p>
            <span className="about-ver">Version {packageJson.version}</span>
            <ul className="about-links">
              <li>
                <a
                  href="https://github.com/moetiker/DonorFlow"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <i className="bi bi-github"></i>
                  GitHub repository
                </a>
              </li>
              <li>
                <a href="mailto:manuel@oetiker.ch">
                  <i className="bi bi-envelope"></i>
                  manuel@oetiker.ch
                </a>
              </li>
            </ul>
          </aside>

          {/* Content */}
          <div className="about-body">
            <section className="about-sec">
              <h2 className="about-h">About</h2>
              <p className="about-lead">
                DonorFlow is a modern donation-management system for clubs and organizations —
                one place to track members, patrons, gifts, and fiscal-year targets, with
                shareable progress pages and reports.
              </p>
            </section>

            <section className="about-sec">
              <h2 className="about-h">What it does</h2>
              <ul className="about-feats">
                {features.map((f) => (
                  <li key={f.title}>
                    <i className={`bi ${f.icon}`}></i>
                    <span>
                      <b>{f.title}</b> — {f.desc}
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="about-sec">
              <h2 className="about-h">Built with</h2>
              <dl className="about-def">
                <dt>Framework</dt>
                <dd>Next.js 16 <span>· App Router</span></dd>
                <dt>Language</dt>
                <dd>TypeScript <span>· strict</span></dd>
                <dt>Data</dt>
                <dd>Prisma <span>· SQLite</span></dd>
                <dt>Auth</dt>
                <dd>NextAuth.js</dd>
                <dt>UI</dt>
                <dd>React-Bootstrap</dd>
              </dl>
            </section>

            <section className="about-sec">
              <h2 className="about-h">Creator &amp; license</h2>
              <p className="about-lead">
                <b style={{ color: '#16202c' }}>Manuel Oetiker</b> — built and maintained in Switzerland.
              </p>
              <div className="about-mit">
                <b>MIT License</b> · Copyright © {new Date().getFullYear()} Manuel Oetiker.
                Free to use, copy, modify, and distribute; provided &ldquo;as is&rdquo;, without
                warranty of any kind.
              </div>
            </section>
          </div>
        </div>
      </Container>
    </>
  )
}
