import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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
  if (!data.customerId || !data.productId) {
    return NextResponse.json({ error: 'customerId and productId are required' }, { status: 400 })
  }

  const subscription = await prisma.subscription.create({
    data: {
      customerId: data.customerId,
      productId: data.productId,
      plan: data.plan || 'MONTHLY',
      billingType: data.billingType || 'RECURRING',
      oneTimeAmount: data.billingType === 'ONE_TIME' ? (data.oneTimeAmount || 0) : null,
      status: data.status || 'ACTIVE',
      mrr: data.mrr || 0,
      startDate: data.startDate ? new Date(data.startDate) : new Date(),
      endDate: data.endDate ? new Date(data.endDate) : null,
      trialEndDate: data.trialEndDate ? new Date(data.trialEndDate) : null,
      autoRenew: data.billingType === 'ONE_TIME' ? false : (data.autoRenew !== false),
      notes: data.notes || null,
      salesPersonId: session.user.id,
    },
  })

  return NextResponse.json(subscription)
}
