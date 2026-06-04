import type { Session } from 'next-auth'

/**
 * Returns a Prisma `where` filter based on the user's role.
 *
 * ADMIN  → sees all (empty filter)
 * SALES_MGR → sees customers in their region
 * SALES  → sees only customers they follow
 */
export function getDataScope(session: Session | null): Record<string, unknown> {
  if (!session) return {}

  const role = session.user.role as string
  const userId = session.user.id as number

  switch (role) {
    case 'ADMIN':
      return {} // full access

    case 'SALES_MGR':
      if (session.user.region) {
        return { region: session.user.region }
      }
      return {} // no region restriction -> sees all

    case 'SALES':
    default:
      return { followerId: userId }
  }
}

/**
 * Check if the current user can access/modify a specific customer record.
 * Used in detail/update endpoints where we need to verify ownership.
 */
export function canAccessCustomer(
  session: Session | null,
  customer: { followerId?: number | null; region?: string | null } | null
): boolean {
  if (!session || !customer) return false

  const role = session.user.role as string

  if (role === 'ADMIN') return true
  if (role === 'SALES_MGR' && session.user.region && customer.region === session.user.region) return true
  if (role === 'SALES' && customer.followerId === (session.user.id as number)) return true

  return false
}

/**
 * Check if the current user can see records owned by a specific user.
 */
export function canAccessUserRecords(session: Session | null, ownerId: number): boolean {
  if (!session) return false

  const role = session.user.role as string
  const userId = session.user.id as number

  if (role === 'ADMIN') return true
  if (role === 'SALES_MGR') return true // managers can see their team's records
  return userId === ownerId
}

/**
 * Get the visible role label for display
 */
export function getRoleLabel(role: string): string {
  switch (role) {
    case 'ADMIN':
      return '管理員'
    case 'SALES_MGR':
      return '銷售主管'
    case 'SALES':
      return '銷售'
    default:
      return role
  }
}
