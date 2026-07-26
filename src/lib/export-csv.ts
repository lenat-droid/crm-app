import type { Session } from 'next-auth'
import { prisma } from './prisma'

export const EXPORT_TYPES = ['CUSTOMERS', 'SUBSCRIPTIONS', 'TICKETS', 'LEADS'] as const

/**
 * Fetch rows for an export, applying RBAC scope:
 * ADMIN sees all; SALES_MGR is limited to their region (no region -> all).
 * SALES cannot reach the export endpoints at all.
 */
export async function buildExportRows(type: string, filters: any, session: Session): Promise<any[]> {
  const region =
    session.user.role === 'SALES_MGR' && session.user.region ? session.user.region : null

  if (type === 'CUSTOMERS') {
    const where = buildCustomerFilter(filters || {})
    if (region) where.region = region
    return prisma.customer.findMany({
      where,
      include: { follower: { select: { name: true } } },
    })
  }
  if (type === 'SUBSCRIPTIONS') {
    return prisma.subscription.findMany({
      where: region ? { customer: { region } } : {},
      include: { customer: { select: { name: true } }, product: { select: { name: true } } },
    })
  }
  if (type === 'TICKETS') {
    return prisma.supportTicket.findMany({
      where: region ? { customer: { region } } : {},
      include: { customer: { select: { name: true } }, assignedTo: { select: { name: true } } },
    })
  }
  if (type === 'LEADS') {
    return prisma.lead.findMany({
      where: region ? { registeredBy: { region } } : {},
      include: { registeredBy: { select: { name: true } } },
    })
  }
  return []
}

function buildCustomerFilter(filters: any) {
  const where: any = {}
  if (filters.region) where.region = filters.region
  if (filters.type) where.type = filters.type
  if (filters.tier) where.tier = filters.tier
  if (filters.status) where.status = filters.status
  return where
}

export function convertToCSV(rows: any[]): string {
  if (rows.length === 0) return 'No data'

  const headers = extractHeaders(rows[0])
  const lines = [headers.join(',')]

  for (const row of rows) {
    const values = headers.map(h => {
      const val = getNestedValue(row, h)
      if (val === null || val === undefined) return ''
      const str = val instanceof Date ? val.toISOString() : String(val)
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
    if (
      typeof obj[key] === 'object' &&
      obj[key] !== null &&
      !Array.isArray(obj[key]) &&
      !(obj[key] instanceof Date)
    ) {
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
