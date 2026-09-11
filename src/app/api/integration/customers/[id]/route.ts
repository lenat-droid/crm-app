/**
 * GET /api/integration/customers/:id
 *
 * Returns a single customer's full profile in one response:
 *   - Basic info (base fields)
 *   - Product interest (denormalized fields + normalized ProductInterest matrix)
 *   - Product deployment (active deployments)
 *   - Subscription (active subscriptions with contract info)
 *   - Recent transaction metrics (last 10)
 *   - Recent revenue records (last 10)
 *   - Merchant profile
 *   - Pipeline info
 *
 * Auth: same as list endpoint — x-api-token or session.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  parseIntegrationAuth,
  getIntegrationScope,
  isAuthenticated,
} from '../../auth'
import { PRODUCT_KEY_TO_FIELD, shapeCustomer } from '../../customers/route'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const ctx = await parseIntegrationAuth(req)

  if (!isAuthenticated(ctx)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const customerId = parseInt(params.id)
  if (isNaN(customerId)) {
    return NextResponse.json({ error: 'Invalid customer ID' }, { status: 400 })
  }

  const scope = getIntegrationScope(ctx)

  // Full customer record with all related data
  const raw = await prisma.customer.findFirst({
    where: { id: customerId, ...scope },
    include: {
      follower: { select: { id: true, name: true, email: true, role: true } },
      profile: true,
      productDeployments: {
        where: { status: 'ACTIVE' },
        select: { id: true, productKey: true, status: true, plan: true, monthlyFee: true, deployedAt: true },
      },
      subscriptions: {
        where: { status: 'ACTIVE' },
        include: {
          product: { select: { id: true, name: true, key: true } },
        },
      },
      productInterests: {
        include: { product: { select: { id: true, name: true, key: true } } },
      },
      transactionMetrics: {
        take: 10,
        orderBy: { metricDate: 'desc' },
        select: {
          id: true, productKey: true, metricDate: true,
          gmv: true, orders: true, revenue: true, revenueType: true,
        },
      },
      revenueRecords: {
        take: 10,
        orderBy: { recordDate: 'desc' },
        select: {
          id: true, productKey: true, revenueType: true,
          amount: true, currency: true, periodStart: true, periodEnd: true, recordDate: true,
        },
      },
      pipeline: {
        include: {
          communications: {
            include: { createdBy: { select: { id: true, name: true } } },
            orderBy: { contactOrder: 'asc' },
            take: 5,
          },
        },
      },
    },
  })

  if (!raw) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
  }

  const customer = shapeCustomer(raw, {
    includeProfile: true,
    includeDeployments: true,
    includeSubscriptions: true,
    includeProductInterest: true,
    includeTransactionMetrics: true,
    includeRevenueRecords: true,
  })

  // Add pipeline info
  if (raw.pipeline) {
    customer.pipeline = {
      status: raw.pipeline.status,
      active: raw.pipeline.active,
      lastContactDate: raw.pipeline.lastContactDate,
      nextFollowUpAt: raw.pipeline.nextFollowUpAt,
      nextAction: raw.pipeline.nextAction,
      notes: raw.pipeline.notes,
    }
  }

  return NextResponse.json({ data: customer })
}
