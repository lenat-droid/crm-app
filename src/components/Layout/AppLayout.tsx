'use client'

import React, { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { Layout, Menu, Button, Avatar, Dropdown, Typography, Spin, Drawer, Grid } from 'antd'
import type { MenuProps } from 'antd'
import {
  CarryOutOutlined,
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
  ScheduleOutlined,
  GlobalOutlined,
} from '@ant-design/icons'
import { useLanguage } from '@/lib/i18n'

const { Header, Sider, Content } = Layout
const { Text } = Typography

// ── Navigation menu definitions ──

// Inline type: matches Ant Design's MenuProps['items'] shape
type MenuItem = Exclude<MenuProps['items'], undefined>[number]

const menuGroupsZh: MenuItem[] = [
  {
    type: 'group',
    label: '工作台',
    children: [
      { key: '/today', icon: <CarryOutOutlined />, label: '今日跟进' },
    ],
  },
  {
    type: 'group',
    label: '看板類',
    children: [
      { key: '/dashboard', icon: <DashboardOutlined />, label: '仪表盘' },
      { key: '/product-stats', icon: <BarChartOutlined />, label: '产品潜力看板' },
      { key: '/operating-dashboard', icon: <BarChartOutlined />, label: '经营看板' },
      { key: '/kanban', icon: <ProjectOutlined />, label: '看板（Pipeline）' },
      { key: '/weekly-review', icon: <ScheduleOutlined />, label: '每週復盤' },
    ],
  },
  {
    type: 'group',
    label: '記錄類',
    children: [
      { key: '/records', icon: <HistoryOutlined />, label: '记录总览' },
      { key: '/leads', icon: <UserAddOutlined />, label: '线索及 AIM 申请' },
      { key: '/leads/new', icon: <UserAddOutlined />, label: '新建线索' },
      { key: '/quick-checkin', icon: <CustomerServiceOutlined />, label: '每日速报' },
      { key: '/visits', icon: <EnvironmentOutlined />, label: '拜访记录' },
    ],
  },
  {
    type: 'group',
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

const menuGroupsEn: MenuItem[] = [
  {
    type: 'group',
    label: 'Workbench',
    children: [
      { key: '/today', icon: <CarryOutOutlined />, label: 'Today' },
    ],
  },
  {
    type: 'group',
    label: 'Boards',
    children: [
      { key: '/dashboard', icon: <DashboardOutlined />, label: 'Dashboard' },
      { key: '/product-stats', icon: <BarChartOutlined />, label: 'Product Potential' },
      { key: '/operating-dashboard', icon: <BarChartOutlined />, label: 'Operating Dashboard' },
      { key: '/kanban', icon: <ProjectOutlined />, label: 'Kanban (Pipeline)' },
      { key: '/weekly-review', icon: <ScheduleOutlined />, label: 'Weekly Review' },
    ],
  },
  {
    type: 'group',
    label: 'Records',
    children: [
      { key: '/records', icon: <HistoryOutlined />, label: 'Records Overview' },
      { key: '/leads', icon: <UserAddOutlined />, label: 'Leads & AIM Requests' },
      { key: '/leads/new', icon: <UserAddOutlined />, label: 'New Lead' },
      { key: '/quick-checkin', icon: <CustomerServiceOutlined />, label: 'Daily Check-in' },
      { key: '/visits', icon: <EnvironmentOutlined />, label: 'Visit Records' },
    ],
  },
  {
    type: 'group',
    label: 'Management',
    children: [
      { key: '/customers', icon: <TeamOutlined />, label: 'Customers' },
      { key: '/customer-health', icon: <BarChartOutlined />, label: 'Health' },
      { key: '/subscriptions', icon: <ProjectOutlined />, label: 'Subscriptions' },
      { key: '/segments', icon: <ProjectOutlined />, label: 'Segments' },
      { key: '/support-tickets', icon: <CustomerServiceOutlined />, label: 'Support Tickets' },
    ],
  },
]

const adminGroupZh: MenuItem[] = [{
  type: 'group',
  label: '管理後台',
  children: [
    { key: '/admin/users', icon: <SettingOutlined />, label: '用户管理' },
    { key: '/products', icon: <BarChartOutlined />, label: '产品管理' },
    { key: '/admin/import', icon: <FileTextOutlined />, label: '数据导入' },
    { key: '/exports', icon: <FileTextOutlined />, label: '数据导出' },
  ],
}]

const adminGroupEn: MenuItem[] = [{
  type: 'group',
  label: 'Admin Panel',
  children: [
    { key: '/admin/users', icon: <SettingOutlined />, label: 'Users' },
    { key: '/products', icon: <BarChartOutlined />, label: 'Products' },
    { key: '/admin/import', icon: <FileTextOutlined />, label: 'Import' },
    { key: '/exports', icon: <FileTextOutlined />, label: 'Export' },
  ],
}]

const mgrGroupZh: MenuItem[] = [{
  type: 'group',
  label: '管理後台',
  children: [{ key: '/exports', icon: <FileTextOutlined />, label: '数据导出' }],
}]

const mgrGroupEn: MenuItem[] = [{
  type: 'group',
  label: 'Admin Panel',
  children: [{ key: '/exports', icon: <FileTextOutlined />, label: 'Export' }],
}]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const { data: session, status } = useSession()
  const { lang, setLang } = useLanguage()
  const screens = Grid.useBreakpoint()
  // md 断点 (768px) 以下视为移动端：侧边栏改为抽屉
  const isMobile = screens.md === false

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
  const isMgr = session?.user?.role === 'SALES_MGR'

  const menuGroups: MenuItem[] = lang === 'en' ? menuGroupsEn : menuGroupsZh
  const adminG: MenuItem[] = isAdmin ? adminGroupEn : adminGroupZh
  const mgrG: MenuItem[] = mgrGroupEn

  const items: MenuItem[] = [
    ...menuGroups,
    ...(isAdmin ? adminG : isMgr ? mgrG : []),
  ]

  const getSelectedKey = () => {
    if (pathname === '/') return '/dashboard'
    if (pathname.startsWith('/today')) return '/today'
    if (pathname.startsWith('/quick-checkin')) return '/quick-checkin'
    if (pathname.startsWith('/product-stats')) return '/product-stats'
    if (pathname.startsWith('/operating-dashboard')) return '/operating-dashboard'
    if (pathname.startsWith('/customers')) return '/customers'
    if (pathname.startsWith('/kanban')) return '/kanban'
    if (pathname.startsWith('/visits')) return '/visits'
    if (pathname.startsWith('/segments')) return '/segments'
    if (pathname.startsWith('/customer-health')) return '/customer-health'
    if (pathname.startsWith('/support-tickets')) return '/support-tickets'
    if (pathname.startsWith('/subscriptions')) return '/subscriptions'
    if (pathname.startsWith('/leads/new')) return '/leads/new'
    if (pathname.startsWith('/leads')) return '/leads'
    if (pathname.startsWith('/records')) return '/records'
    if (pathname.startsWith('/admin/users')) return '/admin/users'
    if (pathname.startsWith('/exports')) return '/exports'
    if (pathname.startsWith('/products')) return '/products'
    if (pathname.startsWith('/admin/import')) return '/admin/import'
    if (pathname.startsWith('/weekly-review')) return '/weekly-review'
    return pathname
  }

  const roleLabel = session?.user?.role === 'ADMIN'
    ? (lang === 'en' ? 'Admin' : '管理员')
    : session?.user?.role === 'SALES_MGR'
      ? (lang === 'en' ? 'Sales Mgr' : '销售主管')
      : (lang === 'en' ? 'Sales' : '销售')

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: `${session?.user?.name} (${roleLabel})`,
      disabled: true,
    },
    { type: 'divider' },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: lang === 'en' ? 'Logout' : '退出登录',
      danger: true,
    },
  ]

  const titleText = collapsed && !isMobile ? 'CRM' : (lang === 'en' ? 'CRM System' : 'CRM 系統')
  const versionText = collapsed && !isMobile ? 'v1.3.0' : 'Proton CRM v1.3.0'

  // Language toggle button
  const langToggleBtn = (
    <Button
      size="small"
      type="text"
      icon={<GlobalOutlined />}
      onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
      title={lang === 'zh' ? 'Switch to English' : '切换中文'}
      style={{ fontSize: 14, padding: '0 4px' }}
    >
      {!collapsed && !isMobile ? (lang === 'zh' ? 'EN' : '中') : null}
    </Button>
  )

  const menuContent = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{
        height: 64,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderBottom: '1px solid #f0f0f0',
        flexShrink: 0,
      }}>
        <Text strong style={{ fontSize: collapsed && !isMobile ? 16 : 18, color: '#1677ff' }}>
          {titleText}
        </Text>
      </div>
      <div style={{ overflowY: 'auto', flex: 1 }}>
        <Menu
          mode="inline"
          selectedKeys={[getSelectedKey()]}
          items={items}
          onClick={({ key }) => {
            router.push(key)
            setDrawerOpen(false)
          }}
          style={{ border: 'none' }}
        />
      </div>
      <div style={{
        borderTop: '1px solid #f0f0f0',
        padding: collapsed && !isMobile ? '8px 0' : '8px 16px',
        textAlign: 'center',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
      }}>
        {langToggleBtn}
        <Text style={{ fontSize: 11, color: '#bbb' }}>
          {versionText}
        </Text>
      </div>
    </div>
  )

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {isMobile ? (
        <Drawer
          placement="left"
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          width={240}
          styles={{ body: { padding: 0 } }}
          closable={false}
        >
          {menuContent}
        </Drawer>
      ) : (
        <Sider
          trigger={null}
          collapsible
          collapsed={collapsed}
          theme="light"
          width={240}
          style={{
            position: 'fixed',
            top: 0,
            bottom: 0,
            left: 0,
            height: '100vh',
            zIndex: 100,
            borderRight: '1px solid #f0f0f0',
            boxShadow: collapsed ? undefined : '2px 0 8px rgba(0,0,0,0.06)',
          }}
        >
          {menuContent}
        </Sider>
      )}
      <Layout style={{ marginLeft: isMobile ? 0 : collapsed ? 80 : 240 }}>
        <Header style={{
          background: '#fff',
          padding: isMobile ? '0 12px' : '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #f0f0f0',
          height: 64,
          position: 'sticky',
          top: 0,
          zIndex: 99,
        }}>
          <Button
            type="text"
            icon={isMobile ? <MenuUnfoldOutlined /> : collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => (isMobile ? setDrawerOpen(true) : setCollapsed(!collapsed))}
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
        <Content style={{
          margin: isMobile ? 8 : 24,
          background: '#fff',
          borderRadius: 8,
          padding: isMobile ? 12 : 24,
        }}>
          {children}
        </Content>
      </Layout>
    </Layout>
  )
}
