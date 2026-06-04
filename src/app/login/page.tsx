'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { Form, Input, Button, Card, Typography, message } from 'antd'
import { MailOutlined, LockOutlined } from '@ant-design/icons'

const { Title, Text } = Typography

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const onFinish = async (values: { email: string; password: string }) => {
    setLoading(true)
    try {
      const result = await signIn('credentials', {
        email: values.email,
        password: values.password,
        redirect: false,
      })

      if (result?.error) {
        message.error(result.error || '登录失败')
        return
      }

      message.success('登录成功')
      router.push('/dashboard')
    } catch {
      message.error('登录失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    }}>
      <Card style={{ width: 400, padding: '20px' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Title level={2} style={{ margin: 0 }}>CRM 系統</Title>
          <Text type="secondary">客戶關係管理平台</Text>
        </div>

        <Form
          name="login"
          onFinish={onFinish}
          layout="vertical"
          size="large"
        >
          <Form.Item
            name="email"
            rules={[{ required: true, message: '請輸入郵箱' }, { type: 'email', message: '請輸入有效的郵箱' }]}
          >
            <Input prefix={<MailOutlined />} placeholder="郵箱" />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: '請輸入密碼' }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="密碼" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>
              登 錄
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}
