/**
 * GET /api/integration/stats
 *
 * Aggregated KPIs and groupBy queries for the integration API.
 * All endpoints share the same auth layer (x-api-token or session).
 *
 * Query parameters:
 *   metric       — required: which aggregation to compute
 *                  customer_count   — total customer count (default)
 *                  customer_count_by_product     — count by product interest
 *                  customer_count_by_interest    — count by interest level
 *                  customer_count_by_region      — count by region
 *                  customer_count_by_follower    — count by follower
 *                  customer_count_by_status      — count by customer status
 *                  customer_count_by_tier        — count by tier
 *                  customer_count_by_deployment  — count by product deployment
 *                  gmv_total                  — total GMV (from TransactionMetric)
 *                  orders_total               — total order count
 *                  revenue_total              — total revenue (from RevenueRecord + TransactionMetric)
 *                  revenue_by_product         — revenue grouped by product key
 *                  mrr_total                  — total MRR from active subscriptions
 *                  mrr_by_product             — MRR grouped by product
 *                  deployment_count           — total product deployments by key
 *
 *   groupBy        — alternative: specify groupBy + metric
 *                    e.g. groupBy=product&metric=count
 *
 *   product        — filter by product key (for product-scoped metrics)
 *   interestLevel  — filter by interest level
 *   deploymentProduct — filter by deployment product key
 *   deploymentStatus   — filter by deployment status (ACTIVE/CHURNED/PAUSED)
 *   region         — filter by region
 *   followerId     — filter by follower
 *   from           — ISO date range (createdAt for customers, metricDate for metrics)
 *   to             — ISO date range
 *
 * Example:
 *   GET /api/integration/stats?metric=customer_count_by_product
 *   GET /api/integration/stats?metric=customer_count&product=aiManager&interestLevel=HIGH_INTENT
 *   GET /api/integration/stats?metric=deployment_count&deploymentProduct=pos
 *   GET /api/integration/stats?metric=revenue_total&from=2026-01-01&to=2026-09-09
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  parseIntegrationAuth,
  getIntegrationScope,
  isAuthenticated,
} from '../auth'
import { INTEREST_LEVELS, PRODUCT_KEYS, PRODUCT_KEY_LABELS, REGIONS } from '@/lib/constants'
import { PRODUCT_KEY_TO_FIELD } from '../customers/route'

export async function GET(req: NextRequest) {
  const ctx = await parseIntegrationAuth(req)

  if (!isAuthenticated(ctx)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const scope = getIntegrationScope(ctx)
  const params = req.nextUrl.searchParams
  const metric = params.get('metric') || 'customer_count'

  // ── Build common customer where clause ──
  const customerWhere: any = { ...scope }
  const customerStatus = params.get('customerStatus')
  if (customerStatus === 'ALL') {
    // no filter
  } else if (customerStatus) {
    customerWhere.status = customerStatus
  } else {
    customerWhere.status = { not: 'ARCHIVED' }
  }

  if (params.get('region')) customerWhere.region = params.get('region')
  if (params.get('followerId')) customerWhere.followerId = parseInt(params.get('followerId')!)
  if (params.get('tier')) customerWhere.tier = params.get('tier')
  if (params.get('type')) customerWhere.type = params.get('type')
  if (params.get('storeType')) customerWhere.storeType = params.get('storeType')

  const from = params.get('from')
  const to = params.get('to')
  if (from || to) {
    customerWhere.createdAt = {}
    if (from) customerWhere.createdAt.gte = new Date(from)
    if (to) customerWhere.createdAt.lte = new Date(to + 'T23:59:59')
  }

  // Product interest filter
  const product = params.get('product')
  const interestLevel = params.get('interestLevel')
  if (product && interestLevel) {
    const field = PRODUCT_KEY_TO_FIELD[product]
    if (field && INTEREST_LEVELS.includes(interestLevel as any)) {
      customerWhere[field] = interestLevel
    }
  }

  // Deployment filter
  const deploymentProduct = params.get('deploymentProduct')
  const deploymentStatus = params.get('deploymentStatus')
  if (deploymentProduct) {
    const deployWhere: any = { productKey: deploymentProduct }
    if (deploymentStatus) deployWhere.status = deploymentStatus
    const deployedCustomerIds = await prisma.productDeployment
      .findMany({ where: deployWhere, select: { customerId: true } })
    const ids = deployedCustomerIds.map((d: any) => d.customerId)
    if (ids.length > 0) {
      customerWhere.id = { in: ids }
    } else {
      return NextResponse.json({ metric, data: {} })
    }
  }

  // ── Dispatch metric handlers ──
  const handler = METRICS_HANDLERS[metric]
  if (!handler) {
    return NextResponse.json({ error: `Unknown metric: ${metric}` }, { status: 400 })
  }

  const data = await handler(req, customerWhere, scope)

  return NextResponse.json({ metric, data })
}

type MetricHandler = (
  req: NextRequest,
  customerWhere: Record<string, unknown>,
  scope: Record<string, unknown>,
) => Promise<Record<string, unknown>>

// ── Metric handlers ──

const METRICS_HANDLERS: Record<string, MetricHandler> = {

  /** Total customer count */
  customer_count: async (_req, where) => {
    const count = await prisma.customer.count({ where })
    return { count }
  },

  /** Count by product interest field (7 products) */
  customer_count_by_product: async (_req, where) => {
    const PRODUCT_FIELDS_RAW = [
      'posStatus', 'psWebsiteStatus', 'smtStatus',
      'platformManagedStatus', 'aiCamStatus', 'omeStatus', 'smartRobotStatus',
    ]
    const PRODUCT_LABELS: Record<string, string> = {
      posStatus: 'POS',
      psWebsiteStatus: 'Pocket Store',
      smtStatus: 'SMT',
      platformManagedStatus: 'Loyalty',
      aiCamStatus: 'AI Manager',
      omeStatus: 'OME',
      smartRobotStatus: 'Smart Robot',
    }

    // If a specific product is requested, just do a simple count with that filter
    const product = _req.nextUrl.searchParams.get('product')
    if (product) {
      const field = PRODUCT_KEY_TO_FIELD[product]
      if (field) {
        const productWhere = { ...where }
        productWhere[field] = { in: INTEREST_LEVELS.filter(l => l !== 'NOT_CONTACTED') }
        return {
          product,
          total: await prisma.customer.count({ where: productWhere }),
          interested: await prisma.customer.count({
            where: { ...productWhere, [field]: { in: ['INTERESTED', 'HIGH_INTENT', 'PURCHASED'] } },
          }),
          purchased: await prisma.customer.count({
            where: { ...productWhere, [field]: 'PURCHASED' },
          }),
        }
      }
    }

    // Otherwise, aggregate all 7 products
    const result: Record<string, any> = {}
    for (const field of PRODUCT_FIELDS_RAW) {
      const label = PRODUCT_LABELS[field] || field
      const groups = await prisma.customer.groupBy({
        by: [field as any],
        _count: { id: true },
        where,
      })

      // Initialize all levels at 0
      const counts: Record<string, number> = {}
      for (const level of INTEREST_LEVELS) {
        counts[level] = 0
      }
      // Fill actual counts
      for (const g of groups) {
        const lvl = (g as any)[field]
        if (lvl in counts) {
          counts[lvl] = (g as any)._count?.id ?? 0
        }
      }

      result[label] = {
        field,
        counts,
        totalInterested: (counts['INTERESTED'] ?? 0) + (counts['HIGH_INTENT'] ?? 0) + (counts['PURCHASED'] ?? 0),
        totalPurchased: counts['PURCHASED'] ?? 0,
      }
    }
    return result
  },

  /** Count by interest level (for a given product) */
  customer_count_by_interest: async (req, where) => {
    const product = req.nextUrl.searchParams.get('product')
    if (!product) {
      return { error: 'product parameter is required for customer_count_by_interest' }
    }
    const field = PRODUCT_KEY_TO_FIELD[product]
    if (!field) {
      return { error: `Unknown product: ${product}` }
    }

    const groups = await prisma.customer.groupBy({
      by: [field as any],
      _count: { id: true },
      where: { ...where, [field]: { in: INTEREST_LEVELS } },
    })

    const counts: Record<string, number> = {}
    for (const level of INTEREST_LEVELS) {
      counts[level] = 0
    }
    for (const g of groups) {
      const lvl = (g as any)[field]
      if (lvl in counts) {
        counts[lvl] = (g as any)._count?.id ?? 0
      }
    }

    return {
      product,
      productKey: PRODUCT_KEY_LABELS[product] || product,
      counts,
      totalInterested: (counts['INTERESTED'] ?? 0) + (counts['HIGH_INTENT'] ?? 0) + (counts['PURCHASED'] ?? 0),
    }
  },

  /** Count by region */
  customer_count_by_region: async (_req, where) => {
    const groups = await prisma.customer.groupBy({
      by: ['region'],
      _count: { id: true },
      where,
    })

    // Pre-fill all known regions with 0
    const counts: Record<string, number> = {}
    for (const r of REGIONS) {
      counts[r] = 0
    }
    for (const g of groups) {
      const region = g.region as string
      if (region) counts[region] = g._count.id
    }

    return { counts, total: groups.reduce((s, g) => s + g._count.id, 0) }
  },

  /** Count by follower (sales person) */
  customer_count_by_follower: async (_req, where) => {
    const groups = await prisma.customer.groupBy({
      by: ['followerId'],
      _count: { id: true },
      where,
    })

    const result = groups.map((g: any) => ({
      followerId: g.followerId,
      count: g._count.id,
    }))

    return { followers: result, total: groups.reduce((s, g) => s + g._count.id, 0) }
  },

  /** Count by customer status */
  customer_count_by_status: async (_req, where) => {
    const groups = await prisma.customer.groupBy({
      by: ['status'],
      _count: { id: true },
      where,
    })

    const counts: Record<string, number> = { ACTIVE: 0, INACTIVE: 0, ARCHIVED: 0 }
    for (const g of groups) {
      const status = g.status as string
      if (status in counts) counts[status] = g._count.id
    }
    return { counts, total: groups.reduce((s, g) => s + g._count.id, 0) }
  },

  /** Count by tier */
  customer_count_by_tier: async (_req, where) => {
    const groups = await prisma.customer.groupBy({
      by: ['tier'],
      _count: { id: true },
      where,
    })

    const counts: Record<string, number> = { ENTERPRISE: 0, MID_MARKET: 0, SMB: 0 }
    for (const g of groups) {
      const tier = g.tier as string
      if (tier in counts) counts[tier] = g._count.id
    }
    return { counts, total: groups.reduce((s, g) => s + g._count.id, 0) }
  },

  /** Count by product deployment (active deployments) */
  customer_count_by_deployment: async (req, where) => {
    const deployWhere: any = {}
    const whereAny = where as any
    if (whereAny.id?.in) {
      deployWhere.customerId = { in: whereAny.id.in }
    }
    delete where.id // remove temp filter

    const product = req.nextUrl.searchParams.get('product')
    if (product) deployWhere.productKey = product
    deployWhere.status = 'ACTIVE'

    const deployments = await prisma.productDeployment.groupBy({
      by: ['productKey'],
      _count: { id: true },
      where: deployWhere,
    })

    return {
      deployments: deployments.map((d: any) => ({
        productKey: d.productKey,
        productName: PRODUCT_KEY_LABELS[d.productKey] || d.productKey,
        activeCustomers: d._count.id,
      })),
      totalDeployments: deployments.reduce((s, d) => s + d._count.id, 0),
    }
  },

  /** Total GMV from transaction metrics */
  gmv_total: async (req) => {
    const metricWhere: any = {}
    const from = req.nextUrl.searchParams.get('from')
    const to = req.nextUrl.searchParams.get('to')
    if (from) metricWhere.metricDate = { gte: new Date(from) }
    if (to) metricWhere.metricDate = { lte: new Date(to + 'T23:59:59') }

    const product = req.nextUrl.searchParams.get('product')
    if (product) metricWhere.productKey = product

    const agg = await prisma.transactionMetric.aggregate({
      where: metricWhere,
      _sum: { gmv: true },
      _count: { id: true },
    })

    return {
      gmv: agg._sum.gmv ?? 0,
      recordCount: agg._count.id,
    }
  },

  /** Total orders from transaction metrics */
  orders_total: async (req) => {
    const metricWhere: any = {}
    const from = req.nextUrl.searchParams.get('from')
    const to = req.nextUrl.searchParams.get('to')
    if (from) metricWhere.metricDate = { gte: new Date(from) }
    if (to) metricWhere.metricDate = { lte: new Date(to + 'T23:59:59') }

    const product = req.nextUrl.searchParams.get('product')
    if (product) metricWhere.productKey = product

    const agg = await prisma.transactionMetric.aggregate({
      where: metricWhere,
      _sum: { orders: true },
    })

    return { orders: agg._sum.orders ?? 0 }
  },

  /** Total revenue from RevenueRecord + TransactionMetric */
  revenue_total: async (req) => {
    const from = req.nextUrl.searchParams.get('from')
    const to = req.nextUrl.searchParams.get('to')
    const product = req.nextUrl.searchParams.get('product')
    const productKey = product || undefined

    // Revenue records
    const revenueWhere: any = {}
    if (productKey) revenueWhere.productKey = productKey
    if (from || to) {
      revenueWhere.periodStart = {}
      if (from) revenueWhere.periodStart.gte = new Date(from)
      if (to) revenueWhere.periodStart.lte = new Date(to + 'T23:59:59')
    }

    const revenueAgg = await prisma.revenueRecord.aggregate({
      where: revenueWhere,
      _sum: { amount: true },
    })

    // Transaction metrics revenue
    const metricWhere2: any = {}
    if (productKey) metricWhere2.productKey = productKey
    if (from || to) {
      metricWhere2.metricDate = {}
      if (from) metricWhere2.metricDate.gte = new Date(from)
      if (to) metricWhere2.metricDate.lte = new Date(to + 'T23:59:59')
    }

    const metricAgg = await prisma.transactionMetric.aggregate({
      where: metricWhere2,
      _sum: { revenue: true },
    })

    return {
      revenueRecordAmount: revenueAgg._sum.amount ?? 0,
      transactionRevenue: metricAgg._sum.revenue ?? 0,
      total: ((revenueAgg._sum.amount ?? 0) + (metricAgg._sum.revenue ?? 0)),
    }
  },

  /** Revenue grouped by product key (from RevenueRecord) */
  revenue_by_product: async (req) => {
    const from = req.nextUrl.searchParams.get('from')
    const to = req.nextUrl.searchParams.get('to')

    const where: any = {}
    if (from || to) {
      where.periodStart = {}
      if (from) where.periodStart.gte = new Date(from)
      if (to) where.periodStart.lte = new Date(to + 'T23:59:59')
    }

    const groups = await prisma.revenueRecord.groupBy({
      by: ['productKey'],
      _sum: { amount: true },
      where,
    })

    return { items: groups.map((g: any) => ({
      productKey: g.productKey,
      productName: PRODUCT_KEY_LABELS[g.productKey] || g.productKey,
      amount: g._sum.amount ?? 0,
    })) as unknown as Record<string, unknown> }
  },

  /** Total MRR from active subscriptions */
  mrr_total: async () => {
    const agg = await prisma.subscription.aggregate({
      where: { status: 'ACTIVE' },
      _sum: { mrr: true },
    })
    return { mrr: Math.round((agg._sum.mrr ?? 0) * 100) / 100 }
  },

  /** MRR grouped by product (from active subscriptions) */
  mrr_by_product: async () => {
    const groups = await prisma.subscription.groupBy({
      by: ['productId'],
      _sum: { mrr: true },
      where: { status: 'ACTIVE' },
    })

    const products = await prisma.productCatalog.findMany({
      where: { id: { in: groups.map((g: any) => g.productId) } },
      select: { id: true, key: true, name: true },
    })

    const productMap: Record<number, any> = {}
    for (const p of products) {
      productMap[p.id] = p
    }

    return { items: groups.map((g: any) => ({
      productKey: productMap[g.productId]?.key || null,
      productName: productMap[g.productId]?.name || null,
      mrr: Math.round((g._sum.mrr ?? 0) * 100) / 100,
    })) as unknown as Record<string, unknown> }
  },

  /** Count of product deployments by product key */
  deployment_count: async (req) => {
    const where: any = {}
    const product = req.nextUrl.searchParams.get('product')
    if (product) where.productKey = product
    where.status = 'ACTIVE'

    const groups = await prisma.productDeployment.groupBy({
      by: ['productKey'],
      _count: { id: true },
      where,
    })

    return { items: groups.map((g: any) => ({
      productKey: g.productKey,
      productName: PRODUCT_KEY_LABELS[g.productKey] || g.productKey,
      count: g._count.id,
    })) as unknown as Record<string, unknown> }
  },
}
