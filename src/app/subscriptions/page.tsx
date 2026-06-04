'use client'

import { useState, useEffect } from 'react'
import {
  Card, Typography, Table, Tag, Space, Button, Modal, Form,
  Input, InputNumber, Select, DatePicker, message, Statistic, Row, Col,
} from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import AppLayout from '@/components/Layout/AppLayout'

const { Title } = Typography

const planLabels: Record<string, string> = { MONTHLY: '月繳', QUARTERLY: '季繳', SEMI_ANNUAL: '半年繳', ANNUAL: '年繳' }
const statusColors: Record<string, string> = {
  ACTIVE: 'green', CANCELLED: 'red', EXPIRED: 'orange',
  TRIALING: 'blue', PENDING_SIGNATURE: 'gold',
}
const statusLabels: Record<string, string> = {
  ACTIVE: '啟用中', CANCELLED: '已取消', EXPIRED: '已到期',
  TRIALING: '試用中', PENDING_SIGNATURE: '待簽約',
}

interface Subscription {
  id: number
  customer: { id: number; name: string }
  product: { id: number; name: string; key: string }
  plan: string
  billingType: string
  oneTimeAmount: number | null
  status: string
  mrr: number
  startDate: string
  endDate: string | null
  autoRenew: boolean
  salesPerson: { id: number; name: string } | null
}

