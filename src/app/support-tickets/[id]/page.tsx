'use client'

import { useState, useEffect } from 'react'
import {
  Card, Typography, Tag, Button, Form, Input, message, Space,
  Spin, Breadcrumb, Descriptions, Rate, Divider,
} from 'antd'
import { useParams, useRouter } from 'next/navigation'
import dayjs from 'dayjs'
import AppLayout from '@/components/Layout/AppLayout'

const { Title, Text } = Typography

const statusColors: Record<string, string> = { OPEN: 'blue', RESOLVED: 'green', CLOSED: 'gray', PENDING: 'orange' }
const statusLabels: Record<string, string> = { OPEN: '開啟', RESOLVED: '已解決', CLOSED: '已關閉', PENDING: '待回覆' }
const priorityColors: Record<string, string> = { LOW: 'green', MEDIUM: 'blue', HIGH: 'orange', URGENT: 'red' }
const priorityLabels: Record<string, string> = { LOW: '低', MEDIUM: '中', HIGH: '高', URGENT: '緊急' }

interface Message {
  id: number
  content: string
  authorType: string
  isFromCustomer: boolean
  createdAt: string
}

interface Ticket {
  id: number
  subject: string
  status: string
  priority: string
  source: string | null
  csatScore: number | null
  createdAt: string
  resolvedAt: string | null
  customer: { id: number; name: string }
  assignedTo: { id: number; name: string } | null
  messages: Message[]
}

export default function TicketDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [loading, setLoading] = useState(true)
  const [messageForm] = Form.useForm()
  const [sending, setSending] = useState(false)

  const fetchTicket = async () => {
    try {
      const res = await fetch(`/api/support-tickets/${params.id}`)
      if (!res.ok) { router.push('/support-tickets'); return }
      const data = await res.json()
      setTicket(data.ticket || data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchTicket() }, [params.id])

  const handleAddMessage = async (values: { content: string }) => {
    setSending(true)
    try {
      const res = await fetch(`/api/support-tickets/${params.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      if (!res.ok) throw new Error('Failed')
      message.success('消息已添加')
      messageForm.resetFields()
      fetchTicket()
    } catch {
      message.error('發送失敗')
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <div style={{ display: 'flex', justifyContent: 'center', padding: 100 }}><Spin size="large" /></div>
      </AppLayout>
    )
  }

  if (!ticket) return null

  return (
    <AppLayout>
      <Breadcrumb
        items={[
          { title: <a onClick={() => router.push('/support-tickets')}>客服工單</a> },
          { title: `#${ticket.id}` },
        ]}
        style={{ marginBottom: 16 }}
      />

      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <Title level={4} style={{ margin: 0 }}>{ticket.subject}</Title>
            <Space style={{ marginTop: 8 }}>
              <Tag color={statusColors[ticket.status]}>{statusLabels[ticket.status]}</Tag>
              <Tag color={priorityColors[ticket.priority]}>{priorityLabels[ticket.priority]}</Tag>
              <Text type="secondary">#{ticket.id}</Text>
            </Space>
          </div>
          {ticket.csatScore && <Rate disabled value={ticket.csatScore} count={5} />}
        </div>

        <Descriptions size="small" column={2} style={{ marginTop: 16 }}>
          <Descriptions.Item label="客戶">
            <a onClick={() => router.push(`/customers/${ticket.customer.id}`)}>{ticket.customer.name}</a>
          </Descriptions.Item>
          <Descriptions.Item label="負責人">{ticket.assignedTo?.name || '-'}</Descriptions.Item>
          <Descriptions.Item label="來源">{ticket.source || '-'}</Descriptions.Item>
          <Descriptions.Item label="創建時間">{dayjs(ticket.createdAt).format('YYYY-MM-DD HH:mm')}</Descriptions.Item>
          {ticket.resolvedAt && (
            <Descriptions.Item label="解決時間">{dayjs(ticket.resolvedAt).format('YYYY-MM-DD HH:mm')}</Descriptions.Item>
          )}
        </Descriptions>
      </Card>

      <Divider orientation="left">對話記錄</Divider>

      <Card style={{ marginBottom: 16 }}>
        {ticket.messages && ticket.messages.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {ticket.messages.map((msg) => (
              <div
                key={msg.id}
                style={{
                  padding: '12px 16px',
                  borderRadius: 8,
                  backgroundColor: msg.isFromCustomer ? '#f0f5ff' : '#f6f6f6',
                  border: '1px solid #e8e8e8',
                  maxWidth: '80%',
                  alignSelf: msg.isFromCustomer ? 'flex-start' : 'flex-end',
                }}
              >
                <div style={{ marginBottom: 4 }}>
                  <Text strong style={{ fontSize: 12 }}>
                    {msg.isFromCustomer ? '客戶' : msg.authorType === 'SYSTEM' ? '系統' : '客服'}
                  </Text>
                  <Text type="secondary" style={{ fontSize: 11, marginLeft: 8 }}>
                    {dayjs(msg.createdAt).format('MM-DD HH:mm')}
                  </Text>
                </div>
                <Text>{msg.content}</Text>
              </div>
            ))}
          </div>
        ) : (
          <Text type="secondary">暫無消息記錄</Text>
        )}

        <Divider />

        <Form form={messageForm} layout="inline" onFinish={handleAddMessage} style={{ width: '100%' }}>
          <Form.Item name="content" rules={[{ required: true, message: '請輸入消息' }]} style={{ flex: 1 }}>
            <Input.TextArea rows={2} placeholder="輸入回覆..." />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={sending}>發送</Button>
          </Form.Item>
        </Form>
      </Card>
    </AppLayout>
  )
}
