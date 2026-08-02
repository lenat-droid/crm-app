import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import dayjs from 'dayjs'
import { upsertSnapshot } from '@/lib/weekly-snapshot'

/**
 * POST /api/metrics/snapshot — Trigger a weekly metrics snapshot computation.
 *
 * Protected by ADMIN role. Can be called manually from an admin button
 * or by the daily-digest cron when a week boundary is crossed.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Determine which week to compute: default to previous week (completed)
  const { weekStart } = await req.json().catch(() => ({ weekStart: '' }))
  let targetWeek: dayjs.Dayjs
  if (weekStart) {
    targetWeek = dayjs(weekStart)
    if (!targetWeek.isValid()) {
      return NextResponse.json({ error: 'Invalid weekStart' }, { status: 400 })
    }
  } else {
    // Default: compute last completed week (Mon-Sun)
    targetWeek = dayjs().subtract(1, 'week').startOf('isoWeek')
  }

  try {
    const snapshot = await upsertSnapshot(targetWeek, session.user.name)
    return NextResponse.json({
      success: true,
      weekStart: snapshot.weekStart,
      weekEnd: snapshot.weekEnd,
      totalCustomers: snapshot.totalCustomers,
      totalMrr: snapshot.totalMrr,
      netMrr: snapshot.netMrr,
      wonDeals: snapshot.wonDeals,
    })
  } catch (err) {
    console.error('Snapshot computation failed:', err)
    return NextResponse.json({ error: 'Internal error computing snapshot' }, { status: 500 })
  }
}

/**
 * GET /api/metrics/snapshot — List recent weekly snapshots for dashboard filtering.
 * Supports ?weeks=N (default 12) for rolling WoW comparison.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const weeks = parseInt(searchParams.get('weeks') || '12')

  const snapshots = await prisma.weeklyMetricSnapshot.findMany({
    orderBy: { weekStart: 'desc' },
    take: weeks,
  })

  // Reverse to chronological order (oldest first)
  snapshots.reverse()

  // Parse userActivity JSON
  const enriched = snapshots.map((s: any) => ({
    ...s,
    userActivity: s.userActivity ? JSON.parse(s.userActivity) : [],
  }))

  return NextResponse.json({ snapshots: enriched })
}
