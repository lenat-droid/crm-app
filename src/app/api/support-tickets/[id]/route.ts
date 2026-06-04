import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = parseInt(params.id)

  // Apply data scope
  const where: any = { id }
  if (session.user.role === 'SALES') {
    where.assignedToId = session.user.id
  } else if (session.user.role === 'SALES_MGR' && session.user.region) {
    where.customer = { region: session.user.region }
  }

  const ticket = await prisma.supportTicket.findFirst({
    where,
    include: {
      customer: { select: { id: true, name: true, region: true } },
      assignedTo: { select: { id: true, name: true } },
      messages: { orderBy: { createdAt: 'asc' } },
    },
  })

  if (!ticket) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ticket })
}
