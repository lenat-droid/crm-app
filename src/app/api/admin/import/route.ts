import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { excelCheckToInterest } from '@/lib/utils'

/** Parse Chinese date strings like "2026年1月22日" or Excel serial numbers */
function parseDate(val: any): Date | null {
  if (!val) return null
  const d = new Date(val)
  if (!isNaN(d.getTime())) return d
  if (typeof val === 'number') {
    const parsed = XLSX.SSF.parse_date_code(val)
    if (parsed) return new Date(parsed.y, parsed.m - 1, parsed.d)
    return null
  }
  const str = String(val).trim()
  const match = str.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/)
  if (match) return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]))
  const match2 = str.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
  if (match2) return new Date(parseInt(match2[1]), parseInt(match2[2]) - 1, parseInt(match2[3]))
  return null
}

/** Get first row keys for diagnostic */
function getSheetHeaders(sheet: XLSX.WorkSheet): string[] {
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1')
  const headers: string[] = []
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = sheet[XLSX.utils.encode_cell({ r: range.s.r, c })]
    headers.push(cell?.v ? String(cell.v) : `(column ${c + 1})`)
  }
  return headers
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { fileUrl } = await req.json()

    // Resolve file path
    let filePath: string
    if (path.isAbsolute(fileUrl)) {
      filePath = fileUrl
    } else {
      const relativePath = fileUrl.startsWith('/') ? fileUrl.slice(1) : fileUrl
      filePath = path.join(process.cwd(), 'public', relativePath)
    }

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({
        error: `文件不存在: ${filePath}`,
        tip: '上传可能失败了。请重新上传文件。',
      }, { status: 404 })
    }

    // Try reading the workbook
    let workbook: XLSX.WorkBook
    try {
      workbook = XLSX.readFile(filePath)
    } catch (err: any) {
      return NextResponse.json({
        error: `无法读取 Excel 文件: ${err.message}`,
        tip: '文件可能损坏或格式不支持，请使用 .xlsx 格式。',
      }, { status: 400 })
    }

    const availableSheets = workbook.SheetNames
    const diagnostics: string[] = [`检测到 Sheet: ${availableSheets.join(', ')}`]

    // ── Check Sheet 1 ──
    const CUSTOMER_SHEET = 'CRM客户明細'
    const customerSheet = workbook.Sheets[CUSTOMER_SHEET]
    if (!customerSheet) {
      return NextResponse.json({
        error: `找不到名为「${CUSTOMER_SHEET}」的 Sheet`,
        diagnostics: [...diagnostics, `Excel 中的 Sheet 为: ${availableSheets.join(' | ')}`],
        tip: `请确保 Excel 中有一个名为「${CUSTOMER_SHEET}」的 Sheet。Sheet 名必须完全一致。请下载模板参照格式。`,
      }, { status: 400 })
    }

    const customerHeaders = getSheetHeaders(customerSheet)
    const requiredCustomerCols = ['商家名稱']
    const missingCustomerCols = requiredCustomerCols.filter(col => !customerHeaders.includes(col))
    diagnostics.push(`${CUSTOMER_SHEET} 表头: ${customerHeaders.join(' | ')}`)

    if (missingCustomerCols.length > 0) {
      return NextResponse.json({
        error: `「${CUSTOMER_SHEET}」缺少必要列: ${missingCustomerCols.join(', ')}`,
        diagnostics,
        tip: `表头必须包含「${requiredCustomerCols.join('」「')}」列。当前表头为: ${customerHeaders.join(', ')}`,
      }, { status: 400 })
    }

    const customerRows = XLSX.utils.sheet_to_json(customerSheet, { defval: '' }) as any[]
    diagnostics.push(`${CUSTOMER_SHEET} 共 ${customerRows.length} 行数据`)

    const result = {
      customersImported: 0,
      customersSkipped: 0,
      customersErrors: [] as string[],
      pipelinesImported: 0,
      pipelinesSkipped: 0,
      pipelinesErrors: [] as string[],
      communicationsImported: 0,
      visitsImported: 0,
      visitLogsImported: 0,
      leadsImported: 0,
    }

    // ── Import Sheet 1: 客户 ──
    for (let i = 0; i < customerRows.length; i++) {
      const row = customerRows[i]
      const name = String(row['商家名稱'] || '').trim()
      if (!name) {
        result.customersSkipped++
        continue
      }

      const data: any = {
        sapId: row['SAP ID'] || null,
        name,
        city: row['城市'] || null,
        region: row['业务区域划分'] || null,
        address: row['地址'] || null,
        area: row['所在地区'] || null,
        storePhone: row['店鋪電話'] ? String(row['店鋪電話']).trim() : null,
        floorManager: row['樓面負責人'] || null,
        floorManagerPhone: row['樓面聯係電話'] ? String(row['樓面聯係電話']).trim() : null,
        merchantContact: row['商家負責人'] || null,
        merchantContactPhone: row['商家負責人联系电话'] ? String(row['商家負責人联系电话']).trim() : null,
        keyman: row['Keyman（决定性人员）'] || null,
        website: row['官網'] || null,
        type: row['類型'] || null,
        storeType: row['店鋪類型'] || null,
        storeSize: row['店鋪規模'] ? String(row['店鋪規模']) : null,
        notes: row['备注'] || null,
        posStatus: excelCheckToInterest(row['POS']),
        psWebsiteStatus: excelCheckToInterest(row['PS官网']),
        smtStatus: excelCheckToInterest(row['SMT']),
        platformManagedStatus: excelCheckToInterest(row['平台托管']),
        aiCamStatus: excelCheckToInterest(row['AI Cam']),
        omeStatus: excelCheckToInterest(row['OME']),
        smartRobotStatus: excelCheckToInterest(row['智能機器人']),
        contactStatus: row['Proton接觸状态'] || null,
      }

      const followerName = row['跟进人']
      if (followerName && String(followerName).trim()) {
        try {
          const follower = await prisma.user.findFirst({
            where: { name: { contains: String(followerName).trim() } },
          })
          if (follower) {
            data.follower = { connect: { id: follower.id } }
          }
        } catch {}
      }

      try {
        await prisma.customer.upsert({
          where: { id: 0 },
          create: data,
          update: data,
        })
        result.customersImported++
      } catch (err: any) {
        result.customersErrors.push(`第${i + 2}行 ${name}: ${err.message}`)
      }
    }

    // ── Sheet 2: Pipeline ──
    const PIPELINE_SHEET = '10開10目標跟蹤'
    const pipelineSheet = workbook.Sheets[PIPELINE_SHEET]
    if (pipelineSheet) {
      const pipelineHeaders = getSheetHeaders(pipelineSheet)
      diagnostics.push(`${PIPELINE_SHEET} 表头: ${pipelineHeaders.join(' | ')}`)

      const pipelineRows = XLSX.utils.sheet_to_json(pipelineSheet, { defval: '' }) as any[]
      diagnostics.push(`${PIPELINE_SHEET} 共 ${pipelineRows.length} 行数据`)

      for (let i = 0; i < pipelineRows.length; i++) {
        const row = pipelineRows[i]
        const merchantName = String(row['商家名稱Merchant'] || row['商家名稱'] || row['Merchant'] || '').trim()
        if (!merchantName) continue

        try {
          const customer = await prisma.customer.findFirst({
            where: { name: { contains: merchantName } },
          })
          if (!customer) {
            result.pipelinesSkipped++
            diagnostics.push(`Pipeline 跳过「${merchantName}」: 客户表中未找到`)
            continue
          }

          let salesPersonId: number | null = null
          const personName = row['人员Person'] || row['人员'] || row['Person'] || ''
          if (personName) {
            const searchName = String(personName).split('(')[0].trim()
            const person = await prisma.user.findFirst({
              where: { name: { contains: searchName } },
            })
            if (person) salesPersonId = person.id
          }

          const contactDate = parseDate(row['最新聯絡日期'] || row['最新联系日期'])

          const pipeline = await prisma.pipeline.upsert({
            where: { customerId: customer.id },
            create: {
              customerId: customer.id,
              salesPersonId,
              status: row['當前狀態'] || row['当前状态'] || '已建联',
              smt: row['SMT'] || null,
              psWebsite: row['PS官網'] || row['PS官网'] || null,
              aiCam: row['AI Cam'] || null,
              agencyManaged: row['代運營'] || row['代运营'] || null,
              lastContactDate: contactDate,
              notes: row['備注'] || row['备注'] || null,
            },
            update: {
              salesPersonId,
              status: row['當前狀態'] || row['当前状态'] || undefined,
              lastContactDate: contactDate || undefined,
              notes: row['備注'] || row['备注'] || undefined,
            },
          })
          result.pipelinesImported++

          for (let j = 1; j <= 6; j++) {
            const contactDateStr = row[`Contact ${j}`]
            const record = row[`Communication Record ${j}`]
            if (contactDateStr && record) {
              const commDate = parseDate(contactDateStr)
              if (commDate) {
                await prisma.communication.create({
                  data: {
                    pipelineId: pipeline.id,
                    contactDate: commDate,
                    record: String(record),
                    contactOrder: j,
                  },
                })
                result.communicationsImported++
              }
            }
          }
        } catch (err: any) {
          result.pipelinesErrors.push(`第${i + 2}行 ${merchantName}: ${err.message}`)
        }
      }
    } else {
      diagnostics.push(`未找到 Sheet「${PIPELINE_SHEET}」，跳过 Pipeline 导入`)
    }

    // Clean up temp file
    try { fs.unlinkSync(filePath) } catch {}

    return NextResponse.json({ ...result, diagnostics })
  } catch (err: any) {
    return NextResponse.json({ error: err.message, tip: '请下载模板，按格式填写后重新上传。' }, { status: 500 })
  }
}
