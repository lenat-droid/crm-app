'use client'

import { useState, useEffect } from 'react'
import { Card, Typography, Table, Tag, Button, message, Breadcrumb } from 'antd'
import { PlusOutlined, SwapRightOutlined, CheckCircleOutlined } from '@ant-design/icons'
import { useRouter } from 'next/navigation'
import dayjs from 'dayjs'
import AppLayout from '@/components/Layout/AppLayout'

const { Title } = Typography

const statusColors: Record<string, string> = {
  new: 'blue',
  contacted: 'orange',
  converted: 'green',
  closed: 'red',
}

const statusLabels: Record<string, string> = {
  new: '新線索',
  contacted: '已聯繫',
  converted: '已轉化',
  closed: '已關閉',
}

export default function LeadsPage() {
  const router = useRouter()
  const [leads, setLeads] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchLeads = async () => {
    try {
      const res = await fetch('/api/leads')
      const data = await res.json()
      setLeads(data.leads || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchLeads() }, [])

  const columns = [
    { title: '名稱', dataIndex: 'name', key: 'name', width: 180 },
    { title: '電話', dataIndex: 'phone', key: 'phone', width: 140 },
    { title: '聯繫人', dataIndex: 'contactPerson', key: 'contactPerson', width: 120 },
    { title: '餐飲類型', dataIndex: 'foodType', key: 'foodType', width: 120 },
    { title: '需求', dataIndex: 'needs', key: 'needs', width: 200, ellipsis: true },
    {
      title: '狀態',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (val: string, record: any) => (
        record.status === 'converted' && record.customer ? (
          <a onClick={() => router.push(`/customers/${record.customer.id}`)}>
            <Tag color="green" style={{ cursor: 'pointer' }}>{statusLabels[val]}</Tag>
          </a>
        ) : (
          <Tag color={statusColors[val]}>{statusLabels[val] || val}</Tag>
        )
      ),
    },
    {
      title: '登記人',
      key: 'registeredBy',
      width: 100,
      render: (_: any, r: any) => r.registeredBy?.name || '-',
    },
    {
      title: '日期',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 100,
      render: (v: string) => dayjs(v).format('MM-DD'),
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      render: (_: any, record: any) =>
        record.status === 'converted' && record.customer ? (
          <Button size="small" type="link" onClick={() => router.push(`/customers/${record.customer.id}`)}>
            查看客戶 <SwapRightOutlined />
          </Button>
        ) : null,
    },
  ]

  return (
    <AppLayout>
      <Breadcrumb
        items={[
          { title: <a onClick={() => router.push('/records')}>記錄總覽</a> },
          { title: '線索管理' },
        ]}
        style={{ marginBottom: 16 }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>線索管理</Title>
          <div style={{ marginTop: 4, color: '#999', fontSize: 13 }}>
            <CheckCircleOutlined style={{ color: '#52c41a' }} /> 新建線索時自動創建客戶 + Pipeline，無需手動轉化
          </div>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => router.push('/leads/new')}>
          新建線索
        </Button>
      </div>

      <Card>
        <Table
          dataSource={leads}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 20, showTotal: (t) => `共 ${t} 條` }}
          scroll={{ x: 1100 }}
        />
      </Card>
    </AppLayout>
  )
}
