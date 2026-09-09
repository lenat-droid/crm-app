import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ValidationError, assertString, assertOptionalString, assertInt, assertOptionalInt, assertDateString, assertOptionalDateString, assertOptionalOneOf, assertNumber } from '@/lib/validation/index'

/**
 * GET /api/revenue — List revenue records with pagination and filters.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const pageSize = Math.min(200, Math.max(1, parseInt(searchParams.get('pageSize') || '20')))
  const productKey = searchParams.get('productKey')
  const revenueType = searchParams.get('revenueType')
  const customerId = searchParams.get('customerId')
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  const where: any = {}
  if (productKey) where.productKey = productKey
  if (revenueType) where.revenueType = revenueType
  if (customerId) where.customerId = parseInt(customerId)
  if (from) where.periodStart = { ...where.periodStart, gte: new Date(from) }
  if (to) where.periodStart = { ...where.periodStart, lte: new Date(to) }

  // SALES scoping
  if (session.user.role === 'SALES') {
    where.OR = [
      { customerId: null }, // system-level records
      { customer: { followerId: session.user.id } },
    ]
  }

  const [records, total] = await Promise.all([
    prisma.revenueRecord.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { recordDate: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.revenueRecord.count({ where }),
  ])

  return NextResponse.json({ records, total, page, pageSize })
}

/**
 * POST /api/revenue — Create a revenue record.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const data = await req.json()
  let validated: any
  try {
    validated = {
      customerId: data.customerId ? assertOptionalInt(data.customerId, 'customerId') : null,
      productKey: assertString(data.productKey, 'productKey'),
      revenueType: assertString(data.revenueType, 'revenueType'),
      amount: data.amount != null ? assertNumber(data.amount, 'amount') : 0,
      currency: assertOptionalString(data.currency, 'currency') ?? 'USD',
      periodStart: assertOptionalDateString(data.periodStart, 'periodStart') ?? new Date().toISOString(),
      periodEnd: assertOptionalDateString(data.periodEnd, 'periodEnd') ?? new Date().toISOString(),
      recordDate: assertOptionalDateString(data.recordDate, 'recordDate') ?? new Date().toISOString(),
      source: assertOptionalOneOf(data.source, ['manual', 'api', 'system'], 'source') ?? 'manual',
      notes: assertOptionalString(data.notes, 'notes') ?? null,
    }
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    throw err
  }

  const record = await prisma.revenueRecord.create({
    data: {
      customerId: validated.customerId,
      productKey: validated.productKey,
      revenueType: validated.revenueType,
      amount: validated.amount,
      currency: validated.currency,
      periodStart: new Date(validated.periodStart),
      periodEnd: new Date(validated.periodEnd),
      recordDate: new Date(validated.recordDate),
      source: validated.source,
      notes: validated.notes,
      createdById: session.user.id,
    },
    include: {
      customer: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
    },
  })

  return NextResponse.json(record)
}

/**
 * PATCH /api/revenue/[id] — Update a revenue record.
 */
export async function PATCH(req: NextRequest, ctx: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = parseInt(ctx.params.id)
  const data = await req.json()

  const record = await prisma.revenueRecord.findUnique({
    where: { id },
    include: { customer: { select: { followerId: true } } },
  })
  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // SALES users can only edit their own records
  if (session.user.role === 'SALES' && record.customerId && record.customer?.followerId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const updates: any = {}
  if ('productKey' in data) updates.productKey = assertString(data.productKey, 'productKey')
  if ('revenueType' in data) updates.revenueType = assertString(data.revenueType, 'revenueType')
  if ('amount' in data) updates.amount = assertNumber(data.amount, 'amount') ?? 0
  if ('currency' in data) updates.currency = assertOptionalString(data.currency, 'currency') ?? 'USD'
  if ('periodStart' in data) updates.periodStart = assertOptionalDateString(data.periodStart, 'periodStart') ? new Date(data.periodStart) : undefined
  if ('periodEnd' in data) updates.periodEnd = assertOptionalDateString(data.periodEnd, 'periodEnd') ? new Date(data.periodEnd) : undefined
  if ('recordDate' in data) updates.recordDate = assertOptionalDateString(data.recordDate, 'recordDate') ? new Date(data.recordDate) : undefined
  if ('source' in data) updates.source = assertOptionalOneOf(data.source, ['manual', 'api', 'system'], 'source')
  if ('notes' in data) updates.notes = assertOptionalString(data.notes, 'notes') ?? null

  const updated = await prisma.revenueRecord.update({ where: { id }, data: updates })
  return NextResponse.json(updated)
}

/**
 * DELETE /api/revenue/[id] — Delete a revenue record.
 */
export async function DELETE(req: NextRequest, ctx: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = parseInt(ctx.params.id)
  const record = await prisma.revenueRecord.findUnique({ where: { id } })
  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.revenueRecord.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
