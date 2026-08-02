'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Card, Row, Col, Statistic, Table, Typography, Progress, Tag, Space,
  Select, DatePicker, Button, Divider,
} from 'antd'
import {
  TeamOutlined, RiseOutlined, UserAddOutlined, CheckCircleOutlined,
  DollarOutlined, WarningOutlined, HeartOutlined,
  CaretUpOutlined, CaretDownOutlined, FilterOutlined,
} from '@ant-design/icons'
import { Line, Pie } from '@ant-design/charts'
import dayjs from 'dayjs'
import AppLayout from '@/components/Layout/AppLayout'

const { Title, Text } = Typography
const { RangePicker } = DatePicker

const pipelineStatusOrder = ['⚠️', '已建联', '初步有意向', '合作中']
const pipelineStatusColors: Record<string, string> = {
  '⚠️': '#faad14', '已建联': '#1890ff', '初步有意向': '#722ed1', '合作中': '#52c41a',
}
const pipelineLabels: Record<string, string> = {
  '⚠️': '⚠️ 待跟进', '已建联': '已建联', '初步有意向': '初步有意向', '合作中': '合作中',
}

const PERIOD_OPTIONS = [
  { label: '全部', value: 'all' },
  { label: '今天', value: 'today' },
  { label: '本周', value: 'week' },
  { label: '本月', value: 'month' },
  { label: '本季度', value: 'quarter' },
  { label: '自定义', value: 'custom' },
]

