import dayjs from 'dayjs'
import { prisma } from './prisma'

/**
 * Deterministic follow-up rules engine (规则层).
 *
 * 5 rules over active pipelines — plain queries + date math, no AI involved:
 *   1. NEW_LEAD_STALE   新客户建立超 N 小时无任何沟通记录
 *   2. INTENT_NO_REPLY  初步有意向、超 N 天未联系
 *   3. DUE              nextFollowUpAt 已到期（今天或已超期）
 *   4. SILENT           非合作中客户静默超 N 天
 *   5. WON_CHECKIN      合作中客户超 N 天未回访
 *
 * Thresholds are env-configurable so they can be tuned without a deploy.
 */

const THRESHOLDS = {
  newLeadHours: intEnv('FOLLOWUP_NEW_LEAD_HOURS', 24),
  intentDays: intEnv('FOLLOWUP_INTENT_DAYS', 3),
  silentDays: intEnv('FOLLOWUP_SILENT_DAYS', 30),
  wonCheckinDays: intEnv('FOLLOWUP_WON_CHECKIN_DAYS', 30),
}

function intEnv(name: string, fallback: number): number {
  const v = parseInt(process.env[name] || '')
  return Number.isFinite(v) && v > 0 ? v : fallback
}

export const RULE_LABELS: Record<string, string> = {
  NEW_LEAD_STALE: '新客戶未首聯',
  INTENT_NO_REPLY: '有意向無回音',
  DUE: '今日/超期跟進',
  SILENT: '長期靜默',
  WON_CHECKIN: '成交客戶回訪',
}

export interface FollowupItem {
  pipelineId: number
  customerId: number
  customerName: string
  status: string
  ownerId: number | null
  ownerName: string
  rules: string[]
  lastContactDate: string | null
  daysSinceContact: number | null
  nextFollowUpAt: string | null
  nextAction: string | null
  overdueDays: number
}

export interface FollowupScope {
  followerId?: number
  region?: string
}

export async function computeDueFollowups(scope?: FollowupScope) {
  const now = dayjs()
  const endOfToday = now.endOf('day')

  const pipelineWhere: any = { active: true }
  if (scope?.followerId) {
    pipelineWhere.OR = [
      { salesPersonId: scope.followerId },
      { salesPersonId: null, customer: { followerId: scope.followerId } },
    ]
  } else if (scope?.region) {
    pipelineWhere.customer = { region: scope.region }
  }

  const pipelines = await prisma.pipeline.findMany({
    where: pipelineWhere,
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          status: true,
          follower: { select: { id: true, name: true } },
        },
      },
      salesPerson: { select: { id: true, name: true } },
      _count: { select: { communications: true } },
    },
  })

  const items: FollowupItem[] = []

  for (const p of pipelines) {
    if (!p.customer || p.customer.status === 'ARCHIVED') continue

    const rules: string[] = []
    const lastContact = p.lastContactDate ? dayjs(p.lastContactDate) : null
    const referenceDate = lastContact || dayjs(p.createdAt)
    const daysSinceContact = now.diff(referenceDate, 'day')

    // Rule 1: 新客户建立超 N 小时且从无沟通
    if (
      p._count.communications === 0 &&
      !p.lastContactDate &&
      now.diff(dayjs(p.createdAt), 'hour') >= THRESHOLDS.newLeadHours
    ) {
      rules.push('NEW_LEAD_STALE')
    }

    // Rule 2: 初步有意向、超 N 天未联系
    if (p.status === '初步有意向' && daysSinceContact >= THRESHOLDS.intentDays) {
      rules.push('INTENT_NO_REPLY')
    }

    // Rule 3: 下次跟进已到期（含超期）
    let overdueDays = 0
    if (p.nextFollowUpAt && !dayjs(p.nextFollowUpAt).isAfter(endOfToday)) {
      rules.push('DUE')
      overdueDays = Math.max(0, now.startOf('day').diff(dayjs(p.nextFollowUpAt).startOf('day'), 'day'))
    }

    // Rule 4: 非合作中客户静默超 N 天
    if (p.status !== '合作中' && daysSinceContact >= THRESHOLDS.silentDays) {
      rules.push('SILENT')
    }

    // Rule 5: 合作中客户超 N 天未回访
    if (p.status === '合作中' && daysSinceContact >= THRESHOLDS.wonCheckinDays) {
      rules.push('WON_CHECKIN')
    }

    if (rules.length === 0) continue

    const owner = p.salesPerson || p.customer.follower
    items.push({
      pipelineId: p.id,
      customerId: p.customer.id,
      customerName: p.customer.name,
      status: p.status,
      ownerId: owner?.id ?? null,
      ownerName: owner?.name || '未分配',
      rules,
      lastContactDate: p.lastContactDate ? dayjs(p.lastContactDate).format('YYYY-MM-DD') : null,
      daysSinceContact: p.lastContactDate || p.createdAt ? daysSinceContact : null,
      nextFollowUpAt: p.nextFollowUpAt ? dayjs(p.nextFollowUpAt).format('YYYY-MM-DD') : null,
      nextAction: p.nextAction,
      overdueDays,
    })
  }

  // 排序：超期最久的在前，其次按静默天数
  items.sort((a, b) => b.overdueDays - a.overdueDays || (b.daysSinceContact || 0) - (a.daysSinceContact || 0))

  // 按负责人分组
  const byOwnerMap = new Map<string, { ownerId: number | null; ownerName: string; items: FollowupItem[] }>()
  for (const item of items) {
    const key = String(item.ownerId ?? 'unassigned')
    if (!byOwnerMap.has(key)) {
      byOwnerMap.set(key, { ownerId: item.ownerId, ownerName: item.ownerName, items: [] })
    }
    byOwnerMap.get(key)!.items.push(item)
  }

  const summary = {
    total: items.length,
    dueToday: items.filter(i => i.rules.includes('DUE') && i.overdueDays === 0).length,
    overdue: items.filter(i => i.overdueDays > 0).length,
    newLeadStale: items.filter(i => i.rules.includes('NEW_LEAD_STALE')).length,
    silent: items.filter(i => i.rules.includes('SILENT')).length,
    wonCheckin: items.filter(i => i.rules.includes('WON_CHECKIN')).length,
  }

  return {
    generatedAt: now.toISOString(),
    thresholds: THRESHOLDS,
    summary,
    items,
    byOwner: Array.from(byOwnerMap.values()),
  }
}
