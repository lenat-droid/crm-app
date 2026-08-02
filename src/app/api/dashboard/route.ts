import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getDataScope } from '@/lib/auth-helpers'
import dayjs from 'dayjs'

/**
 * GET /api/dashboard — 仪表盘 API (v1.2.0 增强)
 *
 * Query params:
 *   - period: 'today' | 'week' | 'month' | 'quarter' | 'custom' (default: all time)
 *   - from: ISO date (used with period=custom)
 *   - to:   ISO date (used with period=custom)
 *   - personId: filter by specific user (ADMIN/SALES_MGR only)
 *   - region:  filter by region (overrides role-based scope)
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const period = searchParams.get('period') || 'all'
  const fromParam = searchParams.get('from')
  const toParam = searchParams.get('to')
  const personIdParam = searchParams.get('personId')
  const regionParam = searchParams.get('region')

  const scope = getDataScope(session)

  // ── Resolve filter overrides ──
  let dateFrom: string | null = null
  let dateTo: string | null = null
  let targetPersonId: number | null = null
  let targetRegion: string | null = null

  if (period === 'today') {
    const today = dayjs().format('YYYY-MM-DD')
    dateFrom = today
    dateTo = today
  } else if (period === 'week') {
    dateFrom = dayjs().startOf('week').format('YYYY-MM-DD')
    dateTo = dayjs().endOf('week').format('YYYY-MM-DD')
  } else if (period === 'month') {
    dateFrom = dayjs().startOf('month').format('YYYY-MM-DD')
    dateTo = dayjs().endOf('month').format('YYYY-MM-DD')
  } else if (period === 'quarter') {
    // dayjs doesn't support 'quarter' natively — compute manually
    const m = dayjs()
    const qStart = m.month(Math.floor(m.month() / 3) * 3).startOf('month')
    dateFrom = qStart.format('YYYY-MM-DD')
    dateTo = qStart.endOf('month').add(1, 'month').endOf('day').format('YYYY-MM-DD')
  } else if (period === 'custom' && fromParam && toParam) {
    dateFrom = fromParam
    dateTo = toParam
  }

  if (personIdParam && (session.user.role === 'ADMIN' || session.user.role === 'SALES_MGR')) {
    targetPersonId = parseInt(personIdParam)
  }
  if (regionParam && (session.user.role === 'ADMIN' || session.user.role === 'SALES_MGR')) {
    targetRegion = regionParam
  }

  // ── Build date filter helper ──
  const dateFilter = dateFrom && dateTo ? {
    createdAt: { gte: new Date(dateFrom), lte: new Date(dateTo + 'T23:59:59') },
  } : null

  // ── Build customer filter from scope ──
  const customerWhere: any = { ...scope }
  if (targetRegion) customerWhere.region = targetRegion
  if (targetPersonId) customerWhere.followerId = targetPersonId
  // Exclude archived for consistency
  customerWhere.status = 'ACTIVE'

  // ── Pipeline filter ──
  const pipelineWhere: any = { active: true }
  if (scope.followerId) pipelineWhere.salesPersonId = scope.followerId as number
  else if (scope.region) pipelineWhere.customer = { region: scope.region as string }
  if (targetRegion) pipelineWhere.customer = { region: targetRegion }
  if (targetPersonId) pipelineWhere.salesPersonId = targetPersonId

  // ── Subscription filter ──
  const subscriptionWhere: any = { status: 'ACTIVE' }
  if (scope.followerId) subscriptionWhere.customer = { followerId: scope.followerId }
  else if (scope.region) subscriptionWhere.customer = { region: scope.region }
  if (targetRegion) subscriptionWhere.customer = { region: targetRegion }
  if (targetPersonId) subscriptionWhere.customer = { followerId: targetPersonId }

  // ── Health score filter ──
  const healthScoreWhere: any = {}
  if (scope.followerId) healthScoreWhere.customer = { followerId: scope.followerId }
  else if (scope.region) healthScoreWhere.customer = { region: scope.region }
  if (targetRegion) healthScoreWhere.customer = { region: targetRegion }
  if (targetPersonId) healthScoreWhere.customer = { followerId: targetPersonId }

  // ── Lead / Visit filters ──
  const leadWhere: any = {}
  const visitWhere: any = {}
  if (scope.followerId) {
    leadWhere.registeredById = scope.followerId as number
    visitWhere.visitedById = scope.followerId as number
  } else if (scope.region) {
    leadWhere.registeredBy = { region: scope.region as string }
    visitWhere.visitedBy = { region: scope.region as string }
  }
  if (targetPersonId) {
    leadWhere.registeredById = targetPersonId
    visitWhere.visitedById = targetPersonId
  }
  if (targetRegion) {
    leadWhere.registeredBy = { region: targetRegion }
    visitWhere.visitedBy = { region: targetRegion }
  }
  if (dateFilter) {
    leadWhere.createdAt = dateFilter.createdAt
    visitWhere.createdAt = dateFilter.createdAt
  }

  // ── Run all queries in parallel ──
  const [
    totalCustomers,
    totalPipelines,
    totalLeads,
    totalVisits,
    activePipelines,
    leadCountByStatus,
    activeSubscriptions,
    totalMrr,
    churnRiskDistribution,
    avgHealthScore,
    customersByTier,
    customersByRegion,
    pipelineStatusCounts,
    pipelineClosedByReason,
    allSubscriptions,
    wonPipelines,
    lostPipelines,
  ] = await Promise.all([
    // Counts
    prisma.customer.count({ where: customerWhere }),
    prisma.pipeline.count({ where: pipelineWhere }),
    prisma.lead.count({ where: leadWhere }),
    prisma.visit.count({ where: visitWhere }),

    // Pipeline: active count
    prisma.pipeline.count({ where: { ...pipelineWhere, active: true } }),

    prisma.lead.groupBy({ by: ['status'], _count: true, where: leadWhere }),
    prisma.subscription.count({ where: subscriptionWhere }),
    prisma.subscription.aggregate({ where: subscriptionWhere, _sum: { mrr: true } }),
    prisma.customerHealthScore.groupBy({ by: ['churnRisk'], _count: true, where: healthScoreWhere }),
    prisma.customerHealthScore.aggregate({ _avg: { overallScore: true }, where: healthScoreWhere }),

    prisma.customer.groupBy({ by: ['tier'], _count: true, where: customerWhere }),
    prisma.customer.groupBy({ by: ['region'], _count: true, where: { ...customerWhere, region: { not: null } }, orderBy: { _count: { region: 'desc' } }, take: 5 }),
    prisma.pipeline.groupBy({ by: ['status'], _count: true, where: pipelineWhere }),
    prisma.pipeline.groupBy({ by: ['closeReason'], _count: true, where: { ...pipelineWhere, active: false } }),
    prisma.subscription.findMany({
      where: subscriptionWhere,
      select: { mrr: true, startDate: true, endDate: true, status: true, createdAt: true },
    }),
    // Won pipelines (for win rate)
    prisma.pipeline.count({ where: { ...pipelineWhere, closeReason: 'WON', active: false } }),
    // Lost pipelines (for win rate)
    prisma.pipeline.count({ where: { ...pipelineWhere, closeReason: 'LOST' } }),
  ])

  // ── Compute pipeline win rate ──
  const totalClosed = wonPipelines + lostPipelines
  const winRate = totalClosed > 0 ? Math.round((wonPipelines / totalClosed) * 10000) / 100 : 0

  // ── Compute conversion rates between pipeline stages ──
  const pm: Record<string, number> = {}
  for (const r of pipelineStatusCounts) pm[r.status] = r._count
  const pipelineList = Object.entries(pm).map(([status, count]) => ({ status, count }))
  const totalInPipeline = pipelineList.reduce((s, p) => s + p.count, 0)

  // ── MRR trend ──
  const mrrTrend = computeMrrTrend(allSubscriptions, dateFrom, dateTo)

  // ── MRR delta vs previous period (WoW/MoM) ──
  let mrrDelta = null
  if (dateFrom && dateTo && period !== 'custom') {
    const days = dayjs(dateTo).diff(dayjs(dateFrom), 'day') + 1
    const prevFrom = dayjs(dateFrom).subtract(days, 'day').format('YYYY-MM-DD')
    const prevTo = dayjs(dateTo).subtract(days, 'day').format('YYYY-MM-DD')
    const prevMrr = await prisma.subscription.aggregate({
      where: { ...subscriptionWhere, startDate: { gte: new Date(prevFrom), lte: new Date(prevTo + 'T23:59:59') } },
      _sum: { mrr: true },
    })
    const currentMrr = totalMrr._sum.mrr || 0
    const prevMrrVal = prevMrr._sum.mrr || 0
    if (prevMrrVal > 0) {
      mrrDelta = {
        current: Math.round(currentMrr),
        previous: Math.round(prevMrrVal),
        change: Math.round(currentMrr - prevMrrVal),
        pctChange: Math.round(((currentMrr - prevMrrVal) / prevMrrVal) * 10000) / 100,
      }
    }
  }

  return NextResponse.json({
    // Basic stats
    totalCustomers,
    totalPipelines,
    totalLeads,
    totalVisits,
    activePipelines,

    // Lead breakdown
    leadsByStatus: leadCountByStatus.reduce((acc, r) => ({ ...acc, [r.status]: r._count }), {} as Record<string, number>),

    // Subscription / MRR
    activeSubscriptions,
    totalMrr: Math.round(totalMrr._sum.mrr || 0),

    // Health
    churnRiskDistribution: churnRiskDistribution.reduce((acc, r) => ({ ...acc, [r.churnRisk]: r._count }), {} as Record<string, number>),
    avgHealthScore: Math.round(avgHealthScore._avg.overallScore || 0),

    // Customer composition
    customersByTier: customersByTier.map(r => ({ tier: r.tier, count: r._count })),
    topRegions: customersByRegion.map(r => ({ region: r.region, count: r._count })),

    // Pipeline funnel with win rate
    pipelineByStatus: pipelineList,
    winRate,
    totalWon: wonPipelines,
    totalLost: lostPipelines,
    totalClosed: totalClosed,
    pipelineTotalInFlow: totalInPipeline,

    // MRR trend + delta
    mrrTrend,
    mrrDelta,

    // Health score distribution (detailed for pie chart)
    healthDistribution: {
      healthy: churnRiskDistribution.reduce((acc, r) => (r.churnRisk === 'LOW' ? acc + r._count : acc), 0),
      attention: churnRiskDistribution.reduce((acc, r) => (r.churnRisk === 'MEDIUM' ? acc + r._count : acc), 0),
      atRisk: churnRiskDistribution.reduce((acc, r) => (r.churnRisk === 'HIGH' ? acc + r._count : acc), 0),
    },

    // Filtering metadata
    filters: { period, personId: targetPersonId, region: targetRegion },
  })
}

function computeMrrTrend(
  subscriptions: Array<{ mrr: number; startDate: Date; endDate: Date | null; status: string; createdAt: Date }>,
  fromParam?: string | null,
  toParam?: string | null
): Array<{ month: string; mrr: number }> {
  let now = dayjs()
  let months = 12

  if (fromParam && toParam) {
    // Custom range: show per-month within the range
    const diff = dayjs(toParam).diff(dayjs(fromParam), 'month')
    months = Math.min(Math.max(diff, 3), 24)
    now = dayjs(toParam)
  }

  const result: Array<{ month: string; mrr: number }> = []

  for (let i = months - 1; i >= 0; i--) {
    const monthStart = now.subtract(i, 'month').startOf('month')
    const monthEnd = monthStart.endOf('month')

    let monthMrr = 0
    for (const sub of subscriptions) {
      const subStart = dayjs(sub.startDate)
      const subEnd = sub.endDate ? dayjs(sub.endDate) : now.add(1, 'year')

      if (subStart.isBefore(monthEnd) && subEnd.isAfter(monthStart)) {
        if (sub.status === 'ACTIVE' || sub.status === 'TRIALING' ||
            (sub.status === 'CANCELLED' && dayjs(sub.endDate!).isAfter(monthStart)) ||
            (sub.status === 'EXPIRED' && dayjs(sub.endDate!).isAfter(monthStart))) {
          monthMrr += sub.mrr
        }
      }
    }

    result.push({
      month: monthStart.format('YYYY-MM'),
      mrr: Math.round(monthMrr),
    })
  }

  return result
}
