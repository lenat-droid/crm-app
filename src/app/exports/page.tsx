'use client'

import { useState, useEffect } from 'react'
import {
  Card, Typography, Table, Tag, Button, Select, message, Space, Row, Col, Statistic,
} from 'antd'
import { DownloadOutlined, ReloadOutlined } from '@ant-design/icons'
import { useSession } from 'next-auth/react'
import dayjs from 'dayjs'
import AppLayout from '@/components/Layout/AppLayout'

const { Title } = Typography

const exportTypeLabels: Record<string, string> = {
  CUSTOMERS: '客戶資料', SUBSCRIPTIONS: '訂閱資料', TICKETS: '客服工單', LEADS: '線索',
}

const statusColors: Record<string, string> = {
  PENDING: 'default', PROCESSING: 'blue', COMPLETED: 'green', FAILED: 'red',
}
const statusLabels: Record<string, string> = {
  PENDING: '等待中', PROCESSING: '處理中', COMPLETED: '已完成', FAILED: '失敗',
}

export default function ExportsPage() {
  const { data: session } = useSession()
  const [exports, setExports] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [exportType, setExportType] = useState<string>('CUSTOMERS')
  const canExport = session?.user?.role !== 'SALES'

  const fetchExports = async () => {
    try {
      const res = await fetch('/api/exports?pageSize=50')
      const data = await res.json()
      setExports(data.exports || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchExports() }, [])

  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await fetch('/api/exports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: exportType }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Export failed')
      message.success(`匯出完成：${data.rowCount} 條記錄`)
      fetchExports()
    } catch (err: any) {
      message.error(err.message || '匯出失敗')
    } finally {
      setExporting(false)
    }
  }

  const handleDownload = async (exportJob: any) => {
    // Re-fetch the export data and trigger download
    try {
      const res = await fetch(`/api/exports/${exportJob.id}`)
      const data = await res.json()
      // For now, just show the details — actual file download needs blob storage
      message.info(`已準備好 ${data.export.rowCount} 條記錄的匯出 (${Math.round((data.export.fileSize || 0) / 1024)} KB)`)
    } catch {
      message.error('下載失敗')
    }
  }

  const columns = [
    {
      title: '類型',
      dataIndex: 'type',
      key: 'type',
      render: (v: string) => exportTypeLabels[v] || v,
    },
    {
      title: '狀態',
      dataIndex: 'status',
      key: 'status',
      render: (v: string) => <Tag color={statusColors[v]}>{statusLabels[v] || v}</Tag>,
    },
    {
      title: '記錄數',
      dataIndex: 'rowCount',
      key: 'rowCount',
      render: (v: number | null) => v !== null ? v.toLocaleString() : '-',
    },
    {
      title: '文件大小',
      dataIndex: 'fileSize',
      key: 'fileSize',
      render: (v: number | null) => v !== null ? `${Math.round(v / 1024)} KB` : '-',
    },
    {
      title: '請求人',
      dataIndex: ['requestedBy', 'name'],
      key: 'requestedBy',
      render: (v: string | null) => v || '-',
    },
    {
      title: '創建時間',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '完成時間',
      dataIndex: 'completedAt',
      key: 'completedAt',
      render: (v: string | null) => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: any) => (
        record.status === 'COMPLETED' ? (
          <Button size="small" icon={<DownloadOutlined />} onClick={() => handleDownload(record)}>
            下載
          </Button>
        ) : null
      ),
    },
  ]

  return (
    <AppLayout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>資料匯出</Title>
        <Space>
          {canExport && (
            <>
              <Select value={exportType} onChange={setExportType} style={{ width: 150 }}>
                <Select.Option value="CUSTOMERS">客戶資料</Select.Option>
                <Select.Option value="SUBSCRIPTIONS">訂閱資料</Select.Option>
                <Select.Option value="TICKETS">客服工單</Select.Option>
                <Select.Option value="LEADS">線索</Select.Option>
              </Select>
              <Button type="primary" icon={<DownloadOutlined />} loading={exporting} onClick={handleExport}>
                匯出 CSV
              </Button>
            </>
          )}
          <Button icon={<ReloadOutlined />} onClick={fetchExports}>
            刷新
          </Button>
        </Space>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic title="今日匯出" value={exports.filter(e => dayjs(e.createdAt).isSame(dayjs(), 'day')).length} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="成功" value={exports.filter(e => e.status === 'COMPLETED').length} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="處理中" value={exports.filter(e => e.status === 'PROCESSING' || e.status === 'PENDING').length} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="失敗" value={exports.filter(e => e.status === 'FAILED').length} />
          </Card>
        </Col>
      </Row>

      <Card>
        <Table
          dataSource={exports}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 20, showTotal: (t) => `共 ${t} 條` }}
        />
      </Card>
    </AppLayout>
  )
}
