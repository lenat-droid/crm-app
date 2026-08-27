import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import dayjs from 'dayjs'

/**
 * GET /api/team-stats — Per-user weekly activity stats.
 *
 * Query params:
 *   - weekStart: ISO date (Mon) — defaults to previous week
 *   - compare: true/false — include previous week for WoW
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const weekStartParam = searchParams.get('weekStart')
  const includeCompare = searchParams.get('compare') === 'true'

  const currentWeek = weekStartParam
    ? dayjs(weekStartParam)
    : dayjs().subtract(1, 'week').startOf('isoWeek')
  const currentWeekEnd = currentWeek.endOf('isoWeek')

  // ── Current week activity ──
  const currentResult = await getTeamStats(currentWeek, currentWeekEnd)

  // ── Previous week for WoW comparison ──
  let previousResult: any = null
  if (includeCompare) {
    const prevWeek = currentWeek.subtract(1, 'week')
    previousResult = await getTeamStats(prevWeek, prevWeek.endOf('isoWeek'))
  }

  return NextResponse.json({
    currentWeek: currentResult,
    weekStart: currentWeekStartParam(currentWeek),
    weekEnd: currentWeekEnd.format('YYYY-MM-DD'),
    compare: previousResult,
  })
}

function currentWeekStartParam(d: dayjs.Dayjs): string {
  return d.format('YYYY-MM-DD')
}

async function getTeamStats(weekStart: dayjs.Dayjs, weekEnd: dayjs.Dayjs) {
  const nowStr = new Date().toISOString()
  const ws = weekStart.toISOString()
  const we = weekEnd.toISOString()

  const [users, newLeads, visits, comms, wonPipelines, lostPipelines, activeCustomers, userMrr] = await Promise.all([
    prisma.user.findMany({ where: { active: true }, select: { id: true, name: true, role: true, region: true, targetMRR: true, targetCustomers: true } }),
    prisma.lead.groupBy({ by: ['registeredById'], _count: true, where: { registeredById: { not: null }, createdAt: { gte: ws, lte: we } } }),
    prisma.visit.groupBy({ by: ['visitedById'], _count: true, where: { visitedById: { not: null }, createdAt: { gte: ws, lte: we } } }),
    prisma.communication.groupBy({ by: ['createdById'], _count: true, where: { createdById: { not: null }, createdAt: { gte: ws, lte: we } } }),
    prisma.pipeline.groupBy({ by: ['salesPersonId'], _count: true, where: { salesPersonId: { not: null }, closeReason: 'WON', closedAt: { gte: ws, lte: we }, active: false } }),
    prisma.pipeline.groupBy({ by: ['salesPersonId'], _count: true, where: { salesPersonId: { not: null }, closeReason: 'LOST', closedAt: { gte: ws, lte: we } } }),
    prisma.customer.groupBy({ by: ['followerId'], _count: true, where: { followerId: { not: null }, status: 'ACTIVE' } }),
    // MRR per sales person (subscriptions they created)
    prisma.subscription.groupBy({
      by: ['salesPersonId'],
      _sum: { mrr: true },
      where: { salesPersonId: { not: null }, status: 'ACTIVE' },
    }),
  ])

  const map = (arr: any[], key: string, val: string) => {
    const m = new Map<number, number>()
    for (const r of arr) m.set(Number(r[key]), Number(r[val]))
    return m
  }

  const leadMap = map(newLeads, 'registeredById', '_count')
  const visitMap = map(visits, 'visitedById', '_count')
  const commMap = map(comms, 'createdById', '_count')
  const wonMap = map(wonPipelines, 'salesPersonId', '_count')
  const lostMap = map(lostPipelines, 'salesPersonId', '_count')
  const customerMap = map(activeCustomers, 'followerId', '_count')
  const mrrMap = map(userMrr, 'salesPersonId', '_sum_mrr')

  return users.map(u => {
    const uid = u.id
    const target = u.targetMRR || 0
    const mrrAchieved = mrrMap.get(uid) || 0
    return {
      userId: uid,
      name: u.name,
      role: u.role,
      region: u.region,
      newLeads: leadMap.get(uid) || 0,
      visits: visitMap.get(uid) || 0,
      comms: commMap.get(uid) || 0,
      wonDeals: wonMap.get(uid) || 0,
      lostDeals: lostMap.get(uid) || 0,
      activeCustomers: customerMap.get(uid) || 0,
      mrr: mrrAchieved,
      targetMRR: target,
      targetCustomers: u.targetCustomers || 0,
      mrrAchievementRate: target > 0 ? Math.round((mrrAchieved / target) * 10000) / 100 : 0,
    }
  })
}
