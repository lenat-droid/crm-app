import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'
import fs from 'fs'
import path from 'path'
import { excelCheckToInterest } from '@/lib/utils'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { fileUrl } = await req.json()
    const filePath = path.join(process.cwd(), 'public', fileUrl)

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    const workbook = XLSX.readFile(filePath)
    const result = {
      customersImported: 0,
      pipelinesImported: 0,
      communicationsImported: 0,
      visitsImported: 0,
      visitLogsImported: 0,
      leadsImported: 0,
    }

    // Sheet 1: CRM客户明細
    const customerSheet = workbook.Sheets['CRM客户明細']
    if (customerSheet) {
      const rows = XLSX.utils.sheet_to_json(customerSheet, { defval: '' }) as any[]

      for (const row of rows) {
        const data: any = {
          sapId: row['SAP ID'] || null,
          name: String(row['商家名稱'] || '').trim(),
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
          // Look up follower by name
          follower: row['跟进人'] ? { connect: undefined } : undefined,
        }

        // Try to find follower
        if (row['跟进人']) {
          const follower = await prisma.user.findFirst({
            where: { name: { contains: row['跟进人'] as string } },
          })
          if (follower) {
            data.follower = { connect: { id: follower.id } }
            delete data.followerId
          } else {
            delete data.follower
          }
        } else {
          delete data.follower
        }

        if (!data.name) continue

        try {
          await prisma.customer.upsert({
            where: { id: 0 }, // Will always create new
            create: data,
            update: data,
          })
          result.customersImported++
        } catch (err) {
          console.error(`Failed to import customer ${data.name}:`, err)
        }
      }
    }

    // Sheet 2: 10開10目標跟蹤
    const pipelineSheet = workbook.Sheets['10開10目標跟蹤']
    if (pipelineSheet) {
      const rows = XLSX.utils.sheet_to_json(pipelineSheet, { defval: '' }) as any[]

      for (const row of rows) {
        const merchantName = String(row['商家名稱Merchant'] || '').trim()
        if (!merchantName) continue

        // Find customer
        const customer = await prisma.customer.findFirst({
          where: { name: { contains: merchantName } },
        })
        if (!customer) continue

        // Find sales person
        let salesPersonId = null
        const personName = row['人员Person']
        if (personName) {
          const person = await prisma.user.findFirst({
            where: { name: { contains: String(personName).split('(')[0].trim() } },
          })
          if (person) salesPersonId = person.id
        }

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
            lastContactDate: row['最新聯絡日期'] ? new Date(row['最新聯絡日期']) : null,
            notes: row['備注'] || null,
          },
          update: {
            salesPersonId,
            status: row['當前狀態'] || undefined,
            lastContactDate: row['最新聯絡日期'] ? new Date(row['最新聯絡日期']) : undefined,
            notes: row['備注'] || undefined,
          },
        })
        result.pipelinesImported++

        // Import communications (Contact 1-6)
        for (let i = 1; i <= 6; i++) {
          const contactDate = row[`Contact ${i}`]
          const record = row[`Communication Record ${i}`]
          if (contactDate && record) {
            let parsedDate: Date
            try {
              parsedDate = new Date(contactDate)
              if (isNaN(parsedDate.getTime())) {
                // Try Excel serial date
                if (typeof contactDate === 'number') {
                  parsedDate = XLSX.SSF.parse_date_code(contactDate) as any
                } else {
                  continue
                }
              }
            } catch {
              continue
            }

            await prisma.communication.create({
              data: {
                pipelineId: pipeline.id,
                contactDate: parsedDate,
                record: String(record),
                contactOrder: i,
              },
            })
            result.communicationsImported++
          }
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
