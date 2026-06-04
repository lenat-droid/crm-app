// ── Request validation schemas for all API endpoints ──
// Simple TypeScript validators (zod blocked by npm sandbox)

import {
  REGIONS, CUSTOMER_TYPES, CUSTOMER_TIERS, CUSTOMER_STATUSES,
  CUSTOMER_SOURCES, ONBOARDING_STATUSES, INTEREST_LEVELS,
  PIPELINE_STATUSES, CONTACT_STATUSES, LEAD_STATUSES, LEAD_SOURCES,
  PRODUCT_FIELDS,
} from '../constants'
import {
  assertString, assertOptionalString, assertInt, assertOptionalInt,
  assertDateString, assertOptionalDateString, assertBoolean,
  assertOneOf, assertOptionalOneOf, assertObject,
  ValidationError,
} from './index'

export { ValidationError }

// ── Customer ──

export function validateCreateCustomer(data: unknown) {
  const obj = assertObject(data, 'body')
  return {
    name: assertString(obj.name, 'name'),
    storePhone: assertOptionalString(obj.storePhone, 'storePhone'),
    city: assertOptionalString(obj.city, 'city'),
    region: assertOptionalOneOf(obj.region, REGIONS, 'region'),
    address: assertOptionalString(obj.address, 'address'),
    area: assertOptionalString(obj.area, 'area'),
    type: assertOptionalOneOf(obj.type, CUSTOMER_TYPES, 'type'),
    storeType: assertOptionalString(obj.storeType, 'storeType'),
    storeSize: assertOptionalString(obj.storeSize, 'storeSize'),
    notes: assertOptionalString(obj.notes, 'notes'),
    contactStatus: assertOptionalOneOf(obj.contactStatus, CONTACT_STATUSES, 'contactStatus'),
    followerId: assertOptionalInt(obj.followerId, 'followerId'),
    status: assertOptionalOneOf(obj.status, CUSTOMER_STATUSES, 'status'),
    tier: assertOptionalOneOf(obj.tier, CUSTOMER_TIERS, 'tier'),
    source: assertOptionalOneOf(obj.source, CUSTOMER_SOURCES, 'source'),
    onboardingStatus: assertOptionalOneOf(obj.onboardingStatus, ONBOARDING_STATUSES, 'onboardingStatus'),
  }
}

export function validateUpdateCustomer(data: unknown) {
  const obj = assertObject(data, 'body')
  const result: Record<string, unknown> = {}

  const fields = [
    'name', 'storePhone', 'city', 'address', 'area', 'storeType', 'storeSize', 'notes',
    'sapId', 'floorManager', 'floorManagerPhone', 'merchantContact', 'merchantContactPhone',
    'keyman', 'website', 'followerId',
  ] as const
  for (const f of fields) {
    if (f in obj) result[f] = obj[f]
  }

  if ('region' in obj) result.region = assertOptionalOneOf(obj.region, REGIONS, 'region')
  if ('type' in obj) result.type = assertOptionalOneOf(obj.type, CUSTOMER_TYPES, 'type')
  if ('contactStatus' in obj) result.contactStatus = assertOptionalOneOf(obj.contactStatus, CONTACT_STATUSES, 'contactStatus')
  if ('status' in obj) result.status = assertOneOf(obj.status, CUSTOMER_STATUSES, 'status')
  if ('tier' in obj) result.tier = assertOneOf(obj.tier, CUSTOMER_TIERS, 'tier')
  if ('source' in obj) result.source = assertOptionalOneOf(obj.source, CUSTOMER_SOURCES, 'source')
  if ('onboardingStatus' in obj) result.onboardingStatus = assertOptionalOneOf(obj.onboardingStatus, ONBOARDING_STATUSES, 'onboardingStatus')

  // Product interest fields
  for (const pf of PRODUCT_FIELDS) {
    if (pf in obj) result[pf] = assertOneOf(obj[pf], INTEREST_LEVELS, pf)
  }

  return result
}

export function validateListCustomers(params: URLSearchParams) {
  const result: Record<string, unknown> = {}
  if (params.get('search')) result.search = params.get('search')
  if (params.get('region')) result.region = params.get('region')
  if (params.get('type')) result.type = params.get('type')
  if (params.get('status')) result.status = params.get('status')
  if (params.get('tier')) result.tier = params.get('tier')
  if (params.get('followerId')) result.followerId = parseInt(params.get('followerId')!)
  if (params.get('productField')) result.productField = params.get('productField')
  if (params.get('productInterest')) result.productInterest = params.get('productInterest')
  if (params.get('productInterests')) result.productInterests = params.get('productInterests')!.split(',')
  result.page = Math.max(1, parseInt(params.get('page') || '1'))
  result.pageSize = Math.min(200, Math.max(1, parseInt(params.get('pageSize') || '20')))
  if (params.get('cursor')) result.cursor = parseInt(params.get('cursor')!)
  return result
}

