/**
 * GET /api/integration/customers
 *
 * Unified customer read API for AI Manager, AI Camera, third-party agents, and MCP tools.
 * Returns a clean, agent-friendly response — not raw Prisma structures.
 *
 * Query parameters:
 *   page          — page number (default 1)
 *   pageSize      — items per page, 1-500 (default 50)
 *
 *   // Filters (all optional)
 *   region               — exact region match (e.g. "LA EAST")
 *   followerId           — filter by sales person ID
 *   customerStatus       — ACTIVE | INACTIVE | ARCHIVED | ALL
 *   tier                 — ENTERPRISE | MID_MARKET | SMB
 *   type                 — restaurant type (茶餐廳 / 正餐 / etc.)
 *   storeType            — 單店 | 連鎖
 *
 *   // Product interest (Customer denormalized fields)
 *   product              — product key for interest filter (e.g. "pos", "aiManager", "smt")
 *                         Maps to Customer fields: pos→posStatus, aiManager→aiCamStatus, etc.
 *   interestLevel        — filter by interest level (NOT_CONTACTED | NOT_INTERESTED | AWARE | INTERESTED | HIGH_INTENT | PURCHASED)
 *
 *   // Deployment status (ProductDeployment table)
 *   deploymentStatus     — ACTIVE | CHURNED | PAUSED — only returns customers with matching deployment
 *   deploymentProduct    — product key to check deployment against (e.g. "pos", "aiManager")
 *
 *   // Time range
 *   from                 — ISO date (filters createdAt >= from)
 *   to                   — ISO date (filters createdAt <= to)
 *
 *   // Include related data (defaults to false — only return identifiers)
 *   includeProfile       — include MerchantProfile data
 *   includeDeployments   — include ProductDeployment array
 *   includeSubscriptions — include active Subscription array
 *   includeProductInterest — include normalized ProductInterest array
 *   includeTransactionMetrics — include last 10 TransactionMetric records
 *   includeRevenueRecords   — include last 10 RevenueRecord records
 *
 * Example:
 *   GET /api/integration/customers?product=pos&interestLevel=HIGH_INTENT&deploymentProduct=pos&deploymentStatus=ACTIVE
 *   → Customers interested in POS and already deployed with POS
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  parseIntegrationAuth,
  getIntegrationScope,
  isAuthenticated,
} from '../auth'
import { INTEREST_LEVELS, PRODUCT_KEYS, PRODUCT_KEY_LABELS } from '@/lib/constants'

// Map high-level product keys to Customer denormalized interest fields
export const PRODUCT_KEY_TO_FIELD: Record<string, string> = {
  pos: 'posStatus',
  aiManager: 'aiCamStatus',
  smt: 'smtStatus',
  pocketStore: 'psWebsiteStatus',
  loyalty: 'platformManagedStatus',
  ome: 'omeStatus',
  smartRobot: 'smartRobotStatus',
}

// Reverse map: field → key
const FIELD_TO_PRODUCT_KEY: Record<string, string> = {}
for (const [key, field] of Object.entries(PRODUCT_KEY_TO_FIELD)) {
  FIELD_TO_PRODUCT_KEY[field] = key
}

export async function GET(req: NextRequest) {
  const ctx = await parseIntegrationAuth(req)

  if (!isAuthenticated(ctx)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const scope = getIntegrationScope(ctx)
  const params = req.nextUrl.searchParams

  // ── Pagination ──
  const page = Math.max(1, parseInt(params.get('page') || '1'))
  const pageSize = Math.min(500, Math.max(1, parseInt(params.get('pageSize') || '50')))

  // ── Build where clause ──
  const where: any = { ...scope }

  // Customer status
  const customerStatus = params.get('customerStatus')
  if (customerStatus === 'ALL') {
    // no filter
  } else if (customerStatus) {
    where.status = customerStatus
  } else {
    where.status = { not: 'ARCHIVED' }
  }

  // Basic filters
  if (params.get('region')) where.region = params.get('region')
  if (params.get('followerId')) where.followerId = parseInt(params.get('followerId')!)
  if (params.get('tier')) where.tier = params.get('tier')
  if (params.get('type')) where.type = params.get('type')
  if (params.get('storeType')) where.storeType = params.get('storeType')

  // Time range
  const from = params.get('from')
  const to = params.get('to')
  if (from || to) {
    where.createdAt = {}
    if (from) where.createdAt.gte = new Date(from)
    if (to) where.createdAt.lte = new Date(to + 'T23:59:59')
  }

  // Product interest filter (denormalized fields on Customer)
  const product = params.get('product')
  const interestLevel = params.get('interestLevel')
  if (product && interestLevel) {
    const field = PRODUCT_KEY_TO_FIELD[product]
    if (field && INTEREST_LEVELS.includes(interestLevel as any)) {
      where[field] = interestLevel
    }
  }

  // Deployment filter — find customers with matching deployment
  const deploymentProduct = params.get('deploymentProduct')
  const deploymentStatus = params.get('deploymentStatus')
  if (deploymentProduct) {
    const deployWhere: any = { productKey: deploymentProduct }
    if (deploymentStatus) deployWhere.status = deploymentStatus

    const deployedCustomerIds = await prisma.productDeployment
      .findMany({ where: deployWhere, select: { customerId: true } })
    const ids = deployedCustomerIds.map(d => d.customerId)
    if (ids.length > 0) {
      where.id = { in: ids }
    } else {
      // No matching deployments → return empty
      return NextResponse.json({ customers: [], total: 0, page, pageSize })
    }
  }

  // ── Count ──
  const total = await prisma.customer.count({ where })

  // ── Build include ──
  const include: any = {
    follower: { select: { id: true, name: true, email: true, role: true } },
  }

  const includeProfile = params.get('includeProfile') === 'true'
  const includeDeployments = params.get('includeDeployments') === 'true'
  const includeSubscriptions = params.get('includeSubscriptions') === 'true'
  const includeProductInterest = params.get('includeProductInterest') === 'true'
  const includeTransactionMetrics = params.get('includeTransactionMetrics') === 'true'
  const includeRevenueRecords = params.get('includeRevenueRecords') === 'true'

  if (includeProfile) {
    include.profile = true
  }

  if (includeDeployments) {
    include.deployments = {
      where: { status: 'ACTIVE' },
      select: { id: true, productKey: true, status: true, plan: true, monthlyFee: true, deployedAt: true },
    }
  }

  if (includeSubscriptions) {
    include.subscriptions = {
      where: { status: 'ACTIVE' },
      select: {
        id: true, productId: true, plan: true, billingType: true,
        mrr: true, currency: true, startDate: true, endDate: true,
        contractEndDate: true,
        product: { select: { key: true, name: true } },
      },
    }
  }

  if (includeProductInterest) {
    include.productInterests = {
      include: { product: { select: { key: true, name: true } } },
    }
  }

  if (includeTransactionMetrics) {
    include.transactionMetrics = {
      take: 10,
      orderBy: { metricDate: 'desc' },
      select: {
        id: true, productKey: true, metricDate: true,
        gmv: true, orders: true, revenue: true, revenueType: true,
      },
    }
  }

  if (includeRevenueRecords) {
    include.revenueRecords = {
      take: 10,
      orderBy: { recordDate: 'desc' },
      select: {
        id: true, productKey: true, revenueType: true,
        amount: true, currency: true, periodStart: true, periodEnd: true, recordDate: true,
      },
    }
  }

  // ── Fetch ──
  const customersRaw = await prisma.customer.findMany({
    where,
    include,
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * pageSize,
    take: pageSize,
  })

  // ── Shape response ──
  const customers = customersRaw.map(c => shapeCustomer(c, {
    includeProfile,
    includeDeployments,
    includeSubscriptions,
    includeProductInterest,
    includeTransactionMetrics,
    includeRevenueRecords,
  }))

  const hasNextPage = page * pageSize < total

  return NextResponse.json({
    data: customers,
    pagination: {
      page,
      pageSize,
      total,
      hasNextPage,
      hasPreviousPage: page > 1,
    },
  })
}

/**
 * Shape a single customer record into a clean, agent-friendly response.
 * Flattens denormalized product interest fields + includes related data.
 */
