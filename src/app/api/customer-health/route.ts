import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calculateHealthScore, type HealthResult } from '@/lib/health-score'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const pageSize = Math.min(200, Math.max(1, parseInt(searchParams.get('pageSize') || '20')))
  const churnRisk = searchParams.get('churnRisk')
  const recalculate = searchParams.get('recalculate') === 'true'

  // Get product catalog count
  const totalProducts = await prisma.productCatalog.count({ where: { active: true } })

  // Data scoping
  const customerWhere: any = {}
  if (session.user.role === 'SALES') {
    customerWhere.followerId = session.user.id
  } else if (session.user.role === 'SALES_MGR' && session.user.region) {
    customerWhere.region = session.user.region
  }

  // If recalculating, batch compute for all accessible customers
  if (recalculate) {
    const customers = await prisma.customer.findMany({
      where: customerWhere,
      select: {
        id: true,
        lastActivityAt: true,
        firstPurchasedAt: true,
        _count: { select: { subscriptions: { where: { status: 'ACTIVE' } } } },
        subscriptions: {
          where: { status: 'ACTIVE' },
          select: { endDate: true, mrr: true },
          take: 1,
        },
      },
    })

    const results: Array<{ customerId: number; result: HealthResult }> = []

    for (const customer of customers) {
      const daysSinceLastActivity = customer.lastActivityAt
        ? Math.floor((Date.now() - customer.lastActivityAt.getTime()) / (1000 * 60 * 60 * 24))
        : null

      const daysSinceFirstPurchase = customer.firstPurchasedAt
        ? Math.floor((Date.now() - customer.firstPurchasedAt.getTime()) / (1000 * 60 * 60 * 24))
        : null

      // Count products with interest
      const productInterests = await prisma.productInterest.findMany({
        where: { customerId: customer.id, status: { in: ['INTERESTED', 'HIGH_INTENT', 'PURCHASED'] } },
      })

      // Count tickets
      const openTickets = await prisma.supportTicket.count({
        where: { customerId: customer.id, status: { in: ['OPEN', 'PENDING'] } },
      })

      const resolvedTickets = await prisma.supportTicket.count({
        where: { customerId: customer.id, status: 'RESOLVED', resolvedAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) } },
      })

      // Avg CSAT
      const csatResult = await prisma.supportTicket.aggregate({
        where: { customerId: customer.id, csatScore: { not: null } },
        _avg: { csatScore: true },
      })

      const result = calculateHealthScore({
        daysSinceLastActivity,
        productCount: productInterests.length,
        totalProducts,
        openTicketCount: openTickets,
        resolvedTicketCount: resolvedTickets,
        avgCsatScore: csatResult._avg.csatScore ?? null,
        hasActiveSubscription: customer.subscriptions.length > 0,
        subscriptionExpiringDays: customer.subscriptions[0]?.endDate
          ? Math.floor((customer.subscriptions[0].endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          : null,
        daysSinceFirstPurchase,
      })

      // Upsert health score
      await prisma.customerHealthScore.upsert({
        where: { customerId: customer.id },
        update: {
          overallScore: result.overallScore,
          engagementScore: result.engagementScore,
          productAdoptionScore: result.productAdoptionScore,
          supportHealthScore: result.supportHealthScore,
          subscriptionHealth: result.subscriptionHealth,
          churnRisk: result.churnRisk,
          calculatedAt: result.calculatedAt,
        },
        create: {
          customerId: customer.id,
          overallScore: result.overallScore,
          engagementScore: result.engagementScore,
          productAdoptionScore: result.productAdoptionScore,
          supportHealthScore: result.supportHealthScore,
          subscriptionHealth: result.subscriptionHealth,
          churnRisk: result.churnRisk,
          calculatedAt: result.calculatedAt,
        },
      })

      results.push({ customerId: customer.id, result })
    }

    return NextResponse.json({
      message: `Recalculated health scores for ${results.length} customers`,
      count: results.length,
    })
  }

  // Normal list query
  const healthWhere: any = {}
  if (churnRisk) healthWhere.churnRisk = churnRisk
  if (Object.keys(customerWhere).length > 0) {
    healthWhere.customer = customerWhere
  }

  const [scores, total] = await Promise.all([
    prisma.customerHealthScore.findMany({
      where: healthWhere,
      include: {
        customer: { select: { id: true, name: true, tier: true, region: true, follower: { select: { name: true } } } },
      },
      orderBy: [{ churnRisk: 'asc' }, { overallScore: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.customerHealthScore.count({ where: healthWhere }),
  ])

  // Aggregations (respect data scope)
  const aggregation = await prisma.customerHealthScore.aggregate({
    _avg: { overallScore: true },
    where: healthWhere,
  })
  const riskCounts = await prisma.customerHealthScore.groupBy({
    by: ['churnRisk'],
    _count: true,
    where: healthWhere,
  })

  return NextResponse.json({
    scores,
    total,
    page,
    pageSize,
    avgScore: Math.round(aggregation._avg.overallScore || 0),
    riskDistribution: riskCounts.reduce((acc, r) => ({ ...acc, [r.churnRisk]: r._count }), {} as Record<string, number>),
  })
}
