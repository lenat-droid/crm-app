import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getDataScope } from '@/lib/auth-helpers'
import dayjs from 'dayjs'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const scope = getDataScope(session)

  // Build customer filter from scope
  const customerWhere: any = { ...scope }

  // Build pipeline filter
  const pipelineWhere: any = {}
  if (scope.followerId) {
    pipelineWhere.salesPersonId = scope.followerId as number
  } else if (scope.region) {
    pipelineWhere.customer = { region: scope.region as string }
  }

  // Build subscription filter (through customer relation)
  const subscriptionWhere: any = { status: 'ACTIVE' }
  if (scope.followerId) {
    subscriptionWhere.customer = { followerId: scope.followerId }
  } else if (scope.region) {
    subscriptionWhere.customer = { region: scope.region }
  }

  // Build health score filter (through customer relation)
  const healthScoreWhere: any = {}
  if (scope.followerId) {
    healthScoreWhere.customer = { followerId: scope.followerId }
  } else if (scope.region) {
    healthScoreWhere.customer = { region: scope.region }
  }

  // Run all queries in parallel
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
    allSubscriptions,
  ] = await Promise.all([
    // Basic counts
    prisma.customer.count({ where: customerWhere }),
    prisma.pipeline.count({ where: pipelineWhere }),
    prisma.lead.count({ where: scope.followerId ? { registeredById: scope.followerId as number } : {} }),
    prisma.visit.count({ where: scope.followerId ? { visitedById: scope.followerId as number } : {} }),

    // Pipeline: active count
    prisma.pipeline.count({ where: { ...pipelineWhere, active: true } }),

    // Leads by status
    prisma.lead.groupBy({
      by: ['status'],
      _count: true,
      where: scope.followerId ? { registeredById: scope.followerId as number } : {},
    }),

    // Subscriptions: active count
    prisma.subscription.count({ where: subscriptionWhere }),

    // MRR: sum of active subscriptions
    prisma.subscription.aggregate({
      where: subscriptionWhere,
      _sum: { mrr: true },
    }),

    // Health score: churn risk distribution
    prisma.customerHealthScore.groupBy({
      by: ['churnRisk'],
      _count: true,
      where: healthScoreWhere,
    }),

    // Health score: average
    prisma.customerHealthScore.aggregate({
      _avg: { overallScore: true },
      where: healthScoreWhere,
    }),

    // Customers by tier
    prisma.customer.groupBy({
      by: ['tier'],
      _count: true,
      where: customerWhere,
    }),

    // Customers by region (top 5)
    prisma.customer.groupBy({
      by: ['region'],
      _count: true,
      where: { ...customerWhere, region: { not: null } },
      orderBy: { _count: { region: 'desc' } },
      take: 5,
    }),

    // Pipeline by status
    prisma.pipeline.groupBy({
      by: ['status'],
      _count: true,
      where: pipelineWhere,
    }),

    // All active subscriptions for MRR trend calculation
    prisma.subscription.findMany({
      where: subscriptionWhere,
      select: { mrr: true, startDate: true, endDate: true, status: true, createdAt: true },
    }),
  ])

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
    totalMrr: totalMrr._sum.mrr || 0,

    // Health
    churnRiskDistribution: churnRiskDistribution.reduce((acc, r) => ({ ...acc, [r.churnRisk]: r._count }), {} as Record<string, number>),
    avgHealthScore: Math.round(avgHealthScore._avg.overallScore || 0),

    // Customer composition
    customersByTier: customersByTier.map(r => ({ tier: r.tier, count: r._count })),
    topRegions: customersByRegion.map(r => ({ region: r.region, count: r._count })),

    // Pipeline funnel
    pipelineByStatus: pipelineStatusCounts.reduce((acc, r) => ({ ...acc, [r.status]: r._count }), {} as Record<string, number>),

    // MRR trend: monthly MRR for the last 12 months
    mrrTrend: computeMrrTrend(allSubscriptions),

    // Health score distribution (detailed for pie chart)
    healthDistribution: {
      healthy: (churnRiskDistribution as unknown as Record<string, number>)['LOW'] || 0,
      attention: (churnRiskDistribution as unknown as Record<string, number>)['MEDIUM'] || 0,
      atRisk: (churnRiskDistribution as unknown as Record<string, number>)['HIGH'] || 0,
    },
  })
}

function computeMrrTrend(subscriptions: Array<{ mrr: number; startDate: Date; endDate: Date | null; status: string; createdAt: Date }>) {
  const now = dayjs()
  const months: Array<{ month: string; mrr: number }> = []

  for (let i = 11; i >= 0; i--) {
    const monthStart = now.subtract(i, 'month').startOf('month')
    const monthEnd = monthStart.endOf('month')

    // Sum MRR of subscriptions that were active during this month
    let monthMrr = 0
    for (const sub of subscriptions) {
      const subStart = dayjs(sub.startDate)
      const subEnd = sub.endDate ? dayjs(sub.endDate) : now.add(1, 'year') // no end = still active

      // Subscription overlaps with this month?
      if (subStart.isBefore(monthEnd) && subEnd.isAfter(monthStart)) {
        // For active subscriptions, count their MRR
        if (sub.status === 'ACTIVE' || sub.status === 'TRIALING' ||
            (sub.status === 'CANCELLED' && dayjs(sub.endDate).isAfter(monthStart)) ||
            (sub.status === 'EXPIRED' && dayjs(sub.endDate).isAfter(monthStart))) {
          monthMrr += sub.mrr
        }
      }
    }

    months.push({
      month: monthStart.format('YYYY-MM'),
      mrr: Math.round(monthMrr),
    })
  }

  return months
}
