'use client'

import { useState, useEffect } from 'react'
import { Card, Typography, Table, Tag, Breadcrumb } from 'antd'
import { useParams, useRouter } from 'next/navigation'
import AppLayout from '@/components/Layout/AppLayout'
import { productLabels, interestLabels, interestColors } from '@/lib/utils'

const { Title } = Typography

export default function ProductDrillDownPage() {
  const params = useParams()
  const router = useRouter()
  const productField = params.product as string
  const productName = productLabels[productField] || productField

  const [customers, setCustomers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Optimized: 2 parallel API calls instead of 6 serial calls
    const fetchAll = async () => {
      setLoading(true)
      try {
        const nonContactedLevels = ['HIGH_INTENT', 'INTERESTED', 'AWARE', 'NOT_INTERESTED', 'PURCHASED']

        const [activeRes, notContactedRes] = await Promise.all([
          fetch(`/api/customers?pageSize=1000&productField=${productField}&productInterests=${nonContactedLevels.join(',')}`),
          fetch(`/api/customers?pageSize=500&productField=${productField}&productInterest=NOT_CONTACTED`),
        ])

        const activeData = await activeRes.json()
        const notContactedData = await notContactedRes.json()

        // API now annotates each customer with _productInterestLevel
        const allCustomers = [
          ...((activeData.customers || []).map((c: any) => ({ ...c, _interest: c._productInterestLevel }))),
          ...((notContactedData.customers || []).map((c: any) => ({ ...c, _interest: 'NOT_CONTACTED' }))),
        ]

        setCustomers(allCustomers)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [productField])

  const columns = [
    { title: '客戶名稱', dataIndex: 'name', key: 'name', width: 200 },
    { title: '城市', dataIndex: 'city', key: 'city', width: 120 },
    { title: '區域', dataIndex: 'region', key: 'region', width: 150 },
    {
      title: '興趣程度',
      key: 'interest',
      width: 120,
      render: (_: any, record: any) => {
        const level = record._interest || record[productField] || 'NOT_CONTACTED'
        return <Tag color={interestColors[level]}>{interestLabels[level] || level}</Tag>
      },
    },
    { title: '類別', dataIndex: 'type', key: 'type', width: 100 },
    { title: '跟進人', key: 'follower', width: 120, render: (_: any, record: any) => record.follower?.name || '-' },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: any, record: any) => (
        <a onClick={() => router.push(`/customers/${record.id}`)}>查看詳情</a>
      ),
    },
  ]

  return (
    <AppLayout>
      <Breadcrumb
        items={[
          { title: <a onClick={() => router.push('/product-stats')}>产品潜力看板</a> },
          { title: productName },
        ]}
        style={{ marginBottom: 16 }}
      />
      <Title level={4}>{productName} — 客戶列表</Title>

      <Card loading={loading}>
        <Table
          dataSource={customers}
          columns={columns}
          rowKey="id"
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `共 ${t} 條` }}
        />
      </Card>
    </AppLayout>
  )
}