// ── Pipeline ──

export function validateCreatePipeline(data: unknown) {
  const obj = assertObject(data, 'body')
  return {
    customerId: assertInt(obj.customerId, 'customerId'),
    contactDate: obj.contactDate ? assertDateString(obj.contactDate, 'contactDate') : undefined,
    record: assertOptionalString(obj.record, 'record'),
    status: assertOptionalOneOf(obj.status, PIPELINE_STATUSES, 'status'),
  }
}

export function validateUpdatePipeline(data: unknown) {
  const obj = assertObject(data, 'body')
  const result: Record<string, unknown> = {
    id: assertInt(obj.id, 'id'),
  }

  if ('status' in obj) {
    result.status = assertOneOf(obj.status, PIPELINE_STATUSES, 'status')
  }

  // Pipeline close/archive support
  if ('active' in obj) {
    result.active = assertBoolean(obj.active, 'active')
    if (result.active === false && !('closedAt' in obj)) {
      result.closedAt = new Date().toISOString()
    }
  }

  // Support explicit closeReason override (LOST for '不再合作')
  if ('closeReason' in obj) {
    result.closeReason = assertOneOf(obj.closeReason, ['WON', 'LOST'] as const, 'closeReason')
  }

  return result as { id: number; status?: string; active?: boolean; closedAt?: string; closeReason?: string }
}

// ── Lead ──

export function validateCreateLead(data: unknown) {
  const obj = assertObject(data, 'body')
  return {
    name: assertString(obj.name, 'name'),
    phone: assertOptionalString(obj.phone, 'phone'),
    contactPerson: assertOptionalString(obj.contactPerson, 'contactPerson'),
    foodType: assertOptionalString(obj.foodType, 'foodType'),
    posBrand: assertOptionalString(obj.posBrand, 'posBrand'),
    needs: assertOptionalString(obj.needs, 'needs'),
    notes: assertOptionalString(obj.notes, 'notes'),
    source: assertOptionalOneOf(obj.source, LEAD_SOURCES, 'source'),
    score: assertOptionalInt(obj.score, 'score'),
    visitDate: assertOptionalDateString(obj.visitDate, 'visitDate'),
  }
}

export function validateUpdateLead(data: unknown) {
  const obj = assertObject(data, 'body')
  const id = assertInt(obj.id, 'id')
  const action = obj.action === 'convert' ? 'convert' : undefined

  if (action === 'convert') {
    return { id, action: 'convert' as const }
  }

  const result: Record<string, unknown> = { id }
  const fields = ['name', 'phone', 'contactPerson', 'foodType', 'posBrand', 'needs', 'notes'] as const
  for (const f of fields) {
    if (f in obj) result[f] = obj[f]
  }
  if ('status' in obj) result.status = assertOneOf(obj.status, LEAD_STATUSES, 'status')
  if ('source' in obj) result.source = assertOptionalOneOf(obj.source, LEAD_SOURCES, 'source')
  if ('score' in obj) result.score = assertOptionalInt(obj.score, 'score')

  return result
}

// ── Visit ──

export function validateCreateVisit(data: unknown) {
  const obj = assertObject(data, 'body')
  return {
    customerId: assertInt(obj.customerId, 'customerId'),
    visitDate: assertDateString(obj.visitDate, 'visitDate'),
    outcome: assertOptionalString(obj.outcome, 'outcome'),
    notes: assertOptionalString(obj.notes, 'notes'),
  }
}

// ── User (admin) ──

export function validateCreateUser(data: unknown) {
  const obj = assertObject(data, 'body')
  return {
    email: assertString(obj.email, 'email'),
    name: assertString(obj.name, 'name'),
    password: assertString(obj.password, 'password'),
    role: assertOptionalOneOf(obj.role, ['ADMIN', 'SALES_MGR', 'SALES'] as const, 'role'),
    region: assertOptionalOneOf(obj.region, REGIONS, 'region'),
    phone: assertOptionalString(obj.phone, 'phone'),
  }
}

export function validateUpdateUser(data: unknown) {
  const obj = assertObject(data, 'body')
  const result: Record<string, unknown> = {
    id: assertInt(obj.id, 'id'),
  }
  if ('email' in obj) result.email = assertString(obj.email, 'email')
  if ('name' in obj) result.name = assertString(obj.name, 'name')
  if ('role' in obj) result.role = assertOneOf(obj.role, ['ADMIN', 'SALES_MGR', 'SALES'] as const, 'role')
  if ('region' in obj) result.region = assertOptionalOneOf(obj.region, REGIONS, 'region')
  if ('phone' in obj) result.phone = assertOptionalString(obj.phone, 'phone')
  if ('active' in obj) result.active = assertBoolean(obj.active, 'active')
  if ('password' in obj) result.password = assertString(obj.password, 'password')
  return result
}
