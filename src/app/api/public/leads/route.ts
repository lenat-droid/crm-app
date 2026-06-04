import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// POST /api/public/leads — create a lead via share link (no auth needed)
export async function POST(req: NextRequest) {
  const data = await req.json()
  const { token, name, phone, contactPerson, foodType, posBrand, needs, notes, visitDate, address, city, state, zipCode, website } = data

  if (!token) {
    return NextResponse.json({ error: 'token is required' }, { status: 400 })
  }

  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  // Look up the user by share token
  const user = await prisma.user.findUnique({
    where: { shareToken: token },
    select: { id: true },
  })

  if (!user) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 404 })
  }

  // Auto-convert: create Lead + Customer + Pipeline in a transaction
  const result = await prisma.$transaction(async (tx) => {
    const lead = await tx.lead.create({
      data: {
        name,
        phone: phone || null,
        contactPerson: contactPerson || null,
        foodType: foodType || null,
        posBrand: posBrand || null,
        needs: needs || null,
        notes: notes || null,
        source: 'REFERRAL',
        status: 'converted',
        registeredById: user.id,
        visitDate: visitDate ? new Date(visitDate) : null,
      },
    })

    const customer = await tx.customer.create({
      data: {
        name: lead.name,
        storePhone: lead.phone || undefined,
        merchantContact: lead.contactPerson || undefined,
        type: lead.foodType || undefined,
        source: 'LEAD_CONVERSION',
        notes: lead.needs || undefined,
        followerId: user.id,
        // New address fields
        city: city || undefined,
        website: website || undefined,
      },
    })

    // Create MerchantProfile with address details
    await tx.merchantProfile.create({
      data: {
        customerId: customer.id,
        street: address || undefined,
        state: state || undefined,
        zipCode: zipCode || undefined,
        dataSource: 'MERCHANT',
      },
    })

    await tx.lead.update({
      where: { id: lead.id },
      data: { customerId: customer.id },
    })

    const pipeline = await tx.pipeline.create({
      data: {
        customerId: customer.id,
        salesPersonId: user.id,
        status: '已建联',
        notes: lead.needs || undefined,
      },
    })

    return { lead: { ...lead, customerId: customer.id, status: 'converted' }, customer, pipeline }
  })

  return NextResponse.json(result)
}
