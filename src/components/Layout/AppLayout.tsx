'use client'

import React, { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { Layout, Menu, Button, Avatar, Dropdown, Typography, Spin } from 'antd'
import {
  DashboardOutlined,
  TeamOutlined,
  ProjectOutlined,
  BarChartOutlined,
  EnvironmentOutlined,
  FileTextOutlined,
  UserAddOutlined,
  SettingOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  UserOutlined,
  CustomerServiceOutlined,
  HistoryOutlined,
} from '@ant-design/icons'

const { Header, Sider, Content } = Layout
const { Text } = Typography

const menuGroups = [
  {
    type: 'group' as const,
    label: '看板類',
    children: [
      { key: '/dashboard', icon: <DashboardOutlined />, label: '仪表盘' },
      { key: '/product-stats', icon: <BarChartOutlined />, label: '产品潜力看板' },
      { key: '/kanban', icon: <ProjectOutlined />, label: '看板（Pipeline）' },
    ],
  },
  {
    type: 'group' as const,
    label: '記錄類',
    children: [
      { key: '/records', icon: <HistoryOutlined />, label: '记录总览' },
      { key: '/leads/new', icon: <UserAddOutlined />, label: '新建线索' },
      { key: '/quick-checkin', icon: <CustomerServiceOutlined />, label: '每日速报' },
      { key: '/visits', icon: <EnvironmentOutlined />, label: '拜访记录' },
    ],
  },
  {
    type: 'group' as const,
    label: '管理類',
    children: [
      { key: '/customers', icon: <TeamOutlined />, label: '客户管理' },
      { key: '/customer-health', icon: <BarChartOutlined />, label: '客户健康' },
      { key: '/subscriptions', icon: <ProjectOutlined />, label: '訂閱管理' },
      { key: '/segments', icon: <ProjectOutlined />, label: '客户分群' },
      { key: '/support-tickets', icon: <CustomerServiceOutlined />, label: '客服工单' },
    ],
  },
]

const adminGroup = {
  type: 'group' as const,
  label: '管理後台',
  children: [
    { key: '/admin/users', icon: <SettingOutlined />, label: '用户管理' },
    { key: '/products', icon: <BarChartOutlined />, label: '产品管理' },
    { key: '/admin/import', icon: <FileTextOutlined />, label: '数据导入' },
    { key: '/exports', icon: <FileTextOutlined />, label: '数据导出' },
  ],
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const { data: session, status } = useSession()

  if (status === 'loading') {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" />
      </div>
    )
  }

  if (status === 'unauthenticated') {
    router.push('/login')
    return null
  }

  const isAdmin = session?.user?.role === 'ADMIN'

  const items = [
    ...menuGroups,
    ...(isAdmin ? [adminGroup] : []),
  ]

  const getSelectedKey = () => {
    if (pathname === '/') return '/dashboard'
    if (pathname.startsWith('/quick-checkin')) return '/quick-checkin'
    if (pathname.startsWith('/product-stats')) return '/product-stats'
    if (pathname.startsWith('/customers')) return '/customers'
    if (pathname.startsWith('/kanban')) return '/kanban'
    if (pathname.startsWith('/visits')) return '/visits'
    if (pathname.startsWith('/segments')) return '/segments'
    if (pathname.startsWith('/customer-health')) return '/customer-health'
    if (pathname.startsWith('/support-tickets')) return '/support-tickets'
    if (pathname.startsWith('/subscriptions')) return '/subscriptions'
    if (pathname.startsWith('/leads/new')) return '/leads/new'
    if (pathname.startsWith('/records')) return '/records'
    if (pathname.startsWith('/admin/users')) return '/admin/users'
    if (pathname.startsWith('/exports')) return '/exports'
    if (pathname.startsWith('/products')) return '/products'
    if (pathname.startsWith('/admin/import')) return '/admin/import'
    return pathname
  }

  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: `${session?.user?.name} (${session?.user?.role === 'ADMIN' ? '管理员' : session?.user?.role === 'SALES_MGR' ? '销售主管' : '销售'})`,
      disabled: true,
    },
    { type: 'divider' as const },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      danger: true,
    },
  ]

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        theme="light"
        style={{
          borderRight: '1px solid #f0f0f0',
          boxShadow: collapsed ? undefined : '2px 0 8px rgba(0,0,0,0.06)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderBottom: '1px solid #f0f0f0',
          }}>
            <Text strong style={{ fontSize: collapsed ? 16 : 18, color: '#1677ff' }}>
              {collapsed ? 'CRM' : 'CRM 系統'}
            </Text>
          </div>
          <Menu
            mode="inline"
            selectedKeys={[getSelectedKey()]}
            items={items}
            onClick={({ key }) => router.push(key)}
            style={{ border: 'none', flex: 1 }}
          />
          <div style={{
            borderTop: '1px solid #f0f0f0',
            padding: collapsed ? '8px 0' : '8px 16px',
            textAlign: 'center',
          }}>
            <Text style={{ fontSize: 11, color: '#bbb' }}>
              {collapsed ? 'v1.0.0' : 'Proton CRM v1.0.0'}
            </Text>
          </div>
        </div>
      </Sider>
      <Layout>
        <Header style={{
          background: '#fff',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #f0f0f0',
          height: 64,
        }}>
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
          />
          <Dropdown
            menu={{
              items: userMenuItems,
              onClick: ({ key }) => {
                if (key === 'logout') signOut({ callbackUrl: '/login' })
              },
            }}
            placement="bottomRight"
          >
            <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Avatar icon={<UserOutlined />} style={{ backgroundColor: '#1677ff' }} />
              <Text>{session?.user?.name}</Text>
            </div>
          </Dropdown>
        </Header>
        <Content style={{ margin: 24 }}>
          {children}
        </Content>
      </Layout>
    </Layout>
  )
}
