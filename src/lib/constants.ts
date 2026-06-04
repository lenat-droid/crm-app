// ── Shared constants for the CRM ──

export const REGIONS = [
  'LA EAST',
  'LA DOWNTOWN',
  'LA WEST',
  'ORANGE COUNTY',
  'WESTERN INLAND EMPIRE',
  'SOUTH BAY',
  'OUT OF CALIFORNIA',
] as const

export const CUSTOMER_TYPES = [
  '茶餐廳',
  '正餐',
  '酒樓',
  '火鍋',
  '快餐',
  '其他',
] as const

export const CUSTOMER_TIERS = ['ENTERPRISE', 'MID_MARKET', 'SMB'] as const
export const CUSTOMER_STATUSES = ['ACTIVE', 'INACTIVE', 'ARCHIVED'] as const
export const CUSTOMER_SOURCES = ['IMPORT', 'LEAD_CONVERSION', 'MANUAL', 'API', 'PARTNER'] as const
export const ONBOARDING_STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'] as const

export const INTEREST_LEVELS = [
  'NOT_CONTACTED',
  'NOT_INTERESTED',
  'AWARE',
  'INTERESTED',
  'HIGH_INTENT',
  'PURCHASED',
] as const

export const PIPELINE_STATUSES = ['⚠️', '已建联', '初步有意向', '合作中'] as const
export const CONTACT_STATUSES = ['合作中', '已建联', '已流失'] as const
export const LEAD_STATUSES = ['new', 'contacted', 'converted', 'closed'] as const
export const LEAD_SOURCES = ['WEBSITE', 'REFERRAL', 'COLD_CALL', 'EVENT', 'PARTNER', 'OTHER'] as const

export const USER_ROLES = ['ADMIN', 'SALES_MGR', 'SALES'] as const

export const PRODUCT_FIELDS = [
  'posStatus',
  'psWebsiteStatus',
  'smtStatus',
  'platformManagedStatus',
  'aiCamStatus',
  'omeStatus',
  'smartRobotStatus',
] as const
