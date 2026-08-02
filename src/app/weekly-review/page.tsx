'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Card, Row, Col, Typography, Tag, Table, Space, Button, Segmented, Statistic, Empty, Select, Divider,
} from 'antd'
import {
  TrophyOutlined, FrownOutlined, ThunderboltOutlined, SyncOutlined,
  ReloadOutlined, ArrowUpOutlined, ArrowDownOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import AppLayout from '@/components/Layout/AppLayout'

const { Title, Text } = Typography

export default function WeeklyReviewPage() {
  const [loading, setLoading] = useState(true)
  const [weeklyData, setWeeklyData] = useState<any>(null)
  const [teamData, setTeamData] = useState<any[]>([])
  const [compareData, setCompareData] = useState<any[]>([])
  const [includeCompare, setIncludeCompare] = useState(true)
  const [selectedWeek, setSelectedWeek] = useState(dayjs().subtract(1, 'week').format('YYYY-MM-DD'))

  const fetchData = useCallback(() => {
    setLoading(true)
    const params = `?weekStart=${encodeURIComponent(selectedWeek)}&compare=${includeCompare}`

    Promise.all([
      fetch(`/api/metrics/snapshot?weeks=4`).then(r => r.json()),
      fetch(`/api/team-stats${params}`).then(r => r.json()),
    ]).then(([snapshotRes, teamRes]) => {
      // Find the matching week in snapshots
      const targetSnapshot = (snapshotRes.snapshots || []).find(
        (s: any) => s.weekStart === dayjs(selectedWeek).startOf('isoWeek').toISOString()
      )
      setWeeklyData(targetSnapshot || null)
      setTeamData(teamRes.currentWeek || [])
      setCompareData(teamRes.compare || [])
    }).catch(console.error).finally(() => setLoading(false))
  }, [selectedWeek, includeCompare])

  useEffect(() => { fetchData() }, [fetchData])

  // Quick stats from weekly snapshot
  const w = weeklyData

  // Merge current week team data with previous week for WoW
  const mergedTeamData = teamData.map((u: any) => {
    const prev = compareData.find((p: any) => p.userId === u.userId)
    if (!prev) return { ...u, commsWoW: null, leadsWoW: null, visitsWoW: null }

    const calcWoW = (curr: number, prevVal: number) => {
      if (prevVal === 0) return curr > 0 ? 100 : 0
      return Math.round(((curr - prevVal) / prevVal) * 10000) / 100
    }

    return {
      ...u,
      commsWoW: calcWoW(u.comms, prev.comms),
      leadsWoW: calcWoW(u.newLeads, prev.newLeads),
      visitsWoW: calcWoW(u.visits, prev.visits),
    }
  })

  const teamColumns = [
    { title: '姓名', dataIndex: 'name', key: 'name', fixed: 'left' as const, width: 80 },
    { title: '角色', dataIndex: 'role', key: 'role', width: 70, render: (v: string) => {
      const labels = { ADMIN: '管理', SALES_MGR: '主管', SALES: '銷售' }
      return <Tag>{({ ADMIN: '管理', SALES_MGR: '主管', SALES: '銷售' } as Record<string, string>)[v] || v}</Tag>
    }},
    {
      title: '新增線索',
      dataIndex: 'newLeads',
      key: 'newLeads',
      width: 80,
      sorter: (a: any, b: any) => a.newLeads - b.newLeads,
      render: (v: number, r: any) => (
        <Space>
          {v}
          {r.leadsWoW !== null && (
            <Text type={r.leadsWoW >= 0 ? 'success' : 'danger'} style={{ fontSize: 11 }}>
              {r.leadsWoW >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}{Math.abs(r.leadsWoW)}%
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: '拜訪',
      dataIndex: 'visits',
      key: 'visits',
      width: 60,
      render: (v: number, r: any) => (
        <Space>
          {v}
          {r.visitsWoW !== null && (
            <Text type={r.visitsWoW >= 0 ? 'success' : 'danger'} style={{ fontSize: 11 }}>
              {r.visitsWoW >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}{Math.abs(r.visitsWoW)}%
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: '溝通',
      dataIndex: 'comms',
      key: 'comms',
      width: 60,
      render: (v: number, r: any) => (
        <Space>
          {v}
          {r.commsWoW !== null && (
            <Text type={r.commsWoW >= 0 ? 'success' : 'danger'} style={{ fontSize: 11 }}>
              {r.commsWoW >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}{Math.abs(r.commsWoW)}%
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: '成交',
      dataIndex: 'wonDeals',
      key: 'wonDeals',
      width: 60,
      render: (v: number) => v > 0 ? <Tag color="green">{v}</Tag> : <Text type="secondary">0</Text>,
    },
    {
      title: '丟單',
      dataIndex: 'lostDeals',
      key: 'lostDeals',
      width: 60,
      render: (v: number) => v > 0 ? <Tag color="red">{v}</Tag> : <Text type="secondary">0</Text>,
    },
    {
      title: 'MRR',
      dataIndex: 'mrr',
      key: 'mrr',
      width: 80,
      render: (v: number, r: any) => (
        <Space>
          <Text>${Math.round(v).toLocaleString()}</Text>
          {r.targetMRR && r.targetMRR > 0 && (
            <Tag color={r.mrrAchievementRate >= 100 ? 'green' : r.mrrAchievementRate >= 50 ? 'orange' : 'red'}>
              {r.mrrAchievementRate}%
            </Tag>
          )}
        </Space>
      ),
    },
  ]

  // Week selector options (last 8 weeks)
  const weekOptions = Array.from({ length: 8 }, (_, i) => {
    const d = dayjs().subtract(i + 1, 'week').startOf('isoWeek')
    return {
      label: `${d.format('MM/DD')}-${d.endOf('isoWeek').format('MM/DD')}`,
      value: d.format('YYYY-MM-DD'),
    }
  })

  return (
    <AppLayout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>每週復盤</Title>
        <Space>
          <Select
            options={weekOptions}
            value={selectedWeek}
            onChange={setSelectedWeek}
            style={{ width: 200 }}
            size="small"
          />
          <Segmented
            size="small"
            value={includeCompare ? 'true' : 'false'}
            onChange={v => setIncludeCompare(v === 'true')}
            options={[
              { label: '本周', value: 'false' },
              { label: '含比較', value: 'true' },
            ]}
          />
          <Button icon={<ReloadOutlined />} onClick={fetchData} size="small">刷新</Button>
        </Space>
      </div>

      {/* Summary Cards */}
      {w ? (
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={12} lg={6}>
            <Card loading={loading} hoverable>
              <Statistic
                title="週 MRR"
                value={w.totalMrr || 0}
                prefix={<ThunderboltOutlined />}
                precision={0}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card loading={loading} hoverable>
              <Statistic title="新客戶" value={w.totalCustomers || 0} prefix={<TrophyOutlined />} />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card loading={loading} hoverable>
              <Statistic
                title="新簽 MRR"
                value={w.newMrr || 0}
                precision={0}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card loading={loading} hoverable>
              <Statistic
                title="流失 MRR"
                value={w.churnMrr || 0}
                precision={0}
                valueStyle={{ color: '#ff4d4f' }}
              />
            </Card>
          </Col>
        </Row>
      ) : (
        <Card style={{ marginBottom: 16 }}>
          <Empty description="該週暂无快照數據。請先觸發一次快照計算。" />
        </Card>
      )}

      {/* Pipeline & Win/Loss */}
      {w && (
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} lg={12}>
            <Card title="Pipeline 狀態 (週末快照)" size="small">
              <Space direction="vertical" style={{ width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text>⚠️ 待跟进</Text><Tag>{w.pipelinePending}</Tag>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text>已建联</Text><Tag color="blue">{w.pipelineConnected}</Tag>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text>初步有意向</Text><Tag color="purple">{w.pipelineInterested}</Tag>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text>合作中</Text><Tag color="green">{w.pipelineCooperating}</Tag>
                </div>
                <Divider style={{ margin: '4px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text>本周成交</Text><Tag color="green">{w.wonDeals}</Tag>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text>本周丟單</Text><Tag color="red">{w.lostDeals}</Tag>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text>新增線索</Text><Text>{w.totalNewLeads}</Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text>拜訪記錄</Text><Text>{w.totalVisits}</Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text>溝通記錄</Text><Text>{w.totalComms}</Text>
                </div>
              </Space>
            </Card>
          </Col>

          <Col xs={24} lg={12}>
            <Card title="客戶構成" size="small">
              <Space direction="vertical" style={{ width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text>企業客戶</Text><Tag color="red">{w.tierEnterprise}</Tag>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text>中階客戶</Text><Tag color="blue">{w.tierMidMarket}</Tag>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text>一般客戶</Text><Tag color="green">{w.tierSmb}</Tag>
                </div>
                <Divider style={{ margin: '4px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text>健康</Text><Tag color="green">{w.healthyCount}</Tag>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text>需關注</Text><Tag color="orange">{w.attentionCount}</Tag>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text>高風險</Text><Tag color="red">{w.atRiskCount}</Tag>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text>平均健康度</Text><Text>{w.avgHealthScore}/100</Text>
                </div>
              </Space>
            </Card>
          </Col>
        </Row>
      )}

      {/* Team Activity */}
      <Card title="團隊活動量表" size="small" loading={loading}>
        <Table
          dataSource={mergedTeamData}
          columns={teamColumns}
          rowKey="userId"
          scroll={{ x: 800 }}
          size="small"
          pagination={false}
        />
      </Card>
    </AppLayout>
  )
}

// Import Select at the top level (already imported above but let me make sure)
