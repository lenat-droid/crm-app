'use client'

import { useEffect, useState, useCallback } from 'react'
import { Alert, Button, Card, Descriptions, Form, Input, Select, Table, Typography } from 'antd'
import AppLayout from '@/components/Layout/AppLayout'
import { apiFetch, toastSuccess } from '@/lib/toast'

export default function LeadDetail({ params }: { params: { id: string } }) {
  const [lead, setLead] = useState<any>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()
  const load = useCallback(async () => {
    const [data, err] = await apiFetch(`/api/leads/${params.id}`)
    if (err) { setError(err); return }
    setLead(data); form.setFieldsValue({ status: data.status, notes: data.notes || '' })
  }, [params.id, form])
  useEffect(() => { load() }, [load])
  const save = async (values: any) => {
    setSaving(true)
    const [, err] = await apiFetch(`/api/leads/${params.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) })
    setSaving(false)
    if (!err) { toastSuccess('跟進已保存'); load() }
  }
  return <AppLayout>
    <Typography.Title level={3}>線索詳情及跟進</Typography.Title>
    {error && <Alert type="error" message={error} />}
    {lead && <>
      <Card><Descriptions column={2} bordered items={[
        { key: 'restaurant', label: '餐廳', children: lead.name },
        { key: 'source', label: '來源', children: lead.source || '—' },
        { key: 'name', label: '聯繫人', children: lead.contactPerson || '—' },
        { key: 'email', label: '郵箱', children: lead.email || '—' },
        { key: 'phone', label: '電話', children: lead.phone || '—' },
        { key: 'time', label: '提交時間', children: new Date(lead.submittedAt || lead.createdAt).toLocaleString() },
        { key: 'place', label: 'Place ID', children: lead.placeId || '—' },
        { key: 'report', label: 'Report ID', children: lead.reportId || '—' },
        { key: 'application', label: 'AIM 申請 ID', children: lead.aimApplicationId || '—' },
        { key: 'consent', label: '同意記錄', children: lead.consent ? `${lead.consent.statement} (${lead.consent.accepted_at}; ${lead.consent.version})` : '—' },
      ]} /></Card>
      {lead.aimApplicationId && <Card title="營運跟進" style={{ marginTop: 16 }}>
        <Form form={form} layout="vertical" onFinish={save}>
          <Form.Item name="status" label="狀態" rules={[{ required: true }]}><Select options={[{ value: 'new', label: '新線索' }, { value: 'contacted', label: '已聯繫' }, { value: 'closed', label: '已關閉' }]} /></Form.Item>
          <Form.Item name="notes" label="跟進備註"><Input.TextArea maxLength={5000} rows={3} /></Form.Item>
          <Button type="primary" htmlType="submit" loading={saving}>保存跟進</Button>
        </Form>
      </Card>}
      {lead.notification && <Card title="營運通知" style={{ marginTop: 16 }}>
        <p>狀態：{lead.notification.status} · 嘗試：{lead.notification.attempts} · 郵件服務接受時間：{lead.notification.sentAt || '—'}</p>
        <Table size="small" rowKey="id" pagination={false} dataSource={lead.notification.logs} columns={[{ title: '嘗試', dataIndex: 'attempt' }, { title: '結果', dataIndex: 'outcome' }, { title: '錯誤碼', dataIndex: 'errorCode' }, { title: '時間', dataIndex: 'createdAt' }]} />
      </Card>}
    </>}
  </AppLayout>
}
