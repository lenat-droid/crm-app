'use client'

import './globals.css'
import { ConfigProvider, App as AntApp } from 'antd'
import { SessionProvider } from 'next-auth/react'
import zhCN from 'antd/locale/zh_CN'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body>
        <SessionProvider>
          <ConfigProvider
            locale={zhCN}
            theme={{
              token: {
                colorPrimary: '#1677ff',
                borderRadius: 6,
              },
            }}
          >
            <AntApp>
              {children}
            </AntApp>
          </ConfigProvider>
        </SessionProvider>
      </body>
    </html>
  )
}
