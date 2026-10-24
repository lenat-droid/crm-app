import { createHash, timingSafeEqual } from 'crypto'
import type { Session } from 'next-auth'
import type { Prisma } from '@prisma/client'
import { prisma } from './prisma'
import { ValidationError } from './validation/schemas'

export function ingestAuthorized(header: string | null) {
  const token = process.env.CRM_INGEST_TOKEN
  if (!token || token.length < 32) return false
  const digest = (s: string) => createHash('sha256').update(s).digest()
  return timingSafeEqual(digest(header || ''), digest(`Bearer ${token}`))
}

// Historical lead scopes stay intact. AIM leads additionally require a current,
// active operator with the configured region/ownership. Unassigned intake is admin-only.
export async function leadScope(session: Session, legacy: Prisma.LeadWhereInput = {}): Promise<Prisma.LeadWhereInput> {
  const user = await prisma.user.findUnique({ where: { id: session.user.id } })
  let aim: Prisma.LeadWhereInput = { id: -1 }
  if (user?.active) {
    if (user.role === 'ADMIN') aim = {}
    else if (user.role === 'SALES_MGR' && user.region) aim = { region: user.region }
    else if (user.role === 'SALES') aim = { registeredById: user.id }
  }
  return { OR: [{ AND: [{ aimApplicationId: null }, legacy] }, { AND: [{ aimApplicationId: { not: null } }, aim] }] }
}

export function validateAimLead(data: unknown) {
  const b = data as Record<string, any>
  if (!b || typeof b !== 'object' || Array.isArray(b)) throw new ValidationError('Invalid intake')
  const string = (value: unknown, max: number) => {
    if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u001f\u007f]/.test(value)) throw new ValidationError('Invalid intake field')
    return value.trim()
  }
  const optional = (v: unknown, max: number) => v == null ? null : string(v, max)
  const applicationId = string(b.application_id, 80)
  if (!/^[a-zA-Z0-9_-]{8,80}$/.test(applicationId)) throw new ValidationError('Invalid application ID')
  const email = string(b.email, 254).toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ValidationError('Invalid email')
  const submittedAt = string(b.submitted_at, 40)
  if (!Number.isFinite(Date.parse(submittedAt)) || Date.parse(submittedAt) > Date.now() + 300000) throw new ValidationError('Invalid submitted time')
  if (b.source !== 'AIM Website' || b.consent?.contact !== true) throw new ValidationError('Source and consent required')
  const consent = { contact: true, version: string(b.consent.version, 80), statement: string(b.consent.statement, 500), accepted_at: string(b.consent.accepted_at, 40) }
  if (!Number.isFinite(Date.parse(consent.accepted_at))) throw new ValidationError('Invalid consent time')
  return { aimApplicationId: applicationId, name: string(b.restaurant, 160), email, contactPerson: string(b.name, 80), placeId: optional(b.place_id, 255), reportId: optional(b.report_id, 80), source: 'AIM Website', consent, submittedAt: new Date(submittedAt) }
}

export async function ingestAimLead(data: ReturnType<typeof validateAimLead>) {
  const existing = () => prisma.lead.findUnique({ where: { aimApplicationId: data.aimApplicationId } })
  const response = (lead: NonNullable<Awaited<ReturnType<typeof existing>>>, duplicate: boolean) => {
    // Idempotency keys cannot be reused to silently replace contact/consent data.
    for (const key of ['name', 'email', 'contactPerson', 'placeId', 'reportId', 'source'] as const) {
      if (lead[key] !== data[key]) throw new ValidationError('Application ID conflict')
    }
    if (lead.submittedAt?.toISOString() !== data.submittedAt.toISOString() || JSON.stringify(lead.consent) !== JSON.stringify(data.consent)) {
      // PostgreSQL JSONB reorders keys; compare values rather than serialization.
      const c = lead.consent as any
      if (lead.submittedAt?.toISOString() !== data.submittedAt.toISOString() || Object.entries(data.consent).some(([k, v]) => c?.[k] !== v)) throw new ValidationError('Application ID conflict')
    }
    return { ok: true, application_id: data.aimApplicationId, crm_id: lead.id, duplicate }
  }
  const old = await existing()
  if (old) return response(old, true)
  const ownerId = Number(process.env.AIM_LEAD_OWNER_ID) || null
  if (ownerId && !await prisma.user.findFirst({ where: { id: ownerId, active: true } })) throw new Error('invalid_intake_owner')
  try {
    const lead = await prisma.lead.create({ data: { ...data, status: 'new', registeredById: ownerId, region: process.env.AIM_LEAD_REGION || null, notification: { create: {} } } })
    return response(lead, false)
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') { const lead = await existing(); if (lead) return response(lead, true) }
    throw error
  }
}

export function validateAimFollowup(data: any) {
  if (!data || typeof data !== 'object' || Object.keys(data).some(k => !['id', 'status', 'notes'].includes(k))) throw new ValidationError('Unsupported update')
  const result: { status?: string; notes?: string } = {}
  if ('status' in data) {
    if (!['new', 'contacted', 'closed'].includes(data.status)) throw new ValidationError('Use the existing customer conversion workflow for a sale')
    result.status = data.status
  }
  if ('notes' in data) {
    if (typeof data.notes !== 'string' || data.notes.length > 5000) throw new ValidationError('Invalid notes')
    result.notes = data.notes
  }
  if (!Object.keys(result).length) throw new ValidationError('Empty update')
  return result
}
