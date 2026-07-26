import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { buildExportRows, convertToCSV } from '@/lib/export-csv'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role === 'SALES') {
    return NextResponse.json({ error: 'Forbidden: only admins and managers can export data' }, { status: 403 })
  }

  const id = parseInt(params.id)
  const exportJob = await prisma.exportJob.findUnique({ where: { id } })
  if (!exportJob) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Only admin or the requester can download
  if (session.user.role !== 'ADMIN' && exportJob.requestedById !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (exportJob.status !== 'COMPLETED') {
    return NextResponse.json({ error: 'Export is not completed' }, { status: 400 })
  }

  // Regenerate the CSV on demand (reflects current data), scoped to the
  // downloader's own RBAC — a manager re-downloading still only gets their region
  let filters: any = null
  try {
    filters = exportJob.filters ? JSON.parse(exportJob.filters) : null
  } catch {
    filters = null
  }
  const rows = await buildExportRows(exportJob.type, filters, session)

  // UTF-8 BOM so Excel opens Chinese text correctly
  const csv = '\uFEFF' + convertToCSV(rows)
  const filename = `${exportJob.type.toLowerCase()}_${exportJob.id}.csv`

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
