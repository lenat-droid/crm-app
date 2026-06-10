'use client'

import { useState, useEffect } from 'react'
import {
  Card, Row, Col, Statistic, Table, Typography, Progress, Tag, Space,
} from 'antd'
import {
  TeamOutlined, RiseOutlined, UserAddOutlined, CheckCircleOutlined,
  DollarOutlined, WarningOutlined, HeartOutlined,
} from '@ant-design/icons'
import { Line, Pie } from '@ant-design/charts'
import AppLayout from '@/components/Layout/AppLayout'

const { Title, Text } = Typography

const pipelineStatusColors: Record<string, string> = {
  '⚠️': '#faad14', '已建联': '#1890ff', '初步有意向': '#722ed1', '合作中': '#52c41a',
}

export default function DashboardPage() {
  const [dashboard, setDashboard] = useState<any>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/dashboard')
      .then(res => res.json())
      .then(setDashboard)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const {
    totalCustomers, totalPipelines, totalLeads, totalVisits, activePipelines,
    leadsByStatus = {}, activeSubscriptions, totalMrr,
    churnRiskDistribution = {}, avgHealthScore,
    customersByTier = [], topRegions = [], pipelineByStatus = {},
    mrrTrend = [], healthDistribution = {},
  } = dashboard

  const scoreColor = (score: number) => score >= 70 ? '#52c41a' : score >= 40 ? '#faad14' : '#ff4d4f'
  const newLeads = (leadsByStatus['new'] || 0)

  const tierColumns = [
    { title: '層級', dataIndex: 'tier', key: 'tier', render: (v: string) => {
      const colors: Record<string, string> = { ENTERPRISE: 'red', MID_MARKET: 'blue', SMB: 'green' }
      const labels: Record<string, string> = { ENTERPRISE: '企業', MID_MARKET: '中階', SMB: '一般' }
      return <Tag color={colors[v]}>{labels[v] || v}</Tag>
    }},
    { title: '客戶數', dataIndex: 'count', key: 'count' },
  ]

  const regionColumns = [
    { title: '區域', dataIndex: 'region', key: 'region' },
    { title: '客戶數', dataIndex: 'count', key: 'count' },
  ]

  const pipelineColumns = [
    { title: '階段', dataIndex: 'status', key: 'status', render: (v: string) => <Tag color={pipelineStatusColors[v]}>{v}</Tag> },
    { title: '數量', dataIndex: 'count', key: 'count' },
  ]

  return (
    <AppLayout>
      <Title level={4} style={{ marginBottom: 24 }}>仪表盘</Title>

      {/* Top-level KPI cards */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading} hoverable>
            <Statistic title="客戶總數" value={totalCustomers} prefix={<TeamOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading} hoverable>
            <Statistic title="月度 MRR" value={totalMrr} prefix={<DollarOutlined />} precision={0} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading} hoverable>
            <Statistic title="活躍訂閱" value={activeSubscriptions} prefix={<CheckCircleOutlined />} valueStyle={{ color: '#1890ff' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading} hoverable>
            <Statistic
              title="平均健康度"
              value={avgHealthScore}
              prefix={<HeartOutlined />}
              suffix="/ 100"
              valueStyle={{ color: scoreColor(avgHealthScore) }}
            />
          </Card>
        </Col>
      </Row>

      {/* Second row: Pipeline, Leads, Churn */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading} hoverable>
            <Statistic title="跟進中 Pipeline" value={activePipelines} prefix={<RiseOutlined />} suffix={`/ ${totalPipelines}`} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading} hoverable>
            <Statistic title="待處理線索" value={newLeads} prefix={<UserAddOutlined />} valueStyle={{ color: '#faad14' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading} hoverable style={{ borderColor: churnRiskDistribution['HIGH'] > 0 ? '#ff4d4f' : undefined }}>
            <Statistic
              title="高流失風險"
              value={churnRiskDistribution['HIGH'] || 0}
              prefix={<WarningOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading} hoverable>
            <Statistic title="拜訪記錄" value={totalVisits} prefix={<CheckCircleOutlined />} />
          </Card>
        </Col>
      </Row>

      {/* Health Score Distribution */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={8}>
          <Card title="健康度分布" size="small" loading={loading}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <Text>健康</Text>
                <Progress
                  percent={totalCustomers > 0 ? Math.round(((churnRiskDistribution['LOW'] || 0) / totalCustomers) * 100) : 0}
                  size="small"
                  strokeColor="#52c41a"
                  format={() => `${churnRiskDistribution['LOW'] || 0} (${totalCustomers > 0 ? Math.round(((churnRiskDistribution['LOW'] || 0) / totalCustomers) * 100) : 0}%)`}
                />
              </div>
              <div>
                <Text>需關注</Text>
                <Progress
                  percent={totalCustomers > 0 ? Math.round(((churnRiskDistribution['MEDIUM'] || 0) / totalCustomers) * 100) : 0}
                  size="small"
                  strokeColor="#faad14"
                  format={() => `${churnRiskDistribution['MEDIUM'] || 0} (${totalCustomers > 0 ? Math.round(((churnRiskDistribution['MEDIUM'] || 0) / totalCustomers) * 100) : 0}%)`}
                />
              </div>
              <div>
                <Text>高流失風險</Text>
                <Progress
                  percent={totalCustomers > 0 ? Math.round(((churnRiskDistribution['HIGH'] || 0) / totalCustomers) * 100) : 0}
                  size="small"
                  strokeColor="#ff4d4f"
                  format={() => `${churnRiskDistribution['HIGH'] || 0} (${totalCustomers > 0 ? Math.round(((churnRiskDistribution['HIGH'] || 0) / totalCustomers) * 100) : 0}%)`}
                />
              </div>
            </Space>
          </Card>
        </Col>

        {/* Pipeline funnel */}
        <Col xs={24} lg={8}>
          <Card title="Pipeline 漏斗" size="small" loading={loading}>
            <Table
              dataSource={Object.entries(pipelineByStatus).map(([status, count]) => ({ status, count }))}
              columns={pipelineColumns}
              rowKey="status"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>

        {/* Customer tier distribution */}
        <Col xs={24} lg={8}>
          <Card title="客戶層級分布" size="small" loading={loading}>
            <Table
              dataSource={customersByTier}
              columns={tierColumns}
              rowKey="tier"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
      </Row>

      {/* MRR Trend + Health Pie Chart */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={14}>
          <Card title="月度 MRR 趨勢" size="small" loading={loading}>
            {mrrTrend.length > 0 ? (
              <Line
                data={mrrTrend}
                xField="month"
                yField="mrr"
                height={260}
                point={{ size: 3 }}
                color="#1890ff"
                yAxis={{ label: { formatter: (v: number) => `$${v.toLocaleString()}` } }}
                tooltip={{ formatter: (datum: any) => ({ name: 'MRR', value: `$${datum.mrr.toLocaleString()}` }) }}
              />
            ) : (
              <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
                暂无 MRR 数据
              </div>
            )}
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title="健康度分布" size="small" loading={loading}>
            {(healthDistribution.healthy || healthDistribution.attention || healthDistribution.atRisk) ? (
              <Pie
                data={[
                  { type: '健康', value: healthDistribution.healthy || 0 },
                  { type: '需關注', value: healthDistribution.attention || 0 },
                  { type: '高風險', value: healthDistribution.atRisk || 0 },
                ]}
                angleField="value"
                colorField="type"
                height={260}
                radius={0.85}
                innerRadius={0.55}
                color={['#52c41a', '#faad14', '#ff4d4f']}
                label={{
                  type: 'inner',
                  offset: '-30%',
                  content: '{percentage}',
                  style: { fontSize: 14, textAlign: 'center' },
                }}
                legend={{ position: 'bottom' }}
                statistic={{
                  title: { style: { fontSize: '14px' }, content: '客戶健康度' },
                  content: { style: { fontSize: '24px', fontWeight: 'bold' }, content: `${totalCustomers || 0}` },
                }}
              />
            ) : (
              <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
                暂无健康度数据
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* Top Regions */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          <Card title="熱門區域 Top 5" size="small" loading={loading}>
            <Table
              dataSource={topRegions}
              columns={regionColumns}
              rowKey="region"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="線索概覽" size="small" loading={loading}>
            <Table
              dataSource={Object.entries(leadsByStatus).map(([status, count]) => ({ status, count }))}
              columns={[
                { title: '狀態', dataIndex: 'status', key: 'status' },
                { title: '數量', dataIndex: 'count', key: 'count' },
              ]}
              rowKey="status"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
      </Row>
    </AppLayout>
  )
}
