import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/public/share?token=xxx — returns user name + their customers (no auth needed)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const token = searchParams.get('token')

  if (!token) {
    return NextResponse.json({ error: 'token is required' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({
    where: { shareToken: token },
    select: { id: true, name: true, role: true },
  })

  if (!user) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 404 })
  }

  // Return the customers this sales rep follows
  const customers = await prisma.customer.findMany({
    where: {
      followerId: user.id,
      status: { not: 'ARCHIVED' },
    },
    select: { id: true, name: true, city: true, region: true, type: true, contactStatus: true },
    orderBy: { name: 'asc' },
    take: 200,
  })

  return NextResponse.json({ user, customers })
}

// POST /api/public/share/checkin — submit a check-in (no auth needed, validated by token)
export async function POST(req: NextRequest) {
  const data = await req.json()
  const { token, customerId, contactDate, record, ...interestFields } = data

  if (!token) {
    return NextResponse.json({ error: 'token is required' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({
    where: { shareToken: token },
    select: { id: true },
  })

  if (!user) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 404 })
  }

  // Find or create pipeline for this customer
  let pipeline = await prisma.pipeline.findUnique({ where: { customerId } })

  if (!pipeline) {
    pipeline = await prisma.pipeline.create({
      data: {
        customerId,
        salesPersonId: user.id,
        status: '已建联',
        lastContactDate: contactDate ? new Date(contactDate) : null,
      },
    })
  } else {
    pipeline = await prisma.pipeline.update({
      where: { id: pipeline.id },
      data: {
        lastContactDate: contactDate ? new Date(contactDate) : undefined,
      },
    })
  }

  // Add communication record
  if (contactDate && record) {
    const maxOrder = await prisma.communication.aggregate({
      where: { pipelineId: pipeline.id },
      _max: { contactOrder: true },
    })
    const nextOrder = (maxOrder._max.contactOrder || 0) + 1

    await prisma.communication.create({
      data: {
        pipelineId: pipeline.id,
        contactDate: new Date(contactDate),
        record,
        contactOrder: nextOrder,
        createdById: user.id,
      },
    })
  }

  // Update product interest fields
  const interestUpdate: any = {}
  const productFields = [
    'posStatus', 'psWebsiteStatus', 'smtStatus', 'platformManagedStatus',
    'aiCamStatus', 'omeStatus', 'smartRobotStatus',
  ]
  for (const field of productFields) {
    if (interestFields[field]) {
      interestUpdate[field] = interestFields[field]
    }
  }
  if (Object.keys(interestUpdate).length > 0) {
    await prisma.customer.update({
      where: { id: customerId },
      data: interestUpdate,
    })
  }

  return NextResponse.json({ success: true })
}
