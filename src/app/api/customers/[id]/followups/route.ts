import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isAgentRequest } from '@/lib/agent-auth'

/**
 * POST /api/customers/[id]/followups — 写入一条跟进记录。
 *
 * Body: { record: string (必填), contactDate?, nextFollowUpAt?, nextAction? }
 *
 * 行为：创建 Communication + 更新 pipeline.lastContactDate / nextFollowUpAt / nextAction。
 * 客户没有 pipeline 时自动创建（状态"已建联"）。
 *
 * Agent token 写入：source 标为 'agent' 留审计；本端点能力上限就是
 * 「追加记录 + 改跟进时间」——不能改阶段、不能关闭、不能删除、不能碰金额。
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
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
    include: { pipeline: { select: { id: true } } },
  })
  if (!customer) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  // All authenticated users can write follow-ups to any customer (cross-sales visits).
  // No ownership/follower check — only block unauthenticated requests.

  const body = await req.json().catch(() => null)
  if (!body || typeof body.record !== 'string' || !body.record.trim()) {
    return NextResponse.json({ error: 'record is required' }, { status: 400 })
  }
  if (body.record.length > 5000) {
    return NextResponse.json({ error: 'record too long (max 5000)' }, { status: 400 })
  }

  const contactDate = parseDate(body.contactDate) || new Date()
  const nextFollowUpAt = parseDate(body.nextFollowUpAt)
  const nextAction = typeof body.nextAction === 'string' ? body.nextAction.slice(0, 500) : undefined

  const result = await prisma.$transaction(async tx => {
    // Ensure pipeline exists
    let pipelineId = customer.pipeline?.id
    if (!pipelineId) {
      const created = await tx.pipeline.create({
        data: {
          customerId: customer.id,
          salesPersonId: session ? (session.user.id as number) : customer.followerId,
          status: '已建联',
        },
      })
      pipelineId = created.id
    }

    const count = await tx.communication.count({ where: { pipelineId } })
    const communication = await tx.communication.create({
      data: {
        pipelineId,
        contactDate,
        record: body.record.trim(),
        contactOrder: count + 1,
        source: isAgent ? 'agent' : 'manual',
        createdById: session ? (session.user.id as number) : null,
      },
    })

    const pipeline = await tx.pipeline.update({
      where: { id: pipelineId },
      data: {
        lastContactDate: contactDate,
        ...(nextFollowUpAt !== undefined ? { nextFollowUpAt } : {}),
        ...(nextAction !== undefined ? { nextAction } : {}),
      },
    })

    return { communication, pipeline }
  })

  return NextResponse.json({
    id: result.communication.id,
    pipelineId: result.pipeline.id,
    lastContactDate: result.pipeline.lastContactDate,
    nextFollowUpAt: result.pipeline.nextFollowUpAt,
    nextAction: result.pipeline.nextAction,
    source: result.communication.source,
  })
}

function parseDate(v: unknown): Date | undefined {
  if (typeof v !== 'string' || !v) return undefined
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? undefined : d
}
