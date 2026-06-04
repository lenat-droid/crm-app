'use client'

import { useState, useEffect } from 'react'
import { Card, Typography, Row, Col, Table, Tag, Progress } from 'antd'
import { useRouter } from 'next/navigation'
import AppLayout from '@/components/Layout/AppLayout'

const { Title } = Typography

const interestColors: Record<string, string> = {
  NOT_CONTACTED: '#d9d9d9',
  NOT_INTERESTED: '#ff4d4f',
  AWARE: '#faad14',
  INTERESTED: '#1890ff',
  HIGH_INTENT: '#722ed1',
  PURCHASED: '#52c41a',
}

const interestLabels: Record<string, string> = {
  NOT_CONTACTED: '未接觸',
  NOT_INTERESTED: '無興趣',
  AWARE: '已了解',
  INTERESTED: '感興趣',
  HIGH_INTENT: '高意向',
  PURCHASED: '已購買',
}

export default function ProductStatsPage() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [statsRes, productsRes] = await Promise.all([
          fetch('/api/product-stats'),
          fetch('/api/products'),
        ])
        const statsData = await statsRes.json()
        const productsData = await productsRes.json()

        // Build productField map from dynamic product catalog
        const dynamicMap: Record<string, string> = {}
        if (productsData.products) {
          for (const p of productsData.products) {
            if (p.active !== false) {
              dynamicMap[p.name] = p.key
            }
          }
        }

        setData(statsData)
        setProductFieldMap(dynamicMap)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [])

  const [productFieldMap, setProductFieldMap] = useState<Record<string, string>>({
    'POS': 'posStatus',
    'PS官網': 'psWebsiteStatus',
    'SMT': 'smtStatus',
    '平台托管': 'platformManagedStatus',
    'AI Cam': 'aiCamStatus',
    'OME': 'omeStatus',
    '智能機器人': 'smartRobotStatus',
  })

  const columns = [
    {
      title: '產品',
      dataIndex: 'product',
      key: 'product',
      fixed: 'left' as const,
      width: 120,
      render: (text: string, record: any) => (
        <a onClick={() => router.push(`/product-stats/${record.productField || text}`)}>
          <strong>{text}</strong>
        </a>
      ),
    },
    {
      title: '未接觸',
      dataIndex: 'NOT_CONTACTED',
      key: 'NOT_CONTACTED',
      render: (val: number) => <Tag color={interestColors.NOT_CONTACTED}>{val}</Tag>,
    },
    {
      title: '無興趣',
      dataIndex: 'NOT_INTERESTED',
      key: 'NOT_INTERESTED',
      render: (val: number) => <Tag color={interestColors.NOT_INTERESTED}>{val}</Tag>,
    },
    {
      title: '已了解',
      dataIndex: 'AWARE',
      key: 'AWARE',
      render: (val: number) => <Tag color={interestColors.AWARE}>{val}</Tag>,
    },
    {
      title: '感興趣',
      dataIndex: 'INTERESTED',
      key: 'INTERESTED',
      render: (val: number) => <Tag color={interestColors.INTERESTED}>{val}</Tag>,
    },
    {
      title: '高意向',
      dataIndex: 'HIGH_INTENT',
      key: 'HIGH_INTENT',
      render: (val: number) => <Tag color={interestColors.HIGH_INTENT}>{val}</Tag>,
    },
    {
      title: '已購買',
      dataIndex: 'PURCHASED',
      key: 'PURCHASED',
      render: (val: number) => <Tag color={interestColors.PURCHASED}>{val}</Tag>,
    },
    {
      title: '潛在客戶 (感興趣+高意向)',
      dataIndex: 'potential',
      key: 'potential',
      fixed: 'right' as const,
      render: (val: number, record: any) => {
        const total = (record['NOT_CONTACTED'] || 0) + (record['NOT_INTERESTED'] || 0) +
          (record['AWARE'] || 0) + (record['INTERESTED'] || 0) +
          (record['HIGH_INTENT'] || 0) + (record['PURCHASED'] || 0)
        const pct = total > 0 ? Math.round((val / total) * 100) : 0
        return (
          <div>
            <strong style={{ color: '#722ed1', fontSize: 16 }}>{val}</strong>
            <span style={{ marginLeft: 8, color: '#999' }}>({pct}%)</span>
          </div>
        )
      },
    },
  ]

  // Enrich data with productField key for drill-down (from dynamic product catalog)
  const enrichedData = data.map((d: any) => ({ ...d, productField: productFieldMap[d.product] || d.product }))

  return (
    <AppLayout>
      <Title level={4} style={{ marginBottom: 24 }}>产品潜力看板</Title>
      <Title level={5} type="secondary" style={{ marginBottom: 16, fontWeight: 400 }}>
        每個產品的客戶興趣程度分佈 — 點擊產品名稱查看具體客戶列表
      </Title>

      <Row gutter={[16, 16]}>
        {enrichedData.map((item: any) => {
          const total = (item['NOT_CONTACTED'] || 0) + (item['NOT_INTERESTED'] || 0) +
            (item['AWARE'] || 0) + (item['INTERESTED'] || 0) +
            (item['HIGH_INTENT'] || 0) + (item['PURCHASED'] || 0)
          const potential = item['potential'] || 0
          const potentialPct = total > 0 ? Math.round((potential / total) * 100) : 0

          return (
            <Col xs={24} sm={12} lg={8} key={item.product}>
              <Card
                hoverable
                title={
                  <a onClick={() => router.push(`/product-stats/${item.productField}`)}>
                    {item.product}
                  </a>
                }
                extra={<Tag color="purple">潛在: {potential}</Tag>}
                loading={loading}
              >
                {/* Simple stacked bar visualization */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', height: 24, borderRadius: 4, overflow: 'hidden' }}>
                    {['NOT_CONTACTED', 'NOT_INTERESTED', 'AWARE', 'INTERESTED', 'HIGH_INTENT', 'PURCHASED'].map(level => {
                      const count = item[level] || 0
                      const pct = total > 0 ? (count / total) * 100 : 0
                      if (pct < 1) return null
                      return (
                        <div
                          key={level}
                          style={{
                            width: `${pct}%`,
                            backgroundColor: interestColors[level],
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 10,
                            color: '#fff',
                            minWidth: pct > 10 ? undefined : 0,
                          }}
                          title={`${interestLabels[level]}: ${count}`}
                        >
                          {pct > 10 ? `${Math.round(pct)}%` : ''}
                        </div>
                      )
                    })}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12, flexWrap: 'wrap' }}>
                    {['NOT_CONTACTED', 'NOT_INTERESTED', 'AWARE', 'INTERESTED', 'HIGH_INTENT', 'PURCHASED'].map(level => (
                      <span key={level}>
                        <span style={{ color: interestColors[level], fontWeight: 'bold' }}>●</span>{' '}
                        {interestLabels[level]}: {item[level] || 0}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <span>潛在客戶轉化率 </span>
                  <Progress
                    percent={potentialPct}
                    size="small"
                    strokeColor="#722ed1"
                    format={() => `${potential}/${total}`}
                  />
                </div>
              </Card>
            </Col>
          )
        })}
      </Row>

      <Card title="詳細數據表" style={{ marginTop: 24 }} loading={loading}>
        <Table
          dataSource={enrichedData}
          columns={columns}
          rowKey="product"
          pagination={false}
          scroll={{ x: 900 }}
        />
      </Card>
    </AppLayout>
  )
}
