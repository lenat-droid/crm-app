import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getDataScope } from '@/lib/auth-helpers'
import { validateCreateVisit, ValidationError } from '@/lib/validation/schemas'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const pageSize = Math.min(200, Math.max(1, parseInt(searchParams.get('pageSize') || '20')))
  const customerId = searchParams.get('customerId')

  // Data scoping: SALES see only their own visits
  const scope = getDataScope(session)
  const where: any = {}

  if (session.user.role === 'SALES') {
    where.visitedById = session.user.id
  }
  if (customerId) where.customerId = parseInt(customerId)

  const [visits, total] = await Promise.all([
    prisma.visit.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true } },
        visitedBy: { select: { id: true, name: true } },
      },
      orderBy: { visitDate: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.visit.count({ where }),
  ])

  return NextResponse.json({ visits, total, page, pageSize })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const data = await req.json()
  let validated: ReturnType<typeof validateCreateVisit>
  try {
    validated = validateCreateVisit(data)
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    throw err
  }

  const visit = await prisma.visit.create({
    data: {
      customerId: validated.customerId,
      visitDate: new Date(validated.visitDate),
      visitedById: session.user.id,
      outcome: validated.outcome || null,
      notes: validated.notes || null,
    },
  })

  return NextResponse.json(visit)
}
