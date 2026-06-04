import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PRODUCT_FIELDS } from '@/lib/constants'

const productLabels: Record<string, string> = {
  posStatus: 'POS',
  psWebsiteStatus: 'PS官網',
  smtStatus: 'SMT',
  platformManagedStatus: '平台托管',
  aiCamStatus: 'AI Cam',
  omeStatus: 'OME',
  smartRobotStatus: '智能機器人',
}

const interestLevels = [
  'NOT_CONTACTED',
  'NOT_INTERESTED',
  'AWARE',
  'INTERESTED',
  'HIGH_INTENT',
  'PURCHASED',
] as const

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const result = []

  // Optimized: 7 groupBy queries instead of 42 individual count queries
  for (const field of PRODUCT_FIELDS) {
    const groups = await prisma.customer.groupBy({
      by: [field],
      _count: { id: true },
    })

    // Initialize all levels at 0
    const counts: Record<string, number> = {}
    for (const level of interestLevels) {
      counts[level] = 0
    }

    // Fill in actual counts from groupBy results
    for (const g of groups) {
      const level = g[field as keyof typeof g] as string
      if (level in counts) {
        counts[level] = g._count.id
      }
    }

    counts['potential'] = (counts['INTERESTED'] || 0) + (counts['HIGH_INTENT'] || 0)
    result.push({ product: productLabels[field], ...counts })
  }

  return NextResponse.json(result)
}
