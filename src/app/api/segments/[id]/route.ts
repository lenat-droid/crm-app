import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = parseInt(params.id)
  const segment = await prisma.customerSegment.findUnique({
    where: { id },
    include: { createdBy: { select: { id: true, name: true } } },
  })

  if (!segment) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ segment })
}
