import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const EXPORT_TYPES = ['CUSTOMERS', 'SUBSCRIPTIONS', 'TICKETS', 'LEADS'] as const

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const pageSize = Math.min(200, Math.max(1, parseInt(searchParams.get('pageSize') || '20')))

  const where: any = {}
  // Users can see their own export jobs; admins see all
  if (session.user.role !== 'ADMIN') {
    where.requestedById = session.user.id
  }

  const [exports, total] = await Promise.all([
    prisma.exportJob.findMany({
      where,
      include: { requestedBy: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.exportJob.count({ where }),
  ])

  return NextResponse.json({ exports, total, page, pageSize })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role === 'SALES') {
    return NextResponse.json({ error: 'Forbidden: only admins and managers can export data' }, { status: 403 })
  }

  const data = await req.json()
  const type = data.type as string

  if (!EXPORT_TYPES.includes(type as any)) {
    return NextResponse.json({ error: `Invalid export type. Must be one of: ${EXPORT_TYPES.join(', ')}` }, { status: 400 })
  }

  // Create export job record
  const exportJob = await prisma.exportJob.create({
    data: {
      type,
      status: 'PROCESSING',
      filters: data.filters ? JSON.stringify(data.filters) : null,
      requestedById: session.user.id,
    },
  })

  try {
    // Build query based on type
    let rows: any[] = []
    if (type === 'CUSTOMERS') {
      rows = await prisma.customer.findMany({
        where: data.filters ? buildCustomerFilter(data.filters) : {},
        include: { follower: { select: { name: true } } },
      })
    } else if (type === 'SUBSCRIPTIONS') {
      rows = await prisma.subscription.findMany({
        include: { customer: { select: { name: true } }, product: { select: { name: true } } },
      })
    } else if (type === 'TICKETS') {
      rows = await prisma.supportTicket.findMany({
        include: { customer: { select: { name: true } }, assignedTo: { select: { name: true } } },
      })
    } else if (type === 'LEADS') {
      rows = await prisma.lead.findMany({
        include: { registeredBy: { select: { name: true } } },
      })
    }

    // Convert to CSV
    const csv = convertToCSV(rows)
    const buffer = Buffer.from(csv, 'utf-8')

    // Update job with results
    await prisma.exportJob.update({
      where: { id: exportJob.id },
      data: {
        status: 'COMPLETED',
        rowCount: rows.length,
        fileSize: buffer.length,
        completedAt: new Date(),
      },
    })

    return NextResponse.json({
      id: exportJob.id,
      status: 'COMPLETED',
      rowCount: rows.length,
      fileSize: buffer.length,
    })
  } catch (err: any) {
    await prisma.exportJob.update({
      where: { id: exportJob.id },
      data: { status: 'FAILED', error: err.message },
    })
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

function buildCustomerFilter(filters: any) {
  const where: any = {}
  if (filters.region) where.region = filters.region
  if (filters.type) where.type = filters.type
  if (filters.tier) where.tier = filters.tier
  if (filters.status) where.status = filters.status
  return where
}

function convertToCSV(rows: any[]): string {
  if (rows.length === 0) return 'No data'

  // Extract headers from first row
  const headers = extractHeaders(rows[0])
  const lines = [headers.join(',')]

  for (const row of rows) {
    const values = headers.map(h => {
      const val = getNestedValue(row, h)
      if (val === null || val === undefined) return ''
      const str = String(val)
      // Escape quotes and wrap in quotes if contains comma or quote
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    })
    lines.push(values.join(','))
  }

  return lines.join('\n')
}

function extractHeaders(obj: any): string[] {
  const headers: string[] = []
  for (const key of Object.keys(obj)) {
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      // Nested object: flatten with dot notation
      const nested = extractHeaders(obj[key])
      for (const n of nested) {
        headers.push(`${key}.${n}`)
      }
    } else {
      headers.push(key)
    }
  }
  return headers
}

function getNestedValue(obj: any, path: string): any {
  const parts = path.split('.')
  let current = obj
  for (const part of parts) {
    if (current === null || current === undefined) return undefined
    current = current[part]
  }
  return current
}
