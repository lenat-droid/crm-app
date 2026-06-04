'use client'

import { useState, useEffect } from 'react'
import { Card, Typography, Table, Tag, Button, Modal, Form, Input, Select, message, Space, Switch, Popconfirm } from 'antd'
import { PlusOutlined, LinkOutlined, CopyOutlined } from '@ant-design/icons'
import AppLayout from '@/components/Layout/AppLayout'

const { Title } = Typography

export default function AdminUsersPage() {
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<any>(null)
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users')
      const data = await res.json()
      setUsers(data.users || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchUsers() }, [])

  const handleSave = async (values: any) => {
    setSaving(true)
    try {
      const url = '/api/users'
      const method = editingUser ? 'PATCH' : 'POST'
      const body = editingUser ? { id: editingUser.id, ...values } : values

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) throw new Error('Failed')
      message.success(editingUser ? '用戶已更新' : '用戶已創建')
      setModalOpen(false)
      form.resetFields()
      setEditingUser(null)
      fetchUsers()
    } catch {
      message.error('操作失敗')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (userId: number, active: boolean) => {
    try {
      await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: userId, active }),
      })
      message.success(active ? '用戶已啟用' : '用戶已禁用')
      fetchUsers()
    } catch {
      message.error('操作失敗')
    }
  }

  const columns = [
    { title: '姓名', dataIndex: 'name', key: 'name' },
    { title: '郵箱', dataIndex: 'email', key: 'email' },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      render: (role: string) => {
        const colorMap: Record<string, string> = { ADMIN: 'red', SALES_MGR: 'orange', SALES: 'blue' }
        const labelMap: Record<string, string> = { ADMIN: '管理員', SALES_MGR: '銷售主管', SALES: '銷售' }
        return <Tag color={colorMap[role] || 'blue'}>{labelMap[role] || role}</Tag>
      },
    },
    { title: '區域', dataIndex: 'region', key: 'region', render: (v: string) => v || '-' },
    { title: '電話', dataIndex: 'phone', key: 'phone', render: (v: string) => v || '-' },
    {
      title: '狀態',
      key: 'active',
      render: (_: any, record: any) => (
        <Switch
          checked={record.active}
          onChange={(checked) => handleToggleActive(record.id, checked)}
          size="small"
        />
      ),
    },
    { title: '客戶數', dataIndex: ['_count', 'customers'], key: 'customerCount' },
    {
      title: '分享連結',
      key: 'share',
      width: 180,
      render: (_: any, record: any) => {
        if (record.role === 'ADMIN') return <Tag>無需分享</Tag>
        return (
          <Button
            size="small"
            icon={<LinkOutlined />}
            onClick={async () => {
              try {
                const res = await fetch('/api/users/share-token', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ userId: record.id }),
                })
                const data = await res.json()
                // Show a choice modal for which link type
                Modal.confirm({
                  title: '分享連結 - ' + record.name,
                  icon: null,
                  content: (
                    <div>
                      <div style={{ marginBottom: 12, fontWeight: 'bold' }}>每日速報</div>
                      <div style={{ marginBottom: 12, display: 'flex', gap: 8 }}>
                        <Input.TextArea rows={2} readOnly value={data.shareUrl} style={{ fontSize: 12 }} />
                        <Button onClick={async () => {
                          await navigator.clipboard.writeText(data.shareUrl)
                          message.success('速報連結已複製')
                        }} icon={<CopyOutlined />}>複製</Button>
                      </div>
                      <div style={{ marginBottom: 12, fontWeight: 'bold' }}>新增線索</div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <Input.TextArea rows={2} readOnly value={data.leadsShareUrl} style={{ fontSize: 12 }} />
                        <Button onClick={async () => {
                          await navigator.clipboard.writeText(data.leadsShareUrl)
                          message.success('線索連結已複製')
                        }} icon={<CopyOutlined />}>複製</Button>
                      </div>
                    </div>
                  ),
                  okText: '關閉',
                  cancelButtonProps: { style: { display: 'none' } },
                })
              } catch {
                message.error('生成失敗')
              }
            }}
          >
            獲取連結
          </Button>
        )
      },
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: any) => (
        <Button size="small" onClick={() => {
          setEditingUser(record)
          form.setFieldsValue(record)
          setModalOpen(true)
        }}>編輯</Button>
      ),
    },
  ]

  return (
    <AppLayout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>用戶管理</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => {
          setEditingUser(null)
          form.resetFields()
          setModalOpen(true)
        }}>新建用戶</Button>
      </div>

      <Card>
        <Table
          dataSource={users}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={false}
        />
      </Card>

      <Modal
        title={editingUser ? '編輯用戶' : '新建用戶'}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); setEditingUser(null) }}
        onOk={() => form.submit()}
        confirmLoading={saving}
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item name="name" label="姓名" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="email" label="郵箱" rules={[{ required: true, type: 'email' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="password" label="密碼" rules={editingUser ? [] : [{ required: true }]}>
            <Input.Password placeholder={editingUser ? '留空則不修改' : ''} />
          </Form.Item>
          <Form.Item name="role" label="角色" rules={[{ required: true }]}>
            <Select options={[
              { label: '管理員', value: 'ADMIN' },
              { label: '銷售主管', value: 'SALES_MGR' },
              { label: '銷售', value: 'SALES' },
            ]} />
          </Form.Item>
          <Form.Item name="region" label="負責區域">
            <Select allowClear options={[
              { label: 'LA EAST', value: 'LA EAST' },
              { label: 'LA DOWNTOWN', value: 'LA DOWNTOWN' },
              { label: 'LA WEST', value: 'LA WEST' },
              { label: 'ORANGE COUNTY', value: 'ORANGE COUNTY' },
              { label: 'WESTERN INLAND EMPIRE', value: 'WESTERN INLAND EMPIRE' },
              { label: 'SOUTH BAY', value: 'SOUTH BAY' },
              { label: 'OUT OF CALIFORNIA', value: 'OUT OF CALIFORNIA' },
            ]} />
          </Form.Item>
          <Form.Item name="phone" label="電話">
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </AppLayout>
  )
}
