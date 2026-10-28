'use client'

import { useState, useEffect, useCallback } from 'react'
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
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  const fetchLeads = useCallback(async () => {
    try {
      const res = await fetch(`/api/leads?page=${page}`)
      const data = await res.json()
      setLeads(data.leads || [])
      setTotal(data.total || 0)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => { fetchLeads() }, [fetchLeads])

  const columns = [
    { title: '名稱', dataIndex: 'name', key: 'name', width: 180 },
    { title: '電話', dataIndex: 'phone', key: 'phone', width: 140 },
    { title: '聯繫人', dataIndex: 'contactPerson', key: 'contactPerson', width: 120 },
    { title: '郵箱', dataIndex: 'email', key: 'email', width: 220 },
    { title: '來源', dataIndex: 'source', key: 'source', width: 140 },
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
        ) : <Button size="small" type="link" onClick={() => router.push(`/leads/${record.id}`)}>查看及跟進</Button>,
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
            <CheckCircleOutlined style={{ color: '#52c41a' }} /> 手工新建會創建客戶及 Pipeline；AIM 申請先進入新線索，待團隊跟進。
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
          pagination={{ pageSize: 20, current: page, total, onChange: setPage, showSizeChanger: false, showTotal: (t) => `共 ${t} 條` }}
          scroll={{ x: 1100 }}
        />
      </Card>
    </AppLayout>
  )
}
