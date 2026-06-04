'use client'

import { useState, useEffect } from 'react'
import {
  Card, Typography, Table, Tag, Button, Progress, Row, Col, Statistic, Space, message,
} from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import AppLayout from '@/components/Layout/AppLayout'

const { Title, Text } = Typography

const riskColors: Record<string, string> = { LOW: 'green', MEDIUM: 'orange', HIGH: 'red' }
const riskLabels: Record<string, string> = { LOW: '健康', MEDIUM: '需關注', HIGH: '高流失風險' }

function scoreColor(score: number): string {
  if (score >= 70) return '#52c41a'
  if (score >= 40) return '#faad14'
  return '#ff4d4f'
}

export default function CustomerHealthPage() {
  const [scores, setScores] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [recalculating, setRecalculating] = useState(false)
  const [avgScore, setAvgScore] = useState(0)
  const [riskDistribution, setRiskDistribution] = useState<Record<string, number>>({})
  const [total, setTotal] = useState(0)

  const fetchScores = async () => {
    try {
      const res = await fetch('/api/customer-health?pageSize=200')
      const data = await res.json()
      setScores(data.scores || [])
      setAvgScore(data.avgScore || 0)
      setRiskDistribution(data.riskDistribution || {})
      setTotal(data.total || 0)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchScores() }, [])

  const handleRecalculate = async () => {
    setRecalculating(true)
    try {
      const res = await fetch('/api/customer-health?recalculate=true', { method: 'GET' })
      const data = await res.json()
      message.success(`已重新計算 ${data.count} 個客戶的健康度評分`)
      fetchScores()
    } catch {
      message.error('計算失敗')
    } finally {
      setRecalculating(false)
    }
  }

  const columns = [
    {
      title: '客戶',
      dataIndex: ['customer', 'name'],
      key: 'customer',
      render: (name: string, record: any) => (
        <a href={`/customers/${record.customer.id}`}>{name}</a>
      ),
    },
    {
      title: '層級',
      dataIndex: ['customer', 'tier'],
      key: 'tier',
      render: (v: string | null) => {
        const colors: Record<string, string> = { ENTERPRISE: 'red', MID_MARKET: 'blue', SMB: 'green' }
        return v ? <Tag color={colors[v] || 'default'}>{v}</Tag> : '-'
      },
    },
    {
      title: '區域',
      dataIndex: ['customer', 'region'],
      key: 'region',
      render: (v: string | null) => v || '-',
    },
    {
      title: '綜合評分',
      dataIndex: 'overallScore',
      key: 'overallScore',
      render: (score: number) => (
        <Progress
          percent={score}
          size="small"
          strokeColor={scoreColor(score)}
          format={() => <strong>{score}</strong>}
          style={{ width: 120 }}
        />
      ),
    },
    {
      title: '流失風險',
      dataIndex: 'churnRisk',
      key: 'churnRisk',
      render: (risk: string) => <Tag color={riskColors[risk]}>{riskLabels[risk] || risk}</Tag>,
    },
    {
      title: '互動度',
      dataIndex: 'engagementScore',
      key: 'engagementScore',
      render: (v: number | null) => v !== null ? <Text type={v < 40 ? 'danger' : undefined}>{v}</Text> : '-',
    },
    {
      title: '產品採用',
      dataIndex: 'productAdoptionScore',
      key: 'productAdoptionScore',
      render: (v: number | null) => v !== null ? <Text type={v < 40 ? 'danger' : undefined}>{v}</Text> : '-',
    },
    {
      title: '客服健康',
      dataIndex: 'supportHealthScore',
      key: 'supportHealthScore',
      render: (v: number | null) => v !== null ? <Text type={v < 40 ? 'danger' : undefined}>{v}</Text> : '-',
    },
    {
      title: '訂閱健康',
      dataIndex: 'subscriptionHealth',
      key: 'subscriptionHealth',
      render: (v: number | null) => v !== null ? <Text type={v < 40 ? 'danger' : undefined}>{v}</Text> : '-',
    },
    {
      title: '計算時間',
      dataIndex: 'calculatedAt',
      key: 'calculatedAt',
      render: (v: string) => dayjs(v).format('MM-DD HH:mm'),
    },
  ]

  return (
    <AppLayout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>客戶健康度評分</Title>
        <Button
          icon={<ReloadOutlined />}
          loading={recalculating}
          onClick={handleRecalculate}
        >
          重新計算
        </Button>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic title="已評分客戶" value={total} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="平均評分" value={avgScore} suffix="/ 100" valueStyle={{ color: scoreColor(avgScore) }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ borderColor: '#faad14' }}>
            <Statistic title="需關注" value={riskDistribution['MEDIUM'] || 0} valueStyle={{ color: '#faad14' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ borderColor: '#ff4d4f' }}>
            <Statistic title="高流失風險" value={riskDistribution['HIGH'] || 0} valueStyle={{ color: '#ff4d4f' }} />
          </Card>
        </Col>
      </Row>

      <Card>
        <Table
          dataSource={scores}
          columns={columns}
          rowKey={(record) => record.id || record.customerId}
          loading={loading}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `共 ${t} 條` }}
        />
      </Card>
    </AppLayout>
  )
}
