'use client'

import { useState, useEffect } from 'react'
import {
  Card, Form, Input, Select, Button, Typography, message,
  DatePicker, Space, Divider, Spin,
} from 'antd'
import { SendOutlined, CheckCircleOutlined, ShopOutlined, EnvironmentOutlined, GlobalOutlined, StarOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useParams, useRouter } from 'next/navigation'
import { ls, useLanguage } from '@/lib/i18n'

const { Title, Text } = Typography
const { TextArea } = Input

export default function ShareLeadPage() {
  const params = useParams()
  const router = useRouter()
  const token = params.token as string
  const { lang, setLang } = useLanguage()
  const t = ls[lang]
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
        setError(t.errorTitle)
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
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}))
        throw new Error(errBody.error || 'Failed')
      }
      const data = await res.json()
      message.success(t.successMsg)
      setSubmitted(true)
      form.resetFields()
    } catch (err: any) {
      console.error('Lead share submit error:', err)
      message.error(err.message || t.failMsg)
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
        <ShopOutlined style={{ fontSize: 40, marginBottom: 8 }} />
        <Title level={3} style={{ color: '#fff', margin: 0, marginBottom: 4 }}>
          {t.title}
        </Title>
        {salesPerson && (
          <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14 }}>
            {t.salesPersonLabel}{salesPerson.name}
          </Text>
        )}
        <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>
          {t.subtitleNote}
        </div>
      </div>

      {submitted && (
        <Card style={{ marginBottom: 16, background: '#f6ffed', borderColor: '#b7eb8f', textAlign: 'center' }}>
          <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 48, marginBottom: 12 }} />
          <Title level={4} style={{ margin: 0, marginBottom: 8 }}>{t.submittedTitle}</Title>
          <Text type="secondary">{t.submittedDesc}</Text>
          <div style={{ marginTop: 16 }}>
            <Button type="primary" onClick={() => setSubmitted(false)}>
              {t.continueBtn}
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
            <Divider orientation="left" plain>{t.dividerMerchant}</Divider>

            <Form.Item name="name" label={t.merchantName} rules={[{ required: true, message: t.merchantNameRequired }]}>
              <Input placeholder={t.merchantNamePlaceholder} prefix={<ShopOutlined />} />
            </Form.Item>

            <div style={{
              background: '#fff7e6', border: '1px solid #ffd591', borderRadius: 6,
              padding: '8px 12px', marginBottom: 16, fontSize: 12, color: '#d46b08',
            }}>
              <EnvironmentOutlined style={{ marginRight: 6 }} />
              {t.autoFillNote}
            </div>

            <Form.Item name="phone" label={t.phone}>
              <Input placeholder={t.phonePlaceholder} />
            </Form.Item>

            <Form.Item name="address" label={t.address}>
              <Input placeholder={t.addressPlaceholder} />
            </Form.Item>

            <div style={{ display: 'flex', gap: 8 }}>
              <Form.Item name="city" label={t.city} style={{ flex: 1 }}>
                <Input placeholder={t.cityPlaceholder} />
              </Form.Item>
              <Form.Item name="state" label={t.state} style={{ width: 80 }}>
                <Input placeholder={t.state || 'CA'} />
              </Form.Item>
              <Form.Item name="zipCode" label={t.zipCode} style={{ width: 120 }}>
                <Input placeholder={t.zipCodePlaceholder} />
              </Form.Item>
            </div>

            <Form.Item name="website" label={t.website}>
              <Input placeholder={t.websitePlaceholder} prefix={<GlobalOutlined />} />
            </Form.Item>

            <Form.Item name="contactPerson" label={t.contactPerson}>
              <Input placeholder={t.contactPersonPlaceholder} />
            </Form.Item>

            <Form.Item name="foodType" label={t.foodType}>
              <Input placeholder={t.foodTypePlaceholder} />
            </Form.Item>

            <Form.Item name="posBrand" label={t.posBrand}>
              <Input placeholder={t.posBrandPlaceholder} />
            </Form.Item>

            <Form.Item name="needs" label={t.needs}>
              <TextArea rows={3} placeholder={t.needsPlaceholder} />
            </Form.Item>

            <Form.Item name="visitDate" label={t.visitDate}>
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item name="notes" label={t.notes}>
              <TextArea rows={2} placeholder={t.notesPlaceholder} />
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
              {t.submitBtn}
            </Button>

            <div style={{ textAlign: 'center', marginTop: 12 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {t.securityNote}
              </Text>
            </div>
          </Form>
        </Card>
      )}
    </div>
  )
}
