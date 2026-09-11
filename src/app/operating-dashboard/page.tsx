'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Card, Row, Col, Statistic, Table, Typography, Tag, Space,
  Select, DatePicker, Button, Empty,
} from 'antd'
import {
  ShopOutlined, UserOutlined, DollarOutlined, CheckCircleOutlined,
  ReloadOutlined,
  ArrowUpOutlined, ArrowDownOutlined,
} from '@ant-design/icons'
import { Line, Pie, Bar } from '@ant-design/charts'
import dayjs from 'dayjs'
import AppLayout from '@/components/Layout/AppLayout'
import { PRODUCT_KEYS, PRODUCT_KEY_LABELS } from '@/lib/constants'

type PeriodType = 'daily' | 'weekly' | 'monthly' | 'custom'

interface DashboardData {
  totalRegisteredStores: number
  totalActiveStores: number
  totalPaidStores: number
  netNewRegistered: number
  netNewPaid: number
  totalChurn: number
  totalRevenue: number
  psGmv: number
  psOrders: number
  revenueByType: Record<string, number>
  revenueByProduct: Record<string, number>
  revenueMix: Array<{ productKey: string; name: string; amount: number; pct: number }>
  productUsage: Array<{ productKey: string; name: string; count: number }>
  monthlyTrend: Array<{ month: string; revenue: number; gmv: number; orders: number; activeStores: number; paidStores: number }>
  filters: { period: string; from: string; to: string }
}

const periodLabels: Record<PeriodType, string> = {
  daily: '日',
  weekly: '周',
  monthly: '月',
  custom: '自定义',
}

