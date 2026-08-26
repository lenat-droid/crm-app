'use client'

import { useState } from 'react'
import { Card, Typography, Form, Input, Button, message, Breadcrumb, DatePicker } from 'antd'
import { GlobalOutlined } from '@ant-design/icons'
import { useRouter } from 'next/navigation'
import dayjs from 'dayjs'
import AppLayout from '@/components/Layout/AppLayout'
import RecordTypeNav from '@/components/RecordTypeNav'
import { lc, useLanguage } from '@/lib/i18n'

const { Title } = Typography
const { TextArea } = Input

export default function NewLeadPage() {
  const router = useRouter()
  const { lang, setLang } = useLanguage()
  const t = lc[lang]
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
      message.success(t.successMsg(data.customer.name))
      router.push('/kanban')
    } catch {
      message.error(t.failMsg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppLayout>
      <Breadcrumb
        items={[
          { title: <a onClick={() => router.push('/records')}>{t.breadcrumb}</a> },
          { title: t.title },
        ]}
        style={{ marginBottom: 16 }}
      />
      <RecordTypeNav active="lead" />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>{t.title}</Title>
        <Button
          size="small"
          icon={<GlobalOutlined />}
          onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
          style={{ fontSize: 12 }}
        >
          {lang === 'zh' ? 'EN' : '中'}
        </Button>
      </div>

      <Card style={{ maxWidth: 600 }}>
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item name="name" label={t.merchantName} rules={[{ required: true }]}>
            <Input placeholder={t.merchantNamePlaceholder} />
          </Form.Item>

          <Form.Item name="phone" label={t.phone}>
            <Input placeholder={t.phonePlaceholder} />
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

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading}>
              {t.submitBtn}
            </Button>
            <Button style={{ marginLeft: 8 }} onClick={() => router.push('/kanban')}>
              {t.cancelBtn}
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </AppLayout>
  )
}
