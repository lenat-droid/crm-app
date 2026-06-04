import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ticketId = parseInt(params.id)
  const data = await req.json()
  if (!data.content) {
    return NextResponse.json({ error: 'content is required' }, { status: 400 })
  }

  // Verify ticket exists
  const ticket = await prisma.supportTicket.findUnique({ where: { id: ticketId } })
  if (!ticket) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })

  const message = await prisma.ticketMessage.create({
    data: {
      ticketId,
      content: data.content,
      authorType: 'AGENT',
      isFromCustomer: false,
    },
  })

  return NextResponse.json(message)
}
