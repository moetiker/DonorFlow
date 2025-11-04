'use client'

import { Container, Card, Table, ProgressBar, Alert, Badge, Button } from 'react-bootstrap'
import { Navbar } from '@/components/Navbar'
import Link from 'next/link'
import { useEffect, useState, useRef } from 'react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { useTranslations } from 'next-intl'
import { useLocalizedFormatters } from '@/lib/i18n/formatters'

type Member = {
  id: string
  firstName: string
  lastName: string
}

type MemberStat = {
  member: Member
  target: number
  actual: number
  difference: number
  percentage: number
  donationCount: number
}

type GroupStat = {
  group: {
    id: string
    name: string
  }
  target: number
  actual: number
  difference: number
  percentage: number
  memberCount: number
  donationCount: number
  members: Array<{
    id: string
    firstName: string
    lastName: string
  }>
}

type ReportData = {
  currentYear: {
    id: string
    name: string
    startDate: string
    endDate: string
  } | null
  memberStats: MemberStat[]
  groupStats: GroupStat[]
  unassignedTotal: number
  unassignedCount: number
  totalTarget: number
  totalActual: number
  memberActual: number
  groupActual: number
  overallPercentage: number
}

export default function PerformancePage() {
  const t = useTranslations('reports')
  const tCommon = useTranslations('common')
  const { formatCurrency, formatDate } = useLocalizedFormatters()
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const reportRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadReportData()
  }, [])

  async function loadReportData() {
    try {
      const response = await fetch('/api/reports')
      const result = await response.json()
      setData(result)
    } catch (error) {
      console.error('Error loading reports:', error)
    } finally {
      setLoading(false)
    }
  }

  async function exportToPDF() {
    if (!data) return

    setExporting(true)
    try {
      const pdf = new jsPDF('p', 'mm', 'a4')
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const margin = 15
      let yPosition = margin

      const today = new Date()
      const dateStr = formatDate(today)

      // Helper function to add footer
      const addFooter = (pageNum: number) => {
        pdf.setFontSize(9)
        pdf.setTextColor(100)
        pdf.text(`${t('createdOn')}: ${dateStr}`, margin, pageHeight - 10)
        pdf.text(`${t('page')} ${pageNum}`, pageWidth - margin, pageHeight - 10, { align: 'right' })
      }

      // Header
      pdf.setFontSize(20)
      pdf.setTextColor(0)
      pdf.text(t('title'), margin, yPosition)
      yPosition += 10

      pdf.setFontSize(12)
      pdf.setTextColor(50)
      pdf.text(`${t('fiscalYear')}: ${data.currentYear?.name || ''}`, margin, yPosition)
      yPosition += 12

      // Overall Summary
      pdf.setFontSize(14)
      pdf.setTextColor(0)
      pdf.text(t('overallSummary'), margin, yPosition)
      yPosition += 8

      pdf.setFontSize(10)
      const summaryData = [
        [t('targetTotal'), formatCurrency(totalTarget)],
        [t('actualTotalAll'), formatCurrency(totalActual)],
        [`  - ${t('members')}`, formatCurrency(memberActual)],
        [`  - ${t('groups')}`, formatCurrency(groupActual)],
        ...(unassignedTotal > 0 ? [[`  - ${t('notAssigned')}`, formatCurrency(unassignedTotal)]] : []),
        [t('difference'), formatCurrency(totalActual - totalTarget)],
        [t('achievement'), `${totalTarget > 0 ? ((totalActual / totalTarget) * 100).toFixed(1) : '0.0'}%`]
      ]

      autoTable(pdf, {
        startY: yPosition,
        head: [],
        body: summaryData,
        margin: { left: margin, right: margin },
        theme: 'plain',
        styles: { fontSize: 10 },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 80 },
          1: { halign: 'right' }
        }
      })

      yPosition = (pdf as any).lastAutoTable.finalY + 10

      // Group Stats
      if (groupStats && groupStats.length > 0) {
        if (yPosition > pageHeight - 60) {
          pdf.addPage()
          yPosition = margin
        }

        pdf.setFontSize(14)
        pdf.text(t('groupDonations'), margin, yPosition)
        yPosition += 5

        const groupTableData = groupStats.map(stat => [
          stat.group.name,
          formatCurrency(stat.target),
          formatCurrency(stat.actual),
          formatCurrency(stat.difference),
          stat.donationCount.toString(),
          `${stat.percentage.toFixed(0)}%`
        ])

        autoTable(pdf, {
          startY: yPosition,
          head: [[t('group'), t('target'), t('actual'), t('difference'), t('donations'), t('achievement')]],
          body: groupTableData,
          margin: { left: margin, right: margin },
          theme: 'striped',
          styles: { fontSize: 9 },
          headStyles: { fillColor: [52, 58, 64], textColor: 255 },
          columnStyles: {
            0: { cellWidth: 50 },
            1: { halign: 'right', cellWidth: 25 },
            2: { halign: 'right', cellWidth: 25 },
            3: { halign: 'right', cellWidth: 25 },
            4: { halign: 'center', cellWidth: 20 },
            5: { halign: 'right', cellWidth: 20 }
          },
          didParseCell: (data) => {
            // Color achievement column based on percentage
            if (data.column.index === 5 && data.section === 'body') {
              const stat = groupStats[data.row.index]
              if (stat.percentage >= 100) {
                data.cell.styles.textColor = [25, 135, 84] // Green
                data.cell.styles.fontStyle = 'bold'
              } else if (stat.percentage >= 75) {
                data.cell.styles.textColor = [255, 193, 7] // Yellow
              } else {
                data.cell.styles.textColor = [220, 53, 69] // Red
              }
            }
            // Color difference column
            if (data.column.index === 3 && data.section === 'body') {
              const stat = groupStats[data.row.index]
              if (stat.difference >= 0) {
                data.cell.styles.textColor = [25, 135, 84] // Green
              } else {
                data.cell.styles.textColor = [220, 53, 69] // Red
              }
            }
          },
          didDrawPage: (data) => {
            addFooter(pdf.getCurrentPageInfo().pageNumber)
          }
        })

        yPosition = (pdf as any).lastAutoTable.finalY + 10
      }

      // Member Stats
      if (sortedStats.length > 0) {
        if (yPosition > pageHeight - 60) {
          pdf.addPage()
          yPosition = margin
        }

        pdf.setFontSize(14)
        pdf.text(t('membersWithoutGroup'), margin, yPosition)
        yPosition += 5

        const memberTableData = sortedStats.map(stat => [
          `${stat.member.firstName} ${stat.member.lastName}`,
          formatCurrency(stat.target),
          formatCurrency(stat.actual),
          formatCurrency(stat.difference),
          stat.donationCount.toString(),
          `${stat.percentage.toFixed(0)}%`
        ])

        autoTable(pdf, {
          startY: yPosition,
          head: [[t('member'), t('target'), t('actual'), t('difference'), t('donations'), t('achievement')]],
          body: memberTableData,
          margin: { left: margin, right: margin },
          theme: 'striped',
          styles: { fontSize: 9 },
          headStyles: { fillColor: [52, 58, 64], textColor: 255 },
          columnStyles: {
            0: { cellWidth: 50 },
            1: { halign: 'right', cellWidth: 25 },
            2: { halign: 'right', cellWidth: 25 },
            3: { halign: 'right', cellWidth: 25 },
            4: { halign: 'center', cellWidth: 20 },
            5: { halign: 'right', cellWidth: 20 }
          },
          didParseCell: (data) => {
            // Color achievement column based on percentage
            if (data.column.index === 5 && data.section === 'body') {
              const stat = sortedStats[data.row.index]
              if (stat.percentage >= 100) {
                data.cell.styles.textColor = [25, 135, 84] // Green
                data.cell.styles.fontStyle = 'bold'
              } else if (stat.percentage >= 75) {
                data.cell.styles.textColor = [255, 193, 7] // Yellow
              } else {
                data.cell.styles.textColor = [220, 53, 69] // Red
              }
            }
            // Color difference column
            if (data.column.index === 3 && data.section === 'body') {
              const stat = sortedStats[data.row.index]
              if (stat.difference >= 0) {
                data.cell.styles.textColor = [25, 135, 84] // Green
              } else {
                data.cell.styles.textColor = [220, 53, 69] // Red
              }
            }
          },
          didDrawPage: (data) => {
            addFooter(pdf.getCurrentPageInfo().pageNumber)
          }
        })
      }

      // Add footer to first page if not already added
      if (pdf.getCurrentPageInfo().pageNumber === 1) {
        addFooter(1)
      }

      // Generate filename with current date
      const filename = `${t('title')}_${data.currentYear?.name || 'Bericht'}_${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}.pdf`

      pdf.save(filename)
    } catch (error) {
      console.error('Error exporting PDF:', error)
      alert(t('pdfError'))
    } finally {
      setExporting(false)
    }
  }

  if (loading) {
    return (
      <>
        <Navbar />
        <Container>
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">{tCommon('loading')}</span>
            </div>
          </div>
        </Container>
      </>
    )
  }

  if (!data || !data.currentYear) {
    return (
      <>
        <Navbar />
        <Container>
          <h1 className="mb-4">{t('title')}</h1>
          <Alert variant="warning">
            {t('noActiveFiscalYear')}{' '}
            <Link href="/fiscal-years/new">{t('createFiscalYearFirst')}</Link>.
          </Alert>
        </Container>
      </>
    )
  }

  const { currentYear, memberStats, groupStats, unassignedTotal, unassignedCount, totalTarget, totalActual, memberActual, groupActual, overallPercentage } = data

  // Sort by percentage descending
  const sortedStats = [...memberStats].sort((a, b) => b.percentage - a.percentage)

  return (
    <>
      <Navbar />
      <Container>
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h1>{t('title')}</h1>
          <div className="d-flex gap-2">
            <Button
              variant="success"
              onClick={exportToPDF}
              disabled={exporting}
            >
              {exporting ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                  {t('exporting')}
                </>
              ) : (
                <>
                  <i className="bi bi-file-pdf me-2"></i>
                  {t('pdfExport')}
                </>
              )}
            </Button>
            <Link href="/reports" className="btn btn-outline-secondary">
              <i className="bi bi-arrow-left me-2"></i>
              {t('backToOverview')}
            </Link>
          </div>
        </div>

        <div ref={reportRef}>
          <Alert variant="info" className="mb-4">
            <strong>{t('fiscalYear')}:</strong> {currentYear.name}
          </Alert>

          {/* Overall Summary */}
          <Card className="mb-4">
          <Card.Header>
            <h5 className="mb-0">{t('overallSummary')}</h5>
          </Card.Header>
          <Card.Body>
            <div className="row g-3 mb-3">
              <div className="col-md-3">
                <div className="text-muted small">{t('targetTotal')}</div>
                <div className="h4">{formatCurrency(totalTarget)}</div>
              </div>
              <div className="col-md-3">
                <div className="text-muted small">{t('actualTotalAll')}</div>
                <div className="h4 text-success">{formatCurrency(totalActual)}</div>
                <div className="small text-muted">
                  {t('members')}: {formatCurrency(memberActual)}<br />
                  {t('groups')}: {formatCurrency(groupActual)}<br />
                  {unassignedTotal > 0 && `${t('notAssigned')}: ${formatCurrency(unassignedTotal)}`}
                </div>
              </div>
              <div className="col-md-3">
                <div className="text-muted small">{t('difference')}</div>
                <div className={`h4 ${totalActual >= totalTarget ? 'text-success' : 'text-danger'}`}>
                  {formatCurrency(totalActual - totalTarget)}
                </div>
              </div>
              <div className="col-md-3">
                <div className="text-muted small">{t('achievement')}</div>
                <div className="h4">{totalTarget > 0 ? ((totalActual / totalTarget) * 100).toFixed(1) : '0.0'}%</div>
              </div>
            </div>
            <ProgressBar
              now={totalTarget > 0 ? Math.min(((totalActual / totalTarget) * 100), 100) : 0}
              variant={totalActual >= totalTarget ? 'success' : (totalActual / totalTarget) >= 0.75 ? 'warning' : 'danger'}
              style={{ height: '30px' }}
              label={totalTarget > 0 ? `${((totalActual / totalTarget) * 100).toFixed(1)}%` : '0%'}
            />
          </Card.Body>
        </Card>

        {/* Group Stats */}
        {groupStats && groupStats.length > 0 && (
          <Card className="mb-4">
            <Card.Header>
              <h5 className="mb-0">{t('groupDonations')}</h5>
            </Card.Header>
            <Card.Body>
              <Table responsive hover>
                <thead>
                  <tr>
                    <th>{t('group')}</th>
                    <th className="text-end">{t('target')}</th>
                    <th className="text-end">{t('actual')}</th>
                    <th className="text-end">{t('difference')}</th>
                    <th className="text-center">{t('donations')}</th>
                    <th style={{ width: '30%' }}>{t('achievement')}</th>
                  </tr>
                </thead>
                <tbody>
                  {groupStats.map((stat) => (
                    <tr key={stat.group.id}>
                      <td>
                        <strong>{stat.group.name}</strong>
                        <div className="small text-muted">
                          {stat.members.map(m => `${m.firstName} ${m.lastName}`).join(', ')}
                        </div>
                      </td>
                      <td className="text-end">{formatCurrency(stat.target)}</td>
                      <td className="text-end">
                        <span className={stat.actual >= stat.target ? 'text-success fw-bold' : ''}>
                          {formatCurrency(stat.actual)}
                        </span>
                      </td>
                      <td className="text-end">
                        <span className={stat.difference >= 0 ? 'text-success' : 'text-danger'}>
                          {formatCurrency(stat.difference)}
                        </span>
                      </td>
                      <td className="text-center">
                        <Badge bg="info">{stat.donationCount}</Badge>
                      </td>
                      <td>
                        <div className="d-flex align-items-center gap-2">
                          <div className="flex-grow-1">
                            <ProgressBar
                              now={Math.min(stat.percentage, 100)}
                              variant={
                                stat.percentage >= 100 ? 'success' :
                                stat.percentage >= 75 ? 'warning' :
                                stat.percentage >= 50 ? 'info' : 'danger'
                              }
                            />
                          </div>
                          <span className="text-nowrap" style={{ minWidth: '50px' }}>
                            {stat.percentage.toFixed(0)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        )}

        {/* Detailed Member Stats */}
        <Card className="mb-4">
          <Card.Header>
            <h5 className="mb-0">{t('membersWithoutGroup')}</h5>
          </Card.Header>
          <Card.Body>
            {sortedStats.length === 0 ? (
              <div className="text-center py-4 text-muted">
                {t('noTargets')}
              </div>
            ) : (
              <Table responsive hover>
                <thead>
                  <tr>
                    <th>{t('member')}</th>
                    <th className="text-end">{t('target')}</th>
                    <th className="text-end">{t('actual')}</th>
                    <th className="text-end">{t('difference')}</th>
                    <th className="text-center">{t('donations')}</th>
                    <th style={{ width: '30%' }}>{t('achievement')}</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedStats.map((stat) => (
                    <tr key={stat.member.id}>
                      <td>
                        <strong>
                          {stat.member.firstName} {stat.member.lastName}
                        </strong>
                      </td>
                      <td className="text-end">{formatCurrency(stat.target)}</td>
                      <td className="text-end">
                        <span className={stat.actual >= stat.target ? 'text-success fw-bold' : ''}>
                          {formatCurrency(stat.actual)}
                        </span>
                      </td>
                      <td className="text-end">
                        <span className={stat.difference >= 0 ? 'text-success' : 'text-danger'}>
                          {formatCurrency(stat.difference)}
                        </span>
                      </td>
                      <td className="text-center">
                        <Badge bg="info">{stat.donationCount}</Badge>
                      </td>
                      <td>
                        <div className="d-flex align-items-center gap-2">
                          <div className="flex-grow-1">
                            <ProgressBar
                              now={Math.min(stat.percentage, 100)}
                              variant={
                                stat.percentage >= 100 ? 'success' :
                                stat.percentage >= 75 ? 'warning' :
                                stat.percentage >= 50 ? 'info' : 'danger'
                              }
                            />
                          </div>
                          <span className="text-nowrap" style={{ minWidth: '50px' }}>
                            {stat.percentage.toFixed(0)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card.Body>
        </Card>

          {/* Unassigned Donations */}
          {unassignedTotal > 0 && (
            <Alert variant="warning">
              <i className="bi bi-exclamation-triangle me-2"></i>
              <strong>{t('unassignedDonations')}:</strong> {formatCurrency(unassignedTotal)} ({unassignedCount} {t('donations')})
              <div className="small mt-1">
                {t('unassignedInfo')}
              </div>
            </Alert>
          )}
        </div>
      </Container>
    </>
  )
}
