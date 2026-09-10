/**
 * Integration API — Auth helper
 *
 * All integration endpoints start here. They accept:
 *   1. A logged-in session (via NextAuth cookie) — current RBAC scope applies
 *   2. An `x-api-token` header (admin read-only token) — full data access
 *
 * Future: toggle between session-scope and full-access based on which auth was used.
 * The `scope` flag on the returned context lets downstream queries know whether
 * to apply data scoping or return everything.
 */

import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export interface IntegrationContext {
  userId: number | null
  role: string | null
  region: string | null
  /** `true` when authenticated via x-api-token — bypasses RBAC scoping */
  isAdmin: boolean
  /** raw userId from session, for downstream scoping logic */
  sessionId: number | null
}

/**
 * Parse authentication from request — supports both session and API token.
 *
 * x-api-token header value is compared against INTEGRATION_API_TOKEN env var.
 * Token users get full admin read access (no RBAC filtering).
 */
export async function parseIntegrationAuth(req: NextRequest): Promise<IntegrationContext> {
  // 1. Check x-api-token header first
  const apiToken = req.headers.get('x-api-token')
  const envToken = process.env.INTEGRATION_API_TOKEN
  if (apiToken && envToken && apiToken === envToken) {
    return { userId: 0, role: 'ADMIN', region: null, isAdmin: true, sessionId: null }
  }

  // 2. Fall back to NextAuth session
  const session = await getServerSession(authOptions)
  if (!session) {
    return { userId: null, role: null, region: null, isAdmin: false, sessionId: null }
  }

  return {
    userId: session.user.id,
    role: session.user.role,
    region: session.user.region ?? null,
    isAdmin: session.user.role === 'ADMIN',
    sessionId: session.user.id,
  }
}

/**
 * Check if the request has any form of authentication.
 */
export function isAuthenticated(ctx: IntegrationContext): boolean {
  return ctx.userId !== null
}

/**
 * Return a Prisma `where` filter based on the integration context.
 *
 * When authenticated via API token (isAdmin=true), returns empty filter = full access.
 * When authenticated via session, applies the same RBAC scoping as the rest of the app.
 */
export function getIntegrationScope(ctx: IntegrationContext): Record<string, unknown> {
  // API token = full access, no scoping
  if (ctx.isAdmin) return {}

  // Unauthenticated = empty (will fail isAuth check before reaching downstream)
  if (!ctx.userId) return {}

  // Admin = full access
  if (ctx.role === 'ADMIN') return {}

  // SALES_MGR = their region
  if (ctx.role === 'SALES_MGR' && ctx.region) {
    return { region: ctx.region }
  }

  // SALES = their own customers
  return { followerId: ctx.userId }
}
