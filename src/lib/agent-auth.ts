import type { NextRequest } from 'next/server'

/**
 * Token auth for machine callers (cloud Agent / cron), separate from NextAuth.
 *
 * - AGENT_API_TOKEN: for the cloud agent. Grants read of followups/context and
 *   append-only followup writes. It can NOT change pipeline stage, close deals,
 *   delete data, or touch money fields — those routes never accept this token.
 * - CRON_SECRET: for the scheduled daily-digest trigger only.
 *
 * Both are optional env vars; when unset, the corresponding access is disabled.
 */
export function isAgentRequest(req: NextRequest): boolean {
  const token = req.headers.get('x-agent-token')
  const expected = process.env.AGENT_API_TOKEN
  return Boolean(token && expected && token === expected)
}

export function isCronRequest(req: NextRequest): boolean {
  const secret =
    req.headers.get('x-cron-secret') || new URL(req.url).searchParams.get('secret')
  const expected = process.env.CRON_SECRET
  return Boolean(secret && expected && secret === expected)
}
