'use client'

import { useState, useEffect } from 'react'
import {
  Card, Typography, Table, Tag, Button, Modal, Form, Input,
  Switch, message, Space, Popconfirm, Row, Col, Statistic,
} from 'antd'
import { PlusOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons'
import { useSession } from 'next-auth/react'
import AppLayout from '@/components/Layout/AppLayout'

const { Title } = Typography

interface Segment {
  id: number
  name: string
  description: string | null
  isDynamic: boolean
  customerCount: number
  createdBy: { id: number; name: string } | null
  createdAt: string
}

export default function SegmentsPage() {
  const { data: session } = useSession()
  const [segments, setSegments] = useState<Segment[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingSegment, setEditingSegment] = useState<Segment | null>(null)
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)
  const canManageSegments = session?.user?.role !== 'SALES'

  const fetchSegments = async () => {
    try {
      const res = await fetch('/api/segments')
      const data = await res.json()
      setSegments(data.segments || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchSegments() }, [])

  const handleSave = async (values: any) => {
    setSaving(true)
    try {
      const url = '/api/segments'
      const method = editingSegment ? 'PATCH' : 'POST'
      const body = editingSegment ? { id: editingSegment.id, ...values } : values

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) throw new Error('Failed')
      message.success(editingSegment ? '分群已更新' : '分群已創建')
      setModalOpen(false)
      form.resetFields()
      setEditingSegment(null)
      fetchSegments()
    } catch {
      message.error('操作失敗')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await fetch(`/api/segments?id=${id}`, { method: 'DELETE' })
      message.success('分群已刪除')
      fetchSegments()
    } catch {
      message.error('刪除失敗')
    }
  }

  const columns = [
    {
      title: '名稱',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: Segment) => (
        <a href={`/segments/${record.id}`}>{text}</a>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      render: (v: string | null) => v || '-',
    },
    {
      title: '類型',
      dataIndex: 'isDynamic',
      key: 'isDynamic',
      render: (v: boolean) => v ? <Tag color="blue">動態</Tag> : <Tag>靜態</Tag>,
    },
    {
      title: '客戶數',
      dataIndex: 'customerCount',
      key: 'customerCount',
      sorter: (a: any, b: any) => a.customerCount - b.customerCount,
    },
    {
      title: '創建人',
      dataIndex: ['createdBy', 'name'],
      key: 'createdBy',
      render: (v: string | null) => v || '-',
    },
    ...(canManageSegments ? [{
      title: '操作',
      key: 'action',
      render: (_: any, record: Segment) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => {
            setEditingSegment(record)
            form.setFieldsValue(record)
            setModalOpen(true)
          }} />
          <Popconfirm title="確定刪除此分群？" onConfirm={() => handleDelete(record.id)} okText="確定" cancelText="取消">
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    }] : []),
  ]

  return (
    <AppLayout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>客戶分群管理</Title>
        {canManageSegments && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => {
            setEditingSegment(null)
            form.resetFields()
            form.setFieldsValue({ isDynamic: true })
            setModalOpen(true)
          }}>
            新增分群
          </Button>
        )}
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card size="small">
            <Statistic title="分群總數" value={segments.length} />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small">
            <Statistic title="動態分群" value={segments.filter(s => s.isDynamic).length} />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small">
            <Statistic title="總覆蓋客戶" value={segments.reduce((sum, s) => sum + s.customerCount, 0)} />
          </Card>
        </Col>
      </Row>

      <Card>
        <Table
          dataSource={segments}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={false}
        />
      </Card>

      <Modal
        title={editingSegment ? '編輯分群' : '新增分群'}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); setEditingSegment(null) }}
        onOk={() => form.submit()}
        confirmLoading={saving}
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item name="name" label="名稱" rules={[{ required: true }]}>
            <Input placeholder="例如: 高價值客戶" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} placeholder="分群描述" />
          </Form.Item>
          <Form.Item name="isDynamic" label="動態分群" valuePropName="checked">
            <Switch checkedChildren="動態" unCheckedChildren="靜態" />
          </Form.Item>
          <Form.Item name="customerCount" label="客戶數">
            <Input type="number" min={0} />
          </Form.Item>
        </Form>
      </Modal>
    </AppLayout>
  )
}
