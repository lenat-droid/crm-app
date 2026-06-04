'use client'

import { useState, useEffect } from 'react'
import { Card, Typography, Table, Tag, Breadcrumb, Spin } from 'antd'
import { useParams, useRouter } from 'next/navigation'
import dayjs from 'dayjs'
import AppLayout from '@/components/Layout/AppLayout'

const { Title, Text } = Typography

export default function SegmentDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [segment, setSegment] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/segments/${params.id}`)
      .then(res => res.json())
      .then(data => setSegment(data.segment))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [params.id])

  if (loading) {
    return (
      <AppLayout>
        <div style={{ display: 'flex', justifyContent: 'center', padding: 100 }}><Spin size="large" /></div>
      </AppLayout>
    )
  }

  if (!segment) return null

  return (
    <AppLayout>
      <Breadcrumb
        items={[
          { title: <a onClick={() => router.push('/segments')}>客戶分群</a> },
          { title: segment.name },
        ]}
        style={{ marginBottom: 16 }}
      />

      <Card>
        <Title level={4}>{segment.name}</Title>
        <div style={{ marginBottom: 16 }}>
          {segment.description && <Text type="secondary">{segment.description}</Text>}
          <div style={{ marginTop: 8 }}>
            <Tag color={segment.isDynamic ? 'blue' : 'default'}>{segment.isDynamic ? '動態分群' : '靜態分群'}</Tag>
            <span style={{ marginLeft: 16 }}>客戶數: <strong>{segment.customerCount}</strong></span>
            <span style={{ marginLeft: 16 }}>創建人: {segment.createdBy?.name || '-'}</span>
            <span style={{ marginLeft: 16 }}>創建時間: {dayjs(segment.createdAt).format('YYYY-MM-DD')}</span>
          </div>
        </div>
      </Card>
    </AppLayout>
  )
}
