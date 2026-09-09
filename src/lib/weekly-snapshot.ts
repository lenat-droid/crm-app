/**
 * Weekly Metric Snapshot (v1.2.0)
 *
 * Computes a rollup of all key CRM metrics for one ISO week
 * (Monday 00:00 → Sunday 23:59:59 UTC).
 *
 * Called by:
 *   - POST /api/metrics/snapshot  (admin trigger, or auto on missing week)
 *   - /api/cron/daily-digest     (also triggers if week boundary crossed)
 */

import dayjs from 'dayjs'
import isoWeek from 'dayjs/plugin/isoWeek'
import { prisma } from './prisma'

dayjs.extend(isoWeek)

export interface WeeklySnapshotPayload {
  weekStart: string
  weekEnd: string
  totalCustomers: number
  activeSubscriptions: number
  totalMrr: number
  newMrr: number
  churnMrr: number
  netMrr: number
  wonMrr: number
  pipelinePending: number
  pipelineConnected: number
  pipelineInterested: number
  pipelineCooperating: number
  tierEnterprise: number
  tierMidMarket: number
  tierSmb: number
  healthyCount: number
  attentionCount: number
  atRiskCount: number
  avgHealthScore: number
  totalNewLeads: number
  totalVisits: number
  totalComms: number
  wonDeals: number
  lostDeals: number
  userActivity: string
  createdBy: string
}

