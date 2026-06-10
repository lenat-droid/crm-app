import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { validateCreateSubscription, ValidationError } from '@/lib/validation/schemas'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const pageSize = Math.min(200, Math.max(1, parseInt(searchParams.get('pageSize') || '20')))
  const status = searchParams.get('status')
  const customerId = searchParams.get('customerId')
  const expiring = searchParams.get('expiring')

  const where: any = {}

  // Data scoping
  if (session.user.role === 'SALES') {
    where.salesPersonId = session.user.id
  } else if (session.user.role === 'SALES_MGR' && session.user.region) {
    where.customer = { region: session.user.region }
  }

  if (status) where.status = status
  if (customerId) where.customerId = parseInt(customerId)

  // Expiring soon: next 30 days
  if (expiring === 'true') {
    const now = new Date()
    const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    where.status = 'ACTIVE'
    where.endDate = { lte: thirtyDaysLater, gte: now }
  }

  const [subscriptions, total] = await Promise.all([
    prisma.subscription.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true } },
        product: { select: { id: true, name: true, key: true } },
        salesPerson: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.subscription.count({ where }),
  ])

  return NextResponse.json({ subscriptions, total, page, pageSize })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const data = await req.json()

  let validated: ReturnType<typeof validateCreateSubscription>
  try {
    validated = validateCreateSubscription(data)
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    throw err
  }

  const subscription = await prisma.subscription.create({
    data: {
      customerId: validated.customerId,
      productId: validated.productId,
      plan: validated.plan || 'MONTHLY',
      billingType: validated.billingType || 'RECURRING',
      oneTimeAmount: validated.oneTimeAmount || null,
      status: validated.status || 'ACTIVE',
      mrr: validated.mrr,
      startDate: new Date(validated.startDate),
      endDate: validated.endDate ? new Date(validated.endDate) : null,
      trialEndDate: validated.trialEndDate ? new Date(validated.trialEndDate) : null,
      autoRenew: validated.billingType === 'ONE_TIME' ? false : (validated.autoRenew !== false),
      notes: validated.notes || null,
      salesPersonId: session.user.id,
    },
  })

  return NextResponse.json(subscription)
}
