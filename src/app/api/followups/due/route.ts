import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getDataScope } from '@/lib/auth-helpers'
import { isAgentRequest } from '@/lib/agent-auth'
import { computeDueFollowups, FollowupScope } from '@/lib/followups'

/**
 * GET /api/followups/due — 今日到期 + 超时未跟清单，按负责人分组。
 *
 * Auth:
 *  - 登录用户：按自身 RBAC 范围（SALES 看自己，SALES_MGR 看本区域，ADMIN 看全部）
 *  - Agent token (x-agent-token)：全量，可用 ?ownerId= / ?region= 过滤
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  let scope: FollowupScope | undefined

  if (isAgentRequest(req)) {
    const ownerId = searchParams.get('ownerId')
    const region = searchParams.get('region')
    scope = {}
    if (ownerId) scope.followerId = parseInt(ownerId)
    else if (region) scope.region = region
  } else {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const dataScope = getDataScope(session)
    scope = {
      followerId: dataScope.followerId as number | undefined,
      region: dataScope.region as string | undefined,
    }
  }

  const result = await computeDueFollowups(scope)
  return NextResponse.json(result)
}
