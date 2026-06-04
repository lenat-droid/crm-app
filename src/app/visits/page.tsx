'use client'

import { useState, useEffect } from 'react'
import { Card, Typography, Table, Tag, Button, Space } from 'antd'
import { PlusOutlined, GlobalOutlined } from '@ant-design/icons'
import { useRouter } from 'next/navigation'
import dayjs from 'dayjs'
import AppLayout from '@/components/Layout/AppLayout'
import { vr, useLanguage } from '@/lib/i18n'

const { Title } = Typography

export default function VisitsPage() {
  const router = useRouter()
  const { lang, setLang } = useLanguage()
  const t = vr[lang]
  const [visits, setVisits] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/visits')
      .then(res => res.json())
      .then(data => setVisits(data.visits || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const columns = [
    {
      title: t.customerName,
      dataIndex: ['customer', 'name'],
      key: 'customerName',
      render: (name: string, record: any) => (
        <a onClick={() => router.push(`/customers/${record.customerId}`)}>{name}</a>
      ),
    },
    {
      title: t.visitDate,
      dataIndex: 'visitDate',
      key: 'visitDate',
      render: (v: string) => dayjs(v).format('YYYY-MM-DD'),
    },
    {
      title: t.visitedBy,
      key: 'visitedBy',
      render: (_: any, r: any) => r.visitedBy?.name || '-',
    },
    { title: t.outcome, dataIndex: 'outcome', key: 'outcome' },
    { title: t.notes, dataIndex: 'notes', key: 'notes' },
    {
      title: t.action,
      key: 'action',
      render: (_: any, record: any) => (
        <a onClick={() => router.push(`/customers/${record.customerId}`)}>{t.viewCustomer}</a>
      ),
    },
  ]

  return (
    <AppLayout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          {t.title}
          <Button
            size="small"
            icon={<GlobalOutlined />}
            onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
            style={{ marginLeft: 12, fontSize: 12 }}
          >
            {lang === 'zh' ? 'EN' : '中'}
          </Button>
        </Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => router.push(`/visits/new?lang=${lang}`)}>
          {t.newVisit}
        </Button>
      </div>
      <Card>
        <Table
          dataSource={visits}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 20, showTotal: (n) => t.total(n) }}
        />
      </Card>
    </AppLayout>
  )
}
