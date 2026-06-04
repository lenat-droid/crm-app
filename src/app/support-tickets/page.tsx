'use client'

import { useState, useEffect } from 'react'
import {
  Card, Typography, Table, Tag, Button, Modal, Form, Input,
  InputNumber, Select, message, Space, Row, Col, Statistic, Rate,
} from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import AppLayout from '@/components/Layout/AppLayout'

const { Title } = Typography

const statusColors: Record<string, string> = { OPEN: 'blue', RESOLVED: 'green', CLOSED: 'gray', PENDING: 'orange' }
const statusLabels: Record<string, string> = { OPEN: '開啟', RESOLVED: '已解決', CLOSED: '已關閉', PENDING: '待回覆' }
const priorityColors: Record<string, string> = { LOW: 'green', MEDIUM: 'blue', HIGH: 'orange', URGENT: 'red' }
const priorityLabels: Record<string, string> = { LOW: '低', MEDIUM: '中', HIGH: '高', URGENT: '緊急' }

export default function SupportTicketsPage() {
  const [tickets, setTickets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingTicket, setEditingTicket] = useState<any>(null)
  const [form] = Form.useForm()
  const [editForm] = Form.useForm()
  const [saving, setSaving] = useState(false)

  const fetchTickets = async () => {
    try {
      const res = await fetch('/api/support-tickets?pageSize=200')
      const data = await res.json()
      setTickets(data.tickets || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchTickets() }, [])

  const handleCreate = async (values: any) => {
    setSaving(true)
    try {
      const res = await fetch('/api/support-tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      if (!res.ok) throw new Error('Failed')
      message.success('工單已創建')
      setModalOpen(false)
      form.resetFields()
      fetchTickets()
    } catch {
      message.error('創建失敗')
    } finally {
      setSaving(false)
    }
  }

  const handleUpdate = async (values: any) => {
    setSaving(true)
    try {
      const res = await fetch('/api/support-tickets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingTicket.id, ...values }),
      })
      if (!res.ok) throw new Error('Failed')
      message.success('工單已更新')
      setEditModalOpen(false)
      setEditingTicket(null)
      fetchTickets()
    } catch {
      message.error('更新失敗')
    } finally {
      setSaving(false)
    }
  }

  const openTickets = tickets.filter(t => t.status === 'OPEN' || t.status === 'PENDING')
  const urgentCount = tickets.filter(t => t.priority === 'URGENT' && t.status !== 'CLOSED').length

  const columns = [
    {
      title: '主題',
      dataIndex: 'subject',
      key: 'subject',
      render: (text: string, record: any) => (
        <a href={`/support-tickets/${record.id}`}>{text}</a>
      ),
    },
    {
      title: '客戶',
      dataIndex: ['customer', 'name'],
      key: 'customer',
      render: (name: string, record: any) => (
        <a href={`/customers/${record.customer.id}`}>{name}</a>
      ),
    },
    {
      title: '狀態',
      dataIndex: 'status',
      key: 'status',
      render: (v: string) => <Tag color={statusColors[v]}>{statusLabels[v] || v}</Tag>,
    },
    {
      title: '優先級',
      dataIndex: 'priority',
      key: 'priority',
      render: (v: string) => <Tag color={priorityColors[v]}>{priorityLabels[v] || v}</Tag>,
    },
    {
      title: '消息',
      key: 'messages',
      render: (_: any, record: any) => record._count?.messages || 0,
    },
    {
      title: 'CSAT',
      dataIndex: 'csatScore',
      key: 'csatScore',
      render: (v: number | null) => v ? <Rate disabled value={v} count={5} /> : '-',
    },
    {
      title: '負責人',
      dataIndex: ['assignedTo', 'name'],
      key: 'assignedTo',
      render: (v: string | null) => v || '-',
    },
    {
      title: '創建時間',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (v: string) => dayjs(v).format('MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: any) => (
        <Button size="small" onClick={() => {
          setEditingTicket(record)
          editForm.setFieldsValue(record)
          setEditModalOpen(true)
        }}>
          更新狀態
        </Button>
      ),
    },
  ]

  return (
    <AppLayout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>客服工單</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => {
          form.resetFields()
          setModalOpen(true)
        }}>
          創建工單
        </Button>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic title="待處理" value={openTickets.length} valueStyle={{ color: openTickets.length > 0 ? '#faad14' : undefined }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="緊急" value={urgentCount} valueStyle={{ color: urgentCount > 0 ? '#ff4d4f' : undefined }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="已解決" value={tickets.filter(t => t.status === 'RESOLVED').length} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="總計" value={tickets.length} />
          </Card>
        </Col>
      </Row>

      <Card>
        <Table
          dataSource={tickets}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `共 ${t} 條` }}
        />
      </Card>

      {/* Create Modal */}
      <Modal
        title="創建工單"
        open={modalOpen}
        onCancel={() => { setModalOpen(false); form.resetFields() }}
        onOk={() => form.submit()}
        confirmLoading={saving}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="customerId" label="客戶 ID" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} min={1} />
          </Form.Item>
          <Form.Item name="subject" label="主題" rules={[{ required: true }]}>
            <Input placeholder="簡述問題" />
          </Form.Item>
          <Form.Item name="priority" label="優先級" initialValue="MEDIUM">
            <Select options={[
              { label: '低', value: 'LOW' },
              { label: '中', value: 'MEDIUM' },
              { label: '高', value: 'HIGH' },
              { label: '緊急', value: 'URGENT' },
            ]} />
          </Form.Item>
          <Form.Item name="assignedToId" label="指派給 (用戶 ID)">
            <InputNumber style={{ width: '100%' }} min={1} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Update Status Modal */}
      <Modal
        title="更新工單狀態"
        open={editModalOpen}
        onCancel={() => { setEditModalOpen(false); setEditingTicket(null) }}
        onOk={() => editForm.submit()}
        confirmLoading={saving}
      >
        <Form form={editForm} layout="vertical" onFinish={handleUpdate}>
          <Form.Item name="status" label="狀態" rules={[{ required: true }]}>
            <Select options={[
              { label: '開啟', value: 'OPEN' },
              { label: '待回覆', value: 'PENDING' },
              { label: '已解決', value: 'RESOLVED' },
              { label: '已關閉', value: 'CLOSED' },
            ]} />
          </Form.Item>
          <Form.Item name="priority" label="優先級">
            <Select options={[
              { label: '低', value: 'LOW' },
              { label: '中', value: 'MEDIUM' },
              { label: '高', value: 'HIGH' },
              { label: '緊急', value: 'URGENT' },
            ]} />
          </Form.Item>
          <Form.Item name="assignedToId" label="指派給 (用戶 ID)">
            <InputNumber style={{ width: '100%' }} min={1} />
          </Form.Item>
          <Form.Item name="csatScore" label="CSAT 評分">
            <Rate count={5} />
          </Form.Item>
        </Form>
      </Modal>
    </AppLayout>
  )
}
