'use client'

import { useState } from 'react'
import { Card, Typography, Upload, Button, message, Alert, Table, List, Divider, Space } from 'antd'
import { UploadOutlined, InboxOutlined, DownloadOutlined, InfoCircleOutlined } from '@ant-design/icons'
import AppLayout from '@/components/Layout/AppLayout'

const { Title, Text, Paragraph } = Typography
const { Dragger } = Upload

export default function AdminImportPage() {
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<any>(null)

  const handleUpload = async (file: File) => {
    setUploading(true)
    setResult(null)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || '上传失败')
      }

      const importRes = await fetch('/api/admin/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileUrl: data.url }),
      })
      const importData = await importRes.json()
      setResult(importData)

      if (importRes.ok) {
        message.success('導入完成')
      } else {
        message.error(importData.error || '導入失敗')
      }
    } catch (err: any) {
      message.error(err.message)
    } finally {
      setUploading(false)
    }

    return false
  }

  return (
    <AppLayout>
      <Title level={4} style={{ marginBottom: 8 }}>數據導入</Title>

      {/* Template download */}
      <Card style={{ maxWidth: 700, marginBottom: 16 }}>
        <Space direction="vertical" size="small" style={{ width: '100%' }}>
          <Text strong>第一步：下載模板</Text>
          <Text type="secondary">
            請先下載標準模板，按照模板格式填寫數據後再上傳。Excel 必須包含以下兩個 Sheet：
          </Text>
          <ul style={{ margin: '8px 0', paddingLeft: 20, color: '#666' }}>
            <li><Text code>CRM客户明細</Text> — 客户信息（必填列：商家名稱）</li>
            <li><Text code>10開10目標跟蹤</Text> — Pipeline 跟踪（可选）</li>
          </ul>
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            href="/api/admin/import/template"
            target="_blank"
          >
            下載 Excel 模板
          </Button>
        </Space>
      </Card>

      {/* Upload area */}
      <Card style={{ maxWidth: 700, marginBottom: 16 }}>
        <Text strong>第二步：上傳填寫好的 Excel</Text>
        <div style={{ marginTop: 12 }}>
          <Dragger
            accept=".xlsx,.xls"
            multiple={false}
            showUploadList={false}
            beforeUpload={handleUpload}
            disabled={uploading}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">{uploading ? '正在導入...' : '點擊或拖拽 Excel 文件到此處上傳'}</p>
            <p className="ant-upload-hint">支持 .xlsx 和 .xls 格式</p>
          </Dragger>
        </div>
      </Card>

      {/* Result */}
      {result && (
        <Card title="導入結果" style={{ maxWidth: 700 }}>
          {/* Error */}
          {result.error && (
            <Alert
              type="error"
              message="導入失敗"
              description={
                <div>
                  <Paragraph strong style={{ marginBottom: 4 }}>{result.error}</Paragraph>
                  {result.tip && <Paragraph type="secondary" style={{ marginBottom: 4 }}>{result.tip}</Paragraph>}
                </div>
              }
              style={{ marginBottom: 16 }}
              showIcon
            />
          )}

          {/* Diagnostics */}
          {result.diagnostics && result.diagnostics.length > 0 && (
            <Alert
              type="info"
              message="文件診斷信息"
              description={
                <List
                  size="small"
                  dataSource={result.diagnostics}
                  renderItem={(item: string) => <List.Item style={{ padding: '4px 0', fontSize: 12, fontFamily: 'monospace' }}>{item}</List.Item>}
                />
              }
              style={{ marginBottom: 16 }}
              icon={<InfoCircleOutlined />}
              showIcon
            />
          )}

          {/* Success counts */}
          {!result.error && (
            <Alert
              type={result.customersImported > 0 ? 'success' : 'warning'}
              message="導入完成"
              description={
                <div>
                  <p>客户: {result.customersImported} 條導入, {result.customersSkipped} 條跳過</p>
                  <p>Pipeline: {result.pipelinesImported} 條導入, {result.pipelinesSkipped} 條跳過</p>
                  <p>溝通記錄: {result.communicationsImported} 條</p>
                </div>
              }
              style={{ marginBottom: 16 }}
              showIcon
            />
          )}

          {/* Row-level errors */}
          {result.customersErrors && result.customersErrors.length > 0 && (
            <Alert
              type="error"
              message={`客户導入錯誤 (${result.customersErrors.length} 條)`}
              description={
                <List
                  size="small"
                  dataSource={result.customersErrors.slice(0, 20)}
                  renderItem={(item: string) => <List.Item style={{ padding: '2px 0', fontSize: 12, color: '#cf1322' }}>{item}</List.Item>}
                />
              }
              style={{ marginBottom: 16 }}
              showIcon
            />
          )}

          {result.pipelinesErrors && result.pipelinesErrors.length > 0 && (
            <Alert
              type="error"
              message={`Pipeline 導入錯誤 (${result.pipelinesErrors.length} 條)`}
              description={
                <List
                  size="small"
                  dataSource={result.pipelinesErrors.slice(0, 20)}
                  renderItem={(item: string) => <List.Item style={{ padding: '2px 0', fontSize: 12, color: '#cf1322' }}>{item}</List.Item>}
                />
              }
              style={{ marginBottom: 16 }}
              showIcon
            />
          )}
        </Card>
      )}
    </AppLayout>
  )
}
