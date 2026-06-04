import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getDataScope, canAccessCustomer } from '@/lib/auth-helpers'
import { validateUpdateCustomer, ValidationError } from '@/lib/validation/schemas'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = parseInt(params.id)

  // Apply data scope: SALES can only see customers they follow
  const scope = getDataScope(session)
  const customer = await prisma.customer.findFirst({
    where: { id, ...scope },
    include: {
      follower: { select: { id: true, name: true } },
      pipeline: { include: { communications: { include: { createdBy: { select: { id: true, name: true } } }, orderBy: { contactOrder: 'asc' } } } },
      visits: { include: { visitedBy: { select: { id: true, name: true } } }, orderBy: { visitDate: 'desc' } },
      visitLogs: { include: { visitedBy: { select: { id: true, name: true } } }, orderBy: { visitDate: 'desc' } },
      leads: true,
      healthScoreObj: true,
      subscriptions: {
        include: {
          product: { select: { id: true, name: true, key: true } },
          salesPerson: { select: { id: true, name: true } },
        },
        orderBy: { startDate: 'desc' },
      },
      supportTickets: {
        include: { assignedTo: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
      productInterests: {
        include: { product: { select: { id: true, name: true, key: true } } },
      },
      customerLogs: {
        include: { changedBy: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      },
      profile: true,
    },
  })

  if (!customer) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(customer)
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = parseInt(params.id)
  const data = await req.json()

  // Validate
  let validated: Record<string, unknown>
  try {
    validated = validateUpdateCustomer(data)
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    throw err
  }

  // Check access: SALES can only edit customers they follow
  let oldCustomer: any = null
  if (session.user.role === 'SALES') {
    oldCustomer = await prisma.customer.findUnique({ where: { id } })
    if (!oldCustomer || !canAccessCustomer(session, oldCustomer)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  } else {
    oldCustomer = await prisma.customer.findUnique({ where: { id } })
  }

  const customer = await prisma.customer.update({ where: { id }, data: validated })

  // Log changes (skip product interest fields — those are tracked differently)
  const skipFields = new Set([
    'posStatus', 'psWebsiteStatus', 'smtStatus', 'platformManagedStatus',
    'aiCamStatus', 'omeStatus', 'smartRobotStatus',
    'updatedAt', 'createdAt', 'id',
  ])
  const logEntries: any[] = []
  for (const [field, newVal] of Object.entries(validated)) {
    if (skipFields.has(field)) continue
    const oldVal = oldCustomer?.[field]
    const oldStr = oldVal != null ? String(oldVal) : null
    const newStr = newVal != null ? String(newVal) : null
    if (oldStr !== newStr) {
      logEntries.push({
        customerId: id,
        fieldName: field,
        oldValue: oldStr,
        newValue: newStr,
        changedById: session.user.id,
      })
    }
  }

  if (logEntries.length > 0) {
    await prisma.customerLog.createMany({ data: logEntries })
  }

  return NextResponse.json(customer)
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const id = parseInt(params.id)
  await prisma.customer.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
