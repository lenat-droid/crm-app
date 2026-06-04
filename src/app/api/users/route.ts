import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { validateCreateUser, validateUpdateUser, ValidationError } from '@/lib/validation/schemas'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const pageSize = Math.min(200, Math.max(1, parseInt(searchParams.get('pageSize') || '50')))

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        region: true,
        phone: true,
        active: true,
        shareToken: true,
        createdAt: true,
        _count: { select: { customers: true, pipelines: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.user.count(),
  ])

  return NextResponse.json({ users, total, page, pageSize })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const data = await req.json()
  let validated: ReturnType<typeof validateCreateUser>
  try {
    validated = validateCreateUser(data)
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    throw err
  }

  const hashedPassword = await bcrypt.hash(validated.password, 10)

  const user = await prisma.user.create({
    data: {
      email: validated.email,
      name: validated.name,
      password: hashedPassword,
      role: validated.role || 'SALES',
      region: validated.region || null,
      phone: validated.phone || null,
    },
  })

  return NextResponse.json({ id: user.id, email: user.email, name: user.name, role: user.role })
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const data = await req.json()
  let validated: ReturnType<typeof validateUpdateUser>
  try {
    validated = validateUpdateUser(data)
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    throw err
  }

  const { id, password, ...fields } = validated as any

  const updateData: any = { ...fields }
  if (password) {
    updateData.password = await bcrypt.hash(password, 10)
  }

  const user = await prisma.user.update({ where: { id }, data: updateData })
  return NextResponse.json({ id: user.id, email: user.email, name: user.name, role: user.role })
}
