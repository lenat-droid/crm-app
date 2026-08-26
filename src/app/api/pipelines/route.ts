import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getDataScope } from '@/lib/auth-helpers'
import { validateCreatePipeline, validateUpdatePipeline, ValidationError } from '@/lib/validation/schemas'

// GET: list pipelines
//   - 看板模式（默認）: 只返回 active=true（看板用）
//   - 傳 ?active=all 時返回全部
//   - 傳 ?active=closed 時只返回已關閉的
//   - 看板模式支持分页: ?page=1&pageSize=50 (默认 50, 最大 200)
//   - 看板模式下自动计算客户活跃订阅的 MRR 总额
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const activeFilter = searchParams.get('active') || 'true'

  // Data scoping
  const scope = getDataScope(session)
  const pipelineScope: any = {}
  if (scope.followerId) {
    pipelineScope.salesPersonId = scope.followerId
  } else if (scope.region) {
    pipelineScope.customer = { region: scope.region }
  }

  // Active filter
  if (activeFilter === 'true') {
    pipelineScope.active = true
  } else if (activeFilter === 'closed') {
    pipelineScope.active = false
  }
  // 'all' → no filter

  // Kanban mode (active=true or active=all): support pagination + include MRR
  if (activeFilter === 'true') {
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const pageSize = Math.min(200, Math.max(1, parseInt(searchParams.get('pageSize') || '50')))

    const [pipelines, total] = await Promise.all([
      prisma.pipeline.findMany({
        where: pipelineScope,
        include: {
          customer: {
            select: {
              id: true, name: true, contactStatus: true,
              follower: { select: { name: true } },
              // Sum MRR of active subscriptions for this customer
              subscriptions: {
                where: { status: 'ACTIVE' },
                select: { mrr: true },
              },
            },
          },
          salesPerson: { select: { id: true, name: true } },
          communications: {
            include: { createdBy: { select: { id: true, name: true } } },
            orderBy: { contactOrder: 'asc' },
            take: 5,
          },
        },
        orderBy: [{ active: 'desc' }, { updatedAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.pipeline.count({ where: pipelineScope }),
    ])

    // Compute customer MRR
    const enriched = pipelines.map(p => ({
      ...p,
      _customerMrr: p.customer?.subscriptions?.reduce((sum: number, s: any) => sum + s.mrr, 0) || 0,
      customer: p.customer ? {
        ...p.customer,
        subscriptions: undefined, // remove the raw array from response
      } : undefined,
    }))

    return NextResponse.json({ pipelines: enriched, total, page, pageSize, hasMore: page * pageSize < total })
  }

  // Closed/all view: no pagination, no MRR (simpler response)
  const [pipelines, total] = await Promise.all([
    prisma.pipeline.findMany({
      where: pipelineScope,
      include: {
        customer: { select: { id: true, name: true, contactStatus: true, follower: { select: { name: true } } } },
        salesPerson: { select: { id: true, name: true } },
        communications: { include: { createdBy: { select: { id: true, name: true } } }, orderBy: { contactOrder: 'asc' } },
      },
      orderBy: [{ active: 'desc' }, { updatedAt: 'desc' }],
    }),
    prisma.pipeline.count({ where: pipelineScope }),
  ])

  return NextResponse.json({ pipelines, total, page: 1, pageSize: total })
}

// POST: create or update pipeline / add communication
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const data = await req.json()
  const { customerId, contactDate, record, status } = validateCreatePipeline(data)

  // Find or create pipeline
  let pipeline = await prisma.pipeline.findUnique({ where: { customerId } })

  if (!pipeline) {
    pipeline = await prisma.pipeline.create({
      data: {
        customerId,
        salesPersonId: session.user.id,
        status: status || '已建联',
        lastContactDate: contactDate ? new Date(contactDate) : null,
      },
    })
  } else {
    pipeline = await prisma.pipeline.update({
      where: { id: pipeline.id },
      data: {
        lastContactDate: contactDate ? new Date(contactDate) : undefined,
        ...(status ? { status } : {}),
      },
    })
  }

  // Add communication record
  if (contactDate && record) {
    const maxOrder = await prisma.communication.aggregate({
      where: { pipelineId: pipeline.id },
      _max: { contactOrder: true },
    })
    const nextOrder = (maxOrder._max.contactOrder || 0) + 1

    await prisma.communication.create({
      data: {
        pipelineId: pipeline.id,
        contactDate: new Date(contactDate),
        record,
        contactOrder: nextOrder,
        createdById: session.user.id,
      },
    })
  }

  return NextResponse.json(pipeline)
}

// PATCH: update pipeline status, or close/archive a pipeline
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const data = await req.json()

  // Validate
  let validated: ReturnType<typeof validateUpdatePipeline>
  try {
    validated = validateUpdatePipeline(data)
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    throw err
  }

  const { id, status, active, closedAt, closeReason: explicitCloseReason, salesPersonId } = validated

  // ── Case 0: Reassign pipeline owner (can combine with status update) ──
  if (salesPersonId !== undefined && active !== false && !status) {
    const updated = await prisma.pipeline.update({
      where: { id },
      data: { salesPersonId: salesPersonId || null },
      include: { customer: { select: { id: true, name: true } } },
    })
    return NextResponse.json(updated)
  }

  // ── Case 1: 關閉 Pipeline（active=false）──
  if (active === false) {
    const pipeline = await prisma.pipeline.findUnique({
      where: { id },
      include: { customer: { select: { id: true, contactStatus: true, status: true } } },
    })
    if (!pipeline) return NextResponse.json({ error: 'Pipeline not found' }, { status: 404 })

    // Determine WON / LOST close:
    //   - explicit closeReason takes precedence
    //   - fallback: pipeline.status === '合作中' → WON, else → LOST
    const isWon = explicitCloseReason ? explicitCloseReason === 'WON' : pipeline.status === '合作中'

    const updated = await prisma.pipeline.update({
      where: { id },
      data: {
        active: false,
        closedAt: closedAt ? new Date(closedAt) : new Date(),
        closeReason: isWon ? 'WON' : 'LOST',
      },
      include: { customer: { select: { id: true, name: true } } },
    })

    // Sync customer contactStatus:
    if (pipeline.customer) {
      let newContactStatus: string
      if (isWon) {
        newContactStatus = '合作中'
      } else if (pipeline.status === '合作中') {
        newContactStatus = '已流失'
      } else {
        newContactStatus = '已建联'
      }

      await prisma.customer.update({
        where: { id: pipeline.customer.id },
        data: { contactStatus: newContactStatus },
      })
    }

    return NextResponse.json({
      ...updated,
      closeReason: isWon ? 'WON' : 'LOST',
      message: isWon ? '已歸檔（成交）' : '已關閉（未成交）',
    })
  }

  // ── Case 2: 普通狀態更新 ──
  if (!status) {
    return NextResponse.json({ error: 'status is required for non-close updates' }, { status: 400 })
  }

  const pipeline = await prisma.pipeline.update({
    where: { id },
    data: { status },
    include: { customer: { select: { id: true } } },
  })

  // Sync customer's contactStatus based on pipeline status
  if (pipeline.customer) {
    let contactStatus: string | undefined
    if (status === '合作中') {
      contactStatus = '合作中'
    } else if (status === '已建联' || status === '初步有意向') {
      contactStatus = '已建联'
    }
    if (contactStatus) {
      await prisma.customer.update({
        where: { id: pipeline.customer.id },
        data: { contactStatus },
      })
    }
  }

  return NextResponse.json(pipeline)
}
