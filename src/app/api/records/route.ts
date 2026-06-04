import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getDataScope } from '@/lib/auth-helpers'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '30')))
  const typeFilter = searchParams.get('type') // lead | checkin | visit | all
  const customerId = searchParams.get('customerId')

  // Data scoping
  const scope = getDataScope(session)

  // ── Build scoped WHERE clauses ──
  const leadWhere: any = {}
  const commWhere: any = {}
  const visitWhere: any = {}

  if (session.user.role === 'SALES') {
    leadWhere.registeredById = session.user.id
    commWhere.createdById = session.user.id
    visitWhere.visitedById = session.user.id
  }

  if (customerId) {
    const cid = parseInt(customerId)
    leadWhere.customerId = cid
    commWhere.pipeline = { customerId: cid }
    visitWhere.customerId = cid
  }

  // Type filter (skip queries we don't need)
  const fetchLeads = !typeFilter || typeFilter === 'lead' || typeFilter === 'all'
  const fetchCheckins = !typeFilter || typeFilter === 'checkin' || typeFilter === 'all'
  const fetchVisits = !typeFilter || typeFilter === 'visit' || typeFilter === 'all'

  // ── Fetch all three types in parallel ──
  const [leads, communications, visits, leadTotal, commTotal, visitTotal] = await Promise.all([
    fetchLeads
      ? prisma.lead.findMany({
          where: leadWhere,
          include: {
            customer: { select: { id: true, name: true } },
            registeredBy: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'desc' },
        })
      : Promise.resolve([]),

    fetchCheckins
      ? prisma.communication.findMany({
          where: commWhere,
          include: {
            pipeline: {
              include: { customer: { select: { id: true, name: true } } },
            },
            createdBy: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'desc' },
        })
      : Promise.resolve([]),

    fetchVisits
      ? prisma.visit.findMany({
          where: visitWhere,
          include: {
            customer: { select: { id: true, name: true } },
            visitedBy: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'desc' },
        })
      : Promise.resolve([]),

    fetchLeads ? prisma.lead.count({ where: leadWhere }) : Promise.resolve(0),
    fetchCheckins ? prisma.communication.count({ where: commWhere }) : Promise.resolve(0),
    fetchVisits ? prisma.visit.count({ where: visitWhere }) : Promise.resolve(0),
  ])

  // ── Normalize to unified format ──
  const normalized: any[] = []

  for (const lead of leads) {
    normalized.push({
      id: `lead-${lead.id}`,
      type: 'lead',
      title: lead.name,
      description: lead.needs || lead.notes || '',
      customer: lead.customer || undefined,
      user: lead.registeredBy || undefined,
      status: lead.status,
      source: lead.source,
      date: lead.createdAt,
      detailUrl: lead.customer ? `/customers/${lead.customer.id}` : undefined,
    })
  }

  for (const comm of communications) {
    normalized.push({
      id: `checkin-${comm.id}`,
      type: 'checkin',
      title: comm.pipeline?.customer?.name || '未知客戶',
      description: comm.record,
      customer: comm.pipeline?.customer || undefined,
      user: comm.createdBy || undefined,
      status: undefined,
      source: undefined,
      date: comm.createdAt,
      detailUrl: comm.pipeline?.customer ? `/customers/${comm.pipeline.customer.id}` : undefined,
    })
  }

  for (const visit of visits) {
    normalized.push({
      id: `visit-${visit.id}`,
      type: 'visit',
      title: visit.customer?.name || '未知客戶',
      description: visit.notes || visit.outcome || '',
      customer: visit.customer || undefined,
      user: visit.visitedBy || undefined,
      status: visit.outcome,
      source: undefined,
      date: visit.createdAt,
      detailUrl: visit.customer ? `/customers/${visit.customer.id}` : undefined,
    })
  }

  // ── Sort by date descending ──
  normalized.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  // ── Manual pagination after sorting ──
  const total = normalized.length
  const start = (page - 1) * pageSize
  const paged = normalized.slice(start, start + pageSize)

  return NextResponse.json({
    records: paged,
    total,
    page,
    pageSize,
    totals: { leads: leadTotal, checkins: commTotal, visits: visitTotal },
  })
}