export default function SubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)
  const [totalMrr, setTotalMrr] = useState(0)
  const [customers, setCustomers] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [billingType, setBillingType] = useState('RECURRING')

  const fetchSubscriptions = async () => {
    try {
      const res = await fetch('/api/subscriptions?pageSize=200')
      const data = await res.json()
      setSubscriptions(data.subscriptions || [])
      setTotalMrr(data.subscriptions?.reduce((sum: number, s: Subscription) => sum + (s.status === 'ACTIVE' ? s.mrr : 0), 0) || 0)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const fetchCustomers = async () => {
    try {
      const res = await fetch('/api/customers?pageSize=200')
      const data = await res.json()
      setCustomers(data.customers || [])
    } catch { /* ignore */ }
  }

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products')
      const data = await res.json()
      setProducts(data.products || [])
    } catch { /* ignore */ }
  }

  useEffect(() => { fetchSubscriptions() }, [])
  useEffect(() => { fetchCustomers(); fetchProducts() }, [])

  const handleSave = async (values: any) => {
    setSaving(true)
    try {
      const body = {
        ...values,
        billingType,
        startDate: values.startDate?.toISOString(),
        endDate: values.endDate?.toISOString(),
        trialEndDate: values.trialEndDate?.toISOString(),
      }
      const res = await fetch('/api/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Failed')
      message.success('訂閱已創建')
      setModalOpen(false)
      form.resetFields()
      fetchSubscriptions()
    } catch {
      message.error('創建失敗')
    } finally {
      setSaving(false)
    }
  }

  const columns = [
    {
      title: '客戶',
      dataIndex: ['customer', 'name'],
      key: 'customer',
      render: (name: string, record: Subscription) => (
        <a href={`/customers/${record.customer.id}`}>{name}</a>
      ),
    },
    {
      title: '產品',
      dataIndex: ['product', 'name'],
      key: 'product',
    },
    {
      title: '費用類型',
      key: 'billingType',
      width: 90,
      render: (_: any, record: Subscription) =>
        record.billingType === 'ONE_TIME'
          ? <Tag color="purple">一次性</Tag>
          : <Tag color="blue">{planLabels[record.plan] || record.plan}</Tag>,
    },
    {
      title: '金額',
      key: 'amount',
      width: 110,
      render: (_: any, record: Subscription) =>
        record.billingType === 'ONE_TIME'
          ? <span>${record.oneTimeAmount?.toLocaleString() || 0}</span>
          : <span>${record.mrr.toLocaleString()}/mo</span>,
    },
    {
      title: '狀態',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (v: string) => <Tag color={statusColors[v]}>{statusLabels[v] || v}</Tag>,
    },
    {
      title: '開始日期',
      dataIndex: 'startDate',
      key: 'startDate',
      width: 100,
      render: (v: string) => dayjs(v).format('YYYY-MM-DD'),
    },
    {
      title: '結束日期',
      dataIndex: 'endDate',
      key: 'endDate',
      width: 100,
      render: (v: string | null) => v ? dayjs(v).format('YYYY-MM-DD') : '-',
    },
    {
      title: '自動續約',
      dataIndex: 'autoRenew',
      key: 'autoRenew',
      width: 80,
      render: (v: boolean) => v ? <Tag color="green">是</Tag> : <Tag color="red">否</Tag>,
    },
    {
      title: '銷售',
      dataIndex: ['salesPerson', 'name'],
      key: 'salesPerson',
      width: 100,
      render: (v: string | null) => v || '-',
    },
  ]

  return (
    <AppLayout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>訂閱管理</Title>
        <Space>
          <Button onClick={() => window.location.href = '/subscriptions/expiring'}>
            即將到期
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => {
            form.resetFields()
            setBillingType('RECURRING')
            setModalOpen(true)
          }}>
            新增訂閱
          </Button>
        </Space>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic title="活躍訂閱" value={subscriptions.filter(s => s.status === 'ACTIVE').length} suffix={`/ ${subscriptions.length}`} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="月度 MRR" value={totalMrr} prefix="$" precision={0} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="平均 MRR" value={subscriptions.filter(s => s.status === 'ACTIVE').length > 0
              ? Math.round(totalMrr / subscriptions.filter(s => s.status === 'ACTIVE').length)
              : 0} prefix="$" />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="試用中" value={subscriptions.filter(s => s.status === 'TRIALING').length} />
          </Card>
        </Col>
      </Row>

      <Card>
        <Table
          dataSource={subscriptions}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `共 ${t} 條` }}
        />
      </Card>

      <Modal
        title="新增訂閱"
        open={modalOpen}
        onCancel={() => { setModalOpen(false); form.resetFields() }}
        onOk={() => form.submit()}
        confirmLoading={saving}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item name="customerId" label="客戶" rules={[{ required: true, message: '請選擇客戶' }]}>
            <Select
              showSearch
              placeholder="搜尋客戶名稱..."
              filterOption={(input, option) => (option?.label as string)?.toLowerCase().includes(input.toLowerCase())}
              options={customers.map(c => ({ label: `${c.name}${c.city ? ' (' + c.city + ')' : ''}`, value: c.id }))}
            />
          </Form.Item>
          <Form.Item name="productId" label="產品" rules={[{ required: true, message: '請選擇產品' }]}>
            <Select
              placeholder="選擇產品"
              options={products.map(p => ({ label: p.name, value: p.id }))}
            />
          </Form.Item>

          {/* Billing type toggle */}
          <Space style={{ marginBottom: 16 }}>
            <Button
              type={billingType === 'RECURRING' ? 'primary' : 'default'}
              onClick={() => setBillingType('RECURRING')}
            >
              訂閱制（週期付費）
            </Button>
            <Button
              type={billingType === 'ONE_TIME' ? 'primary' : 'default'}
              onClick={() => setBillingType('ONE_TIME')}
            >
              一次性付費
            </Button>
          </Space>

          {billingType === 'RECURRING' ? (
            <>
              <Form.Item name="plan" label="方案" initialValue="MONTHLY">
                <Select options={[
                  { label: '月繳', value: 'MONTHLY' },
                  { label: '季繳', value: 'QUARTERLY' },
                  { label: '半年繳', value: 'SEMI_ANNUAL' },
                  { label: '年繳', value: 'ANNUAL' },
                ]} />
              </Form.Item>
              <Form.Item name="mrr" label="MRR (USD/月)">
                <InputNumber min={0} step={10} style={{ width: '100%' }} placeholder="e.g. 499" />
              </Form.Item>
            </>
          ) : (
            <Form.Item name="oneTimeAmount" label="一次性金額 (USD)" rules={[{ required: true, message: '請輸入金額' }]}>
              <InputNumber min={0} step={100} style={{ width: '100%' }} placeholder="e.g. 5999" />
            </Form.Item>
          )}

          <Form.Item name="status" label="狀態" initialValue="ACTIVE">
            <Select options={[
              { label: '啟用中', value: 'ACTIVE' },
              { label: '試用中', value: 'TRIALING' },
              { label: '待簽約', value: 'PENDING_SIGNATURE' },
            ]} />
          </Form.Item>
          <Form.Item name="startDate" label="開始日期">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="endDate" label="結束日期">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          {billingType === 'RECURRING' && (
            <Form.Item name="autoRenew" label="自動續約" initialValue={true}>
              <Select options={[
                { label: '是', value: true },
                { label: '否', value: false },
              ]} />
            </Form.Item>
          )}
          <Form.Item name="notes" label="備註">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </AppLayout>
  )
}
