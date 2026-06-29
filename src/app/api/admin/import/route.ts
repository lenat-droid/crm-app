import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'
import fs from 'fs'
import path from 'path'
import { excelCheckToInterest } from '@/lib/utils'

/** Parse Chinese date strings like "2026年1月22日" or Excel serial numbers */
function parseDate(val: any): Date | null {
  if (!val) return null
  // Try JavaScript Date parsing first
  const d = new Date(val)
  if (!isNaN(d.getTime())) return d

  // Try Excel serial date number
  if (typeof val === 'number') {
    const parsed = XLSX.SSF.parse_date_code(val)
    if (parsed) return new Date(parsed.y, parsed.m - 1, parsed.d)
    return null
  }

  // Try Chinese date format: "2026年1月22日"
  const str = String(val).trim()
  const match = str.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/)
  if (match) {
    return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]))
  }

  // Try "YYYY-MM-DD" or "YYYY/MM/DD"
  const match2 = str.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
  if (match2) {
    return new Date(parseInt(match2[1]), parseInt(match2[2]) - 1, parseInt(match2[3]))
  }

  return null
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { fileUrl } = await req.json()
    // Strip leading slash — path.join treats "/uploads" as absolute, dropping the prefix
    const relativePath = fileUrl.startsWith('/') ? fileUrl.slice(1) : fileUrl
    const filePath = path.join(process.cwd(), 'public', relativePath)

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    const workbook = XLSX.readFile(filePath)
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

    // ── Sheet 1: CRM客户明細 ──
    const customerSheet = workbook.Sheets['CRM客户明細']
    if (customerSheet) {
      const rows = XLSX.utils.sheet_to_json(customerSheet, { defval: '' }) as any[]

      for (const row of rows) {
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
          // Product interest matrix
          posStatus: excelCheckToInterest(row['POS']),
          psWebsiteStatus: excelCheckToInterest(row['PS官网']),
          smtStatus: excelCheckToInterest(row['SMT']),
          platformManagedStatus: excelCheckToInterest(row['平台托管']),
          aiCamStatus: excelCheckToInterest(row['AI Cam']),
          omeStatus: excelCheckToInterest(row['OME']),
          smartRobotStatus: excelCheckToInterest(row['智能機器人']),
          contactStatus: row['Proton接觸状态'] || null,
        }

        // Look up follower by name
        const followerName = row['跟进人']
        if (followerName && String(followerName).trim()) {
          try {
            const follower = await prisma.user.findFirst({
              where: { name: { contains: String(followerName).trim() } },
            })
            if (follower) {
              data.follower = { connect: { id: follower.id } }
            }
          } catch {
            // Silently skip follower lookup errors
          }
        }

        try {
          await prisma.customer.upsert({
            where: { id: 0 },
            create: data,
            update: data,
          })
          result.customersImported++
        } catch (err: any) {
          result.customersErrors.push(`${name}: ${err.message}`)
        }
      }
    }

    // ── Sheet 2: 10開10目標跟蹤 ──
    const pipelineSheet = workbook.Sheets['10開10目標跟蹤']
    if (pipelineSheet) {
      const rows = XLSX.utils.sheet_to_json(pipelineSheet, { defval: '' }) as any[]

      for (const row of rows) {
        const merchantName = String(row['商家名稱Merchant'] || '').trim()
        if (!merchantName) continue

        try {
          // Find customer
          const customer = await prisma.customer.findFirst({
            where: { name: { contains: merchantName } },
          })
          if (!customer) {
            result.pipelinesSkipped++
            continue
          }

          // Find sales person
          let salesPersonId: number | null = null
          const personName = row['人员Person']
          if (personName) {
            const searchName = String(personName).split('(')[0].trim()
            const person = await prisma.user.findFirst({
              where: { name: { contains: searchName } },
            })
            if (person) salesPersonId = person.id
          }

          // Parse the contact date
          const contactDate = parseDate(row['最新聯絡日期'])

          // Create/update pipeline
          const pipeline = await prisma.pipeline.upsert({
            where: { customerId: customer.id },
            create: {
              customerId: customer.id,
              salesPersonId,
              status: row['當前狀態'] || '已建联',
              smt: row['SMT'] || null,
              psWebsite: row['PS官網'] || null,
              aiCam: row['AI Cam'] || null,
              agencyManaged: row['代運營'] || null,
              lastContactDate: contactDate,
              notes: row['備注'] || null,
            },
            update: {
              salesPersonId,
              status: row['當前狀態'] || undefined,
              lastContactDate: contactDate || undefined,
              notes: row['備注'] || undefined,
            },
          })
          result.pipelinesImported++

          // Import communications (Contact 1-6)
          for (let i = 1; i <= 6; i++) {
            const contactDateStr = row[`Contact ${i}`]
            const record = row[`Communication Record ${i}`]
            if (contactDateStr && record) {
              const commDate = parseDate(contactDateStr)
              if (commDate) {
                await prisma.communication.create({
                  data: {
                    pipelineId: pipeline.id,
                    contactDate: commDate,
                    record: String(record),
                    contactOrder: i,
                  },
                })
                result.communicationsImported++
              }
            }
          }
        } catch (err: any) {
          result.pipelinesErrors.push(`${merchantName}: ${err.message}`)
        }
      }
    }

    // Clean up temp file
    try { fs.unlinkSync(filePath) } catch {}

    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
