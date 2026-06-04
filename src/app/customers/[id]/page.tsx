'use client'

import { useState, useEffect } from 'react'
import {
  Card, Descriptions, Tag, Typography, Spin, Breadcrumb, Tabs, Select, Space,
  message, Button, Timeline, Modal, Form, Input, InputNumber, DatePicker, Table, Empty,
  Progress, Rate, Row, Col,
} from 'antd'
import { EditOutlined, PlusOutlined, UserOutlined, ShopOutlined, EnvironmentOutlined, IdcardOutlined, TagOutlined } from '@ant-design/icons'
import { useParams, useRouter } from 'next/navigation'
import dayjs from 'dayjs'
import AppLayout from '@/components/Layout/AppLayout'
import { useSession } from 'next-auth/react'
import { REGIONS, CUSTOMER_TYPES, CUSTOMER_TIERS, CUSTOMER_STATUSES, CUSTOMER_SOURCES, ONBOARDING_STATUSES } from '@/lib/constants'

const { Title, Text } = Typography

const interestLabels: Record<string, string> = {
  NOT_CONTACTED: '未接觸',
  NOT_INTERESTED: '無興趣',
  AWARE: '已了解',
  INTERESTED: '感興趣',
  HIGH_INTENT: '高意向',
  PURCHASED: '已購買',
}

const interestColors: Record<string, string> = {
  NOT_CONTACTED: '#d9d9d9',
  NOT_INTERESTED: '#ff4d4f',
  AWARE: '#faad14',
  INTERESTED: '#1890ff',
  HIGH_INTENT: '#722ed1',
  PURCHASED: '#52c41a',
}

const productConfig = [
  { field: 'smtStatus', label: 'SMT' },
  { field: 'psWebsiteStatus', label: 'PS官網' },
  { field: 'aiCamStatus', label: 'AI Cam' },
  { field: 'posStatus', label: 'POS' },
  { field: 'platformManagedStatus', label: '平台托管' },
  { field: 'omeStatus', label: 'OME' },
  { field: 'smartRobotStatus', label: '智能機器人' },
]

const allInterestLevels = [
  'NOT_CONTACTED', 'NOT_INTERESTED', 'AWARE', 'INTERESTED', 'HIGH_INTENT', 'PURCHASED',
]

