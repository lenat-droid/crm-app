'use client'

import { useState, useEffect } from 'react'
import { Card, Typography, Form, Input, DatePicker, Select, Button, message, Breadcrumb } from 'antd'
import { useRouter } from 'next/navigation'
import dayjs from 'dayjs'
import AppLayout from '@/components/Layout/AppLayout'
import RecordTypeNav from '@/components/RecordTypeNav'
import { vr, useLanguage } from '@/lib/i18n'

const { Title } = Typography
const { TextArea } = Input

export default function NewVisitPage() {
  const router = useRouter()
  const { lang } = useLanguage()
  const t = vr[lang]
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [customers, setCustomers] = useState<any[]>([])
  const [customerSearch, setCustomerSearch] = useState('')

  useEffect(() => {
    fetch('/api/customers?pageSize=100')
      .then(res => res.json())
      .then(data => setCustomers(data.customers || []))
      .catch(console.error)
  }, [])

  const customerOptions = customers
    .filter(c => !customerSearch || c.name.toLowerCase().includes(customerSearch.toLowerCase()))
    .map(c => ({ label: `${c.name} (${c.city || '-'})`, value: c.id }))

  const onFinish = async (values: any) => {
    setLoading(true)
    try {
      const res = await fetch('/api/visits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: values.customerId,
          visitDate: values.visitDate.toISOString(),
          outcome: values.outcome,
          notes: values.notes,
        }),
      })
      if (!res.ok) throw new Error('Failed')
      message.success(t.saved)
      router.push(`/visits?lang=${lang}`)
    } catch {
      message.error(t.failed)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppLayout>
      <Breadcrumb
        items={[
          { title: <a onClick={() => router.push('/records')}>記錄總覽</a> },
          { title: t.newVisit },
        ]}
        style={{ marginBottom: 16 }}
      />
      <RecordTypeNav active="visit" />
      <Title level={4} style={{ marginBottom: 24 }}>{t.newVisitTitle}</Title>

      <Card style={{ maxWidth: 600 }}>
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item name="customerId" label={t.customer} rules={[{ required: true, message: t.pleaseSelect }]}>
            <Select
              showSearch
              placeholder={t.selectCustomer}
              options={customerOptions}
              onSearch={setCustomerSearch}
              filterOption={false}
            />
          </Form.Item>

          <Form.Item name="visitDate" label={t.visitDate} rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="outcome" label={t.visitResult}>
            <Select options={t.outcomeOptions} />
          </Form.Item>

          <Form.Item name="notes" label={t.notes}>
            <TextArea rows={4} placeholder={t.notesPlaceholder} />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading}>
              {t.save}
            </Button>
            <Button style={{ marginLeft: 8 }} onClick={() => router.push(`/visits?lang=${lang}`)}>
              {t.cancel}
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </AppLayout>
  )
}
