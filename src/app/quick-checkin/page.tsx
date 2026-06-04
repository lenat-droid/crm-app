'use client'

import { useState, useEffect } from 'react'
import {
  Card, Form, Select, DatePicker, Input, Button, Typography, message,
  Tag, Space, Divider, Alert, Spin, Row, Col,
} from 'antd'
import { SendOutlined, GlobalOutlined, ShareAltOutlined, CopyOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { qc, useLanguage } from '@/lib/i18n'

const { Title, Text } = Typography
const { TextArea } = Input

const productFields = [
  { key: 'smtStatus' },
  { key: 'psWebsiteStatus' },
  { key: 'aiCamStatus' },
  { key: 'posStatus' },
  { key: 'platformManagedStatus' },
  { key: 'omeStatus' },
  { key: 'smartRobotStatus' },
]

export default function QuickCheckinPage() {
  const { data: session, status: authStatus } = useSession()
  const router = useRouter()
  const { lang, setLang } = useLanguage()
  const t = qc[lang]
  const [form] = Form.useForm()
  const [customers, setCustomers] = useState<any[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null)
  const [searchText, setSearchText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [lastSubmitted, setLastSubmitted] = useState(false)
  const [customerLoading, setCustomerLoading] = useState(false)
  const [shareUrl, setShareUrl] = useState<string | null>(null)

  const interestOptions = t.interestOptions.map(v => ({
    label: t.interestLabels[v as keyof typeof t.interestLabels],
    value: v,
  }))

  // Fetch customers for selector
  const fetchCustomers = async (search?: string) => {
    setCustomerLoading(true)
    try {
      const params = new URLSearchParams({ pageSize: '50' })
      if (search) params.set('search', search)
      const res = await fetch(`/api/customers?${params}`)
      const data = await res.json()
      setCustomers(data.customers || [])
    } catch (err) {
      console.error(err)
    } finally {
      setCustomerLoading(false)
    }
  }

  useEffect(() => {
    fetchCustomers()
  }, [])

  // Redirect to login if not authenticated
  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      router.push('/login')
    }
  }, [authStatus, router])

  if (authStatus !== 'authenticated') {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" />
      </div>
    )
  }

  const handleCustomerSelect = async (customerId: number) => {
    setSelectedCustomer(null)
    try {
      const res = await fetch(`/api/customers/${customerId}`)
      const data = await res.json()
      setSelectedCustomer(data)
      form.setFieldsValue({
        smtStatus: data.smtStatus || 'NOT_CONTACTED',
        psWebsiteStatus: data.psWebsiteStatus || 'NOT_CONTACTED',
        aiCamStatus: data.aiCamStatus || 'NOT_CONTACTED',
        posStatus: data.posStatus || 'NOT_CONTACTED',
        platformManagedStatus: data.platformManagedStatus || 'NOT_CONTACTED',
        omeStatus: data.omeStatus || 'NOT_CONTACTED',
        smartRobotStatus: data.smartRobotStatus || 'NOT_CONTACTED',
        contactDate: dayjs(),
      })
    } catch {
      message.error(t.fetchError)
    }
  }

  const onFinish = async (values: any) => {
    if (!selectedCustomer) {
      message.warning(t.selectFirst)
      return
    }

    setSubmitting(true)
    try {
      if (values.record?.trim()) {
        await fetch('/api/pipelines', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerId: selectedCustomer.id,
            contactDate: values.contactDate.toISOString(),
            record: values.record,
          }),
        })
      }

      const interestUpdate: any = { id: selectedCustomer.id }
      let hasInterestChange = false
      for (const pf of productFields) {
        if (values[pf.key] && values[pf.key] !== selectedCustomer[pf.key]) {
          interestUpdate[pf.key] = values[pf.key]
          hasInterestChange = true
        }
      }
      if (hasInterestChange) {
        await fetch(`/api/customers/${selectedCustomer.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(interestUpdate),
        })
      }

      message.success(`✅ ${selectedCustomer.name} ${t.saveSuccess}`)
      setLastSubmitted(true)
      form.resetFields(['record'])
      setSelectedCustomer(null)
    } catch {
      message.error(t.saveFail)
    } finally {
      setSubmitting(false)
    }
  }

  const customerOptions = customers.map(c => ({
    label: `${c.name} ${c.city ? '(' + c.city + ')' : ''}`,
    value: c.id,
  }))

  const handleSearch = (val: string) => {
    setSearchText(val)
    fetchCustomers(val)
  }

  return (
    <div style={{
      maxWidth: 720,
      margin: '0 auto',
      padding: '16px',
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
        <Space style={{ position: 'absolute', top: 16, right: 24 }}>
          <Button
            size="small"
            icon={<ShareAltOutlined />}
            onClick={async () => {
              try {
                const res = await fetch('/api/me/share')
                const data = await res.json()
                await navigator.clipboard.writeText(data.shareUrl)
                message.success('分享連結已複製！可發送給業務人員')
              } catch {
                // Fallback: show the URL
                const res = await fetch('/api/me/share')
                const data = await res.json()
                setShareUrl(data.shareUrl)
                message.success('複製失敗，請手動複製下方連結')
              }
            }}
            style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff' }}
          >
            分享連結
          </Button>
          <Button
            size="small"
            icon={<GlobalOutlined />}
            onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
            style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff' }}
          >
            {lang === 'zh' ? 'EN' : '中'}
          </Button>
        </Space>
        <Title level={3} style={{ color: '#fff', margin: 0, marginBottom: 4 }}>
          📋 {t.title}
        </Title>
        <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14 }}>
          {t.subtitle}
        </Text>
        <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>
          {t.recordedBy}：{session?.user?.name}
        </div>
      </div>

      {shareUrl && (
        <Alert
          type="info"
          message="分享連結"
          description={shareUrl}
          showIcon
          closable
          style={{ marginBottom: 16 }}
          action={
            <Button size="small" onClick={() => {
              navigator.clipboard.writeText(shareUrl)
              message.success('已複製')
            }}>
              <CopyOutlined /> 複製
            </Button>
          }
        />
      )}

      {lastSubmitted && (
        <Alert
          type="success"
          message={t.saved}
          description={t.savedDesc}
          showIcon
          closable
          style={{ marginBottom: 16 }}
          action={
            <Button size="small" onClick={() => setLastSubmitted(false)}>
              {t.continueBtn}
            </Button>
          }
        />
      )}

      {/* Quick Stats */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col span={12}>
            <Text type="secondary">{t.todayDate}</Text>
            <div><strong>{dayjs().format('YYYY-MM-DD')}</strong></div>
          </Col>
          <Col span={12}>
            <Text type="secondary">{t.recordedBy}</Text>
            <div><strong>{session?.user?.name}</strong></div>
          </Col>
        </Row>
      </Card>

      <Card>
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          initialValues={{ contactDate: dayjs() }}
        >
          {/* Step 1: Select Customer */}
          <Form.Item label={<strong>{t.step1}</strong>} required>
            <Select
              showSearch
              placeholder={t.searchPlaceholder}
              options={customerOptions}
              onSearch={handleSearch}
              onSelect={(val: any) => handleCustomerSelect(val)}
              filterOption={false}
              loading={customerLoading}
              notFoundContent={customerLoading ? <Spin size="small" /> : t.noMatch}
              style={{ width: '100%' }}
              size="large"
              value={undefined}
            />
          </Form.Item>

          {selectedCustomer && (
            <>
              {/* Customer Info Card */}
              <Card size="small" style={{ marginBottom: 16, background: '#fafafa' }}>
                <Space direction="vertical" size={2}>
                  <Text strong style={{ fontSize: 16 }}>{selectedCustomer.name}</Text>
                  <Text type="secondary">
                    {[selectedCustomer.city, selectedCustomer.region, selectedCustomer.type].filter(Boolean).join(' | ')}
                  </Text>
                  {selectedCustomer.contactStatus && (
                    <Tag color={selectedCustomer.contactStatus === '合作中' ? 'green' : 'blue'}>
                      {selectedCustomer.contactStatus}
                    </Tag>
                  )}
                </Space>
              </Card>

              <Divider style={{ margin: '12px 0' }} />

              {/* Step 2: Communication Record */}
              <Form.Item label={<strong>{t.step2}</strong>}>
                <Form.Item name="contactDate" noStyle>
                  <DatePicker style={{ width: '100%', marginBottom: 8 }} />
                </Form.Item>
                <Form.Item name="record" noStyle>
                  <TextArea rows={3} placeholder={t.commPlaceholder} />
                </Form.Item>
              </Form.Item>

              <Divider style={{ margin: '12px 0' }} />

              {/* Step 3: Update Product Interest */}
              <Form.Item label={<strong>{t.step3}</strong>}>
                <Text type="secondary" style={{ display: 'block', marginBottom: 8, fontSize: 12 }}>
                  {t.step3Hint}
                </Text>
                <Row gutter={[8, 8]}>
                  {productFields.map(pf => (
                    <Col span={12} key={pf.key}>
                      <Form.Item
                        name={pf.key}
                        label={t.productLabels[pf.key as keyof typeof t.productLabels]}
                        style={{ marginBottom: 8 }}
                      >
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
                {t.saveBtn}
              </Button>
            </>
          )}
        </Form>
      </Card>

      {/* Tips */}
      <Card size="small" style={{ marginTop: 16, background: '#fafafa' }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          💡 {t.tips}{' '}
          <a onClick={() => router.push('/customers')}>{t.customerMgmt}</a>。
        </Text>
      </Card>

      {/* Bottom Nav */}
      <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
        <Button onClick={() => router.push('/dashboard')} size="small">
          {t.backToDashboard}
        </Button>
        <Button onClick={() => router.push('/kanban')} size="small">
          {t.viewKanban}
        </Button>
      </div>
    </div>
  )
}
