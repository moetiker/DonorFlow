'use client'

import { Container, Card, Row, Col, Badge, Table } from 'react-bootstrap'
import { Navbar } from '@/components/Navbar'
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useLocalizedFormatters } from '@/lib/i18n/formatters'
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'
import { Pie } from 'react-chartjs-2'

ChartJS.register(ArcElement, Tooltip, Legend)

type Share = {
  id: string
  name: string
  type: 'member'
  amount: number
  percentage: number
  groupName?: string
}

type SharesData = {
  shares: Share[]
  total: number
  fiscalYear: {
    id: string
    name: string
  }
}

export default function SharesReportPage() {
  const [data, setData] = useState<SharesData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedShare, setSelectedShare] = useState<string | null>(null)
  const t = useTranslations('reports')
  const tCommon = useTranslations('common')
  const tErrors = useTranslations('errors')
  const { formatCurrency } = useLocalizedFormatters()

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      const response = await fetch('/api/reports/shares')
      const result = await response.json()
      setData(result)
    } catch (error) {
      console.error('Error fetching shares:', error)
    } finally {
      setLoading(false)
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

  if (!data || data.shares.length === 0) {
    return (
      <>
        <Navbar />
        <Container>
          <h1 className="mb-4">{t('sharesReport')}</h1>
          <div className="alert alert-info">{t('noData')}</div>
        </Container>
      </>
    )
  }

  // Generate colors for pie chart
  const generateColors = (count: number) => {
    const colors = []
    const groupColors = [
      '#198754', // Green for groups
      '#20c997',
      '#0d6efd',
      '#6610f2',
      '#6f42c1',
      '#d63384',
      '#dc3545',
      '#fd7e14',
      '#ffc107',
      '#0dcaf0'
    ]

    for (let i = 0; i < count; i++) {
      colors.push(groupColors[i % groupColors.length])
    }
    return colors
  }

  const colors = generateColors(data.shares.length)

  const chartData = {
    labels: data.shares.map(s => s.name),
    datasets: [
      {
        data: data.shares.map(s => s.amount),
        backgroundColor: colors,
        borderColor: colors.map(c => c),
        borderWidth: 2,
        hoverOffset: 20
      }
    ]
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            const share = data.shares[context.dataIndex]
            return [
              `${share.name}`,
              share.groupName ? `(${share.groupName})` : '',
              `${formatCurrency(share.amount)}`,
              `${share.percentage.toFixed(1)}%`
            ].filter(Boolean)
          }
        }
      }
    },
    onClick: (event: any, elements: any) => {
      if (elements.length > 0) {
        const index = elements[0].index
        const shareId = data.shares[index].id
        setSelectedShare(selectedShare === shareId ? null : shareId)
      }
    }
  }

  return (
    <>
      <Navbar />
      <Container>
        <div className="d-flex align-items-center justify-content-between mb-4">
          <h1 className="mb-0">{t('sharesReport')}</h1>
          <span className="text-muted">{data.fiscalYear.name}</span>
        </div>

        <Row className="mb-4">
          <Col lg={8}>
            <Card>
              <Card.Header>
                <h5 className="mb-0">{t('donationDistribution')}</h5>
              </Card.Header>
              <Card.Body>
                <div style={{ height: '500px', position: 'relative' }}>
                  <Pie data={chartData} options={chartOptions} />
                </div>
              </Card.Body>
            </Card>
          </Col>
          <Col lg={4}>
            <Card>
              <Card.Header>
                <h5 className="mb-0">{t('summary')}</h5>
              </Card.Header>
              <Card.Body>
                <div className="mb-3">
                  <small className="text-muted">{t('totalDonations')}</small>
                  <h3 className="mb-0 text-success">{formatCurrency(data.total)}</h3>
                </div>
                <hr />
                <div className="mb-2">
                  <small className="text-muted">{t('members')}</small>
                  <div className="h5 mb-0">
                    <Badge bg="primary">
                      {data.shares.length}
                    </Badge>
                  </div>
                </div>
                <div>
                  <small className="text-muted">{t('membersInGroups')}</small>
                  <div className="h5 mb-0">
                    <Badge bg="success">
                      {data.shares.filter(s => s.groupName).length}
                    </Badge>
                  </div>
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>

        <Card>
          <Card.Header>
            <h5 className="mb-0">{t('detailedBreakdown')}</h5>
          </Card.Header>
          <Card.Body>
            <Table responsive hover>
              <thead>
                <tr>
                  <th>{t('memberName')}</th>
                  <th>{t('group')}</th>
                  <th className="text-end">{t('amount')}</th>
                  <th className="text-end">{t('percentage')}</th>
                </tr>
              </thead>
              <tbody>
                {data.shares.map((share, index) => (
                  <tr
                    key={share.id}
                    onClick={() => setSelectedShare(selectedShare === share.id ? null : share.id)}
                    style={{
                      cursor: 'pointer',
                      backgroundColor: selectedShare === share.id ? 'rgba(13, 110, 253, 0.1)' : 'transparent'
                    }}
                  >
                    <td>
                      <div className="d-flex align-items-center">
                        <div
                          style={{
                            width: '12px',
                            height: '12px',
                            backgroundColor: colors[index],
                            borderRadius: '50%',
                            marginRight: '10px'
                          }}
                        />
                        <strong>{share.name}</strong>
                      </div>
                    </td>
                    <td>
                      {share.groupName ? (
                        <Badge bg="success">{share.groupName}</Badge>
                      ) : (
                        <span className="text-muted">-</span>
                      )}
                    </td>
                    <td className="text-end">
                      <strong>{formatCurrency(share.amount)}</strong>
                    </td>
                    <td className="text-end">
                      <Badge bg="info">{share.percentage.toFixed(1)}%</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="table-active">
                  <td colSpan={2}>
                    <strong>{tCommon('total')}</strong>
                  </td>
                  <td className="text-end">
                    <strong>{formatCurrency(data.total)}</strong>
                  </td>
                  <td className="text-end">
                    <strong>100.0%</strong>
                  </td>
                </tr>
              </tfoot>
            </Table>
          </Card.Body>
        </Card>
      </Container>
    </>
  )
}
