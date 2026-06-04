'use client'

import { useState, useEffect } from 'react'
import { Card, Typography, Table, Tag, Space, Breadcrumb } from 'antd'
import dayjs from 'dayjs'
import AppLayout from '@/components/Layout/AppLayout'

const { Title } = Typography

const planLabels: Record<string, string> = { MONTHLY: '月繳', QUARTERLY: '季繳', SEMI_ANNUAL: '半年繳', ANNUAL: '年繳' }
const statusColors: Record<string, string> = { ACTIVE: 'green', CANCELLED: 'red', EXPIRED: 'orange', TRIALING: 'blue', PENDING_SIGNATURE: 'gold' }
const statusLabels: Record<string, string> = { ACTIVE: '啟用中', CANCELLED: '已取消', EXPIRED: '已到期', TRIALING: '試用中', PENDING_SIGNATURE: '待簽約' }

export default function ExpiringSubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/subscriptions?pageSize=200&expiring=true')
      .then(res => res.json())
      .then(data => setSubscriptions(data.subscriptions || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const columns = [
    { title: '客戶', dataIndex: ['customer', 'name'], key: 'customer' },
    { title: '產品', dataIndex: ['product', 'name'], key: 'product' },
    { title: '方案', dataIndex: 'plan', key: 'plan', render: (v: string) => planLabels[v] || v },
    { title: '狀態', dataIndex: 'status', key: 'status', render: (v: string) => <Tag color={statusColors[v]}>{statusLabels[v] || v}</Tag> },
    { title: 'MRR', dataIndex: 'mrr', key: 'mrr', render: (v: number) => <span>${v.toLocaleString()}</span> },
    {
      title: '到期日',
      dataIndex: 'endDate',
      key: 'endDate',
      render: (v: string) => {
        const daysLeft = v ? dayjs(v).diff(dayjs(), 'day') : 0
        const color = daysLeft <= 7 ? 'red' : daysLeft <= 14 ? 'orange' : 'gold'
        return <Tag color={color}>{v ? dayjs(v).format('YYYY-MM-DD') : '-'} {daysLeft > 0 ? `(${daysLeft}天)` : ''}</Tag>
      },
    },
  ]

  return (
    <AppLayout>
      <Breadcrumb
        items={[
          { title: <a href="/subscriptions">訂閱管理</a> },
          { title: '即將到期' },
        ]}
        style={{ marginBottom: 16 }}
      />
      <Title level={4}>即將到期的訂閱（30天內）</Title>
      <Card>
        <Table
          dataSource={subscriptions}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 20, showTotal: (t) => `共 ${t} 條` }}
        />
      </Card>
    </AppLayout>
  )
}
