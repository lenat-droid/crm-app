import { NextRequest, NextResponse } from 'next/server'
import dayjs from 'dayjs'
import { prisma } from '@/lib/prisma'
import { isCronRequest } from '@/lib/agent-auth'
import { computeDueFollowups, RULE_LABELS } from '@/lib/followups'
import { sendWecomMarkdown } from '@/lib/wecom'

/**
 * POST/GET /api/cron/daily-digest — 每日跟进清单 + 经营日报，推企微群。
 *
 * 触发：宿主机 crontab 或 n8n 定时器，例如
 *   30 8 * * * curl -s -X POST "https://crm.example.com/api/cron/daily-digest?secret=$CRON_SECRET"
 *
 * 分流：
 *   WECOM_WEBHOOK_SALES — 销售群：按负责人分组的今日清单
 *   WECOM_WEBHOOK_MGMT  — 管理层群：汇总 + 昨日经营数据
 * 未配置 webhook 时不发送，仅返回生成的消息内容（dry-run）。
 */
export async function POST(req: NextRequest) {
  return handle(req)
}

export async function GET(req: NextRequest) {
  return handle(req)
}

async function handle(req: NextRequest) {
  if (!isCronRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const followups = await computeDueFollowups()
  const today = dayjs().format('YYYY-MM-DD')

  // ── 销售群消息：按负责人分组，每人最多列 8 条 ──
  const salesLines: string[] = [`## 📋 今日跟進清單 ${today}`]
  for (const group of followups.byOwner) {
    salesLines.push(`\n**${group.ownerName}**（${group.items.length} 家）`)
    for (const item of group.items.slice(0, 8)) {
      const reasons = item.rules.map(r => RULE_LABELS[r] || r).join('、')
      const overdue = item.overdueDays > 0 ? ` <font color="warning">超期${item.overdueDays}天</font>` : ''
      const action = item.nextAction ? ` → ${item.nextAction}` : ''
      salesLines.push(`> ${item.customerName}（${reasons}${overdue}）${action}`)
    }
    if (group.items.length > 8) salesLines.push(`> …另有 ${group.items.length - 8} 家`)
  }
  if (followups.items.length === 0) salesLines.push('\n今日無待跟進客戶 ✅')
  const salesMessage = salesLines.join('\n')

  // ── 管理层消息：汇总 + 昨日经营数据 ──
  const yStart = dayjs().subtract(1, 'day').startOf('day').toDate()
  const yEnd = dayjs().subtract(1, 'day').endOf('day').toDate()
  const [newLeadsYesterday, newCommsYesterday, newVisitsYesterday, newSubsYesterday] = await Promise.all([
    prisma.lead.count({ where: { createdAt: { gte: yStart, lte: yEnd } } }),
    prisma.communication.count({ where: { createdAt: { gte: yStart, lte: yEnd } } }),
    prisma.visit.count({ where: { createdAt: { gte: yStart, lte: yEnd } } }),
    prisma.subscription.findMany({
      where: { createdAt: { gte: yStart, lte: yEnd } },
      select: { mrr: true, oneTimeAmount: true },
    }),
  ])
  const newMrrYesterday = newSubsYesterday.reduce((s, x) => s + (x.mrr || 0), 0)
  const oneTimeYesterday = newSubsYesterday.reduce((s, x) => s + (x.oneTimeAmount || 0), 0)

  const s = followups.summary
  const mgmtMessage = [
    `## 📊 經營日報 ${today}`,
    ``,
    `**跟進機制**：今日應跟 <font color="info">${s.dueToday}</font> · 超期 <font color="warning">${s.overdue}</font> · 新客未首聯 ${s.newLeadStale} · 靜默喚醒 ${s.silent} · 成交回訪 ${s.wonCheckin}`,
    ``,
    `**昨日動態**：新增線索 ${newLeadsYesterday} · 溝通 ${newCommsYesterday} 條 · 拜訪 ${newVisitsYesterday} 次`,
    `**昨日簽約**：新增 MRR $${newMrrYesterday.toFixed(0)}/月 · 一次性 $${oneTimeYesterday.toFixed(0)}`,
    ``,
    ...followups.byOwner.map(g => `> ${g.ownerName}：${g.items.length} 家待跟進`),
  ].join('\n')

  const results = await Promise.all([
    sendWecomMarkdown(process.env.WECOM_WEBHOOK_SALES, 'sales', salesMessage),
    sendWecomMarkdown(process.env.WECOM_WEBHOOK_MGMT, 'mgmt', mgmtMessage),
  ])

  return NextResponse.json({
    date: today,
    summary: followups.summary,
    pushed: results,
    // dry-run 时便于人工检查消息内容
    messages: results.every(r => r.skipped) ? { sales: salesMessage, mgmt: mgmtMessage } : undefined,
  })
}
