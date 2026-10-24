import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ValidationError, assertString, assertOptionalString, assertInt, assertOptionalInt, assertOptionalOneOf, assertNumber, assertOptionalDateString } from '@/lib/validation/index'
import { DEPLOYMENT_STATUSES } from '@/lib/constants'

/**
 * GET /api/deployments — List product deployments.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const customerId = searchParams.get('customerId')
  const productKey = searchParams.get('productKey')
  const status = searchParams.get('status')

  const where: any = {}
  if (customerId) where.customerId = parseInt(customerId)
  if (productKey) where.productKey = productKey
  if (status) where.status = status

  const deployments = await prisma.productDeployment.findMany({
    where,
    include: {
      customer: { select: { id: true, name: true } },
    },
    orderBy: { deployedAt: 'desc' },
  })

  return NextResponse.json({ deployments })
}

/**
 * POST /api/deployments — Create a product deployment.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const data = await req.json()
  let validated: any
  try {
    validated = {
      customerId: assertInt(data.customerId, 'customerId'),
      productKey: assertString(data.productKey, 'productKey'),
      deployedAt: data.deployedAt ? new Date(data.deployedAt) : new Date(),
      status: assertOptionalOneOf(data.status, DEPLOYMENT_STATUSES, 'status') ?? 'ACTIVE',
      plan: assertOptionalString(data.plan, 'plan') ?? null,
      monthlyFee: data.monthlyFee != null ? assertNumber(data.monthlyFee, 'monthlyFee') : 0,
      notes: assertOptionalString(data.notes, 'notes') ?? null,
    }
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    throw err
  }

  const deployment = await prisma.productDeployment.upsert({
    where: { customerId_productKey: { customerId: validated.customerId, productKey: validated.productKey } },
    update: {
      status: validated.status,
      plan: validated.plan,
      monthlyFee: validated.monthlyFee,
      notes: validated.notes,
      deployedAt: validated.deployedAt,
    },
    create: {
      customerId: validated.customerId,
      productKey: validated.productKey,
      deployedAt: validated.deployedAt,
      status: validated.status,
      plan: validated.plan,
      monthlyFee: validated.monthlyFee,
      notes: validated.notes,
    },
    include: { customer: { select: { id: true, name: true } } },
  })

  return NextResponse.json(deployment)
}

/**
 * PATCH /api/deployments/[id] — Update a product deployment.
 */
export async function PATCH(req: NextRequest, ctx: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = parseInt(ctx.params.id)
  const data = await req.json()

  const existing = await prisma.productDeployment.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const updates: any = {}
  if ('status' in data) updates.status = assertOptionalOneOf(data.status, DEPLOYMENT_STATUSES, 'status')
  if ('plan' in data) updates.plan = assertOptionalString(data.plan, 'plan') ?? null
  if ('monthlyFee' in data) updates.monthlyFee = data.monthlyFee != null ? assertNumber(data.monthlyFee, 'monthlyFee') : 0
  if ('notes' in data) updates.notes = assertOptionalString(data.notes, 'notes') ?? null

  const updated = await prisma.productDeployment.update({ where: { id }, data: updates })
  return NextResponse.json(updated)
}

/**
 * DELETE /api/deployments/[id] — Delete a product deployment.
 */
export async function DELETE(req: NextRequest, ctx: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = parseInt(ctx.params.id)
  const deployment = await prisma.productDeployment.findUnique({ where: { id } })
  if (!deployment) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.productDeployment.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