export default function CustomerDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { data: session } = useSession()
  const [customer, setCustomer] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [profileEditOpen, setProfileEditOpen] = useState(false)
  const [commModalOpen, setCommModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()
  const [profileForm] = Form.useForm()
  const [commForm] = Form.useForm()
  const [merchantForm] = Form.useForm()
  const [merchantModalOpen, setMerchantModalOpen] = useState(false)
  const [profileLoading, setProfileLoading] = useState(false)
  const [merchantProfile, setMerchantProfile] = useState<any>(null)

  const fetchCustomer = async () => {
    try {
      const res = await fetch(`/api/customers/${params.id}`)
      const data = await res.json()
      setCustomer(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCustomer()
    fetchMerchantProfile()
  }, [params.id])

  const handleSaveProducts = async (values: any) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/customers/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      if (!res.ok) throw new Error('Failed to update')
      message.success('更新成功')
      setEditModalOpen(false)
      fetchCustomer()
    } catch {
      message.error('更新失敗')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveProfile = async (values: any) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/customers/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      if (!res.ok) throw new Error('Failed to update')
      message.success('客戶資料已更新')
      setProfileEditOpen(false)
      fetchCustomer()
    } catch {
      message.error('更新失敗')
    } finally {
      setSaving(false)
    }
  }

  const fetchMerchantProfile = async () => {
    setProfileLoading(true)
    try {
      const res = await fetch(`/api/customers/${params.id}/profile`)
      if (res.ok) {
        const data = await res.json()
        setMerchantProfile(data)
      }
    } catch {
      // silent — profile is optional
    } finally {
      setProfileLoading(false)
    }
  }

  const handleSaveMerchantProfile = async (values: any) => {
    setSaving(true)
    try {
      const body: any = { ...values }
      // Parse features JSON field
      if (typeof body.features === 'string') {
        try { body.features = JSON.parse(body.features) } catch { /* keep as-is */ }
      }
      const res = await fetch(`/api/customers/${params.id}/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Failed')
      message.success('商家檔案已更新')
      setMerchantModalOpen(false)
      fetchMerchantProfile()
    } catch {
      message.error('更新失敗')
    } finally {
      setSaving(false)
    }
  }

  const handleAddCommunication = async (values: any) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/pipelines`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: customer.id,
          contactDate: values.contactDate.toISOString(),
          record: values.record,
        }),
      })
      if (!res.ok) throw new Error('Failed')
      message.success('溝通記錄已添加')
      setCommModalOpen(false)
      commForm.resetFields()
      fetchCustomer()
    } catch {
      message.error('添加失敗')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <div style={{ textAlign: 'center', padding: 100 }}><Spin size="large" /></div>
      </AppLayout>
    )
  }

  if (!customer) {
    return (
      <AppLayout>
        <Empty description="客戶不存在" />
      </AppLayout>
    )
  }

  const isAdmin = session?.user?.role === 'ADMIN'
  const isOwner = session?.user?.id === customer.followerId

  // Prepare product interest matrix tab content
  const productMatrixContent = (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Text strong>產品興趣矩陣</Text>
        {(isAdmin || isOwner) && (
          <Button icon={<EditOutlined />} onClick={() => {
            form.setFieldsValue({
              smtStatus: customer.smtStatus,
              psWebsiteStatus: customer.psWebsiteStatus,
              aiCamStatus: customer.aiCamStatus,
              posStatus: customer.posStatus,
              platformManagedStatus: customer.platformManagedStatus,
              omeStatus: customer.omeStatus,
              smartRobotStatus: customer.smartRobotStatus,
              contactStatus: customer.contactStatus,
            })
            setEditModalOpen(true)
          }}>編輯興趣程度</Button>
        )}
      </div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {productConfig.map(p => (
          <Card key={p.field} size="small" style={{ width: 160 }}>
            <Text strong>{p.label}</Text>
            <br />
            <Tag color={interestColors[customer[p.field]]} style={{ marginTop: 8 }}>
              {interestLabels[customer[p.field]] || customer[p.field]}
            </Tag>
          </Card>
        ))}
      </div>
    </div>
  )

  // Communication history
  const communications = customer.pipeline?.communications || []
  const commContent = communications.length > 0 ? (
    <Timeline
      items={communications.map((c: any) => ({
        children: (
          <div>
            <Text type="secondary">{dayjs(c.contactDate).format('YYYY-MM-DD')} · 第{c.contactOrder}次</Text>
            {c.createdBy && <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>— {c.createdBy.name}</Text>}
            <div style={{ marginTop: 4 }}>{c.record}</div>
          </div>
        ),
      })).reverse()}
    />
  ) : (
    <Empty description="暫無溝通記錄" />
  )

  // Subscribe/Support ticket columns
  const subscriptionColumns = [
    { title: '產品', dataIndex: ['product', 'name'], key: 'product' },
    {
      title: '方案', dataIndex: 'plan', key: 'plan',
      render: (v: string) => ({ MONTHLY: '月繳', QUARTERLY: '季繳', SEMI_ANNUAL: '半年繳', ANNUAL: '年繳' }[v] || v),
    },
    {
      title: '狀態', dataIndex: 'status', key: 'status',
      render: (v: string) => {
        const colors: Record<string, string> = { ACTIVE: 'green', CANCELLED: 'red', EXPIRED: 'orange', TRIALING: 'blue' }
        const labels: Record<string, string> = { ACTIVE: '啟用中', CANCELLED: '已取消', EXPIRED: '已到期', TRIALING: '試用中' }
        return <Tag color={colors[v]}>{labels[v] || v}</Tag>
      },
    },
    { title: 'MRR', dataIndex: 'mrr', key: 'mrr', render: (v: number) => `$${v.toLocaleString()}` },
    { title: '開始', dataIndex: 'startDate', key: 'startDate', render: (v: string) => dayjs(v).format('YYYY-MM-DD') },
    { title: '結束', dataIndex: 'endDate', key: 'endDate', render: (v: string | null) => v ? dayjs(v).format('YYYY-MM-DD') : '-' },
  ]

  const ticketColumns = [
    { title: '主題', dataIndex: 'subject', key: 'subject', render: (text: string, r: any) => <a href={`/support-tickets/${r.id}`}>{text}</a> },
    {
      title: '狀態', dataIndex: 'status', key: 'status',
      render: (v: string) => {
        const colors: Record<string, string> = { OPEN: 'blue', RESOLVED: 'green', CLOSED: 'gray', PENDING: 'orange' }
        const labels: Record<string, string> = { OPEN: '開啟', RESOLVED: '已解決', CLOSED: '已關閉', PENDING: '待回覆' }
        return <Tag color={colors[v]}>{labels[v] || v}</Tag>
      },
    },
    {
      title: '優先級', dataIndex: 'priority', key: 'priority',
      render: (v: string) => <Tag color={v === 'URGENT' ? 'red' : v === 'HIGH' ? 'orange' : 'blue'}>{v}</Tag>,
    },
    { title: '負責人', dataIndex: ['assignedTo', 'name'], key: 'assignedTo', render: (v: string | null) => v || '-' },
    { title: '創建', dataIndex: 'createdAt', key: 'createdAt', render: (v: string) => dayjs(v).format('MM-DD') },
  ]

  // Visit records
  const visitColumns = [
    { title: '日期', dataIndex: 'visitDate', key: 'visitDate', render: (v: string) => dayjs(v).format('YYYY-MM-DD') },
    { title: '拜訪人', key: 'visitedBy', render: (_: any, r: any) => r.visitedBy?.name || '-' },
    { title: '結果', dataIndex: 'outcome', key: 'outcome' },
    { title: '備註', dataIndex: 'notes', key: 'notes' },
  ]

  // Health score display
  const hs = customer.healthScoreObj
  const scoreColor = (score: number) => score >= 70 ? '#52c41a' : score >= 40 ? '#faad14' : '#ff4d4f'
  const churnLabels: Record<string, string> = { LOW: '健康', MEDIUM: '需關注', HIGH: '高風險' }
  const churnColors: Record<string, string> = { LOW: 'green', MEDIUM: 'orange', HIGH: 'red' }

  // Tier/Status label helpers
  const tierLabels: Record<string, string> = { ENTERPRISE: '企業', MID_MARKET: '中階', SMB: '一般' }
  const tierColors: Record<string, string> = { ENTERPRISE: 'red', MID_MARKET: 'blue', SMB: 'green' }
  const statusLabels: Record<string, string> = { ACTIVE: '活躍', INACTIVE: '不活躍', ARCHIVED: '已歸檔' }
  const statusColorsBadge: Record<string, string> = { ACTIVE: 'green', INACTIVE: 'orange', ARCHIVED: 'default' }

  return (
    <AppLayout>
      <Breadcrumb
        items={[
          { title: <a onClick={() => router.push('/customers')}>客戶列表</a> },
          { title: customer.name },
        ]}
        style={{ marginBottom: 16 }}
      />

      {/* Basic Info Card */}
      <Card
        title={
          <Space>
            <Title level={4} style={{ margin: 0 }}>{customer.name}</Title>
            {customer.tier && <Tag color={tierColors[customer.tier]}>{tierLabels[customer.tier] || customer.tier}</Tag>}
            {customer.status && <Tag color={statusColorsBadge[customer.status]}>{statusLabels[customer.status] || customer.status}</Tag>}
            {customer.source && <Tag>{customer.source}</Tag>}
          </Space>
        }
        extra={
          <Space>
            {(isAdmin || isOwner) && (
              <Button icon={<UserOutlined />} onClick={() => {
                profileForm.setFieldsValue({
                  name: customer.name,
                  sapId: customer.sapId,
                  city: customer.city,
                  region: customer.region,
                  address: customer.address,
                  area: customer.area,
                  storePhone: customer.storePhone,
                  floorManager: customer.floorManager,
                  floorManagerPhone: customer.floorManagerPhone,
                  merchantContact: customer.merchantContact,
                  merchantContactPhone: customer.merchantContactPhone,
                  keyman: customer.keyman,
                  website: customer.website,
                  type: customer.type,
                  storeType: customer.storeType,
                  storeSize: customer.storeSize,
                  notes: customer.notes,
                  tier: customer.tier,
                  status: customer.status,
                  source: customer.source,
                  onboardingStatus: customer.onboardingStatus,
                  contactStatus: customer.contactStatus,
                })
                setProfileEditOpen(true)
              }}>
                編輯資料
              </Button>
            )}
            {hs && (
              <Space size={4}>
                <Tag color={churnColors[hs.churnRisk]}>{churnLabels[hs.churnRisk]}</Tag>
                <Text type="secondary">健康度</Text>
                <Progress
                  type="circle"
                  percent={hs.overallScore}
                  size={30}
                  strokeColor={scoreColor(hs.overallScore)}
                  format={() => `${hs.overallScore}`}
                />
              </Space>
            )}
            <Tag color={customer.contactStatus === '合作中' ? 'green' : customer.contactStatus === '已流失' ? 'red' : 'blue'}>
              {customer.contactStatus || '未知'}
            </Tag>
          </Space>
        }
      >
        <Descriptions column={{ xs: 1, sm: 2, md: 3 }} size="small" bordered>
          <Descriptions.Item label="SAP ID">{customer.sapId || '-'}</Descriptions.Item>
          <Descriptions.Item label="城市">{customer.city || '-'}</Descriptions.Item>
          <Descriptions.Item label="區域">{customer.region || '-'}</Descriptions.Item>
          <Descriptions.Item label="地址" span={2}>{customer.address || '-'}</Descriptions.Item>
          <Descriptions.Item label="店鋪電話">{customer.storePhone || '-'}</Descriptions.Item>
          <Descriptions.Item label="樓面負責人">{customer.floorManager || '-'}</Descriptions.Item>
          <Descriptions.Item label="樓面電話">{customer.floorManagerPhone || '-'}</Descriptions.Item>
          <Descriptions.Item label="商家負責人">{customer.merchantContact || '-'}</Descriptions.Item>
          <Descriptions.Item label="負責人電話">{customer.merchantContactPhone || '-'}</Descriptions.Item>
          <Descriptions.Item label="Keyman">{customer.keyman || '-'}</Descriptions.Item>
          <Descriptions.Item label="官網">{customer.website || '-'}</Descriptions.Item>
          <Descriptions.Item label="類別">{customer.type || '-'}</Descriptions.Item>
          <Descriptions.Item label="店鋪類型">{customer.storeType || '-'}</Descriptions.Item>
          <Descriptions.Item label="店鋪規模">{customer.storeSize || '-'}</Descriptions.Item>
          <Descriptions.Item label="跟進人">{customer.follower?.name || '-'}</Descriptions.Item>
          <Descriptions.Item label="備註" span={3}>{customer.notes || '-'}</Descriptions.Item>
          <Descriptions.Item label="來源">{customer.source || '-'}</Descriptions.Item>
          <Descriptions.Item label="入職狀態">
            {customer.onboardingStatus ? (
              <Tag color={customer.onboardingStatus === 'COMPLETED' ? 'green' : customer.onboardingStatus === 'IN_PROGRESS' ? 'blue' : 'default'}>
                {({ NOT_STARTED: '未開始', IN_PROGRESS: '進行中', COMPLETED: '已完成' } as Record<string, string>)[customer.onboardingStatus] || customer.onboardingStatus}
              </Tag>
            ) : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="首次購買">
            {customer.firstPurchasedAt ? dayjs(customer.firstPurchasedAt).format('YYYY-MM-DD') : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="最近活動">
            {customer.lastActivityAt ? dayjs(customer.lastActivityAt).format('YYYY-MM-DD') : '-'}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* Health Score Sub-scores */}
      {hs && (
        <Card size="small" style={{ marginTop: 16 }}>
          <Row gutter={16}>
            <Col span={6}>
              <Text type="secondary">互動度</Text>
              <Progress percent={hs.engagementScore || 0} size="small" strokeColor={scoreColor(hs.engagementScore || 0)} />
            </Col>
            <Col span={6}>
              <Text type="secondary">產品採用</Text>
              <Progress percent={hs.productAdoptionScore || 0} size="small" strokeColor={scoreColor(hs.productAdoptionScore || 0)} />
            </Col>
            <Col span={6}>
              <Text type="secondary">客服健康</Text>
              <Progress percent={hs.supportHealthScore || 0} size="small" strokeColor={scoreColor(hs.supportHealthScore || 0)} />
            </Col>
            <Col span={6}>
              <Text type="secondary">訂閱健康</Text>
              <Progress percent={hs.subscriptionHealth || 0} size="small" strokeColor={scoreColor(hs.subscriptionHealth || 0)} />
            </Col>
          </Row>
        </Card>
      )}

      {/* Tabs for Product Matrix, Communications, Visits, Subscriptions, Tickets */}
      <Card style={{ marginTop: 16 }}>
        <Tabs
          defaultActiveKey="products"
          items={[
            {
              key: 'merchant',
              label: (
                <span><ShopOutlined /> 商家檔案</span>
              ),
              children: (
                <div>
                  {profileLoading ? <Spin /> : !merchantProfile ? (
                    <Empty description="暫無商家檔案數據">
                      <Button onClick={fetchMerchantProfile}>加載</Button>
                    </Empty>
                  ) : (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                        <Text strong>商家詳細信息</Text>
                        {(isAdmin || isOwner) && (
                          <Button icon={<EditOutlined />} onClick={() => {
                            merchantForm.setFieldsValue({
                              ...merchantProfile,
                              // Ensure JSON fields are displayed as string for textarea editing
                              openingHours: merchantProfile.openingHours
                                ? JSON.stringify(merchantProfile.openingHours, null, 2)
                                : undefined,
                              specialHours: merchantProfile.specialHours
                                ? JSON.stringify(merchantProfile.specialHours, null, 2)
                                : undefined,
                              features: merchantProfile.features
                                ? JSON.stringify(merchantProfile.features, null, 2)
                                : undefined,
                            })
                            setMerchantModalOpen(true)
                          }}>編輯商家檔案</Button>
                        )}
                      </div>

                      {/* External Platform IDs */}
                      {(merchantProfile.kitchChatId || merchantProfile.yelpId || merchantProfile.googleId || merchantProfile.psId) && (
                        <>
                          <Text type="secondary" strong><IdcardOutlined /> 外部平台 ID</Text>
                          <Descriptions size="small" column={4} style={{ marginTop: 8, marginBottom: 16 }} bordered>
                            {merchantProfile.kitchChatId && <Descriptions.Item label="Kitch Chat">{merchantProfile.kitchChatId}</Descriptions.Item>}
                            {merchantProfile.yelpId && <Descriptions.Item label="Yelp">{merchantProfile.yelpId}</Descriptions.Item>}
                            {merchantProfile.googleId && <Descriptions.Item label="Google">{merchantProfile.googleId}</Descriptions.Item>}
                            {merchantProfile.psId && <Descriptions.Item label="PS">{merchantProfile.psId}</Descriptions.Item>}
                          </Descriptions>
                        </>
                      )}

                      {/* Merchant Details */}
                      {(merchantProfile.chineseName || merchantProfile.email || merchantProfile.logoUrl || merchantProfile.bannerUrl) && (
                        <>
                          <Text type="secondary" strong><ShopOutlined /> 商家詳情</Text>
                          <Descriptions size="small" column={2} style={{ marginTop: 8, marginBottom: 16 }} bordered>
                            {merchantProfile.chineseName && <Descriptions.Item label="中文名">{merchantProfile.chineseName}</Descriptions.Item>}
                            {merchantProfile.email && <Descriptions.Item label="郵箱">{merchantProfile.email}</Descriptions.Item>}
                            {merchantProfile.logoUrl && <Descriptions.Item label="LOGO"><a href={merchantProfile.logoUrl} target="_blank">{merchantProfile.logoUrl}</a></Descriptions.Item>}
                            {merchantProfile.bannerUrl && <Descriptions.Item label="Banner"><a href={merchantProfile.bannerUrl} target="_blank">{merchantProfile.bannerUrl}</a></Descriptions.Item>}
                          </Descriptions>
                        </>
                      )}

                      {/* Structured Address */}
                      {(merchantProfile.street || merchantProfile.streetNumber || merchantProfile.state || merchantProfile.zipCode || merchantProfile.country || (merchantProfile.lat && merchantProfile.lng)) && (
                        <>
                          <Text type="secondary" strong><EnvironmentOutlined /> 結構化地址</Text>
                          <Descriptions size="small" column={3} style={{ marginTop: 8, marginBottom: 16 }} bordered>
                            {merchantProfile.street && <Descriptions.Item label="街道">{merchantProfile.street}</Descriptions.Item>}
                            {merchantProfile.streetNumber && <Descriptions.Item label="門牌號">{merchantProfile.streetNumber}</Descriptions.Item>}
                            {merchantProfile.state && <Descriptions.Item label="州">{merchantProfile.state}</Descriptions.Item>}
                            {merchantProfile.zipCode && <Descriptions.Item label="郵編">{merchantProfile.zipCode}</Descriptions.Item>}
                            {merchantProfile.country && <Descriptions.Item label="國家">{merchantProfile.country}</Descriptions.Item>}
                            {(merchantProfile.lat && merchantProfile.lng) && <Descriptions.Item label="經緯度">{merchantProfile.lat}, {merchantProfile.lng}</Descriptions.Item>}
                          </Descriptions>
                        </>
                      )}

                      {/* Operational Data */}
                      {(merchantProfile.priceLevel || merchantProfile.rating || merchantProfile.menuUrl || merchantProfile.googleAiDesc || merchantProfile.aiDesc) && (
                        <>
                          <Text type="secondary" strong>營運數據</Text>
                          <Descriptions size="small" column={2} style={{ marginTop: 8, marginBottom: 16 }} bordered>
                            {merchantProfile.priceLevel && <Descriptions.Item label="價位">{'$'.repeat(merchantProfile.priceLevel)}</Descriptions.Item>}
                            {merchantProfile.rating && <Descriptions.Item label="評分"><Rate disabled value={merchantProfile.rating} allowHalf /></Descriptions.Item>}
                            {merchantProfile.menuUrl && <Descriptions.Item label="菜單"><a href={merchantProfile.menuUrl} target="_blank">查看菜單</a></Descriptions.Item>}
                            {merchantProfile.googleAiDesc && <Descriptions.Item label="Google AI 描述" span={2}>{merchantProfile.googleAiDesc}</Descriptions.Item>}
                            {merchantProfile.aiDesc && <Descriptions.Item label="AI 描述" span={2}>{merchantProfile.aiDesc}</Descriptions.Item>}
                          </Descriptions>
                        </>
                      )}

                      {/* Business Status & Hours */}
                      {merchantProfile.businessStatus && (
                        <Descriptions size="small" column={2} style={{ marginBottom: 16 }} bordered>
                          <Descriptions.Item label="營業狀態">
                            <Tag color={merchantProfile.businessStatus === 'OPERATIONAL' ? 'green' : 'orange'}>
                              {({ OPERATIONAL: '營業中', CLOSED_TEMPORARILY: '暫停營業', CLOSED_PERMANENTLY: '永久關閉' } as Record<string, string>)[merchantProfile.businessStatus] || merchantProfile.businessStatus}
                            </Tag>
                          </Descriptions.Item>
                        </Descriptions>
                      )}

                      {/* Opening Hours */}
                      {merchantProfile.openingHours && Array.isArray(merchantProfile.openingHours) && merchantProfile.openingHours.length > 0 && (
                        <div style={{ marginBottom: 16 }}>
                          <Text type="secondary" strong>營業時間</Text>
                          <Table
                            dataSource={merchantProfile.openingHours}
                            columns={[
                              { title: '星期', dataIndex: 'day', key: 'day', render: (v: string) => v },
                              { title: '開店', dataIndex: 'open', key: 'open' },
                              { title: '關店', dataIndex: 'close', key: 'close' },
                            ]}
                            rowKey="day"
                            pagination={false}
                            size="small"
                            style={{ marginTop: 8 }}
                          />
                        </div>
                      )}

                      {/* Feature Tags */}
                      {merchantProfile.features && typeof merchantProfile.features === 'object' && (
                        <div style={{ marginBottom: 16 }}>
                          <Text type="secondary" strong><TagOutlined /> 商家特徵</Text>
                          <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {Object.entries(merchantProfile.features).map(([key, val]) => {
                              if (typeof val === 'boolean' && val) {
                                const labels: Record<string, string> = {
                                  takeout: '外帶', delivery: '外送', dineIn: '堂食', curbsidePickup: '車道取貨',
                                  driveThru: '車道窗口', reservable: '可預約', outdoorSeating: '戶外座位',
                                  goodForGroups: '適合團體', goodForChildren: '適合兒童', menuForChildren: '兒童菜單',
                                  hasWiFi: '有 WiFi', allowsDogs: '可帶狗', wheelchairAccessible: '輪椅通行',
                                  liveMusic: '現場音樂', hasTV: '有電視', acceptsCreditCards: '接受信用卡',
                                  contactlessPayment: '非接觸支付', byob: '自帶酒水', privateDining: '私人宴會',
                                  happyHour: '歡樂時光', coatCheck: '大衣寄存', smoking: '吸煙區',
                                  halal: '清真', kosher: '猶太潔食', glutenFree: '無麩質',
                                }
                                return <Tag key={key} color="blue">{labels[key] || key}</Tag>
                              }
                              return null
                            })}
                          </div>
                        </div>
                      )}

                      {merchantProfile.dataSource && (
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          數據來源：{merchantProfile.dataSource}
                          {merchantProfile.lastSyncedAt && <> · 最後同步：{dayjs(merchantProfile.lastSyncedAt).format('YYYY-MM-DD HH:mm')}</>}
                        </Text>
                      )}
                    </div>
                  )}
                </div>
              ),
            },
            {
              key: 'products',
              label: '產品興趣矩陣',
              children: productMatrixContent,
            },
            {
              key: 'communications',
              label: (
                <span>
                  溝通歷史
                  {communications.length > 0 && <Tag style={{ marginLeft: 8 }}>{communications.length}</Tag>}
                </span>
              ),
              children: (
                <div>
                  <div style={{ marginBottom: 16 }}>
                    <Button icon={<PlusOutlined />} onClick={() => setCommModalOpen(true)}>
                      添加溝通記錄
                    </Button>
                  </div>
                  {commContent}
                </div>
              ),
            },
            {
              key: 'visits',
              label: '拜訪記錄',
              children: (
                <Table
                  dataSource={customer.visits || []}
                  columns={visitColumns}
                  rowKey="id"
                  pagination={false}
                  locale={{ emptyText: <Empty description="暫無拜訪記錄" /> }}
                />
              ),
            },
            {
              key: 'subscriptions',
              label: (
                <span>
                  訂閱
                  {(customer.subscriptions?.length || 0) > 0 && <Tag style={{ marginLeft: 8 }}>{customer.subscriptions?.length}</Tag>}
                </span>
              ),
              children: (
                <Table
                  dataSource={customer.subscriptions || []}
                  columns={subscriptionColumns}
                  rowKey="id"
                  pagination={false}
                  locale={{ emptyText: <Empty description="暫無訂閱記錄" /> }}
                />
              ),
            },
            {
              key: 'tickets',
              label: (
                <span>
                  工單
                  {(customer.supportTickets?.length || 0) > 0 && <Tag style={{ marginLeft: 8 }}>{customer.supportTickets?.length}</Tag>}
                </span>
              ),
              children: (
                <Table
                  dataSource={customer.supportTickets || []}
                  columns={ticketColumns}
                  rowKey="id"
                  pagination={false}
                  locale={{ emptyText: <Empty description="暫無客服工單" /> }}
                />
              ),
            },
            {
              key: 'editLog',
              label: (
                <span>
                  編輯歷史
                  {(customer.customerLogs?.length || 0) > 0 && <Tag style={{ marginLeft: 8 }}>{customer.customerLogs?.length}</Tag>}
                </span>
              ),
              children: (
                <div>
                  {(customer.customerLogs || []).length === 0 ? (
                    <Empty description="尚無編輯記錄" />
                  ) : (
                    <Timeline
                      items={(customer.customerLogs || []).map((log: any) => ({
                        children: (
                          <div>
                            <Text type="secondary">
                              {dayjs(log.createdAt).format('YYYY-MM-DD HH:mm')}
                              {log.changedBy && <> · {log.changedBy.name}</>}
                            </Text>
                            <div style={{ marginTop: 2 }}>
                              <Tag>{log.fieldName}</Tag>
                              {log.oldValue !== null && <Text delete style={{ color: '#999' }}>{log.oldValue}</Text>}
                              {log.oldValue !== null && log.newValue !== null && <span style={{ margin: '0 6px', color: '#999' }}>→</span>}
                              {log.newValue !== null && <Text style={{ color: '#52c41a' }}>{log.newValue}</Text>}
                              {log.oldValue === null && log.newValue !== null && <Text style={{ color: '#52c41a' }}>{log.newValue}（新增）</Text>}
                              {log.oldValue !== null && log.newValue === null && <Text style={{ color: '#ff4d4f' }}>清空</Text>}
                            </div>
                          </div>
                        ),
                      }))}
                    />
                  )}
                </div>
              ),
            },
          ]}
        />
      </Card>

      {/* Edit Profile Modal */}
      <Modal
        title="編輯客戶資料"
        open={profileEditOpen}
        onCancel={() => { setProfileEditOpen(false) }}
        onOk={() => profileForm.submit()}
        confirmLoading={saving}
        width={640}
      >
        <Form form={profileForm} layout="vertical" onFinish={handleSaveProfile}>
          <Form.Item name="name" label="商家名稱" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="sapId" label="SAP ID">
            <Input />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="city" label="城市">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="region" label="區域">
                <Select allowClear placeholder="選擇區域"
                  options={REGIONS.map(r => ({ label: r, value: r }))}
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="address" label="地址">
            <Input />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="storePhone" label="店鋪電話">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="website" label="官網">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="floorManager" label="樓面負責人">
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="floorManagerPhone" label="樓面電話">
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="keyman" label="Keyman">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="merchantContact" label="商家負責人">
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="merchantContactPhone" label="負責人電話">
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="type" label="類別">
                <Select allowClear options={CUSTOMER_TYPES.map(t => ({ label: t, value: t }))} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="storeType" label="店鋪類型">
                <Input placeholder="單店/連鎖" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="storeSize" label="店鋪規模">
                <Input placeholder="座位數" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="area" label="片區">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="notes" label="備註">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="tier" label="層級">
                <Select allowClear options={CUSTOMER_TIERS.map(t => ({ label: t, value: t }))} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="status" label="客戶狀態">
                <Select allowClear options={CUSTOMER_STATUSES.map(t => ({ label: t, value: t }))} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="source" label="來源">
                <Select allowClear options={CUSTOMER_SOURCES.map(t => ({ label: t, value: t }))} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="onboardingStatus" label="入職狀態">
                <Select allowClear options={ONBOARDING_STATUSES.map(t => ({ label: t, value: t }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="contactStatus" label="接觸狀態">
                <Select allowClear options={[
                  { label: '合作中', value: '合作中' },
                  { label: '已建联', value: '已建联' },
                  { label: '已流失', value: '已流失' },
                ]} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* Edit Product Interest Modal */}
      <Modal
        title="編輯產品興趣程度"
        open={editModalOpen}
        onCancel={() => setEditModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={saving}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSaveProducts}
        >
          {productConfig.map(p => (
            <Form.Item key={p.field} name={p.field} label={p.label}>
              <Select options={allInterestLevels.map(l => ({
                label: interestLabels[l],
                value: l,
              }))} />
            </Form.Item>
          ))}
          <Form.Item name="contactStatus" label="整體接觸狀態">
            <Select
              options={[
                { label: '合作中', value: '合作中' },
                { label: '已建联', value: '已建联' },
                { label: '已流失', value: '已流失' },
                { label: '', value: '' },
              ]}
              allowClear
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Add Communication Modal */}
      <Modal
        title="添加溝通記錄"
        open={commModalOpen}
        onCancel={() => setCommModalOpen(false)}
        onOk={() => commForm.submit()}
        confirmLoading={saving}
      >
        <Form
          form={commForm}
          layout="vertical"
          onFinish={handleAddCommunication}
        >
          <Form.Item name="contactDate" label="聯繫日期" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="record" label="溝通記錄" rules={[{ required: true }]}>
            <Input.TextArea rows={4} placeholder="記錄溝通內容..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* Merchant Profile Edit Modal */}
      <Modal
        title="編輯商家檔案"
        open={merchantModalOpen}
        onCancel={() => setMerchantModalOpen(false)}
        onOk={() => merchantForm.submit()}
        confirmLoading={saving}
        width={720}
      >
        <Form
          form={merchantForm}
          layout="vertical"
          onFinish={handleSaveMerchantProfile}
          style={{ maxHeight: '60vh', overflowY: 'auto' }}
        >
          <Text type="secondary" strong>外部平台 ID</Text>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="kitchChatId" label="Kitch Chat ID"><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="yelpId" label="Yelp ID"><Input /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="googleId" label="Google Place ID"><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="psId" label="PS ID"><Input /></Form.Item></Col>
          </Row>

          <Text type="secondary" strong>商家詳情</Text>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="chineseName" label="餐館中文名"><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="email" label="郵箱"><Input /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="logoUrl" label="LOGO URL"><Input placeholder="https://..." /></Form.Item></Col>
            <Col span={12}><Form.Item name="bannerUrl" label="Banner URL"><Input placeholder="https://..." /></Form.Item></Col>
          </Row>

          <Text type="secondary" strong>結構化地址</Text>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="street" label="街道"><Input /></Form.Item></Col>
            <Col span={6}><Form.Item name="streetNumber" label="門牌號"><Input /></Form.Item></Col>
            <Col span={6}><Form.Item name="state" label="州"><Input placeholder="CA" /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}><Form.Item name="zipCode" label="郵編"><Input /></Form.Item></Col>
            <Col span={8}><Form.Item name="country" label="國家"><Input placeholder="US" /></Form.Item></Col>
            <Col span={8}><Form.Item name="dataSource" label="數據來源">
              <Select allowClear options={[
                { label: 'Google', value: 'GOOGLE' },
                { label: 'Hifood', value: 'HIFOOD' },
                { label: 'OME', value: 'OME' },
                { label: '手動輸入', value: 'MANUAL' },
                { label: '商家提供', value: 'MERCHANT' },
              ]} />
            </Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}><Form.Item name="lat" label="緯度"><InputNumber style={{ width: '100%' }} step={0.0001} /></Form.Item></Col>
            <Col span={8}><Form.Item name="lng" label="經度"><InputNumber style={{ width: '100%' }} step={0.0001} /></Form.Item></Col>
            <Col span={8}><Form.Item name="businessStatus" label="營業狀態">
              <Select allowClear options={[
                { label: '營業中', value: 'OPERATIONAL' },
                { label: '暫停營業', value: 'CLOSED_TEMPORARILY' },
                { label: '永久關閉', value: 'CLOSED_PERMANENTLY' },
              ]} />
            </Form.Item></Col>
          </Row>

          <Text type="secondary" strong>營運數據</Text>
          <Row gutter={16}>
            <Col span={8}><Form.Item name="priceLevel" label="價位">
              <Select allowClear options={[
                { label: '$', value: 1 },
                { label: '$$', value: 2 },
                { label: '$$$', value: 3 },
                { label: '$$$$', value: 4 },
              ]} />
            </Form.Item></Col>
            <Col span={8}><Form.Item name="rating" label="評分"><InputNumber min={0} max={5} step={0.1} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={8}><Form.Item name="menuUrl" label="菜單 URL"><Input placeholder="https://..." /></Form.Item></Col>
          </Row>
          <Form.Item name="googleAiDesc" label="Google AI 描述">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="aiDesc" label="AI 描述">
            <Input.TextArea rows={2} />
          </Form.Item>

          <Text type="secondary" strong>營業時間 (JSON)</Text>
          <Form.Item name="openingHours" label="營業時間">
            <Input.TextArea rows={3} placeholder='[{"day":"Monday","open":"09:00","close":"22:00"}]' />
          </Form.Item>
          <Form.Item name="specialHours" label="特殊營業時間">
            <Input.TextArea rows={2} placeholder='[{"date":"2026-01-01","open":"10:00","close":"18:00"}]' />
          </Form.Item>

          <Text type="secondary" strong>商家特徵 (JSON)</Text>
          <Form.Item name="features" label="特徵標籤">
            <Input.TextArea rows={4} placeholder='{"takeout":true,"delivery":true,"hasWiFi":false,"outdoorSeating":true}' />
          </Form.Item>
        </Form>
      </Modal>
    </AppLayout>
  )
}
