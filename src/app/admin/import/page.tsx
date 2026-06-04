'use client'

import { useState } from 'react'
import { Card, Typography, Upload, Button, message, Alert, Table } from 'antd'
import { UploadOutlined, InboxOutlined } from '@ant-design/icons'
import AppLayout from '@/components/Layout/AppLayout'

const { Title, Text } = Typography
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

      if (!res.ok) throw new Error(data.error)

      // Trigger import via server action
      const importRes = await fetch('/api/admin/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileUrl: data.url }),
      })
      const importData = await importRes.json()
      setResult(importData)

      if (importRes.ok) {
        message.success(`導入完成！客戶: ${importData.customersImported}, Pipeline: ${importData.pipelinesImported}`)
      } else {
        message.error('導入失敗')
      }
    } catch (err: any) {
      message.error('上傳失敗: ' + err.message)
    } finally {
      setUploading(false)
    }

    return false // Prevent default upload behavior
  }

  return (
    <AppLayout>
      <Title level={4} style={{ marginBottom: 24 }}>數據導入</Title>

      <Card style={{ maxWidth: 600, marginBottom: 24 }}>
        <Text>上傳 CRM.xlsx 文件，系統將自動讀取所有 sheet 並導入數據。</Text>
        <div style={{ marginTop: 16 }}>
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
            <p className="ant-upload-text">點擊或拖拽 Excel 文件到此區域上傳</p>
            <p className="ant-upload-hint">支持 .xlsx 和 .xls 格式</p>
          </Dragger>
        </div>
      </Card>

      {result && (
        <Card title="導入結果">
          {result.error ? (
            <Alert type="error" message="導入錯誤" description={result.error} />
          ) : (
            <Alert
              type="success"
              message="導入成功"
              description={
                <div>
                  <p>✅ 客戶數據: {result.customersImported} 條</p>
                  <p>✅ Pipeline: {result.pipelinesImported} 條</p>
                  <p>✅ 溝通記錄: {result.communicationsImported} 條</p>
                  <p>✅ 拜訪記錄: {result.visitsImported} 條</p>
                  <p>✅ 拜訪日誌: {result.visitLogsImported} 條</p>
                  <p>✅ 線索: {result.leadsImported} 條</p>
                </div>
              }
            />
          )}
        </Card>
      )}
    </AppLayout>
  )
}
