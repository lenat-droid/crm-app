import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = parseInt(params.id)
  const exportJob = await prisma.exportJob.findUnique({
    where: { id },
    include: { requestedBy: { select: { id: true, name: true } } },
  })

  if (!exportJob) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Check permission: only admin or the requester can view
  if (session.user.role !== 'ADMIN' && exportJob.requestedById !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return NextResponse.json({ export: exportJob })
}
