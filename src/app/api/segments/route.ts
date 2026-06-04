import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const segments = await prisma.customerSegment.findMany({
    include: { createdBy: { select: { id: true, name: true } } },
    orderBy: { customerCount: 'desc' },
  })

  return NextResponse.json({ segments })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role === 'SALES') {
    return NextResponse.json({ error: 'Forbidden: only admins and managers can manage segments' }, { status: 403 })
  }

  const data = await req.json()
  if (!data.name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  const segment = await prisma.customerSegment.create({
    data: {
      name: data.name,
      description: data.description || null,
      queryConfig: data.queryConfig ? JSON.stringify(data.queryConfig) : null,
      isDynamic: data.isDynamic !== false,
      customerCount: data.customerCount || 0,
      createdById: session.user.id,
    },
  })

  return NextResponse.json(segment)
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role === 'SALES') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const data = await req.json()
  const { id, ...fields } = data
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const updateData: any = { ...fields }
  if (fields.queryConfig) {
    updateData.queryConfig = JSON.stringify(fields.queryConfig)
  }

  const segment = await prisma.customerSegment.update({
    where: { id },
    data: updateData,
  })

  return NextResponse.json(segment)
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role === 'SALES') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const id = parseInt(searchParams.get('id') || '')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  await prisma.customerSegment.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
