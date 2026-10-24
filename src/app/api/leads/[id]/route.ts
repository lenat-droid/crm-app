import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { leadScope, validateAimFollowup } from '@/lib/aim-leads'
import { ValidationError } from '@/lib/validation/schemas'

async function context(id: string) {
  const session = await getServerSession(authOptions)
  if (!session) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const value = Number(id)
  if (!Number.isSafeInteger(value) || value < 1) return { error: NextResponse.json({ error: 'Not Found' }, { status: 404 }) }
  const legacy = session.user.role === 'SALES' ? { registeredById: session.user.id } : {}
  const lead = await prisma.lead.findFirst({ where: { AND: [{ id: value }, await leadScope(session, legacy)] }, include: { notification: { include: { logs: { orderBy: { attempt: 'asc' } } } }, registeredBy: { select: { name: true } } } })
  if (!lead) return { error: NextResponse.json({ error: 'Not Found' }, { status: 404 }) }
  return { lead }
}
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const result = await context(params.id)
  return result.error || NextResponse.json(result.lead, { headers: { 'Cache-Control': 'no-store' } })
}
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const result = await context(params.id)
  if (result.error) return result.error
  if (!result.lead!.aimApplicationId) return NextResponse.json({ error: 'Use existing lead workflow' }, { status: 400 })
  try {
    const data = validateAimFollowup(await req.json())
    return NextResponse.json(await prisma.lead.update({ where: { id: result.lead!.id }, data }))
  } catch (e) {
    if (e instanceof ValidationError || e instanceof SyntaxError) return NextResponse.json({ error: 'Invalid follow-up' }, { status: 400 })
    throw e
  }
}
