'use client'

import { useState, useEffect } from 'react'
import { Table, Card, Button, Input, Select, Space, Tag, Typography, Modal, Form, Popconfirm, Tooltip } from 'antd'
import { PlusOutlined, SearchOutlined, ReloadOutlined, FilterOutlined } from '@ant-design/icons'
import { useRouter } from 'next/navigation'
import AppLayout from '@/components/Layout/AppLayout'
import { toastSuccess, handleApiError } from '@/lib/toast'

const { Title } = Typography

const interestColors: Record<string, string> = {
  NOT_CONTACTED: '#d9d9d9',
  NOT_INTERESTED: '#ff4d4f',
  AWARE: '#faad14',
  INTERESTED: '#1890ff',
  HIGH_INTENT: '#722ed1',
  PURCHASED: '#52c41a',
}

const interestLabels: Record<string, string> = {
  NOT_CONTACTED: '未接觸',
  NOT_INTERESTED: '無興趣',
  AWARE: '已了解',
  INTERESTED: '感興趣',
  HIGH_INTENT: '高意向',
  PURCHASED: '已購買',
}

export default function CustomersPage() {
  const router = useRouter()
  const [customers, setCustomers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [search, setSearch] = useState('')
  const [region, setRegion] = useState<string>()
  const [statusFilter, setStatusFilter] = useState<string>()
  const [customerStatusFilter, setCustomerStatusFilter] = useState<string>()
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [createForm] = Form.useForm()
  const [creating, setCreating] = useState(false)

  const fetchCustomers = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
      if (search) params.set('search', search)
      if (region) params.set('region', region)
      if (statusFilter) params.set('status', statusFilter)
      if (customerStatusFilter) params.set('customerStatus', customerStatusFilter)

      const res = await fetch(`/api/customers?${params}`)
      const data = await res.json()
      setCustomers(data.customers || [])
      setTotal(data.total || 0)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateCustomer = async (values: any) => {
    setCreating(true)
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      if (!res.ok) throw new Error('Failed')
      toastSuccess('客戶創建成功')
      setCreateModalOpen(false)
      createForm.resetFields()
      fetchCustomers()
    } catch (err) {
      handleApiError(err, '創建失敗')
    } finally {
      setCreating(false)
    }
  }

  const handleArchive = async (customerId: number, archive: boolean) => {
    try {
      const res = await fetch(`/api/customers/${customerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: archive ? 'ARCHIVED' : 'ACTIVE' }),
      })
      if (!res.ok) throw new Error('Failed')
      toastSuccess(archive ? '客戶已歸檔（soft-delete）' : '客戶已恢復')
      fetchCustomers()
    } catch (err) {
      handleApiError(err, '操作失敗')
    }
  }

  useEffect(() => {
    fetchCustomers()
  }, [page, pageSize, region, statusFilter, customerStatusFilter])

  /** Highlight search keyword in text */
  const highlightText = (text: string | null | undefined) => {
    if (!text || !search) return text || '-'
    const regex = new RegExp(`(${search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
    const parts = text.split(regex)
    return parts.map((part, i) =>
      regex.test(part)
        ? <span key={i} style={{ backgroundColor: '#fffbe6', color: '#faad14', fontWeight: 600, padding: '0 1px', borderRadius: 2 }}>{part}</span>
        : part
    )
  }

  const columns = [
    {
      title: '客戶名稱',
      dataIndex: 'name',
      key: 'name',
      width: 220,
      sorter: (a: any, b: any) => a.name.localeCompare(b.name),
      render: (name: string, record: any) => (
        <a onClick={() => router.push(`/customers/${record.id}`)}>{highlightText(name)}</a>
      ),
    },
    {
      title: '城市',
      dataIndex: 'city',
      key: 'city',
      width: 100,
      render: (city: string) => highlightText(city),
    },
    { title: '城市', dataIndex: 'city', key: 'city', width: 100 },
    { title: '區域', dataIndex: 'region', key: 'region', width: 130 },
    { title: '類別', dataIndex: 'type', key: 'type', width: 80 },
    { title: '店鋪類型', dataIndex: 'storeType', key: 'storeType', width: 80 },
    {
      title: '跟進人',
      key: 'follower',
      width: 100,
      render: (_: any, record: any) => record.follower?.name || '-',
    },
    {
      title: '產品興趣',
      key: 'products',
      width: 300,
      render: (_: any, record: any) => (
        <Space size={2} wrap>
          {[
            { key: 'SMT', field: 'smtStatus' },
            { key: 'PS', field: 'psWebsiteStatus' },
            { key: 'AI Cam', field: 'aiCamStatus' },
            { key: 'POS', field: 'posStatus' },
          ].map(p => {
            const interest = record[p.field]
            return (
              <Tag key={p.key} color={interestColors[interest]} style={{ fontSize: 11, margin: 1 }}>
                {p.key}: {interestLabels[interest]}
              </Tag>
            )
          })}
        </Space>
      ),
    },
    {
      title: '接觸狀態',
      dataIndex: 'contactStatus',
      key: 'contactStatus',
      width: 100,
      render: (val: string) => val ? <Tag color="blue">{val}</Tag> : '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: any, record: any) => (
        <Space size={0}>
          <a onClick={() => router.push(`/customers/${record.id}`)}>詳情</a>
          {record.status !== 'ARCHIVED' ? (
            <Popconfirm
              title="確認歸檔此客戶？"
              description="客戶將從列表中隱藏，可在「已歸檔」篩選中找回"
              onConfirm={() => handleArchive(record.id, true)}
              okText="確認歸檔"
              cancelText="取消"
            >
              <a style={{ marginLeft: 8, color: '#999' }}>歸檔</a>
            </Popconfirm>
          ) : (
            <Popconfirm
              title="確認恢復此客戶？"
              onConfirm={() => handleArchive(record.id, false)}
              okText="確認恢復"
              cancelText="取消"
            >
              <a style={{ marginLeft: 8, color: '#52c41a' }}>恢復</a>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  return (
    <AppLayout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>客户管理</Title>
        <Space>
          <Input
            placeholder="搜索客戶名稱/城市/電話"
            prefix={<SearchOutlined />}
            value={search}
            onChange={e => setSearch(e.target.value)}
            onPressEnter={() => { setPage(1); fetchCustomers() }}
            style={{ width: 260 }}
            allowClear
          />
          <Select
            placeholder="按區域篩選"
            allowClear
            style={{ width: 150 }}
            value={region}
            onChange={val => { setRegion(val); setPage(1) }}
            options={[
              { label: 'LA EAST', value: 'LA EAST' },
              { label: 'LA DOWNTOWN', value: 'LA DOWNTOWN' },
              { label: 'LA WEST', value: 'LA WEST' },
              { label: 'ORANGE COUNTY', value: 'ORANGE COUNTY' },
              { label: 'WESTERN INLAND EMPIRE', value: 'WESTERN INLAND EMPIRE' },
              { label: 'SOUTH BAY', value: 'SOUTH BAY' },
              { label: 'OUT OF CALIFORNIA', value: 'OUT OF CALIFORNIA' },
            ]}
          />
          <Select
            placeholder="按接觸狀態"
            allowClear
            style={{ width: 130 }}
            value={statusFilter}
            onChange={val => { setStatusFilter(val); setPage(1) }}
            options={[
              { label: '合作中', value: '合作中' },
              { label: '已建联', value: '已建联' },
              { label: '已流失', value: '已流失' },
            ]}
          />
          <Select
            placeholder="客戶狀態"
            allowClear
            style={{ width: 120 }}
            value={customerStatusFilter}
            onChange={val => { setCustomerStatusFilter(val); setPage(1) }}
            options={[
              { label: '活躍', value: 'ACTIVE' },
              { label: '已歸檔', value: 'ARCHIVED' },
              { label: '全部（含歸檔）', value: 'ALL' },
            ]}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
            新建客户
          </Button>
          <Button icon={<ReloadOutlined />} onClick={() => { setPage(1); fetchCustomers() }} />
        </Space>
      </div>

      <Card>
        <Table
          dataSource={customers}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showTotal: (t) => `共 ${t} 條`,
            onChange: (p, ps) => { setPage(p); setPageSize(ps) },
          }}
          scroll={{ x: 1100 }}
          size="middle"
        />
      </Card>

      {/* Create Customer Modal */}
      <Modal
        title="新建客戶"
        open={createModalOpen}
        onCancel={() => { setCreateModalOpen(false); createForm.resetFields() }}
        onOk={() => createForm.submit()}
        confirmLoading={creating}
        okText="創建"
        cancelText="取消"
        width={600}
      >
        <Form
          form={createForm}
          layout="vertical"
          onFinish={handleCreateCustomer}
          style={{ marginTop: 16 }}
        >
          <Form.Item name="name" label="客戶名稱" rules={[{ required: true, message: '請輸入客戶名稱' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="storePhone" label="電話">
            <Input />
          </Form.Item>
          <Form.Item name="city" label="城市">
            <Input />
          </Form.Item>
          <Form.Item name="region" label="區域">
            <Select
              allowClear
              options={[
                { label: 'LA EAST', value: 'LA EAST' },
                { label: 'LA DOWNTOWN', value: 'LA DOWNTOWN' },
                { label: 'LA WEST', value: 'LA WEST' },
                { label: 'ORANGE COUNTY', value: 'ORANGE COUNTY' },
                { label: 'WESTERN INLAND EMPIRE', value: 'WESTERN INLAND EMPIRE' },
                { label: 'SOUTH BAY', value: 'SOUTH BAY' },
                { label: 'OUT OF CALIFORNIA', value: 'OUT OF CALIFORNIA' },
              ]}
            />
          </Form.Item>
          <Form.Item name="type" label="類別">
            <Select
              allowClear
              options={[
                { label: '茶餐廳', value: '茶餐廳' },
                { label: '正餐', value: '正餐' },
                { label: '酒樓', value: '酒樓' },
                { label: '火鍋', value: '火鍋' },
                { label: '快餐', value: '快餐' },
                { label: '其他', value: '其他' },
              ]}
            />
          </Form.Item>
          <Form.Item name="storeType" label="店鋪類型">
            <Select
              allowClear
              options={[
                { label: '單店', value: '單店' },
                { label: '連鎖', value: '連鎖' },
              ]}
            />
          </Form.Item>
          <Form.Item name="contactStatus" label="接觸狀態">
            <Select
              allowClear
              options={[
                { label: '合作中', value: '合作中' },
                { label: '已建联', value: '已建联' },
              ]}
            />
          </Form.Item>
          <Form.Item name="notes" label="備註">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </AppLayout>
  )
}
