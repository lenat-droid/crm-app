'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Card, Typography, Tag, Button, Space, Spin, Empty, Segmented,
  Row, Col, Pagination, Breadcrumb,
} from 'antd'
import {
  UserAddOutlined, CustomerServiceOutlined, EnvironmentOutlined,
  SwapRightOutlined, HistoryOutlined, GlobalOutlined,
} from '@ant-design/icons'
import { useRouter } from 'next/navigation'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import AppLayout from '@/components/Layout/AppLayout'
import { lr, useLanguage } from '@/lib/i18n'

dayjs.extend(relativeTime)

const { Title, Text } = Typography

// Static type config (colors & icons don't change with language)
const typeConfigStatic: Record<string, { color: string; icon: React.ReactNode }> = {
  lead: { color: '#722ed1', icon: <UserAddOutlined /> },
  checkin: { color: '#1677ff', icon: <CustomerServiceOutlined /> },
  visit: { color: '#52c41a', icon: <EnvironmentOutlined /> },
}

const statusColors: Record<string, string> = {
  new: 'blue',
  contacted: 'orange',
  converted: 'green',
  closed: 'red',
}

export default function RecordsPage() {
  const router = useRouter()
  const { lang, setLang } = useLanguage()
  const t = lr[lang]
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
    const staticCfg = typeConfigStatic[record.type] || { color: '#999', icon: null }
    const typeLabel = record.type === 'lead' ? t.lead : record.type === 'checkin' ? t.checkin : t.visit

    let statusLabel: string | null = null
    if (record.type === 'lead' && record.status) {
      const sk = 'status' + record.status.charAt(0).toUpperCase() + record.status.slice(1)
      statusLabel = t[sk as keyof typeof t] || record.status
    } else if (record.type === 'visit' && record.status) {
      statusLabel = record.status
    }

    return (
      <Card
        key={record.id}
        size="small"
        style={{
          marginBottom: 12,
          borderLeft: `4px solid ${staticCfg.color}`,
          borderRadius: 6,
        }}
        hoverable
        onClick={() => record.detailUrl && router.push(record.detailUrl)}
      >
        <Row gutter={16} align="middle">
          <Col flex="40px" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 20, color: staticCfg.color }}>{staticCfg.icon}</div>
          </Col>

          <Col flex="auto">
            <Space style={{ marginBottom: 4 }}>
              <Text strong style={{ fontSize: 15 }}>
                {record.title}
              </Text>
              <Tag color={staticCfg.color} style={{ borderRadius: 4, fontSize: 11, lineHeight: '18px' }}>
                {typeLabel}
              </Tag>
              {record.status && record.type === 'lead' && statusLabel && (
                <Tag color={statusColors[record.status] || 'default'}>
                  {statusLabel}
                </Tag>
              )}
              {record.status && record.type === 'visit' && statusLabel && (
                <Tag color="geekblue">{statusLabel}</Tag>
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
      <Breadcrumb
        items={[
          { title: t.title },
        ]}
        style={{ marginBottom: 16 }}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Title level={4} style={{ margin: 0 }}>
              <HistoryOutlined /> {t.title}
            </Title>
            <Button
              size="small"
              icon={<GlobalOutlined />}
              onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
              style={{ fontSize: 12 }}
            >
              {lang === 'zh' ? 'EN' : '中'}
            </Button>
          </div>
          <div style={{ marginTop: 4, color: '#999', fontSize: 13 }}>
            {t.subtitle}
          </div>
        </div>

        <Space>
          <Button
            icon={<UserAddOutlined />}
            onClick={() => router.push(`/leads/new?lang=${lang}`)}
            style={{ borderColor: '#722ed1', color: '#722ed1' }}
          >
            {t.lead}
          </Button>
          <Button
            icon={<CustomerServiceOutlined />}
            onClick={() => router.push(`/quick-checkin?lang=${lang}`)}
            style={{ borderColor: '#1677ff', color: '#1677ff' }}
          >
            {t.checkin}
          </Button>
          <Button
            icon={<EnvironmentOutlined />}
            onClick={() => router.push(`/visits/new?lang=${lang}`)}
            style={{ borderColor: '#52c41a', color: '#52c41a' }}
          >
            {t.visit}
          </Button>
        </Space>
      </div>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Row align="middle" gutter={16}>
          <Col>
            <Segmented
              value={typeFilter}
              onChange={(val) => handleTypeChange(val as string)}
              options={[
                { label: `${t.all} (${total})`, value: 'all' },
                { label: `📌 ${t.lead} (${totals.leads})`, value: 'lead' },
                { label: `📋 ${t.checkin} (${totals.checkins})`, value: 'checkin' },
                { label: `📍 ${t.visit} (${totals.visits})`, value: 'visit' },
              ]}
            />
          </Col>
        </Row>
      </Card>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <Spin size="large" />
        </div>
      ) : records.length === 0 ? (
        <Card>
          <Empty
            description={t.noRecords}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          >
            <Space>
              <Button type="primary" icon={<UserAddOutlined />} onClick={() => router.push(`/leads/new?lang=${lang}`)}>
                {t.lead}
              </Button>
              <Button icon={<CustomerServiceOutlined />} onClick={() => router.push(`/quick-checkin?lang=${lang}`)}>
                {t.checkin}
              </Button>
              <Button icon={<EnvironmentOutlined />} onClick={() => router.push(`/visits/new?lang=${lang}`)}>
                {t.visit}
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
              showTotal={(n) => (lang === 'en' ? `Total ${n}` : `共 ${n} 條記錄`)}
              size="small"
            />
          </div>
        </>
      )}
    </AppLayout>
  )
}
