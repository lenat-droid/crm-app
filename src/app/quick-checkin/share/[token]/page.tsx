'use client'

import { useState, useEffect } from 'react'
import {
  Card, Form, Select, DatePicker, Input, Button, Typography, message,
  Tag, Space, Spin, Row, Col, Divider,
} from 'antd'
import { SendOutlined, CheckCircleOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useParams } from 'next/navigation'

const { Title, Text } = Typography
const { TextArea } = Input

const productFields = [
  { key: 'smtStatus', label: 'SMT' },
  { key: 'psWebsiteStatus', label: 'PS Website' },
  { key: 'aiCamStatus', label: 'AI Cam' },
  { key: 'posStatus', label: 'POS' },
  { key: 'platformManagedStatus', label: '平台管理' },
  { key: 'omeStatus', label: 'OME' },
  { key: 'smartRobotStatus', label: '智能機器人' },
]

const interestOptions = [
  { label: '未接觸', value: 'NOT_CONTACTED' },
  { label: '無興趣', value: 'NOT_INTERESTED' },
  { label: '已了解', value: 'AWARE' },
  { label: '感興趣', value: 'INTERESTED' },
  { label: '高意向', value: 'HIGH_INTENT' },
  { label: '已購買', value: 'PURCHASED' },
]

export default function ShareQuickCheckinPage() {
  const params = useParams()
  const token = params.token as string
  const [form] = Form.useForm()
  const [salesPerson, setSalesPerson] = useState<{ id: number; name: string } | null>(null)
  const [customers, setCustomers] = useState<any[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null)
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
        setCustomers(data.customers || [])
        if (data.customers?.length === 0) {
          setError('此連結暫無關聯客戶')
        }
      })
      .catch(() => {
        setError('連結無效或已過期')
      })
      .finally(() => setLoading(false))
  }, [token])

  const handleCustomerSelect = async (customerId: number) => {
    const c = customers.find(c => c.id === customerId)
    if (c) {
      setSelectedCustomer(c)
      form.setFieldsValue({
        contactDate: dayjs(),
      })
    }
  }

  const onFinish = async (values: any) => {
    if (!selectedCustomer) {
      message.warning('請先選擇客戶')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/public/share/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          customerId: selectedCustomer.id,
          contactDate: values.contactDate?.toISOString(),
          record: values.record || null,
          smtStatus: values.smtStatus,
          psWebsiteStatus: values.psWebsiteStatus,
          aiCamStatus: values.aiCamStatus,
          posStatus: values.posStatus,
          platformManagedStatus: values.platformManagedStatus,
          omeStatus: values.omeStatus,
          smartRobotStatus: values.smartRobotStatus,
        }),
      })
      if (!res.ok) throw new Error('Failed')
      message.success(`✅ ${selectedCustomer.name} 已更新`)
      setSubmitted(true)
      form.resetFields(['record', 'contactDate'])
      setSelectedCustomer(null)
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
          <Text type="secondary">請聯繫您的管理員獲取新的分享連結</Text>
        </Card>
      </div>
    )
  }

  const customerOptions = customers.map(c => ({
    label: `${c.name}${c.city ? ' (' + c.city + ')' : ''}`,
    value: c.id,
  }))

  return (
    <div style={{
      maxWidth: 640,
      margin: '0 auto',
      padding: 16,
      minHeight: '100vh',
      background: '#f5f5f5',
    }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        margin: -16,
        marginBottom: 16,
        padding: '32px 24px',
        color: '#fff',
      }}>
        <Title level={3} style={{ color: '#fff', margin: 0, marginBottom: 4 }}>
          📋 每日速報
        </Title>
        <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14 }}>
          {salesPerson?.name} 的客戶拜訪記錄
        </Text>
        <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>
          免登錄 · 快速填寫
        </div>
      </div>

      {submitted && (
        <Card style={{ marginBottom: 16, background: '#f6ffed', borderColor: '#b7eb8f' }}>
          <Space>
            <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 20 }} />
            <div>
              <Text strong>已提交成功！</Text>
              <br />
              <Text type="secondary">繼續填寫下一條</Text>
            </div>
          </Space>
          <div style={{ marginTop: 12 }}>
            <Button onClick={() => setSubmitted(false)} type="primary" size="small">
              填寫下一條
            </Button>
          </div>
        </Card>
      )}

      <Card>
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          initialValues={{ contactDate: dayjs() }}
        >
          {/* Step 1: Select Customer */}
          <Form.Item label={<strong>① 選擇客戶</strong>} required>
            <Select
              showSearch
              placeholder="搜尋客戶名稱..."
              options={customerOptions}
              onSelect={(val: any) => handleCustomerSelect(val)}
              filterOption={(input, option) => (option?.label as string)?.toLowerCase().includes(input.toLowerCase())}
              style={{ width: '100%' }}
              size="large"
              value={undefined}
            />
          </Form.Item>

          {selectedCustomer && (
            <>
              <Card size="small" style={{ marginBottom: 16, background: '#fafafa' }}>
                <Text strong style={{ fontSize: 16 }}>{selectedCustomer.name}</Text>
                <Text type="secondary" style={{ marginLeft: 8 }}>
                  {[selectedCustomer.city, selectedCustomer.region, selectedCustomer.type].filter(Boolean).join(' | ')}
                </Text>
                {selectedCustomer.contactStatus && (
                  <Tag color={selectedCustomer.contactStatus === '合作中' ? 'green' : selectedCustomer.contactStatus === '已流失' ? 'red' : 'blue'} style={{ marginLeft: 8 }}>
                    {selectedCustomer.contactStatus}
                  </Tag>
                )}
              </Card>

              <Divider style={{ margin: '12px 0' }} />

              {/* Step 2: Record */}
              <Form.Item label={<strong>② 溝通記錄</strong>}>
                <Form.Item name="contactDate" noStyle>
                  <DatePicker style={{ width: '100%', marginBottom: 8 }} />
                </Form.Item>
                <Form.Item name="record" noStyle>
                  <TextArea rows={3} placeholder="請填寫溝通內容（選填）..." />
                </Form.Item>
              </Form.Item>

              <Divider style={{ margin: '12px 0' }} />

              {/* Step 3: Product Interest */}
              <Form.Item label={<strong>③ 產品興趣更新</strong>}>
                <Text type="secondary" style={{ display: 'block', marginBottom: 8, fontSize: 12 }}>
                  更新客戶對各產品的興趣程度
                </Text>
                <Row gutter={[8, 8]}>
                  {productFields.map(pf => (
                    <Col span={12} key={pf.key}>
                      <Form.Item name={pf.key} label={pf.label} style={{ marginBottom: 8 }}>
                        <Select size="small" options={interestOptions} />
                      </Form.Item>
                    </Col>
                  ))}
                </Row>
              </Form.Item>

              <Button
                type="primary"
                htmlType="submit"
                loading={submitting}
                size="large"
                block
                icon={<SendOutlined />}
                style={{ marginTop: 8, height: 44 }}
              >
                提交
              </Button>
            </>
          )}
        </Form>
      </Card>

      <div style={{ marginTop: 16, textAlign: 'center' }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          🔒 資料安全：此連結僅供指定業務使用
        </Text>
      </div>
    </div>
  )
}
