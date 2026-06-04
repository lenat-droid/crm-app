// ── Customer Health Score Calculation ──
// Scores are 0-100 across multiple dimensions

interface HealthInput {
  daysSinceLastActivity: number | null       // days since customer last activity
  productCount: number                        // # products with INTERESTED+ or PURCHASED
  totalProducts: number                       // total # of products in catalog
  openTicketCount: number                     // # open / pending tickets
  resolvedTicketCount: number                 // # resolved tickets in last 90 days
  avgCsatScore: number | null                 // average CSAT (1-5)
  hasActiveSubscription: boolean              // whether customer has active subscription
  subscriptionExpiringDays: number | null     // days until subscription expires (null if no sub)
  daysSinceFirstPurchase: number | null       // days since first purchase
}

export interface HealthResult {
  overallScore: number
  engagementScore: number
  productAdoptionScore: number
  supportHealthScore: number
  subscriptionHealth: number
  churnRisk: 'LOW' | 'MEDIUM' | 'HIGH'
  calculatedAt: Date
}

/**
 * Calculate customer health score based on multiple dimensions.
 * Each dimension is 0-100, weighted to produce overallScore.
 */
export function calculateHealthScore(input: HealthInput): HealthResult {
  const engagementScore = calculateEngagement(input)
  const productAdoptionScore = calculateProductAdoption(input)
  const supportHealthScore = calculateSupportHealth(input)
  const subscriptionHealth = calculateSubscriptionHealth(input)

  // Weights: engagement 30%, product adoption 25%, support health 25%, subscription 20%
  const overallScore = Math.round(
    engagementScore * 0.30 +
    productAdoptionScore * 0.25 +
    supportHealthScore * 0.25 +
    subscriptionHealth * 0.20
  )

  // Churn risk based on overall + specific red flags
  const churnRisk = determineChurnRisk(overallScore, input)

  return {
    overallScore,
    engagementScore,
    productAdoptionScore,
    supportHealthScore,
    subscriptionHealth,
    churnRisk,
    calculatedAt: new Date(),
  }
}

function calculateEngagement(input: HealthInput): number {
  const { daysSinceLastActivity } = input
  if (daysSinceLastActivity === null) return 50  // unknown → middle
  if (daysSinceLastActivity <= 7) return 100
  if (daysSinceLastActivity <= 30) return 80
  if (daysSinceLastActivity <= 60) return 60
  if (daysSinceLastActivity <= 90) return 40
  if (daysSinceLastActivity <= 180) return 20
  return 0
}

function calculateProductAdoption(input: HealthInput): number {
  const { productCount, totalProducts } = input
  if (totalProducts === 0) return 50
  const ratio = productCount / totalProducts
  if (ratio >= 0.8) return 100
  if (ratio >= 0.6) return 80
  if (ratio >= 0.4) return 60
  if (ratio >= 0.2) return 40
  if (ratio >= 0.1) return 20
  return 0
}

function calculateSupportHealth(input: HealthInput): number {
  const { openTicketCount, resolvedTicketCount, avgCsatScore } = input

  // Open ticket penalty
  let score = 100
  score -= openTicketCount * 15  // -15 per open ticket
  if (openTicketCount >= 3) score -= 20  // additional penalty for many open tickets

  // Resolution bonus (resolved tickets in last 90 days)
  if (resolvedTicketCount > 0) {
    score += Math.min(resolvedTicketCount * 5, 15)
  }

  // CSAT adjustment
  if (avgCsatScore !== null) {
    if (avgCsatScore >= 4.5) score += 10
    else if (avgCsatScore >= 4.0) score += 5
    else if (avgCsatScore <= 2.0) score -= 30
    else if (avgCsatScore <= 3.0) score -= 15
  }

  return Math.max(0, Math.min(100, score))
}

function calculateSubscriptionHealth(input: HealthInput): number {
  const { hasActiveSubscription, subscriptionExpiringDays, daysSinceFirstPurchase } = input

  if (!hasActiveSubscription) {
    // No subscription: neutral if new, bad if established
    if (daysSinceFirstPurchase === null || daysSinceFirstPurchase < 90) return 40
    return 20
  }

  let score = 80  // base for having active subscription

  // Expiring soon penalty
  if (subscriptionExpiringDays !== null) {
    if (subscriptionExpiringDays <= 7) score -= 40
    else if (subscriptionExpiringDays <= 14) score -= 25
    else if (subscriptionExpiringDays <= 30) score -= 10
  }

  // Established customer bonus
  if (daysSinceFirstPurchase !== null) {
    if (daysSinceFirstPurchase >= 365) score += 20
    else if (daysSinceFirstPurchase >= 180) score += 10
  }

  return Math.max(0, Math.min(100, score))
}

function determineChurnRisk(overallScore: number, input: HealthInput): 'LOW' | 'MEDIUM' | 'HIGH' {
  // Hard triggers for HIGH risk
  if (input.openTicketCount >= 5) return 'HIGH'
  if (input.hasActiveSubscription && input.subscriptionExpiringDays !== null && input.subscriptionExpiringDays <= 7) return 'HIGH'
  if (input.daysSinceLastActivity !== null && input.daysSinceLastActivity > 180) return 'HIGH'

  // Score-based risk
  if (overallScore >= 70) return 'LOW'
  if (overallScore >= 40) return 'MEDIUM'
  return 'HIGH'
}
