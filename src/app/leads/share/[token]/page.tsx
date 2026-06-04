'use client'

import { useState, useEffect } from 'react'
import {
  Card, Form, Input, Select, Button, Typography, message,
  DatePicker, Spin, Space, Divider,
} from 'antd'
import { SendOutlined, CheckCircleOutlined, ShopOutlined, EnvironmentOutlined, GlobalOutlined, StarOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useParams, useRouter } from 'next/navigation'

const { Title, Text } = Typography
const { TextArea } = Input

export default function ShareLeadPage() {
  const params = useParams()
  const router = useRouter()
  const token = params.token as string
  const [form] = Form.useForm()
  const [salesPerson, setSalesPerson] = useState<{ id: number; name: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    setLoading(true)
    fetch(`/api/public/share?token=${encodeURIComponent(token)}`)
      .then(res => {
        if (!res.ok) throw new Error('Invalid link')
        return res.json()
      })
      .then(data => {
        setSalesPerson(data.user)
      })
      .catch(() => {
        setError('連結無效或已過期')
      })
      .finally(() => setLoading(false))
  }, [token])

  const onFinish = async (values: any) => {
    setSubmitting(true)
    try {
      const res = await fetch('/api/public/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          ...values,
          visitDate: values.visitDate?.toISOString(),
        }),
      })
      if (!res.ok) throw new Error('Failed')
      message.success('✅ 線索已提交！')
      setSubmitted(true)
      form.resetFields()
    } catch {
      message.error('提交失敗，請重試')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" />
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ maxWidth: 400, margin: '100px auto', textAlign: 'center' }}>
        <Card>
          <Title level={4} style={{ color: '#ff4d4f' }}>❌ {error}</Title>
          <Text type="secondary">請聯繫您的業務經理獲取新的連結</Text>
        </Card>
      </div>
    )
  }

  return (
    <div style={{
      maxWidth: 560,
      margin: '0 auto',
      padding: 16,
      minHeight: '100vh',
      background: '#f5f5f5',
    }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
        margin: -16,
        marginBottom: 16,
        padding: '32px 24px',
        color: '#fff',
        textAlign: 'center',
      }}>
        <ShopOutlined style={{ fontSize: 40, marginBottom: 8 }} />
        <Title level={3} style={{ color: '#fff', margin: 0, marginBottom: 4 }}>
          新增商家線索
        </Title>
        {salesPerson && (
          <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14 }}>
            業務人員：{salesPerson.name}
          </Text>
        )}
        <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>
          無需登錄 · 快速登記
        </div>
      </div>

      {submitted && (
        <Card style={{ marginBottom: 16, background: '#f6ffed', borderColor: '#b7eb8f', textAlign: 'center' }}>
          <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 48, marginBottom: 12 }} />
          <Title level={4} style={{ margin: 0, marginBottom: 8 }}>提交成功！</Title>
          <Text type="secondary">感謝您的登記，業務人員會儘快與您聯繫</Text>
          <div style={{ marginTop: 16 }}>
            <Button type="primary" onClick={() => setSubmitted(false)}>
              繼續登記
            </Button>
          </div>
        </Card>
      )}

      {!submitted && (
        <Card>
          <Form
            form={form}
            layout="vertical"
            onFinish={onFinish}
            size="large"
          >
            <Divider orientation="left" plain>商家資訊</Divider>

            <Form.Item name="name" label="商家名稱 *" rules={[{ required: true, message: '請輸入商家名稱' }]}>
              <Input placeholder="餐廳/商家名稱" prefix={<ShopOutlined />} />
            </Form.Item>

            <div style={{
              background: '#fff7e6', border: '1px solid #ffd591', borderRadius: 6,
              padding: '8px 12px', marginBottom: 16, fontSize: 12, color: '#d46b08',
            }}>
              <EnvironmentOutlined style={{ marginRight: 6 }} />
              輸入商家名稱後，系統將自動從 Google Places 補全地址、評分、價位等信息（即將推出）
            </div>

            <Form.Item name="phone" label="電話">
              <Input placeholder="電話號碼" />
            </Form.Item>

            <Form.Item name="address" label="地址">
              <Input placeholder="完整街道地址" />
            </Form.Item>

            <div style={{ display: 'flex', gap: 8 }}>
              <Form.Item name="city" label="城市" style={{ flex: 1 }}>
                <Input placeholder="城市" />
              </Form.Item>
              <Form.Item name="state" label="州" style={{ width: 80 }}>
                <Input placeholder="CA" />
              </Form.Item>
              <Form.Item name="zipCode" label="郵編" style={{ width: 120 }}>
                <Input placeholder="郵編" />
              </Form.Item>
            </div>

            <Form.Item name="website" label="官網">
              <Input placeholder="https://" prefix={<GlobalOutlined />} />
            </Form.Item>

            <Form.Item name="contactPerson" label="聯繫人">
              <Input placeholder="聯繫人姓名" />
            </Form.Item>

            <Form.Item name="foodType" label="餐飲類型">
              <Input placeholder="例如：中餐、墨西哥餐..." />
            </Form.Item>

            <Form.Item name="posBrand" label="當前 POS 品牌">
              <Input placeholder="例如：Clover, Toast..." />
            </Form.Item>

            <Form.Item name="needs" label="需求描述">
              <TextArea rows={3} placeholder="簡單描述您的需求..." />
            </Form.Item>

            <Form.Item name="visitDate" label="希望拜訪時間">
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item name="notes" label="備註">
              <TextArea rows={2} placeholder="其他補充..." />
            </Form.Item>

            <Divider />

            <Button
              type="primary"
              htmlType="submit"
              loading={submitting}
              size="large"
              block
              icon={<SendOutlined />}
              style={{ height: 48, fontSize: 16 }}
            >
              提交線索
            </Button>

            <div style={{ textAlign: 'center', marginTop: 12 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                🔒 資訊僅供內部 CRM 使用
              </Text>
            </div>
          </Form>
        </Card>
      )}
    </div>
  )
}
