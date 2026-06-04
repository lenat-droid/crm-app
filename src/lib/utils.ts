
// Re-export constants for backward compatibility
export {
  REGIONS, CUSTOMER_TYPES, CUSTOMER_TIERS, CUSTOMER_STATUSES,
  CUSTOMER_SOURCES, ONBOARDING_STATUSES, INTEREST_LEVELS,
  PIPELINE_STATUSES, CONTACT_STATUSES, LEAD_STATUSES, LEAD_SOURCES,
  USER_ROLES, PRODUCT_FIELDS,
} from './constants'

export const productLabels: Record<string, string> = {
  posStatus: 'POS',
  psWebsiteStatus: 'PS官網',
  smtStatus: 'SMT',
  platformManagedStatus: '平台托管',
  aiCamStatus: 'AI Cam',
  omeStatus: 'OME',
  smartRobotStatus: '智能機器人',
}

export const productFields = Object.keys(productLabels)

export const interestLabels: Record<string, string> = {
  NOT_CONTACTED: '未接觸',
  NOT_INTERESTED: '無興趣',
  AWARE: '已了解',
  INTERESTED: '感興趣',
  HIGH_INTENT: '高意向',
  PURCHASED: '已購買',
}

export const interestColors: Record<string, string> = {
  NOT_CONTACTED: '#d9d9d9',
  NOT_INTERESTED: '#ff4d4f',
  AWARE: '#faad14',
  INTERESTED: '#1890ff',
  HIGH_INTENT: '#722ed1',
  PURCHASED: '#52c41a',
}

export const pipelineStatuses = [
  { value: '⚠️', label: '待跟进', color: '#faad14' },
  { value: '已建联', label: '已建联', color: '#1890ff' },
  { value: '初步有意向', label: '初步有意向', color: '#722ed1' },
  { value: '合作中', label: '合作中', color: '#52c41a' },
]

export function getProductFieldName(productKey: string): string {
  return productLabels[productKey] || productKey
}

// Convert old Excel checkmarks to ProductInterest
export function excelCheckToInterest(val: string | null | undefined): string {
  if (!val || val.trim() === '') return 'NOT_CONTACTED'
  const cleaned = val.trim()
  if (cleaned === '✅' || cleaned === 'TRUE' || cleaned === 'true' || cleaned === '1') {
    return 'PURCHASED'
  }
  if (cleaned === '□' || cleaned === 'FALSE' || cleaned === 'false' || cleaned === '0') {
    return 'NOT_CONTACTED'
  }
  // If there's text, might indicate interest
  if (cleaned.includes('意向') || cleaned.includes('兴趣')) {
    return 'INTERESTED'
  }
  return 'NOT_CONTACTED'
}