export default function DashboardPage() {
  const [dashboard, setDashboard] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('all')
  const [customRange, setCustomRange] = useState<[string, string] | null>(null)
  const [totalCustomers, setTotalCustomers] = useState(0)
  const [totalMrr, setTotalMrr] = useState(0)
  const [activeSubscriptions, setActiveSubscriptions] = useState(0)
  const [avgHealthScore, setAvgHealthScore] = useState(0)
  const [activePipelines, setActivePipelines] = useState(0)
  const [totalLeads, setTotalLeads] = useState(0)
  const [totalVisits, setTotalVisits] = useState(0)
  const [churnRiskDistribution, setChurnRiskDistribution] = useState<Record<string, number>>({})
  const [avgHealthScoreState, setAvgHealthScoreState] = useState(0)
  const [customersByTier, setCustomersByTier] = useState<any[]>([])
  const [topRegions, setTopRegions] = useState<any[]>([])
  const [pipelineByStatus, setPipelineByStatus] = useState<any[]>([])
  const [mrrTrend, setMrrTrend] = useState<any[]>([])
  const [healthDistribution, setHealthDistribution] = useState<any>({})
  const [leadsByStatus, setLeadsByStatus] = useState<Record<string, number>>({})
  const [winRate, setWinRate] = useState(0)
  const [totalWon, setTotalWon] = useState(0)
  const [totalLost, setTotalLost] = useState(0)
  const [mrrDelta, setMrrDelta] = useState<any>(null)

  const fetchData = useCallback((p: string, range?: [string, string] | null) => {
    setLoading(true)
    let url = '/api/dashboard?period=' + encodeURIComponent(p)
    if (p === 'custom' && range) {
      url += `&from=${encodeURIComponent(range[0])}&to=${encodeURIComponent(range[1])}`
    }
    fetch(url)
      .then(res => res.json())
      .then(data => {
        setDashboard(data)
        setTotalCustomers(data.totalCustomers || 0)
        setTotalMrr(data.totalMrr || 0)
        setActiveSubscriptions(data.activeSubscriptions || 0)
        setAvgHealthScore(data.avgHealthScore || 0)
        setActivePipelines(data.activePipelines || 0)
        setTotalLeads(data.totalLeads || 0)
        setTotalVisits(data.totalVisits || 0)
        setChurnRiskDistribution(data.churnRiskDistribution || {})
        setAvgHealthScoreState(data.avgHealthScore || 0)
        setCustomersByTier(data.customersByTier || [])
        setTopRegions(data.topRegions || [])
        setPipelineByStatus(data.pipelineByStatus || [])
        setMrrTrend(data.mrrTrend || [])
        setHealthDistribution(data.healthDistribution || {})
        setLeadsByStatus(data.leadsByStatus || {})
        setWinRate(data.winRate || 0)
        setTotalWon(data.totalWon || 0)
        setTotalLost(data.totalLost || 0)
        setMrrDelta(data.mrrDelta || null)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchData(period, customRange) }, [period, customRange, fetchData])

  const handlePeriodChange = (val: string) => {
    setPeriod(val)
    if (val !== 'custom') setCustomRange(null)
  }

  const scoreColor = (score: number) => score >= 70 ? '#52c41a' : score >= 40 ? '#faad14' : '#ff4d4f'

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

  // Pipeline funnel table with conversion rate
  const pipelineFunnelData = pipelineByStatus.map(p => {
    const totalIn = pipelineByStatus.reduce((s, x) => s + x.count, 0)
    const conversion = totalIn > 0 ? Math.round((p.count / totalIn) * 10000) / 100 : 0
    return { ...p, conversion }
  })

  const pipelineFunnelColumns = [
    {
      title: '階段',
      dataIndex: 'status',
      key: 'status',
      render: (v: string) => <Tag color={pipelineStatusColors[v]}>{pipelineLabels[v] || v}</Tag>,
    },
    { title: '數量', dataIndex: 'count', key: 'count' },
    {
      title: '佔比',
      dataIndex: 'conversion',
      key: 'conversion',
      render: (v: number) => `${v}%`,
    },
  ]

  // Health distribution based on data or fallback
  const healthyCount = healthDistribution.healthy ?? churnRiskDistribution['LOW'] ?? 0
  const attentionCount = healthDistribution.attention ?? churnRiskDistribution['MEDIUM'] ?? 0
  const atRiskCount = healthDistribution.atRisk ?? churnRiskDistribution['HIGH'] ?? 0
  const healthTotal = healthyCount + attentionCount + atRiskCount

  // MRR WoW/MoM delta display
  const MrrDeltaBadge = mrrDelta ? (
    <Tag color={mrrDelta.change >= 0 ? 'green' : 'red'}>
      {mrrDelta.change >= 0 ? <CaretUpOutlined /> : <CaretDownOutlined />}
      {' '}{mrrDelta.change >= 0 ? '+' : ''}{mrrDelta.change} ({mrrDelta.change >= 0 ? '+' : ''}{mrrDelta.pctChange}%)
    </Tag>
  ) : null

  return (
    <AppLayout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>仪表盘</Title>
        <Space>
          <Select
            value={period}
            onChange={handlePeriodChange}
            options={PERIOD_OPTIONS}
            style={{ width: 120 }}
            size="small"
          />
          {period === 'custom' && (
            <RangePicker
              size="small"
              onChange={dates => {
                if (dates && dates[0] && dates[1]) {
                  setCustomRange([dates[0].format('YYYY-MM-DD'), dates[1].format('YYYY-MM-DD')])
                }
              }}
            />
          )}
          <Button icon={<FilterOutlined />} size="small" onClick={() => fetchData(period, customRange)}>
            刷新
          </Button>
        </Space>
      </div>

      {/* KPI Row 1 */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading} hoverable>
            <Statistic title="客戶總數" value={totalCustomers} prefix={<TeamOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading} hoverable>
            <Statistic
              title="月度 MRR"
              value={totalMrr}
              prefix={<DollarOutlined />}
              precision={0}
              valueStyle={{ color: '#52c41a' }}
              suffix={MrrDeltaBadge}
            />
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
              value={avgHealthScoreState}
              prefix={<HeartOutlined />}
              suffix="/ 100"
              valueStyle={{ color: scoreColor(avgHealthScoreState) }}
            />
          </Card>
        </Col>
      </Row>

      {/* KPI Row 2 */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading} hoverable>
            <Statistic title="跟進中 Pipeline" value={activePipelines} prefix={<RiseOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading} hoverable>
            <Statistic title="新增線索" value={totalLeads} prefix={<UserAddOutlined />} valueStyle={{ color: '#faad14' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading} hoverable style={{ borderColor: atRiskCount > 0 ? '#ff4d4f' : undefined }}>
            <Statistic
              title="高流失風險"
              value={atRiskCount}
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

      {/* Wins/Losses + Win Rate */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} sm={12} lg={8}>
          <Card title="Pipeline 漏斗" size="small" loading={loading}>
            <Table
              dataSource={pipelineFunnelData}
              columns={pipelineFunnelColumns}
              rowKey="status"
              pagination={false}
              size="small"
              summary={pageData => {
                const total = pageData.reduce((s, p) => s + p.count, 0)
                return (
                  <Table.Summary fixed>
                    <Table.Summary.Row>
                      <Table.Summary.Cell index={0}><Text strong>合計</Text></Table.Summary.Cell>
                      <Table.Summary.Cell index={1}><Text strong>{total}</Text></Table.Summary.Cell>
                      <Table.Summary.Cell index={2}><Text strong>100%</Text></Table.Summary.Cell>
                    </Table.Summary.Row>
                  </Table.Summary>
                )
              }}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={8}>
          <Card title="成交概覽" size="small" loading={loading}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text>贏率</Text>
                <Tag color={winRate >= 50 ? 'green' : 'orange'}>{winRate}%</Tag>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text>已成交</Text>
                <Tag color="green">{totalWon}</Tag>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text>已丟單</Text>
                <Tag color="red">{totalLost}</Tag>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text>已關閉合計</Text>
                <Text>{totalWon + totalLost}</Text>
              </div>
            </Space>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={8}>
          <Card title="健康度分布" size="small" loading={loading}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <Text>健康 ({healthyCount})</Text>
                <Progress
                  percent={healthTotal > 0 ? Math.round((healthyCount / healthTotal) * 100) : 0}
                  size="small" strokeColor="#52c41a"
                />
              </div>
              <div>
                <Text>需關注 ({attentionCount})</Text>
                <Progress
                  percent={healthTotal > 0 ? Math.round((attentionCount / healthTotal) * 100) : 0}
                  size="small" strokeColor="#faad14"
                />
              </div>
              <div>
                <Text>高流失風險 ({atRiskCount})</Text>
                <Progress
                  percent={healthTotal > 0 ? Math.round((atRiskCount / healthTotal) * 100) : 0}
                  size="small" strokeColor="#ff4d4f"
                />
              </div>
            </Space>
          </Card>
        </Col>
      </Row>

      {/* MRR Trend + Customer Tier */}
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
          <Card title="客戶層級分布" size="small" loading={loading}>
            {customersByTier.length > 0 ? (
              <Pie
                data={customersByTier.map((c: any) => ({
                  type: ({ ENTERPRISE: '企業', MID_MARKET: '中階', SMB: '一般' } as Record<string, string>)[c.tier] || c.tier,
                  value: c.count,
                }))}
                angleField="value"
                colorField="type"
                height={260}
                radius={0.85}
                innerRadius={0.55}
                color={['#ff4d4f', '#1890ff', '#52c41a']}
                label={{ type: 'outer', content: '{type} {percentage}' }}
                legend={{ position: 'bottom' }}
                statistic={{
                  title: { style: { fontSize: '14px' }, content: '客戶總數' },
                  content: { style: { fontSize: '24px', fontWeight: 'bold' }, content: `${totalCustomers}` },
                }}
              />
            ) : (
              <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
                暂无數據
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* Top Regions + Leads */}
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
                {
                  title: '狀態', dataIndex: 'status', key: 'status',
                  render: (v: string) => {
                    const colors: Record<string, string> = { new: 'blue', contacted: 'orange', converted: 'green', closed: 'default' }
                    const labels: Record<string, string> = { new: '新建', contacted: '已聯絡', converted: '已轉化', closed: '已關閉' }
                    return <Tag color={colors[v]}>{labels[v] || v}</Tag>
                  },
                },
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
