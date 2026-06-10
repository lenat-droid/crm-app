import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { validateCreateSupportTicket, validateUpdateSupportTicket, ValidationError } from '@/lib/validation/schemas'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const pageSize = Math.min(200, Math.max(1, parseInt(searchParams.get('pageSize') || '20')))
  const status = searchParams.get('status')
  const priority = searchParams.get('priority')
  const customerId = searchParams.get('customerId')
  const assignedToId = searchParams.get('assignedToId')

  const where: any = {}
  if (status) where.status = status
  if (priority) where.priority = priority
  if (customerId) where.customerId = parseInt(customerId)
  if (assignedToId) where.assignedToId = parseInt(assignedToId)

  // Data scoping: SALES sees tickets assigned to them
  if (session.user.role === 'SALES') {
    where.assignedToId = session.user.id
  } else if (session.user.role === 'SALES_MGR' && session.user.region) {
    where.customer = { region: session.user.region }
  }

  const [tickets, total] = await Promise.all([
    prisma.supportTicket.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true } },
        _count: { select: { messages: true } },
      },
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.supportTicket.count({ where }),
  ])

  return NextResponse.json({ tickets, total, page, pageSize })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const data = await req.json()

  let validated: ReturnType<typeof validateCreateSupportTicket>
  try {
    validated = validateCreateSupportTicket(data)
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    throw err
  }

  const ticket = await prisma.supportTicket.create({
    data: {
      customerId: validated.customerId,
      subject: validated.subject,
      status: 'OPEN',
      priority: validated.priority || 'MEDIUM',
      source: 'MANUAL',
      assignedToId: validated.assignedToId || null,
    },
  })

  return NextResponse.json(ticket)
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const data = await req.json()
  if (!data.id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  let validated: ReturnType<typeof validateUpdateSupportTicket>
  try {
    validated = validateUpdateSupportTicket(data)
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    throw err
  }

  const updateData: Record<string, unknown> = { ...validated }

  // If resolving, set resolvedAt
  if (updateData.status === 'RESOLVED' || updateData.status === 'CLOSED') {
    updateData.resolvedAt = new Date()
  }

  const ticket = await prisma.supportTicket.update({
    where: { id: data.id },
    data: updateData as any,
  })

  return NextResponse.json(ticket)
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const id = parseInt(searchParams.get('id') || '')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  await prisma.supportTicket.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
