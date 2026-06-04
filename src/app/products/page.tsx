'use client'

import { useState, useEffect } from 'react'
import {
  Card, Typography, Table, Button, Modal, Form, Input, InputNumber,
  Select, Switch, message, Space, Popconfirm, Tag,
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import AppLayout from '@/components/Layout/AppLayout'

const { Title } = Typography

interface Product {
  id: number
  key: string
  name: string
  category: string | null
  active: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products')
      const data = await res.json()
      setProducts(data.products || [])
    } catch (err) {
      console.error(err)
      message.error('載入產品列表失敗')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchProducts() }, [])

  const handleSave = async (values: any) => {
    setSaving(true)
    try {
      const url = '/api/products'
      const method = editingProduct ? 'PATCH' : 'POST'
      const body = editingProduct ? { id: editingProduct.id, ...values } : values

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'Failed')
      }

      message.success(editingProduct ? '產品已更新' : '產品已創建')
      setModalOpen(false)
      form.resetFields()
      setEditingProduct(null)
      fetchProducts()
    } catch (err: any) {
      message.error(err.message || '操作失敗')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`/api/products?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
      message.success('產品已刪除')
      fetchProducts()
    } catch {
      message.error('刪除失敗')
    }
  }

  const columns = [
    {
      title: '排序',
      dataIndex: 'sortOrder',
      key: 'sortOrder',
      width: 80,
    },
    {
      title: '名稱',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: Product) => (
        <Space>
          <strong>{text}</strong>
          {!record.active && <Tag color="default">已停用</Tag>}
        </Space>
      ),
    },
    {
      title: 'Key',
      dataIndex: 'key',
      key: 'key',
      render: (text: string) => <code>{text}</code>,
    },
    {
      title: '分類',
      dataIndex: 'category',
      key: 'category',
      render: (v: string | null) => v ? <Tag>{v}</Tag> : '-',
    },
    {
      title: '啟用',
      dataIndex: 'active',
      key: 'active',
      width: 80,
      render: (v: boolean) => v ? <Tag color="green">啟用</Tag> : <Tag color="red">停用</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      render: (_: any, record: Product) => (
        <Space>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => {
              setEditingProduct(record)
              form.setFieldsValue(record)
              setModalOpen(true)
            }}
          />
          <Popconfirm
            title="確定刪除此產品？"
            description="此操作不可撤銷"
            onConfirm={() => handleDelete(record.id)}
            okText="確定"
            cancelText="取消"
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <AppLayout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>產品目錄管理</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => {
          setEditingProduct(null)
          form.resetFields()
          form.setFieldsValue({ active: true, sortOrder: 0 })
          setModalOpen(true)
        }}>
          新增產品
        </Button>
      </div>

      <Card>
        <Table
          dataSource={products}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={false}
        />
      </Card>

      <Modal
        title={editingProduct ? '編輯產品' : '新增產品'}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); setEditingProduct(null) }}
        onOk={() => form.submit()}
        confirmLoading={saving}
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item name="key" label="Key" rules={[{ required: true, message: '請輸入唯一 Key' }]}>
            <Input placeholder="例如: newProductStatus" disabled={!!editingProduct} />
          </Form.Item>
          <Form.Item name="name" label="名稱" rules={[{ required: true, message: '請輸入產品名稱' }]}>
            <Input placeholder="例如: 新產品" />
          </Form.Item>
          <Form.Item name="category" label="分類">
            <Select allowClear placeholder="選擇分類">
              <Select.Option value="CORE">CORE</Select.Option>
              <Select.Option value="ADDON">ADDON</Select.Option>
              <Select.Option value="SERVICE">SERVICE</Select.Option>
              <Select.Option value="HARDWARE">HARDWARE</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="sortOrder" label="排序">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="active" label="啟用" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </AppLayout>
  )
}
