import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import dayjs from 'dayjs'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canAccessCustomer } from '@/lib/auth-helpers'
import { isAgentRequest } from '@/lib/agent-auth'

const PRODUCT_FIELDS: Array<{ key: string; name: string }> = [
  { key: 'posStatus', name: 'POS' },
  { key: 'psWebsiteStatus', name: 'PS Website' },
  { key: 'smtStatus', name: 'SMT' },
  { key: 'platformManagedStatus', name: 'Platform Managed' },
  { key: 'aiCamStatus', name: 'AI Cam' },
  { key: 'omeStatus', name: 'OME' },
  { key: 'smartRobotStatus', name: 'Smart Robot' },
]

/**
 * GET /api/customers/[id]/context — 客户上下文一次打包（给云端 Agent 生成话术用）。
 *
 * 返回结构化 JSON：画像 + 阶段/跟进状态 + 产品意向 + 活跃订阅 + 最近 5 条跟进记录 + 健康度。
 * Auth: 登录用户（按 RBAC）或 Agent token。
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const id = parseInt(params.id)
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const isAgent = isAgentRequest(req)
  let session = null
  if (!isAgent) {
    session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      follower: { select: { id: true, name: true } },
      pipeline: {
        include: {
          communications: { orderBy: { contactDate: 'desc' }, take: 5 },
        },
      },
      visits: { orderBy: { visitDate: 'desc' }, take: 5, include: { visitedBy: { select: { name: true } } } },
      subscriptions: {
        where: { status: { in: ['ACTIVE', 'TRIALING'] } },
        include: { product: { select: { name: true } } },
      },
      healthScoreObj: true,
      supportTickets: { where: { status: { notIn: ['RESOLVED', 'CLOSED'] } }, select: { id: true, subject: true, priority: true } },
    },
  })

  if (!customer) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!isAgent && !canAccessCustomer(session, customer)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // 合并沟通 + 拜访为统一时间线，取最近 5 条
  const recentRecords = [
    ...(customer.pipeline?.communications || []).map(c => ({
      type: 'communication' as const,
      date: dayjs(c.contactDate).format('YYYY-MM-DD'),
      content: c.record,
      source: c.source,
    })),
    ...customer.visits.map(v => ({
      type: 'visit' as const,
      date: dayjs(v.visitDate).format('YYYY-MM-DD'),
      content: [v.outcome, v.notes].filter(Boolean).join(' — '),
      source: 'manual',
    })),
  ]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5)

  return NextResponse.json({
    customer: {
      id: customer.id,
      name: customer.name,
      city: customer.city,
      region: customer.region,
      type: customer.type,
      storeType: customer.storeType,
      contactStatus: customer.contactStatus,
      owner: customer.follower ? { id: customer.follower.id, name: customer.follower.name } : null,
    },
    pipeline: customer.pipeline
      ? {
          id: customer.pipeline.id,
          status: customer.pipeline.status,
          active: customer.pipeline.active,
          lastContactDate: customer.pipeline.lastContactDate
            ? dayjs(customer.pipeline.lastContactDate).format('YYYY-MM-DD')
            : null,
          nextFollowUpAt: customer.pipeline.nextFollowUpAt
            ? dayjs(customer.pipeline.nextFollowUpAt).format('YYYY-MM-DD')
            : null,
          nextAction: customer.pipeline.nextAction,
        }
      : null,
    productInterests: PRODUCT_FIELDS.map(p => ({
      product: p.name,
      level: (customer as any)[p.key],
    })),
    activeSubscriptions: customer.subscriptions.map(s => ({
      product: s.product?.name,
      plan: s.plan,
      mrr: s.mrr,
      status: s.status,
      startDate: dayjs(s.startDate).format('YYYY-MM-DD'),
    })),
    health: customer.healthScoreObj
      ? {
          overallScore: customer.healthScoreObj.overallScore,
          churnRisk: customer.healthScoreObj.churnRisk,
        }
      : null,
    openTickets: customer.supportTickets,
    recentRecords,
  })
}
