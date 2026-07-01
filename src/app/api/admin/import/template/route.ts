import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import * as XLSX from 'xlsx'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // ── Sheet 1: 客户明细 ──
  const customerHeaders = [
    'SAP ID',
    '商家名稱',
    '城市',
    '业务区域划分',
    '地址',
    '所在地区',
    '店鋪電話',
    '樓面負責人',
    '樓面聯係電話',
    '商家負責人',
    '商家負責人联系电话',
    'Keyman（决定性人员）',
    '官網',
    '類型',
    '店鋪類型',
    '店鋪規模',
    '跟进人',
    '备注',
    'POS',
    'PS官网',
    'SMT',
    '平台托管',
    'AI Cam',
    'OME',
    '智能機器人',
    'Proton接觸状态',
  ]

  const customerExample = [
    'SAP001',
    '示例餐廳（必填）',
    '香港',
    '港島',
    '中環皇后大道中100號',
    '中環',
    '28881234',
    '張經理',
    '98765432',
    '李老闆',
    '91234567',
    '王總',
    'www.example.com',
    '餐饮',
    '中型',
    '100',
    '陳銷售',
    '示例备注',
    '✓',
    '✓',
    '✓',
    '',
    '',
    '',
    '',
    '已建联',
  ]

  const customerNotes = [
    '* 必填',
    '* 必填',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '必须是系统中已存在的用户名',
    '',
    '✓ = 有興趣, ✗ = 明確拒絕, 空白 = 未接觸',
    '✓ = 有興趣, ✗ = 明確拒絕, 空白 = 未接觸',
    '✓ = 有興趣, ✗ = 明確拒絕, 空白 = 未接觸',
    '✓ = 有興趣, ✗ = 明確拒絕, 空白 = 未接觸',
    '✓ = 有興趣, ✗ = 明確拒絕, 空白 = 未接觸',
    '✓ = 有興趣, ✗ = 明確拒絕, 空白 = 未接觸',
    '✓ = 有興趣, ✗ = 明確拒絕, 空白 = 未接觸',
    '',
  ]

  const customerSheet = XLSX.utils.aoa_to_sheet([
    customerHeaders,
    customerExample,
    customerNotes,
  ])
  // Set column widths
  customerSheet['!cols'] = customerHeaders.map(() => ({ wch: 20 }))

  // ── Sheet 2: Pipeline 跟踪 ──
  const pipelineHeaders = [
    '商家名稱Merchant',
    '人员Person',
    '當前狀態',
    'SMT',
    'PS官網',
    'AI Cam',
    '代運營',
    '最新聯絡日期',
    '備注',
    'Contact 1',
    'Communication Record 1',
    'Contact 2',
    'Communication Record 2',
  ]

  const pipelineExample = [
    '示例餐廳（必须在 Sheet 1 中存在）',
    '陳銷售',
    '已建联',
    '',
    '',
    '',
    '',
    '2026-06-15',
    '首次联系',
    '2026-06-01',
    '电话沟通，客户有興趣',
    '2026-06-10',
    '上门拜访，展示方案',
  ]

  const pipelineNotes = [
    '* 必填，且商家名稱必须在 Sheet 1 中存在',
    '必须是系统中已存在的用户名',
    '已建联 / 需求确认 / 方案报价 / 合同谈判 / 已签单 / 已流失',
    '✓ 或 ✗ 或空白',
    '✓ 或 ✗ 或空白',
    '✓ 或 ✗ 或空白',
    '✓ 或 ✗ 或空白',
    '格式: 2026-06-15 或 2026年6月15日',
    '',
    '格式: 2026-06-15',
    '沟通内容描述',
    '格式: 2026-06-15',
    '沟通内容描述',
  ]

  const pipelineSheet = XLSX.utils.aoa_to_sheet([
    pipelineHeaders,
    pipelineExample,
    pipelineNotes,
  ])
  pipelineSheet['!cols'] = pipelineHeaders.map(() => ({ wch: 25 }))

  // Create workbook
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, customerSheet, 'CRM客户明細')
  XLSX.utils.book_append_sheet(wb, pipelineSheet, '10開10目標跟蹤')

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="CRM-import-template.xlsx"',
    },
  })
}
