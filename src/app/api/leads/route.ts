import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getDataScope } from '@/lib/auth-helpers'
import { leadScope, validateAimFollowup } from '@/lib/aim-leads'
import { validateCreateLead, validateUpdateLead, ValidationError } from '@/lib/validation/schemas'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const pageSize = Math.min(200, Math.max(1, parseInt(searchParams.get('pageSize') || '20')))
  const status = searchParams.get('status')

  // Data scoping: SALES see only their own leads
  const legacyWhere: any = {}
  if (session.user.role === 'SALES') {
    legacyWhere.registeredById = session.user.id
  }
  const where: any = await leadScope(session, legacyWhere)
  if (status) where.status = status

  const [leads, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      include: {
        notification: { select: { status: true, attempts: true, sentAt: true } },
        customer: { select: { id: true, name: true } },
        registeredBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.lead.count({ where }),
  ])

  return NextResponse.json({ leads, total, page, pageSize })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const data = await req.json()
  let validated: ReturnType<typeof validateCreateLead>
  try {
    validated = validateCreateLead(data)
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    throw err
  }

  // Auto-convert: create Customer + Pipeline alongside the Lead
  const result = await prisma.$transaction(async (tx) => {
    const lead = await tx.lead.create({
      data: {
        name: validated.name,
        phone: validated.phone || null,
        contactPerson: validated.contactPerson || null,
        foodType: validated.foodType || null,
        posBrand: validated.posBrand || null,
        needs: validated.needs || null,
        status: 'converted',
        notes: validated.notes || null,
        source: validated.source || null,
        score: validated.score || null,
        registeredById: session.user.id,
        visitDate: validated.visitDate ? new Date(validated.visitDate) : null,
      },
    })

    const customer = await tx.customer.create({
      data: {
        name: lead.name,
        storePhone: lead.phone || undefined,
        merchantContact: lead.contactPerson || undefined,
        type: lead.foodType || undefined,
        source: 'LEAD_CONVERSION',
        notes: lead.needs || undefined,
        followerId: session.user.id,
      },
    })

    await tx.lead.update({
      where: { id: lead.id },
      data: { customerId: customer.id },
    })

    const pipeline = await tx.pipeline.create({
      data: {
        customerId: customer.id,
        salesPersonId: session.user.id,
        status: '已建联',
        notes: lead.needs || undefined,
      },
    })

    return { lead: { ...lead, customerId: customer.id, status: 'converted' }, customer, pipeline }
  })

  return NextResponse.json(result)
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const data = await req.json()
  const { id, action, ...updateData } = data

  // Validate
  let validated: ReturnType<typeof validateUpdateLead>
  try {
    validated = validateUpdateLead(data)
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    throw err
  }

  if (Object.keys(updateData).some(k => ['aimApplicationId', 'notification', 'consent', 'submittedAt', 'reportId', 'placeId', 'region'].includes(k))) return NextResponse.json({ error: 'Immutable integration fields' }, { status: 400 })
  const intake = await prisma.lead.findUnique({ where: { id: validated.id as number } })
  if (intake?.aimApplicationId) {
    const allowed = await prisma.lead.findFirst({ where: { AND: [{ id: intake.id }, await leadScope(session)] } })
    if (!allowed) return NextResponse.json({ error: 'Not Found' }, { status: 404 })
    if (action !== 'convert') {
      try {
        return NextResponse.json(await prisma.lead.update({ where: { id: intake.id }, data: validateAimFollowup(data) }))
      } catch (e) {
        if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 })
        throw e
      }
    }
    if (intake.customerId) return NextResponse.json({ error: 'Already converted' }, { status: 409 })
  }

  // Backward-compatible: manual convert action (still supported)
  if (action === 'convert') {
    const lead = await prisma.lead.findUnique({ where: { id } })
    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

    const result = await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.create({
        data: {
          name: lead.name,
          storePhone: lead.phone || undefined,
          merchantContact: lead.contactPerson || undefined,
          type: lead.foodType || undefined,
          source: 'LEAD_CONVERSION',
          posStatus: lead.posBrand ? 'INTERESTED' : 'NOT_CONTACTED',
          notes: lead.needs || undefined,
          followerId: session.user.id,
        },
      })

      await tx.lead.update({
        where: { id },
        data: { customerId: customer.id, status: 'converted' },
      })

      const pipeline = await tx.pipeline.create({
        data: {
          customerId: customer.id,
          salesPersonId: session.user.id,
          status: '已建联',
          notes: lead.needs || undefined,
        },
      })

      return { customer, lead: { ...lead, status: 'converted', customerId: customer.id }, pipeline }
    })

    return NextResponse.json(result)
  }

  // Regular update
  const lead = await prisma.lead.update({
    where: { id },
    data: updateData,
  })

  return NextResponse.json(lead)
}