export function shapeCustomer(
  raw: any,
  opts: {
    includeProfile: boolean
    includeDeployments: boolean
    includeSubscriptions: boolean
    includeProductInterest: boolean
    includeTransactionMetrics: boolean
    includeRevenueRecords: boolean
  }
): any {
  const base: Record<string, any> = {
    id: raw.id,
    sapId: raw.sapId,
    name: raw.name,
    city: raw.city,
    region: raw.region,
    address: raw.address,
    area: raw.area,
    storePhone: raw.storePhone,
    floorManager: raw.floorManager,
    floorManagerPhone: raw.floorManagerPhone,
    merchantContact: raw.merchantContact,
    merchantContactPhone: raw.merchantContactPhone,
    keyman: raw.keyman,
    website: raw.website,
    type: raw.type,
    storeType: raw.storeType,
    storeSize: raw.storeSize,
    notes: raw.notes,
    status: raw.status,
    tier: raw.tier,
    source: raw.source,
    onboardingStatus: raw.onboardingStatus,
    healthScore: raw.healthScore,
    chatwootContactId: raw.chatwootContactId,
    firstPurchasedAt: raw.firstPurchasedAt,
    lastActivityAt: raw.lastActivityAt,
    contactStatus: raw.contactStatus,
    follower: raw.follower,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  }

  // Flatten denormalized product interest matrix into a `products` object
  const productInterests: Record<string, string> = {}
  for (const [key, field] of Object.entries(PRODUCT_KEY_TO_FIELD)) {
    const level = raw[field]
    if (level && level !== 'NOT_CONTACTED') {
      productInterests[key] = level
    }
  }
  base.products = productInterests

  // Include related data arrays
  if (opts.includeProfile && raw.profile) {
    base.profile = {
      id: raw.profile.id,
      kitchChatId: raw.profile.kitchChatId,
      yelpId: raw.profile.yelpId,
      googleId: raw.profile.googleId,
      psId: raw.profile.psId,
      street: raw.profile.street,
      state: raw.profile.state,
      zipCode: raw.profile.zipCode,
      country: raw.profile.country,
      lat: raw.profile.lat,
      lng: raw.profile.lng,
      chineseName: raw.profile.chineseName,
      email: raw.profile.email,
      logoUrl: raw.profile.logoUrl,
      rating: raw.profile.rating,
      menuUrl: raw.profile.menuUrl,
      businessStatus: raw.profile.businessStatus,
      openingHours: raw.profile.openingHours,
      features: raw.profile.features,
      dataSource: raw.profile.dataSource,
    }
  }

  if (opts.includeDeployments && raw.deployments) {
    base.deployments = raw.deployments.map((d: any) => ({
      productKey: d.productKey,
      status: d.status,
      plan: d.plan,
      monthlyFee: d.monthlyFee,
      deployedAt: d.deployedAt,
    }))
  }

  if (opts.includeSubscriptions && raw.subscriptions) {
    base.subscriptions = raw.subscriptions.map((s: any) => ({
      productKey: s.product?.key || null,
      productName: s.product?.name || null,
      plan: s.plan,
      billingType: s.billingType,
      mrr: s.mrr,
      currency: s.currency,
      status: s.status,
      startDate: s.startDate,
      endDate: s.endDate,
      contractEndDate: s.contractEndDate,
    }))
  }

  if (opts.includeProductInterest && raw.productInterests) {
    base.productInterestMatrix = raw.productInterests.map((pi: any) => ({
      productId: pi.product.id,
      productKey: pi.product.key,
      productName: pi.product.name,
      status: pi.status,
    }))
  }

  if (opts.includeTransactionMetrics && raw.transactionMetrics) {
    base.transactionMetrics = raw.transactionMetrics.map((tm: any) => ({
      productKey: tm.productKey,
      metricDate: tm.metricDate,
      gmv: tm.gmv,
      orders: tm.orders,
      revenue: tm.revenue,
      revenueType: tm.revenueType,
    }))
  }

  if (opts.includeRevenueRecords && raw.revenueRecords) {
    base.revenueRecords = raw.revenueRecords.map((rr: any) => ({
      productKey: rr.productKey,
      revenueType: rr.revenueType,
      amount: rr.amount,
      currency: rr.currency,
      periodStart: rr.periodStart,
      periodEnd: rr.periodEnd,
      recordDate: rr.recordDate,
    }))
  }

  return base
}
