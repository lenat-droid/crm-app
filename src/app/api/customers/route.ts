import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getDataScope } from '@/lib/auth-helpers'
import { validateCreateCustomer, ValidationError } from '@/lib/validation/schemas'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const stats = searchParams.get('stats')
  const search = searchParams.get('search')
  const region = searchParams.get('region')
  const type = searchParams.get('type')
  const status = searchParams.get('status')        // filters contactStatus
  const customerStatus = searchParams.get('customerStatus')  // filters Customer.status (ACTIVE/INACTIVE/ARCHIVED)
  const tier = searchParams.get('tier')
  const followerId = searchParams.get('followerId')
  const productField = searchParams.get('productField')
  const productInterest = searchParams.get('productInterest')
  const productInterests = searchParams.get('productInterests')  // comma-separated multi-value
  const cursor = searchParams.get('cursor')
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const pageSize = Math.min(200, Math.max(1, parseInt(searchParams.get('pageSize') || '20')))

  // Stats mode
  if (stats === 'true') {
    const [totalCustomers, totalPipelines, totalLeads, totalVisits] = await Promise.all([
      prisma.customer.count(),
      prisma.pipeline.count(),
      prisma.lead.count({ where: { status: 'new' } }),
      prisma.visit.count(),
    ])
    return NextResponse.json({ totalCustomers, totalPipelines, totalLeads, totalVisits })
  }

  // Build where clause
  const scope = getDataScope(session)
  const where: any = { ...scope }

  // By default exclude ARCHIVED customers (soft-delete)
  // Pass ?customerStatus=ARCHIVED to see only archived ones
  // Pass ?customerStatus=ALL to disable this filter
  if (customerStatus === 'ALL') {
    // no filter on Customer.status
  } else if (customerStatus) {
    where.status = customerStatus
  } else {
    where.status = { not: 'ARCHIVED' }
  }

  if (search) {
    where.OR = [
      { name: { contains: search } },
      { city: { contains: search } },
      { storePhone: { contains: search } },
    ]
  }
  if (region) where.region = region
  if (type) where.type = type
  if (status) where.contactStatus = status
  if (tier) where.tier = tier
  if (followerId) where.followerId = parseInt(followerId)

  // Single product interest filter
  if (productField && productInterest) {
    where[productField] = productInterest
  }

  // Multi-value product interest filter (comma-separated)
  if (productField && productInterests) {
    const levels = productInterests.split(',').map(s => s.trim()).filter(Boolean)
    if (levels.length > 0) {
      where[productField] = { in: levels }
    }
  }

  // Cursor-based pagination (optional, alongside offset)
  const findManyArgs: any = {
    where,
    include: { follower: { select: { id: true, name: true } }, pipeline: true },
    orderBy: { updatedAt: 'desc' },
  }

  if (cursor) {
    findManyArgs.cursor = { id: parseInt(cursor) }
    findManyArgs.skip = 1  // skip the cursor itself
    findManyArgs.take = pageSize
  } else {
    findManyArgs.skip = (page - 1) * pageSize
    findManyArgs.take = pageSize
  }

  const [customers, total] = await Promise.all([
    prisma.customer.findMany(findManyArgs),
    prisma.customer.count({ where }),
  ])

  // When filtering by productField, annotate each customer with their interest level
  if (productField) {
    for (const c of customers) {
      (c as any)._productInterestLevel = (c as any)[productField] || 'NOT_CONTACTED'
    }
  }

  const nextCursor = customers.length === pageSize ? customers[customers.length - 1].id : null

  return NextResponse.json({ customers, total, page, pageSize, nextCursor })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const data = await req.json()
    const validated = validateCreateCustomer(data)
    const customer = await prisma.customer.create({ data: validated })
    return NextResponse.json(customer)
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    throw err
  }
}
