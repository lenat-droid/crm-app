'use client'

import { useState, useEffect } from 'react'
import {
  Card, Typography, Tag, message, Modal, Form, Input, InputNumber, Select, DatePicker,
  Empty, Spin, Button, Space, Popconfirm, Row, Col, Statistic,
} from 'antd'
import {
  CheckCircleOutlined, CloseCircleOutlined,
  HistoryOutlined, ReloadOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import AppLayout from '@/components/Layout/AppLayout'

const { Title, Text } = Typography

const statusConfig: Record<string, { label: string; color: string }> = {
  '⚠️': { label: '待跟进', color: '#faad14' },
  '已建联': { label: '已建联', color: '#1890ff' },
  '初步有意向': { label: '初步有意向', color: '#722ed1' },
  '合作中': { label: '合作中', color: '#52c41a' },
}

export default function KanbanPage() {
  const [pipelines, setPipelines] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [commModalOpen, setCommModalOpen] = useState(false)
  const [selectedPipeline, setSelectedPipeline] = useState<any>(null)
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)
  const [showClosed, setShowClosed] = useState(false)

  // ── Subscription creation modal state ──
  const [subModalOpen, setSubModalOpen] = useState(false)
  const [subSaving, setSubSaving] = useState(false)
  const [subForm] = Form.useForm()
  const [subCustomer, setSubCustomer] = useState<{ id: number; name: string } | null>(null)
  const [products, setProducts] = useState<any[]>([])

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products')
      const data = await res.json()
      setProducts(data.products || [])
    } catch { /* ignore */ }
  }

  const fetchPipelines = async () => {
    try {
      const activeParam = showClosed ? 'active=closed' : 'active=true'
      const res = await fetch(`/api/pipelines?${activeParam}&pageSize=200`)
      const data = await res.json()
      setPipelines(data.pipelines || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPipelines()
  }, [showClosed])

  useEffect(() => { fetchProducts() }, [])

  const handleStatusChange = async (pipelineId: number, newStatus: string) => {
    try {
      const res = await fetch(`/api/pipelines`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: pipelineId, status: newStatus }),
      })
      if (!res.ok) throw new Error('Failed')
      message.success('狀態已更新')
      fetchPipelines()
    } catch {
      message.error('更新失敗')
    }
  }

  const handleClosePipeline = async (pipeline: any, closeAsLost?: boolean) => {
    try {
      const res = await fetch('/api/pipelines', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: pipeline.id,
          active: false,
          ...(closeAsLost ? { closeReason: 'LOST' } : {}),
        }),
      })
      if (!res.ok) throw new Error('Failed')
      const result = await res.json()
      message.success(result.message || 'Pipeline 已關閉')
      fetchPipelines()

      // If WON (成交歸檔), open subscription creation modal
      if (result.closeReason === 'WON' && !closeAsLost) {
        setSubCustomer({ id: pipeline.customerId, name: pipeline.customer?.name || '' })
        subForm.resetFields()
        setSubModalOpen(true)
      }
    } catch {
      message.error('關閉失敗')
    }
  }

  const handleAddCommunication = async (values: any) => {
    if (!selectedPipeline) return
    setSaving(true)
    try {
      const res = await fetch('/api/pipelines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedPipeline.customerId,
          contactDate: values.contactDate.toISOString(),
          record: values.record,
        }),
      })
      if (!res.ok) throw new Error('Failed')
      message.success('溝通記錄已添加')
      setCommModalOpen(false)
      form.resetFields()
      fetchPipelines()
    } catch {
      message.error('添加失敗')
    } finally {
      setSaving(false)
    }
  }

  const handleCreateSubscription = async (values: any) => {
    if (!subCustomer) return
    setSubSaving(true)
    try {
      const body = {
        customerId: subCustomer.id,
        productId: values.productId,
        plan: values.plan || 'MONTHLY',
        mrr: values.mrr || 0,
        startDate: values.startDate?.toISOString(),
        endDate: values.endDate?.toISOString(),
        autoRenew: values.autoRenew !== false,
        notes: values.notes || null,
      }
      const res = await fetch('/api/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Failed')
      message.success(`訂閱已為 ${subCustomer.name} 創建`)
      setSubModalOpen(false)
      subForm.resetFields()
      setSubCustomer(null)
    } catch {
      message.error('創建失敗')
    } finally {
      setSubSaving(false)
    }
  }

  const columns = ['⚠️', '已建联', '初步有意向', '合作中']

  const getColumnPipelines = (status: string) =>
    pipelines.filter(p => p.status === status)

  const statusSelectOptions = columns.map(s => ({ label: statusConfig[s]?.label || s, value: s }))

  if (loading) {
    return (
      <AppLayout>
        <div style={{ textAlign: 'center', padding: 100 }}><Spin size="large" /></div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          {showClosed ? '已關閉 Pipeline 歷史' : '看板（Pipeline）'}
        </Title>
        <Space>
          <Button
            icon={<HistoryOutlined />}
            type={showClosed ? 'primary' : 'default'}
            onClick={() => setShowClosed(!showClosed)}
          >
            {showClosed ? '返回看板' : '已關閉記錄'}
          </Button>
          <Button icon={<ReloadOutlined />} onClick={fetchPipelines} />
        </Space>
      </div>

      {/* Stats bar (only in closed view) */}
      {showClosed && (
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={8}>
            <Card size="small">
              <Statistic title="已關閉 Pipeline" value={pipelines.length} />
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small">
              <Statistic
                title="已成交（合作中→歸檔）"
                value={pipelines.filter(p => p.status === '合作中').length}
                valueStyle={{ color: '#52c41a' }}
                prefix={<CheckCircleOutlined />}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small">
              <Statistic
                title="未成交（其他→關閉）"
                value={pipelines.filter(p => p.status !== '合作中').length}
                valueStyle={{ color: '#ff4d4f' }}
                prefix={<CloseCircleOutlined />}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* Closed list view */}
      {showClosed ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {pipelines.length === 0 && (
            <Empty description="暫無已關閉的 Pipeline" />
          )}
          {pipelines.map((p: any) => {
            const isWon = p.status === '合作中'
            return (
              <Card key={p.id} size="small" hoverable
                onClick={() => {
                  setSelectedPipeline(p)
                  setCommModalOpen(true)
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <Text strong>{p.customer?.name}</Text>
                    <Tag color={statusConfig[p.status]?.color} style={{ marginLeft: 8 }}>
                      {statusConfig[p.status]?.label || p.status}
                    </Tag>
                    <Tag color={isWon ? 'green' : 'red'} style={{ marginLeft: 4 }}>
                      {isWon ? '已成交' : '未成交'}
                    </Tag>
                  </div>
                  <Space size={4}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      負責人: {p.salesPerson?.name || '-'}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      關閉: {p.closedAt ? dayjs(p.closedAt).format('YYYY-MM-DD') : '-'}
                    </Text>
                  </Space>
                </div>
              </Card>
            )
          })}
        </div>
      ) : (
        /* ── Kanban columns ── */
        <div style={{ display: 'flex', gap: 16, overflow: 'auto', minHeight: 'calc(100vh - 200px)' }}>
          {columns.map(status => (
            <div key={status} style={{ minWidth: 280, flex: 1 }}>
              {/* Column Header */}
              <div style={{
                background: statusConfig[status]?.color || '#999',
                color: '#fff',
                padding: '10px 16px',
                borderRadius: '8px 8px 0 0',
                fontWeight: 'bold',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <span>{statusConfig[status]?.label || status}</span>
                <Tag color="white" style={{ borderRadius: 10 }}>
                  {getColumnPipelines(status).length}
                </Tag>
              </div>

              {/* Cards */}
              <div style={{
                background: '#fafafa',
                padding: 12,
                borderRadius: '0 0 8px 8px',
                minHeight: 200,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}>
                {getColumnPipelines(status).map((p: any) => {
                  const isLastColumn = status === '合作中'
                  return (
                    <Card
                      key={p.id}
                      size="small"
                      hoverable
                      style={{ cursor: 'pointer' }}
                      onClick={() => {
                        setSelectedPipeline(p)
                        setCommModalOpen(true)
                      }}
                    >
                      <Text strong>{p.customer?.name}</Text>
                      <div style={{ marginTop: 4, fontSize: 12, color: '#999' }}>
                        負責人: {p.salesPerson?.name || p.customer?.follower?.name || '-'}
                      </div>
                      <div style={{ marginTop: 2, fontSize: 12, color: '#999' }}>
                        最近聯繫: {p.lastContactDate ? dayjs(p.lastContactDate).format('MM-DD') : '-'}
                      </div>

                      {/* Status selector */}
                      <div style={{ marginTop: 8 }}>
                        <Select
                          size="small"
                          value={p.status}
                          options={statusSelectOptions}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(val) => handleStatusChange(p.id, val)}
                          style={{ width: 120 }}
                        />
                      </div>

                      {/* Recent communication preview */}
                      {p.communications?.length > 0 && (
                        <div style={{ marginTop: 8, fontSize: 11, color: '#999' }}>
                          最近: {p.communications[p.communications.length - 1]?.record?.substring(0, 30)}...
                        </div>
                      )}

                      {/* Close/Archive buttons */}
                      <div style={{ marginTop: 10, borderTop: '1px solid #f0f0f0', paddingTop: 8 }}>
                        <Space size={4}>
                          {isLastColumn ? (
                            <Space size={4}>
                              <Popconfirm
                                title="確認歸檔此客戶？"
                                description="該客戶已合作，歸檔後將從看板移除"
                                onConfirm={(e) => { e?.stopPropagation(); handleClosePipeline(p) }}
                                onCancel={(e) => e?.stopPropagation()}
                                okText="確認歸檔"
                                cancelText="取消"
                              >
                                <Button
                                  size="small"
                                  type="primary"
                                  icon={<CheckCircleOutlined />}
                                  onClick={(e) => e.stopPropagation()}
                                  style={{ background: '#52c41a', borderColor: '#52c41a' }}
                                >
                                  成交歸檔
                                </Button>
                              </Popconfirm>
                              <Popconfirm
                                title="確認不再合作？"
                                description="客戶將標記為已流失，從看板移除"
                                onConfirm={(e) => { e?.stopPropagation(); handleClosePipeline(p, true) }}
                                onCancel={(e) => e?.stopPropagation()}
                                okText="確認流失"
                                cancelText="取消"
                              >
                                <Button
                                  size="small"
                                  danger
                                  icon={<CloseCircleOutlined />}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  不再合作
                                </Button>
                              </Popconfirm>
                            </Space>
                          ) : (
                            <Popconfirm
                              title="確認關閉此 Pipeline？"
                              description="此客戶暫未成交，關閉後將從看板移除，可在客戶列表查看"
                              onConfirm={(e) => { e?.stopPropagation(); handleClosePipeline(p) }}
                              onCancel={(e) => e?.stopPropagation()}
                              okText="確認關閉"
                              cancelText="取消"
                            >
                              <Button
                                size="small"
                                danger
                                icon={<CloseCircleOutlined />}
                                onClick={(e) => e.stopPropagation()}
                              >
                                關閉/未成交
                              </Button>
                            </Popconfirm>
                          )}
                        </Space>
                      </div>
                    </Card>
                  )
                })}
                {getColumnPipelines(status).length === 0 && (
                  <Empty description="暫無" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Communication Modal */}
      <Modal
        title={selectedPipeline ? `溝通記錄 - ${selectedPipeline.customer?.name}` : '溝通記錄'}
        open={commModalOpen}
        onCancel={() => { setCommModalOpen(false); setSelectedPipeline(null); form.resetFields() }}
        onOk={() => form.submit()}
        confirmLoading={saving}
      >
        {/* Show recent communications */}
        {selectedPipeline?.communications?.length > 0 && (
          <div style={{ marginBottom: 16, maxHeight: 200, overflow: 'auto' }}>
            <Text strong>歷史記錄：</Text>
            <div style={{ marginTop: 4 }}>
              {selectedPipeline.active === false && (
                <Tag color={selectedPipeline.status === '合作中' ? 'green' : 'red'}>
                  {selectedPipeline.status === '合作中' ? '已成交歸檔' : '已關閉'}
                </Tag>
              )}
            </div>
            {selectedPipeline.communications.map((c: any) => (
              <div key={c.id} style={{ marginTop: 8, padding: 8, background: '#f5f5f5', borderRadius: 4 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {dayjs(c.contactDate).format('YYYY-MM-DD')} (第{c.contactOrder}次)
                  {c.createdBy && <> · {c.createdBy.name}</>}
                </Text>
                <div style={{ fontSize: 13 }}>{c.record}</div>
              </div>
            ))}
          </div>
        )}

        <Form form={form} layout="vertical" onFinish={handleAddCommunication}>
          <Form.Item name="contactDate" label="聯繫日期" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="record" label="溝通記錄" rules={[{ required: true }]}>
            <Input.TextArea rows={4} placeholder="記錄溝通內容..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* Create Subscription Modal (shown after 成交歸檔) */}
      <Modal
        title={subCustomer ? `新增訂閱 - ${subCustomer.name}` : '新增訂閱'}
        open={subModalOpen}
        onCancel={() => { setSubModalOpen(false); subForm.resetFields(); setSubCustomer(null) }}
        onOk={() => subForm.submit()}
        confirmLoading={subSaving}
        width={560}
      >
        <Form form={subForm} layout="vertical" onFinish={handleCreateSubscription}>
          <Form.Item name="productId" label="產品" rules={[{ required: true, message: '請選擇產品' }]}>
            <Select
              placeholder="選擇產品"
              options={products.map((p: any) => ({ label: p.name, value: p.id }))}
            />
          </Form.Item>
          <Form.Item name="plan" label="方案" initialValue="MONTHLY">
            <Select options={[
              { label: '月繳', value: 'MONTHLY' },
              { label: '季繳', value: 'QUARTERLY' },
              { label: '半年繳', value: 'SEMI_ANNUAL' },
              { label: '年繳', value: 'ANNUAL' },
            ]} />
          </Form.Item>
          <Form.Item name="mrr" label="MRR (USD)" rules={[{ required: true, message: '請輸入月經常性收入' }]}>
            <InputNumber min={0} step={10} style={{ width: '100%' }} placeholder="e.g. 499" />
          </Form.Item>
          <Form.Item name="startDate" label="開始日期">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="endDate" label="結束日期">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="autoRenew" label="自動續約" initialValue={true}>
            <Select options={[
              { label: '是', value: true },
              { label: '否', value: false },
            ]} />
          </Form.Item>
          <Form.Item name="notes" label="備註">
            <Input.TextArea rows={2} placeholder="..." />
          </Form.Item>
        </Form>
      </Modal>
    </AppLayout>
  )
}
