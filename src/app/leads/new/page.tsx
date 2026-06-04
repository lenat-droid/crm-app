'use client'

import { useState } from 'react'
import { Card, Typography, Form, Input, Select, Button, message, Breadcrumb, DatePicker } from 'antd'
import { useRouter } from 'next/navigation'
import AppLayout from '@/components/Layout/AppLayout'
import RecordTypeNav from '@/components/RecordTypeNav'

const { Title } = Typography
const { TextArea } = Input

export default function NewLeadPage() {
  const router = useRouter()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)

  const onFinish = async (values: any) => {
    setLoading(true)
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...values,
          visitDate: values.visitDate?.toISOString(),
        }),
      })
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      message.success(`✅ 線索已轉化為客戶：${data.customer.name}，已加入 Pipeline`)
      // Redirect to the kanban so the sales person can immediately start working on it
      router.push('/kanban')
    } catch {
      message.error('創建失敗')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppLayout>
      <Breadcrumb
        items={[
          { title: <a onClick={() => router.push('/records')}>記錄總覽</a> },
          { title: '新建線索' },
        ]}
        style={{ marginBottom: 16 }}
      />
      <RecordTypeNav active="lead" />
      <Title level={4} style={{ marginBottom: 24 }}>新建線索</Title>

      <Card style={{ maxWidth: 600 }}>
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item name="name" label="商家名稱" rules={[{ required: true }]}>
            <Input placeholder="商家名稱" />
          </Form.Item>

          <Form.Item name="phone" label="電話">
            <Input placeholder="電話號碼" />
          </Form.Item>

          <Form.Item name="contactPerson" label="聯繫人">
            <Input placeholder="聯繫人姓名" />
          </Form.Item>

          <Form.Item name="foodType" label="餐飲類型">
            <Input placeholder="例如：中餐、墨西哥餐..." />
          </Form.Item>

          <Form.Item name="posBrand" label="POS 品牌">
            <Input placeholder="例如：Clover, Toast..." />
          </Form.Item>

          <Form.Item name="needs" label="需求描述">
            <TextArea rows={3} placeholder="客戶的需求..." />
          </Form.Item>

          <Form.Item name="visitDate" label="拜訪日期">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="notes" label="備註">
            <TextArea rows={2} placeholder="..." />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading}>
              創建線索並入 Pipeline
            </Button>
            <Button style={{ marginLeft: 8 }} onClick={() => router.push('/kanban')}>
              取消
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </AppLayout>
  )
}
