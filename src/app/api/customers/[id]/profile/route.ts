import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canAccessCustomer, getDataScope } from '@/lib/auth-helpers'

// GET /api/customers/[id]/profile — fetch merchant profile (auto-create if missing)
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const customerId = parseInt(params.id, 10)
  if (isNaN(customerId)) {
    return NextResponse.json({ error: 'Invalid customer ID' }, { status: 400 })
  }

  // Check access
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true, followerId: true, region: true },
  })
  if (!customer || !canAccessCustomer(session, customer)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Auto-create empty profile if missing
  let profile = await prisma.merchantProfile.findUnique({
    where: { customerId },
  })

  if (!profile) {
    profile = await prisma.merchantProfile.create({
      data: { customerId },
    })
  }

  // Parse JSON fields for the response
  return NextResponse.json({
    ...profile,
    openingHours: profile.openingHours ? JSON.parse(profile.openingHours) : null,
    specialHours: profile.specialHours ? JSON.parse(profile.specialHours) : null,
    features: profile.features ? JSON.parse(profile.features) : null,
  })
}

// PATCH /api/customers/[id]/profile — update merchant profile
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const customerId = parseInt(params.id, 10)
  if (isNaN(customerId)) {
    return NextResponse.json({ error: 'Invalid customer ID' }, { status: 400 })
  }

  // Check access
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true, followerId: true, region: true },
  })
  if (!customer || !canAccessCustomer(session, customer)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()

  // Build update data — only allow known fields
  const allowedFields = [
    'kitchChatId', 'yelpId', 'googleId', 'psId',
    'street', 'streetNumber', 'state', 'zipCode', 'country',
    'lat', 'lng',
    'chineseName', 'email', 'logoUrl', 'bannerUrl',
    'priceLevel', 'rating', 'menuUrl', 'googleAiDesc', 'aiDesc',
    'businessStatus', 'dataSource',
  ] as const

  const updateData: Record<string, unknown> = {}
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updateData[field] = body[field]
    }
  }

  // Handle JSON fields — stringify before saving
  if (body.openingHours !== undefined) {
    updateData.openingHours = JSON.stringify(body.openingHours)
  }
  if (body.specialHours !== undefined) {
    updateData.specialHours = JSON.stringify(body.specialHours)
  }
  if (body.features !== undefined) {
    updateData.features = JSON.stringify(body.features)
  }

  // Upsert: create if not exists, update if exists
  const profile = await prisma.merchantProfile.upsert({
    where: { customerId },
    create: { customerId, ...updateData },
    update: updateData,
  })

  // Parse JSON fields for the response
  return NextResponse.json({
    ...profile,
    openingHours: profile.openingHours ? JSON.parse(profile.openingHours) : null,
    specialHours: profile.specialHours ? JSON.parse(profile.specialHours) : null,
    features: profile.features ? JSON.parse(profile.features) : null,
  })
}