export default function OperatingDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<PeriodType>('monthly')
  const [customRange, setCustomRange] = useState<[string, string] | null>(null)

  const fetchData = useCallback((p: PeriodType, range?: [string, string] | null) => {
    setLoading(true)
    let url = `/api/operating?period=${encodeURIComponent(p)}`
    if (p === 'custom' && range) {
      url += `&from=${encodeURIComponent(range[0])}&to=${encodeURIComponent(range[1])}`
    }
    fetch(url)
      .then(res => res.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchData(period, customRange) }, [period, customRange, fetchData])

  const handlePeriodChange = (val: PeriodType) => {
    setPeriod(val)
    if (val !== 'custom') setCustomRange(null)
  }

  const revenuePerStore = data && data.totalActiveStores > 0
    ? (data.totalRevenue / data.totalActiveStores).toFixed(2)
    : '0.00'

  // ── Revenue trend chart data ──
  const revenueTrendData = (data?.monthlyTrend || []).map(t => ({
    month: t.month,
    Revenue: t.revenue,
    GMV: t.gmv,
    type: 'Revenue',
  })).concat((data?.monthlyTrend || []).map(t => ({
    month: t.month,
    GMV: t.gmv,
    Revenue: t.revenue,
    type: 'GMV',
  })))

  // ── Store trend data ──
  const storeTrendData = (data?.monthlyTrend || []).map(t => ({
    month: t.month,
    active: t.activeStores,
    paid: t.paidStores,
    type: '活跃门店',
  })).concat((data?.monthlyTrend || []).map(t => ({
    month: t.month,
    active: t.activeStores,
    paid: t.paidStores,
    type: '付费门店',
  })))

  // ── Orders data ──
  const ordersData = (data?.monthlyTrend || []).map(t => ({
    month: t.month,
    orders: t.orders,
  }))

  // ── GMV data ──
  const gmvData = (data?.monthlyTrend || []).map(t => ({
    month: t.month,
    gmv: t.gmv,
  }))

  // ── Product usage data ──
  const productUsageData = (data?.productUsage || []).map(p => ({
    name: p.name,
    count: p.count,
  }))

  // ── Revenue mix data ──
  const revenueMixData = (data?.revenueMix || [])
    .filter(r => r.amount > 0)
    .map(r => ({ name: r.name, amount: r.amount, pct: r.pct }))

  return (
    <AppLayout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>经营看板</Typography.Title>
        <Space>
          <Select<PeriodType>
            value={period}
            onChange={handlePeriodChange}
            options={Object.entries(periodLabels).map(([val, label]) => ({ label, value: val as PeriodType }))}
            style={{ width: 100 }}
            size="small"
          />
          {period === 'custom' && (
            <DatePicker.RangePicker
              size="small"
              onChange={dates => {
                if (dates && dates[0] && dates[1]) {
                  setCustomRange([dates[0].format('YYYY-MM-DD'), dates[1].format('YYYY-MM-DD')])
                }
              }}
            />
          )}
          <Button icon={<ReloadOutlined />} size="small" onClick={() => fetchData(period, customRange)}>
            刷新
          </Button>
        </Space>
      </div>

      {/* KPI Cards */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading} hoverable>
            <Statistic
              title="注册门店"
              value={data?.totalRegisteredStores ?? 0}
              prefix={<ShopOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
            <div style={{ marginTop: 4, fontSize: 12 }}>
              <Typography.Text style={{ color: data?.netNewRegistered && data.netNewRegistered > 0 ? '#52c41a' : '#999' }}>
                {data && data.netNewRegistered !== undefined && data.netNewRegistered !== 0
                  ? `${data.netNewRegistered > 0 ? '+' : ''}${data.netNewRegistered} 净增`
                  : ''}
              </Typography.Text>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading} hoverable>
            <Statistic
              title="活跃门店"
              value={data?.totalActiveStores ?? 0}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
            <div style={{ marginTop: 4, fontSize: 12 }}>
              <Typography.Text type="secondary">
                {data ? `${data.totalPaidStores} 付费 · $${revenuePerStore} / store` : ''}
              </Typography.Text>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading} hoverable>
            <Statistic
              title="付费门店"
              value={data?.totalPaidStores ?? 0}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
            <div style={{ marginTop: 4, fontSize: 12 }}>
              <Typography.Text style={{ color: data?.netNewPaid && data.netNewPaid > 0 ? '#52c41a' : '#999' }}>
                {data && data.netNewPaid !== undefined && data.netNewPaid !== 0
                  ? `${data.netNewPaid > 0 ? '+' : ''}${data.netNewPaid} 净增`
                  : ''}
              </Typography.Text>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading} hoverable>
            <Statistic
              title="Revenue"
              value={data?.totalRevenue ?? 0}
              prefix={<DollarOutlined />}
              precision={2}
              valueStyle={{ color: '#faad14' }}
            />
            <div style={{ marginTop: 4, fontSize: 12 }}>
              <Typography.Text type="secondary">PS GMV: ${data?.psGmv?.toLocaleString() ?? '0.00'}</Typography.Text>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Revenue / GMV Trend + Store Trend */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          <Card title="Revenue / GMV 趋势" size="small" loading={loading}>
            {revenueTrendData.length > 0 ? (
              <Line
                data={revenueTrendData}
                xField="month"
                yField="value"
                seriesField="type"
                height={260}
                color={['#1890ff', '#52c41a']}
                yAxis={{ label: { formatter: (v: number) => `$${v.toLocaleString()}` } }}
                tooltip={{
                  formatter: (datum: any) => ({
                    name: datum.type,
                    value: `$${datum.value.toFixed(2).toLocaleString()}`,
                  }),
                }}
              />
            ) : (
              <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
                暂无数据
              </div>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="注册 / 付费门店趋势" size="small" loading={loading}>
            {storeTrendData.length > 0 ? (
              <Line
                data={storeTrendData}
                xField="month"
                yField="value"
                seriesField="type"
                height={260}
                color={['#1890ff', '#722ed1']}
                point={{ size: 3 }}
                tooltip={{
                  formatter: (datum: any) => ({
                    name: datum.type,
                    value: datum.value,
                  }),
                }}
              />
            ) : (
              <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
                暂无数据
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* Orders + GMV */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          <Card title="PS Orders" size="small" loading={loading}>
            {ordersData.length > 0 ? (
              <Bar
                data={ordersData}
                xField="month"
                yField="orders"
                height={260}
                color="#faad14"
                label={{ position: 'top' as const }}
                yAxis={{ label: { formatter: (v: number) => v.toLocaleString() } }}
              />
            ) : (
              <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
                暂无数据
              </div>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="PS GMV" size="small" loading={loading}>
            {gmvData.length > 0 ? (
              <Bar
                data={gmvData}
                xField="month"
                yField="gmv"
                height={260}
                color="#722ed1"
                label={{ position: 'top' as const }}
                yAxis={{ label: { formatter: (v: number) => `$${v.toLocaleString()}` } }}
              />
            ) : (
              <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
                暂无数据
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* Revenue Mix + Product Usage */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          <Card title="Revenue Mix" size="small" loading={loading}>
            {revenueMixData.length > 0 ? (
              <Pie
                data={revenueMixData}
                angleField="amount"
                colorField="name"
                height={280}
                radius={0.85}
                innerRadius={0.5}
                label={{
                  type: 'outer',
                  content: '{name} {percentage}',
                }}
                legend={{ position: 'bottom' }}
              />
            ) : (
              <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
                暂无收入数据
              </div>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="Product Usage" size="small" loading={loading}>
            {productUsageData.length > 0 ? (
              <Bar
                data={productUsageData}
                xField="name"
                yField="count"
                height={280}
                color="#1890ff"
                label={{ position: 'top' as const }}
                xAxis={{ label: { style: { fontSize: 12 } } }}
              />
            ) : (
              <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
                暂无产品开通数据
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </AppLayout>
  )
}
