import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const products = await prisma.productCatalog.findMany({
    orderBy: [{ active: 'desc' }, { sortOrder: 'asc' }],
  })

  return NextResponse.json({ products })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const data = await req.json()
  if (!data.key || !data.name) {
    return NextResponse.json({ error: 'key and name are required' }, { status: 400 })
  }

  const product = await prisma.productCatalog.create({
    data: {
      key: data.key,
      name: data.name,
      category: data.category || null,
      active: data.active !== false,
      sortOrder: data.sortOrder ?? 0,
    },
  })

  return NextResponse.json(product)
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const data = await req.json()
  const { id, ...fields } = data
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const product = await prisma.productCatalog.update({
    where: { id },
    data: fields,
  })

  return NextResponse.json(product)
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const id = parseInt(searchParams.get('id') || '')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  await prisma.productCatalog.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
