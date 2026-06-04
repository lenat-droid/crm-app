'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Card, Typography, Tag, Button, Space, Spin, Empty, Segmented,
  Row, Col, Pagination, Breadcrumb,
} from 'antd'
import {
  UserAddOutlined, CustomerServiceOutlined, EnvironmentOutlined,
  SwapRightOutlined, HistoryOutlined,
} from '@ant-design/icons'
import { useRouter } from 'next/navigation'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import AppLayout from '@/components/Layout/AppLayout'

dayjs.extend(relativeTime)

const { Title, Text } = Typography

const typeConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  lead: { label: '新建線索', color: '#722ed1', icon: <UserAddOutlined /> },
  checkin: { label: '每日速报', color: '#1677ff', icon: <CustomerServiceOutlined /> },
  visit: { label: '拜訪記錄', color: '#52c41a', icon: <EnvironmentOutlined /> },
}

const statusLabels: Record<string, string> = {
  new: '新線索',
  contacted: '已聯繫',
  converted: '已轉化',
  closed: '已關閉',
}

const statusColors: Record<string, string> = {
  new: 'blue',
  contacted: 'orange',
  converted: 'green',
  closed: 'red',
}

export default function RecordsPage() {
  const router = useRouter()
  const [records, setRecords] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totals, setTotals] = useState({ leads: 0, checkins: 0, visits: 0 })
  const pageSize = 30

  const fetchRecords = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        type: typeFilter,
      })
      const res = await fetch(`/api/records?${params}`)
      const data = await res.json()
      setRecords(data.records || [])
      setTotal(data.total || 0)
      setTotals(data.totals || { leads: 0, checkins: 0, visits: 0 })
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [page, typeFilter])

  useEffect(() => {
    fetchRecords()
  }, [fetchRecords])

  const handleTypeChange = (val: string) => {
    setTypeFilter(val)
    setPage(1)
  }

  const renderRecord = (record: any) => {
    const cfg = typeConfig[record.type] || { label: '未知', color: '#999', icon: null }

    return (
      <Card
        key={record.id}
        size="small"
        style={{
          marginBottom: 12,
          borderLeft: `4px solid ${cfg.color}`,
          borderRadius: 6,
        }}
        hoverable
        onClick={() => record.detailUrl && router.push(record.detailUrl)}
      >
        <Row gutter={16} align="middle">
          {/* Left: Icon + Type badge */}
          <Col flex="40px" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 20, color: cfg.color }}>{cfg.icon}</div>
          </Col>

          {/* Main content */}
          <Col flex="auto">
            <Space style={{ marginBottom: 4 }}>
              <Text strong style={{ fontSize: 15 }}>
                {record.title}
              </Text>
              <Tag color={cfg.color} style={{ borderRadius: 4, fontSize: 11, lineHeight: '18px' }}>
                {cfg.label}
              </Tag>
              {record.status && record.type === 'lead' && (
                <Tag color={statusColors[record.status] || 'default'}>
                  {statusLabels[record.status] || record.status}
                </Tag>
              )}
              {record.status && record.type === 'visit' && record.status && (
                <Tag color="geekblue">{record.status}</Tag>
              )}
            </Space>

            {record.description && (
              <div style={{ color: '#666', fontSize: 13, marginBottom: 4, lineHeight: 1.5 }}>
                {record.description.length > 120
                  ? record.description.slice(0, 120) + '...'
                  : record.description}
              </div>
            )}

            <Space size={16} style={{ fontSize: 12, color: '#999' }}>
              {record.user && (
                <span>👤 {record.user.name}</span>
              )}
              {record.customer && record.type !== 'lead' && (
                <span>
                  🏢 {record.customer.name}
                </span>
              )}
              <span>🕐 {dayjs(record.date).format('YYYY-MM-DD HH:mm')}</span>
              <span style={{ color: '#bbb' }}>{dayjs(record.date).fromNow()}</span>
            </Space>
          </Col>

          {/* Right arrow */}
          {record.detailUrl && (
            <Col flex="24px" style={{ color: '#ccc' }}>
              <SwapRightOutlined />
            </Col>
          )}
        </Row>
      </Card>
    )
  }

  return (
    <AppLayout>
      {/* Breadcrumb */}
      <Breadcrumb
        items={[
          { title: '記錄總覽' },
        ]}
        style={{ marginBottom: 16 }}
      />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>
            <HistoryOutlined /> 記錄總覽
          </Title>
          <div style={{ marginTop: 4, color: '#999', fontSize: 13 }}>
            統合顯示新建線索、每日速报、拜訪記錄的時間線
          </div>
        </div>

        {/* Quick-create buttons */}
        <Space>
          <Button
            icon={<UserAddOutlined />}
            onClick={() => router.push('/leads/new')}
            style={{ borderColor: '#722ed1', color: '#722ed1' }}
          >
            新建線索
          </Button>
          <Button
            icon={<CustomerServiceOutlined />}
            onClick={() => router.push('/quick-checkin')}
            style={{ borderColor: '#1677ff', color: '#1677ff' }}
          >
            每日速报
          </Button>
          <Button
            icon={<EnvironmentOutlined />}
            onClick={() => router.push('/visits/new')}
            style={{ borderColor: '#52c41a', color: '#52c41a' }}
          >
            拜訪記錄
          </Button>
        </Space>
      </div>

      {/* Filter tabs */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row align="middle" gutter={16}>
          <Col>
            <Segmented
              value={typeFilter}
              onChange={(val) => handleTypeChange(val as string)}
              options={[
                { label: `全部 (${total})`, value: 'all' },
                { label: `📌 新建線索 (${totals.leads})`, value: 'lead' },
                { label: `📞 每日速报 (${totals.checkins})`, value: 'checkin' },
                { label: `📍 拜訪記錄 (${totals.visits})`, value: 'visit' },
              ]}
            />
          </Col>
        </Row>
      </Card>

      {/* Records list */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <Spin size="large" />
        </div>
      ) : records.length === 0 ? (
        <Card>
          <Empty
            description="暫無記錄"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          >
            <Space>
              <Button type="primary" icon={<UserAddOutlined />} onClick={() => router.push('/leads/new')}>
                新建線索
              </Button>
              <Button icon={<CustomerServiceOutlined />} onClick={() => router.push('/quick-checkin')}>
                每日速报
              </Button>
              <Button icon={<EnvironmentOutlined />} onClick={() => router.push('/visits/new')}>
                拜訪記錄
              </Button>
            </Space>
          </Empty>
        </Card>
      ) : (
        <>
          {records.map(renderRecord)}

          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <Pagination
              current={page}
              total={total}
              pageSize={pageSize}
              onChange={(p) => setPage(p)}
              showTotal={(t) => `共 ${t} 條記錄`}
              size="small"
            />
          </div>
        </>
      )}
    </AppLayout>
  )
}
