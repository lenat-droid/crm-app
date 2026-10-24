import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * PATCH /api/customers/bulk — Batch update customers.
 *
 * Body:
 *   { ids: number[], data: Partial<Customer> }
 *
 * Supports: contactStatus, type, storeType, region, tier, notes
 * Admin/SALES_MGR: can update anyone's customers
 * SALES: can only update customers they follow
 */
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { ids, data } = await req.json()

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'ids is required' }, { status: 400 })
  }
  if (!data || Object.keys(data).keys().next().done) {
    return NextResponse.json({ error: 'data is required' }, { status: 400 })
  }

  // Filter out product interest fields — not allowed in bulk edit
  const skipProductFields = new Set([
    'posStatus', 'psWebsiteStatus', 'smtStatus', 'platformManagedStatus',
    'aiCamStatus', 'omeStatus', 'smartRobotStatus',
    'updatedAt', 'createdAt', 'id',
  ])
  const cleanData: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(data)) {
    if (!skipProductFields.has(k)) cleanData[k] = v
  }

  if (Object.keys(cleanData).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  // SALES can only edit their own customers
  if (session.user.role === 'SALES') {
    const followerId = session.user.id
    const result = await prisma.customer.updateMany({
      where: { id: { in: ids }, followerId },
      data: cleanData,
    })
    return NextResponse.json({ updated: result.count })
  }

  // Admin / SALES_MGR: can update all
  const result = await prisma.customer.updateMany({
    where: { id: { in: ids } },
    data: cleanData,
  })

  return NextResponse.json({ updated: result.count })
}
