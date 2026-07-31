'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Typography, Tag, Button, Modal, Form, Input, DatePicker, Spin, Empty, Space, Segmented,
} from 'antd'
import { EditOutlined, ReloadOutlined, PhoneOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import AppLayout from '@/components/Layout/AppLayout'
import { toastSuccess, handleApiError } from '@/lib/toast'

const { Title, Text } = Typography

const RULE_META: Record<string, { label: string; color: string }> = {
  NEW_LEAD_STALE: { label: '新客未首聯', color: 'magenta' },
  INTENT_NO_REPLY: { label: '有意向無回音', color: 'orange' },
  DUE: { label: '今日跟進', color: 'blue' },
  SILENT: { label: '長期靜默', color: 'default' },
  WON_CHECKIN: { label: '成交回訪', color: 'green' },
}

const STATUS_COLORS: Record<string, string> = {
  '⚠️': 'red', '已建联': 'blue', '初步有意向': 'orange', '合作中': 'green',
}

interface FollowupItem {
  pipelineId: number
  customerId: number
  customerName: string
  status: string
  ownerId: number | null
  ownerName: string
  rules: string[]
  lastContactDate: string | null
  daysSinceContact: number | null
  nextFollowUpAt: string | null
  nextAction: string | null
  overdueDays: number
}

export default function TodayPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any>(null)
  const [filter, setFilter] = useState<string>('all')
  const [logTarget, setLogTarget] = useState<FollowupItem | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [form] = Form.useForm()

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/followups/due')
      setData(await res.json())
    } catch (err) {
      handleApiError(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const items: FollowupItem[] = data?.items || []
  const filtered = items.filter(i => {
    if (filter === 'all') return true
    if (filter === 'overdue') return i.overdueDays > 0
    return i.rules.includes(filter)
  })

  const openLog = (item: FollowupItem) => {
    setLogTarget(item)
    form.setFieldsValue({
      record: '',
      nextFollowUpAt: dayjs().add(3, 'day'),
      nextAction: item.nextAction || '',
    })
  }

  const submitLog = async () => {
    const values = await form.validateFields()
    if (!logTarget) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/customers/${logTarget.customerId}/followups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          record: values.record,
          nextFollowUpAt: values.nextFollowUpAt ? values.nextFollowUpAt.format('YYYY-MM-DD') : undefined,
          nextAction: values.nextAction || undefined,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || '提交失敗')
      }
      toastSuccess('已記錄，下次跟進已排上')
      setLogTarget(null)
      form.resetFields()
      fetchData()
    } catch (err) {
      handleApiError(err)
    } finally {
      setSubmitting(false)
    }
  }

  const s = data?.summary

  return (
    <AppLayout>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Title level={4} style={{ margin: 0 }}>今日跟進</Title>
          <Button icon={<ReloadOutlined />} onClick={fetchData} size="small">刷新</Button>
        </div>

        {s && (
          <Space size={[6, 6]} wrap style={{ marginBottom: 12 }}>
            <Tag color="blue">今日到期 {s.dueToday}</Tag>
            <Tag color="red">超期 {s.overdue}</Tag>
            <Tag color="magenta">未首聯 {s.newLeadStale}</Tag>
            <Tag>靜默 {s.silent}</Tag>
            <Tag color="green">待回訪 {s.wonCheckin}</Tag>
          </Space>
        )}

        <Segmented
          block
          value={filter}
          onChange={v => setFilter(v as string)}
          options={[
            { label: `全部 (${items.length})`, value: 'all' },
            { label: '超期', value: 'overdue' },
            { label: '今日', value: 'DUE' },
            { label: '未首聯', value: 'NEW_LEAD_STALE' },
            { label: '靜默', value: 'SILENT' },
          ]}
          style={{ marginBottom: 12 }}
        />

        {loading ? (
          <div style={{ textAlign: 'center', padding: 48 }}><Spin /></div>
        ) : filtered.length === 0 ? (
          <Empty description="沒有待跟進客戶 🎉" style={{ padding: 32 }} />
        ) : (
          filtered.map(item => (
            <div
              key={item.pipelineId}
              style={{
                border: '1px solid #f0f0f0',
                borderLeft: item.overdueDays > 0 ? '4px solid #ff4d4f' : '4px solid #1677ff',
                borderRadius: 8,
                padding: '12px 14px',
                marginBottom: 10,
                background: '#fff',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <a
                    onClick={() => router.push(`/customers/${item.customerId}`)}
                    style={{ fontSize: 15, fontWeight: 600 }}
                  >
                    {item.customerName}
                  </a>
                  <Tag color={STATUS_COLORS[item.status] || 'default'} style={{ marginLeft: 8 }}>
                    {item.status}
                  </Tag>
                </div>
                <Button
                  type="primary"
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => openLog(item)}
                >
                  記一筆
                </Button>
              </div>

              <div style={{ marginTop: 6 }}>
                <Space size={[4, 4]} wrap>
                  {item.rules.map(r => (
                    <Tag key={r} color={RULE_META[r]?.color}>{RULE_META[r]?.label || r}</Tag>
                  ))}
                  {item.overdueDays > 0 && <Tag color="red">超期 {item.overdueDays} 天</Tag>}
                </Space>
              </div>

              <div style={{ marginTop: 6, fontSize: 13, color: '#888' }}>
                <Space size={12} wrap>
                  <span><PhoneOutlined /> 最近聯繫：{item.lastContactDate || '從未'}
                    {item.daysSinceContact !== null && item.lastContactDate ? `（${item.daysSinceContact} 天前）` : ''}
                  </span>
                  {item.nextFollowUpAt && <span>下次：{item.nextFollowUpAt}</span>}
                  <span>負責人：{item.ownerName}</span>
                </Space>
              </div>

              {item.nextAction && (
                <div style={{ marginTop: 6, fontSize: 13 }}>
                  <Text type="secondary">待辦：</Text>{item.nextAction}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <Modal
        title={`記一筆 — ${logTarget?.customerName || ''}`}
        open={!!logTarget}
        onCancel={() => setLogTarget(null)}
        onOk={submitLog}
        confirmLoading={submitting}
        okText="提交"
        cancelText="取消"
      >
        <Form form={form} layout="vertical" style={{ marginTop: 8 }}>
          <Form.Item
            name="record"
            label="這次溝通了什麼"
            rules={[{ required: true, message: '請填寫溝通內容' }]}
          >
            <Input.TextArea rows={4} placeholder="例：和王老闆聊了 POS 換機，他關心費率，約好下週三帶報價再去" />
          </Form.Item>
          <Form.Item
            name="nextFollowUpAt"
            label="下次跟進日期"
            rules={[{ required: true, message: '每個客戶都要有下一步' }]}
          >
            <DatePicker style={{ width: '100%' }} inputReadOnly />
          </Form.Item>
          <Form.Item name="nextAction" label="下次要做什麼（可選）">
            <Input placeholder="例：帶報價單上門，重點講費率對比" maxLength={100} />
          </Form.Item>
        </Form>
      </Modal>
    </AppLayout>
  )
}
