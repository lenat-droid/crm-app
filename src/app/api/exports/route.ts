import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { EXPORT_TYPES, buildExportRows, convertToCSV } from '@/lib/export-csv'

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
    // Fetch rows with RBAC scope applied (SALES_MGR limited to own region)
    const rows = await buildExportRows(type, data.filters, session)

    const csv = convertToCSV(rows)
    const buffer = Buffer.from(csv, 'utf-8')

    // Update job with results; the file itself is regenerated on demand
    // by GET /api/exports/[id]/download
    await prisma.exportJob.update({
      where: { id: exportJob.id },
      data: {
        status: 'COMPLETED',
        rowCount: rows.length,
        fileSize: buffer.length,
        fileUrl: `/api/exports/${exportJob.id}/download`,
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