export async function computeWeeklySnapshot(
  weekStart: dayjs.Dayjs,
  createdBy: string = 'system'
): Promise<WeeklySnapshotPayload> {
  const weekEnd = weekStart.endOf('isoWeek')
  const weekStartStr = weekStart.toISOString()
  const weekEndStr = weekEnd.toISOString()

  // ── Snapshot counts as of week end ──
  const [
    totalCustomers,
    activeSubscriptions,
    totalMrrResult,
    pipelineStatusCounts,
    tierCounts,
    healthDist,
    avgHealth,
    tierEnterprise,
    tierMidMarket,
    tierSmb,
    healthyCount,
    attentionCount,
    atRiskCount,
  ] = await Promise.all([
    prisma.customer.count({ where: { status: 'ACTIVE' } }),
    prisma.subscription.count({ where: { status: { in: ['ACTIVE', 'TRIALING'] } } }),
    prisma.subscription.aggregate({
      where: { status: 'ACTIVE' },
      _sum: { mrr: true },
    }),
    prisma.pipeline.groupBy({
      by: ['status'],
      _count: true,
      where: { active: true },
    }),
    prisma.customer.groupBy({ by: ['tier'], _count: true }),
    prisma.customerHealthScore.groupBy({ by: ['churnRisk'], _count: true }),
    prisma.customerHealthScore.aggregate({ _avg: { overallScore: true } }),
    // Derive tier counts from groupBy
    prisma.customer.count({ where: { tier: 'ENTERPRISE', status: 'ACTIVE' } }),
    prisma.customer.count({ where: { tier: 'MID_MARKET', status: 'ACTIVE' } }),
    prisma.customer.count({ where: { tier: 'SMB', status: 'ACTIVE' } }),
    prisma.customerHealthScore.count({ where: { churnRisk: 'LOW' } }),
    prisma.customerHealthScore.count({ where: { churnRisk: 'MEDIUM' } }),
    prisma.customerHealthScore.count({ where: { churnRisk: 'HIGH' } }),
  ])

  // ── Pipeline status map ──
  const pm: Record<string, number> = {}
  for (const r of pipelineStatusCounts) pm[r.status] = r._count

  // ── MRR delta: new vs churn this week ──
  // New MRR: subscriptions that became ACTIVE in this week
  const newSubs = await prisma.subscription.findMany({
    where: {
      status: 'ACTIVE',
      createdAt: { gte: weekStartStr, lte: weekEndStr },
    },
    select: { mrr: true, createdAt: true, endDate: true },
  })

  // Churned MRR: subscriptions that changed to CANCELLED/EXPIRED this week
  const churnedSubs = await prisma.subscription.findMany({
    where: {
      status: { in: ['CANCELLED', 'EXPIRED'] },
      updatedAt: { gte: weekStartStr, lte: weekEndStr },
    },
    select: { mrr: true, status: true, endDate: true },
  })

  // WON pipeline MRR: pipelines closed WON this week
  const wonPipelines = await prisma.pipeline.findMany({
    where: {
      closeReason: 'WON',
      closedAt: { gte: weekStartStr, lte: weekEndStr },
    },
    include: { customer: { include: { subscriptions: { where: { status: 'ACTIVE' } } } } },
  })

  let newMrr = 0
  let churnMrr = 0
  let wonMrr = 0

  // New MRR: sum of active subscriptions created this week
  for (const sub of newSubs) {
    newMrr += sub.mrr
  }

  // Churn MRR from explicitly churned subs
  churnMrr = churnedSubs.reduce((s, sub) => s + sub.mrr, 0)

  // WON MRR: sum of ACTIVE subscriptions of newly-won customers
  for (const p of wonPipelines) {
    wonMrr += p.customer.subscriptions.reduce((s, sub) => s + sub.mrr, 0)
  }

  // ── Per-user activity (this week) ──
  const allUsers = await prisma.user.findMany({
    where: { active: true },
    select: { id: true, name: true, role: true, targetMRR: true, targetCustomers: true },
  })

  const userIds = allUsers.map(u => u.id)
  const [
    userNewLeads,
    userVisits,
    userComms,
    userWonPipelines,
    userLostPipelines,
    userActiveCustomers,
  ] = await Promise.all([
    prisma.lead.groupBy({ by: ['registeredById'], _count: true, where: { registeredById: { in: userIds }, createdAt: { gte: weekStartStr, lte: weekEndStr } } }),
    prisma.visit.groupBy({ by: ['visitedById'], _count: true, where: { visitedById: { in: userIds }, createdAt: { gte: weekStartStr, lte: weekEndStr } } }),
    prisma.communication.groupBy({ by: ['createdById'], _count: true, where: { createdById: { in: userIds }, createdAt: { gte: weekStartStr, lte: weekEndStr } } }),
    prisma.pipeline.count({ where: { salesPersonId: { in: userIds }, closeReason: 'WON', closedAt: { gte: weekStartStr, lte: weekEndStr } } }),
    prisma.pipeline.count({ where: { salesPersonId: { in: userIds }, closeReason: 'LOST', closedAt: { gte: weekStartStr, lte: weekEndStr } } }),
    prisma.customer.count({ where: { followerId: { in: userIds }, status: 'ACTIVE' } }),
  ])

  const userActivityMap = new Map<number, any>()
  for (const u of allUsers) {
    userActivityMap.set(u.id, {
      userId: u.id,
      userName: u.name,
      newLeads: 0,
      visits: 0,
      comms: 0,
      wonPipelines: 0,
      lostPipelines: 0,
      totalCustomers: 0,
      targetMRR: u.targetMRR ?? 0,
      targetCustomers: u.targetCustomers ?? 0,
    })
  }

  for (const r of userNewLeads) {
    const row = userActivityMap.get(Number(r.registeredById))
    if (row) row.newLeads = r._count
  }
  for (const r of userVisits) {
    const row = userActivityMap.get(Number(r.visitedById))
    if (row) row.visits = r._count
  }
  for (const r of userComms) {
    const row = userActivityMap.get(Number(r.createdById))
    if (row) row.comms = r._count
  }

  // Total activity counts
  const totalNewLeads = userNewLeads.reduce((s, r) => s + r._count, 0)
  const totalVisitsCount = userVisits.reduce((s, r) => s + r._count, 0)
  const totalCommsCount = userComms.reduce((s, r) => s + r._count, 0)

  // ── Pipeline stage transitions (advancements) ──
  // Count pipelines that changed status this week (any direction)
  // We use updatedAt as a proxy — if status changed, updatedAt will be within the week
  const stageTransitions = await prisma.pipeline.count({
    where: {
      updatedAt: { gte: weekStartStr, lte: weekEndStr },
      active: true,
    },
  })

  const avgHealthScore = Math.round((avgHealth._avg.overallScore || 0) * 100) / 100

  return {
    weekStart: weekStartStr,
    weekEnd: weekEndStr,
    totalCustomers,
    activeSubscriptions,
    totalMrr: totalMrrResult._sum.mrr || 0,
    newMrr: Math.round(newMrr * 100) / 100,
    churnMrr: Math.round(churnMrr * 100) / 100,
    netMrr: Math.round(((totalMrrResult._sum.mrr || 0) - churnMrr) * 100) / 100,
    wonMrr: Math.round(wonMrr * 100) / 100,
    pipelinePending: pm['⚠️'] || 0,
    pipelineConnected: pm['已建联'] || 0,
    pipelineInterested: pm['初步有意向'] || 0,
    pipelineCooperating: pm['合作中'] || 0,
    tierEnterprise,
    tierMidMarket,
    tierSmb,
    healthyCount,
    attentionCount,
    atRiskCount,
    avgHealthScore,
    totalNewLeads,
    totalVisits: totalVisitsCount,
    totalComms: totalCommsCount,
    wonDeals: wonPipelines.length,
    lostDeals: userLostPipelines,
    userActivity: JSON.stringify(Array.from(userActivityMap.values())),
    createdBy,
  }
}

export async function upsertSnapshot(weekStart: dayjs.Dayjs, createdBy: string) {
  const payload = await computeWeeklySnapshot(weekStart, createdBy)
  return prisma.weeklyMetricSnapshot.upsert({
    where: { weekStart: weekStart.toISOString() },
    update: payload,
    create: payload,
  })
}
