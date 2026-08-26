'use client'

import { useState, useEffect } from 'react'
import {
  Card, Form, Select, DatePicker, Input, Button, Typography, message,
  Tag, Space, Spin, Row, Col, Divider,
} from 'antd'
import { SendOutlined, CheckCircleOutlined, GlobalOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useParams } from 'next/navigation'
import { qcs, useLanguage } from '@/lib/i18n'

const { Title, Text } = Typography
const { TextArea } = Input

export default function ShareQuickCheckinPage() {
  const params = useParams()
  const token = params.token as string
  const { lang, setLang } = useLanguage()
  const t = qcs[lang]
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
          setError(t.noCustomers)
        }
      })
      .catch(() => {
        setError(t.errorTitle)
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
      message.warning(t.selectFirst)
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
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}))
        throw new Error(errBody.error || 'Failed')
      }
      message.success(t.submitSuccess(selectedCustomer.name))
      setSubmitted(true)
      form.resetFields(['record', 'contactDate'])
      setSelectedCustomer(null)
    } catch (err: any) {
      console.error('Checkin share submit error:', err)
      message.error(err.message || t.submitFail)
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
          <Text type="secondary">{t.errorDesc}</Text>
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
        position: 'relative',
      }}>
        <div style={{ position: 'absolute', top: 16, right: 24 }}>
          <Button
            size="small"
            icon={<GlobalOutlined />}
            onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
            style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff' }}
          >
            {lang === 'zh' ? 'EN' : '中'}
          </Button>
        </div>
        <Title level={3} style={{ color: '#fff', margin: 0, marginBottom: 4 }}>
          📋 {t.title}
        </Title>
        <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14 }}>
          {t.subtitle(salesPerson?.name || '')}
        </Text>
        <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>
          {t.subtitleNote}
        </div>
      </div>

      {submitted && (
        <Card style={{ marginBottom: 16, background: '#f6ffed', borderColor: '#b7eb8f' }}>
          <Space>
            <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 20 }} />
            <div>
              <Text strong>{t.successTitle}</Text>
              <br />
              <Text type="secondary">{t.successDesc}</Text>
            </div>
          </Space>
          <div style={{ marginTop: 12 }}>
            <Button onClick={() => setSubmitted(false)} type="primary" size="small">
              {t.continueBtn}
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
          <Form.Item label={<strong>{t.selectCustomer}</strong>} required>
            <Select
              showSearch
              placeholder={t.searchPlaceholder}
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
                  <Tag color={
                    selectedCustomer.contactStatus === '合作中' ? 'green' :
                    selectedCustomer.contactStatus === '已流失' ? 'red' : 'blue'
                  } style={{ marginLeft: 8 }}>
                    {selectedCustomer.contactStatus === '合作中' ? t.customerStatusActive :
                     selectedCustomer.contactStatus === '已流失' ? t.customerStatusChurned :
                     selectedCustomer.contactStatus}
                  </Tag>
                )}
              </Card>

              <Divider style={{ margin: '12px 0' }} />

              {/* Step 2: Record */}
              <Form.Item label={<strong>{t.commRecord}</strong>}>
                <Form.Item name="contactDate" noStyle>
                  <DatePicker style={{ width: '100%', marginBottom: 8 }} />
                </Form.Item>
                <Form.Item name="record" noStyle>
                  <TextArea rows={3} placeholder={t.commPlaceholder} />
                </Form.Item>
              </Form.Item>

              <Divider style={{ margin: '12px 0' }} />

              {/* Step 3: Product Interest */}
              <Form.Item label={<strong>{t.productInterest}</strong>}>
                <Text type="secondary" style={{ display: 'block', marginBottom: 8, fontSize: 12 }}>
                  {t.productInterestHint}
                </Text>
                <Row gutter={[8, 8]}>
                  {Object.entries(t.productLabels).map(([key, label]) => (
                    <Col span={12} key={key}>
                      <Form.Item name={key} label={label} style={{ marginBottom: 8 }}>
                        <Select
                          size="small"
                          options={Object.entries(t.interestLabels).map(([value, label]) => ({ label, value }))}
                        />
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
                {t.submitBtn}
              </Button>
            </>
          )}
        </Form>
      </Card>

      <div style={{ marginTop: 16, textAlign: 'center' }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {t.securityNote}
        </Text>
      </div>
    </div>
  )
}
