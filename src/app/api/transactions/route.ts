import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ValidationError, assertString, assertOptionalString, assertInt, assertOptionalInt, assertDateString, assertOptionalOneOf, assertNumber } from '@/lib/validation/index'

/**
 * GET /api/transactions — List transaction metrics with pagination and filters.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const pageSize = Math.min(200, Math.max(1, parseInt(searchParams.get('pageSize') || '20')))
  const customerId = searchParams.get('customerId')
  const productKey = searchParams.get('productKey')
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const revenueType = searchParams.get('revenueType')

  const where: any = {}
  if (customerId) where.customerId = parseInt(customerId)
  if (productKey) where.productKey = productKey
  if (revenueType) where.revenueType = revenueType
  if (from) where.metricDate = { ...where.metricDate, gte: new Date(from) }
  if (to) where.metricDate = { ...where.metricDate, lte: new Date(to + 'T23:59:59') }

  if (session.user.role === 'SALES') {
    where.OR = [
      { customer: { followerId: session.user.id } },
    ]
  }

  const [metrics, total] = await Promise.all([
    prisma.transactionMetric.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { metricDate: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.transactionMetric.count({ where }),
  ])

  return NextResponse.json({ metrics, total, page, pageSize })
}

/**
 * POST /api/transactions — Create transaction metrics (supports bulk).
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const data = await req.json()

  // Support both single object and array
  const items = Array.isArray(data) ? data : [data]
  const created: any[] = []

  for (const item of items) {
    let validated: any
    try {
      validated = {
        customerId: assertInt(item.customerId, 'customerId'),
        productKey: assertString(item.productKey, 'productKey'),
        metricDate: assertDateString(item.metricDate, 'metricDate'),
        gmv: item.gmv != null ? assertNumber(item.gmv, 'gmv') : 0,
        orders: assertOptionalInt(item.orders, 'orders') ?? 0,
        revenue: item.revenue != null ? assertNumber(item.revenue, 'revenue') : 0,
        revenueType: assertOptionalOneOf(item.revenueType, ['TRANSACTION', 'SUBSCRIPTION', 'AI_TOKEN'], 'revenueType') ?? 'TRANSACTION',
        notes: assertOptionalString(item.notes, 'notes') ?? null,
        source: assertOptionalOneOf(item.source, ['manual', 'api', 'system'], 'source') ?? 'manual',
      }
    } catch (err) {
      if (err instanceof ValidationError) {
        return NextResponse.json({ error: err.message }, { status: 400 })
      }
      throw err
    }

    // SALES users can only create for their own customers
    if (session.user.role === 'SALES') {
      const cust = await prisma.customer.findUnique({
        where: { id: validated.customerId },
        select: { followerId: true },
      })
      if (!cust || cust.followerId !== session.user.id) {
        return NextResponse.json({ error: `Customer ${validated.customerId} not accessible` }, { status: 403 })
      }
    }

    const record = await prisma.transactionMetric.create({
      data: {
        customerId: validated.customerId,
        productKey: validated.productKey,
        metricDate: new Date(validated.metricDate),
        gmv: validated.gmv,
        orders: validated.orders,
        revenue: validated.revenue,
        revenueType: validated.revenueType,
        notes: validated.notes,
        source: validated.source,
        createdById: session.user.id,
      },
      include: {
        customer: { select: { id: true, name: true } },
      },
    })
    created.push(record)
  }

  return NextResponse.json(items.length > 1 ? { metrics: created, count: created.length } : created[0])
}

/**
 * PATCH /api/transactions/[id] — Update a transaction metric.
 */
export async function PATCH(req: NextRequest, ctx: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = parseInt(ctx.params.id)
  const data = await req.json()

  const metric = await prisma.transactionMetric.findUnique({
    where: { id },
    include: { customer: { select: { followerId: true } } },
  })
  if (!metric) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (session.user.role === 'SALES' && metric.customer?.followerId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const updates: any = {}
  if ('productKey' in data) updates.productKey = assertString(data.productKey, 'productKey')
  if ('metricDate' in data) updates.metricDate = assertDateString(data.metricDate, 'metricDate') ? new Date(data.metricDate) : undefined
  if ('gmv' in data) updates.gmv = data.gmv != null ? assertNumber(data.gmv, 'gmv') : 0
  if ('orders' in data) updates.orders = assertOptionalInt(data.orders, 'orders') ?? 0
  if ('revenue' in data) updates.revenue = data.revenue != null ? assertNumber(data.revenue, 'revenue') : 0
  if ('revenueType' in data) updates.revenueType = assertOptionalOneOf(data.revenueType, ['TRANSACTION', 'SUBSCRIPTION', 'AI_TOKEN'], 'revenueType')
  if ('notes' in data) updates.notes = assertOptionalString(data.notes, 'notes') ?? null

  const updated = await prisma.transactionMetric.update({ where: { id }, data: updates })
  return NextResponse.json(updated)
}

/**
 * DELETE /api/transactions/[id] — Delete a transaction metric.
 */
export async function DELETE(req: NextRequest, ctx: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = parseInt(ctx.params.id)
  const metric = await prisma.transactionMetric.findUnique({
    where: { id },
    include: { customer: { select: { followerId: true } } },
  })
  if (!metric) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (session.user.role === 'SALES' && metric.customer?.followerId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await prisma.transactionMetric.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
