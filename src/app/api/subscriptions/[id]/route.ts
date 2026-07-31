import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const ALLOWED_STATUSES = ['ACTIVE', 'CANCELLED', 'EXPIRED', 'TRIALING', 'PENDING_SIGNATURE']

/**
 * PATCH /api/subscriptions/[id] — 订阅生命周期管理（取消 / 续约 / 改状态）。
 *
 * 之前订阅只有 GET+POST，CANCELLED/EXPIRED 永远不会产生，
 * 流失率/续约率在数据层面不存在 — 这个端点补上生命周期闭环。
 * 仅 ADMIN / SALES_MGR / 该订阅的销售本人可操作。不提供 DELETE，历史数据只改状态不删除。
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = parseInt(params.id)
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const subscription = await prisma.subscription.findUnique({ where: { id } })
  if (!subscription) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const role = session.user.role
  const isOwner = subscription.salesPersonId === session.user.id
  if (role !== 'ADMIN' && role !== 'SALES_MGR' && !isOwner) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  const data: any = {}

  if (body.status !== undefined) {
    if (!ALLOWED_STATUSES.includes(body.status)) {
      return NextResponse.json({ error: `Invalid status. Must be one of: ${ALLOWED_STATUSES.join(', ')}` }, { status: 400 })
    }
    data.status = body.status
    if (body.status === 'CANCELLED' && !subscription.cancelledAt) {
      data.cancelledAt = new Date()
      if (!body.endDate && !subscription.endDate) data.endDate = new Date()
    }
    // 重新激活（续约）时清掉取消时间
    if (body.status === 'ACTIVE') data.cancelledAt = null
  }

  if (body.endDate !== undefined) {
    const d = body.endDate ? new Date(body.endDate) : null
    if (d && Number.isNaN(d.getTime())) return NextResponse.json({ error: 'Invalid endDate' }, { status: 400 })
    data.endDate = d
  }
  if (body.autoRenew !== undefined) data.autoRenew = Boolean(body.autoRenew)
  if (body.mrr !== undefined) {
    const mrr = Number(body.mrr)
    if (!Number.isFinite(mrr) || mrr < 0) return NextResponse.json({ error: 'Invalid mrr' }, { status: 400 })
    data.mrr = mrr
  }
  if (body.notes !== undefined) data.notes = String(body.notes).slice(0, 2000)

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const updated = await prisma.subscription.update({
    where: { id },
    data,
    include: { customer: { select: { id: true, name: true } }, product: { select: { name: true } } },
  })

  return NextResponse.json(updated)
}
