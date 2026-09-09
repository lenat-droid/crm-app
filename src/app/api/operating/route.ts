import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getDataScope } from '@/lib/auth-helpers'
import dayjs from 'dayjs'
import { PRODUCT_KEYS } from '@/lib/constants'

/**
 * GET /api/operating — Operating Dashboard API (v1.3.0)
 *
 * Returns all KPIs for the AIM Operating Dashboard.
 *
 * Query params:
 *   - period: 'daily' | 'weekly' | 'monthly' | 'custom' (default: monthly)
 *   - from: ISO date (used with period=custom)
 *   - to:   ISO date (used with period=custom)
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const period = searchParams.get('period') || 'monthly'
  const fromParam = searchParams.get('from')
  const toParam = searchParams.get('to')

  const scope = getDataScope(session)

  // ── Resolve date range ──
  let dateFrom: string
  let dateTo: string

  if (period === 'daily') {
    const today = dayjs().format('YYYY-MM-DD')
    dateFrom = today
    dateTo = today
  } else if (period === 'weekly') {
    dateFrom = dayjs().startOf('week').format('YYYY-MM-DD')
    dateTo = dayjs().endOf('week').format('YYYY-MM-DD')
  } else if (period === 'monthly') {
    dateFrom = dayjs().startOf('month').format('YYYY-MM-DD')
    dateTo = dayjs().endOf('month').format('YYYY-MM-DD')
  } else if (period === 'custom' && fromParam && toParam) {
    dateFrom = fromParam
    dateTo = toParam + 'T23:59:59'
  } else {
    // default: current month
    dateFrom = dayjs().startOf('month').format('YYYY-MM-DD')
    dateTo = dayjs().endOf('month').format('YYYY-MM-DD')
  }

  // ── Build customer filter from scope ──
  const customerWhere: any = { ...scope, status: 'ACTIVE' }
  // For operating dashboard, we want ALL stores (not RBAC filtered) for business-wide metrics
  // But SALES users should only see their own customer data
  // ADMIN/SALES_MGR see everything
  if (session.user.role === 'SALES') {
    customerWhere.followerId = session.user.id as number
  }
  // SALES_MGR already filtered by region in scope

  // ── Parallel queries ──
  const [
    allCustomers,
    registeredStores,
    productDeployments,
    revenueRecords,
    transactionMetrics,
    subscriptions,
    pipelineData,
  ] = await Promise.all([
    // All active customers (for registered stores)
    prisma.customer.findMany({
      where: { ...scope, status: 'ACTIVE' },
      select: { id: true, createdAt: true, firstPurchasedAt: true },
    }),

    // Registered stores: count of all active customers with a contract/billing start
    prisma.customer.count({
      where: { ...scope, status: 'ACTIVE' },
    }),

    // Product deployment counts
    prisma.productDeployment.findMany({
      where: { status: 'ACTIVE' },
      select: { productKey: true, customerId: true, status: true },
    }),

    // Revenue records in date range
    prisma.revenueRecord.findMany({
      where: {
        periodStart: { gte: new Date(dateFrom), lte: new Date(dateTo) },
      },
      select: {
        id: true, customerId: true, productKey: true, revenueType: true,
        amount: true, currency: true, periodStart: true, periodEnd: true,
      },
    }),

    // Transaction metrics in date range
    prisma.transactionMetric.findMany({
      where: {
        metricDate: { gte: new Date(dateFrom), lte: new Date(dateTo + 'T23:59:59') },
      },
      select: {
        id: true, customerId: true, productKey: true, metricDate: true,
        gmv: true, orders: true, revenue: true, revenueType: true,
      },
    }),

    // Active subscriptions (for paid stores)
    prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        ...(scope.followerId ? { salesPersonId: scope.followerId as number } : {}),
      },
      select: {
        id: true, customerId: true, status: true, billingStartDate: true, contractEndDate: true,
        mrr: true, productId: true, product: { select: { key: true } },
        customer: { select: { id: true, region: true } },
      },
    }),

    // Pipeline data (for won/lost)
    prisma.pipeline.findMany({
      where: {
        active: true,
        ...getPipelineScope(scope),
      },
      select: {
        id: true, customerId: true, status: true, closeReason: true,
        customer: { select: { id: true } },
      },
    }),
  ])

  // ── Compute KPIs ──

  // 1. Registered stores = all active customers
  const totalRegisteredStores = registeredStores

  // 2. Active stores = customers with transaction metrics in the period
  const activeStoreIds = new Set(
    transactionMetrics.filter(m => m.gmv > 0 || m.orders > 0).map(m => m.customerId)
  )
  const totalActiveStores = activeStoreIds.size

  // 3. Paid stores = customers with ACTIVE subscriptions and billingStartDate in or before period
  const paidStoreIds = new Set(
    subscriptions
      .filter(s => s.billingStartDate && dayjs(s.billingStartDate).isBefore(new Date(dateTo + 'T23:59:59')))
      .map(s => s.customerId)
  )
  const totalPaidStores = paidStoreIds.size

  // 4. Net new registered this period
  const newRegisteredInPeriod = allCustomers.filter(c =>
    dayjs(c.createdAt).isAfter(new Date(dateFrom)) && dayjs(c.createdAt).isBefore(new Date(dateTo + 'T23:59:59'))
  ).length

  // 5. Net new paid this period
  const newPaidInPeriod = subscriptions.filter(s =>
    s.status === 'ACTIVE' &&
    s.billingStartDate &&
    dayjs(s.billingStartDate).isAfter(new Date(dateFrom)) &&
    dayjs(s.billingStartDate).isBefore(new Date(dateTo + 'T23:59:59'))
  ).map(s => s.customerId)
  const netNewPaid = new Set(newPaidInPeriod).size

  // 6. Revenue total and by type
  const totalRevenue = revenueRecords.reduce((sum, r) => sum + r.amount, 0)
  const revenueByType = revenueRecords.reduce((acc, r) => {
    acc[r.revenueType] = (acc[r.revenueType] || 0) + r.amount
    return acc
  }, {} as Record<string, number>)

  // 7. PS GMV, PS Orders (by productKey = 'pos')
  const posMetrics = transactionMetrics.filter(m => m.productKey === 'pos')
  const totalPsGmv = posMetrics.reduce((sum, m) => sum + m.gmv, 0)
  const totalPsOrders = posMetrics.reduce((sum, m) => sum + m.orders, 0)

  // 8. Product usage from deployments
  const productUsage = PRODUCT_KEYS.map(key => ({
    productKey: key,
    name: getProductKeyName(key),
    count: productDeployments.filter(d => d.productKey === key && d.status === 'ACTIVE').length,
  }))

  // 9. Monthly trend data (last 6 months)
  const monthlyTrend = computeMonthlyTrend(
    revenueRecords, transactionMetrics, subscriptions, dateFrom, dateTo
  )

  // 10. Revenue by product key
  const revenueByProduct = revenueRecords.reduce((acc, r) => {
    acc[r.productKey] = (acc[r.productKey] || 0) + r.amount
    return acc
  }, {} as Record<string, number>)

  // 11. Revenue mix (by type)
  const revenueMix = PRODUCT_KEYS.map(key => ({
    productKey: key,
    name: getProductKeyName(key),
    amount: revenueByProduct[key] || 0,
    pct: totalRevenue > 0 ? Math.round(((revenueByProduct[key] || 0) / totalRevenue) * 10000) / 100 : 0,
  }))

  // 12. Churned this period (pipeline closed LOST or subscription CANCELLED)
  const lostPipelines = pipelineData.filter(p => p.closeReason === 'LOST')
  const churnedSubs = subscriptions.filter(s => s.status === 'CANCELLED')
  const totalChurn = lostPipelines.length + churnedSubs.length

  return NextResponse.json({
    // KPIs
    totalRegisteredStores,
    totalActiveStores,
    totalPaidStores,
    netNewRegistered: newRegisteredInPeriod,
    netNewPaid,
    totalChurn,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    psGmv: Math.round(totalPsGmv * 100) / 100,
    psOrders: totalPsOrders,
    revenueByType,
    revenueByProduct,
    revenueMix,
    productUsage,
    monthlyTrend,
    // Filter metadata
    filters: { period, from: dateFrom, to: dateTo },
  })
}

function getPipelineScope(scope: Record<string, unknown>): Record<string, unknown> {
  if (scope.followerId) return { salesPersonId: scope.followerId as number }
  if (scope.region) return { customer: { region: scope.region as string } }
  return {}
}

function getProductKeyName(key: string): string {
  const labels: Record<string, string> = {
    pocketStore: 'Pocket Store',
    pos: 'POS',
    loyalty: 'Loyalty',
    smt: 'SMT',
    aiManager: 'AI Manager',
    other: '其他',
  }
  return labels[key] || key
}

function computeMonthlyTrend(
  revenueRecords: any[],
  transactionMetrics: any[],
  subscriptions: any[],
  fromParam: string,
  toParam: string
): Array<{ month: string; revenue: number; gmv: number; orders: number; activeStores: number; paidStores: number }> {
  const dateTo = dayjs(toParam)
  const months = 6
  const result: Array<{ month: string; revenue: number; gmv: number; orders: number; activeStores: number; paidStores: number }> = []

  for (let i = months - 1; i >= 0; i--) {
    const monthStart = dateTo.subtract(i, 'month').startOf('month')
    const monthEnd = monthStart.endOf('month')
    const monthKey = monthStart.format('YYYY-MM')

    let monthRevenue = 0
    let monthGmv = 0
    let monthOrders = 0
    const monthActiveStoreIds = new Set<number>()

    // Revenue
    revenueRecords.forEach(r => {
      const rStart = dayjs(r.periodStart)
      if (rStart.isAfter(monthStart) && rStart.isBefore(monthEnd)) {
        monthRevenue += r.amount
      }
    })

    // Transaction metrics
    transactionMetrics.forEach(m => {
      const mDate = dayjs(m.metricDate)
      if (mDate.isAfter(monthStart) && mDate.isBefore(monthEnd)) {
        monthGmv += m.gmv
        monthOrders += m.orders
        monthActiveStoreIds.add(m.customerId)
      }
    })

    // Paid stores (subscriptions with billingStartDate in this month)
    const monthPaid = new Set(
      subscriptions
        .filter(s => {
          if (!s.billingStartDate) return false
          const bs = dayjs(s.billingStartDate)
          return bs.isAfter(monthStart) && bs.isBefore(monthEnd)
        })
        .map(s => s.customerId)
    )

    result.push({
      month: monthKey,
      revenue: Math.round(monthRevenue * 100) / 100,
      gmv: Math.round(monthGmv * 100) / 100,
      orders: monthOrders,
      activeStores: monthActiveStoreIds.size,
      paidStores: monthPaid.size,
    })
  }

  return result
}
