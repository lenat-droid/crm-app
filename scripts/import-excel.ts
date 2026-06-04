/**
 * Standalone script to import CRM.xlsx into the database.
 * Usage: npx tsx scripts/import-excel.ts <path-to-xlsx>
 *
 * This script reads all sheets and imports data into the CRM database.
 * Run after `npx prisma migrate dev` and `npx prisma db seed`.
 */

import { PrismaClient } from '@prisma/client'
import * as XLSX from 'xlsx'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

function excelCheckToInterest(val: any): string {
  if (!val || String(val).trim() === '') return 'NOT_CONTACTED'
  const cleaned = String(val).trim()
  if (cleaned === '✅' || cleaned === 'TRUE' || cleaned === 'true' || cleaned === '1') {
    return 'PURCHASED'
  }
  if (cleaned === '□' || cleaned === 'FALSE' || cleaned === 'false' || cleaned === '0') {
    return 'NOT_CONTACTED'
  }
  if (cleaned.includes('意向') || cleaned.includes('兴趣')) {
    return 'INTERESTED'
  }
  return 'NOT_CONTACTED'
}

async function importCustomers(rows: any[]) {
  console.log(`  Importing ${rows.length} customers...`)
  let count = 0

  for (const row of rows) {
    const name = String(row['商家名稱'] || '').trim()
    if (!name) continue

    // Find follower if exists
    let followerId: number | undefined
    if (row['跟进人']) {
      const follower = await prisma.user.findFirst({
        where: { name: { contains: String(row['跟进人']).trim(), mode: 'insensitive' } },
      })
      if (follower) followerId = follower.id
    }

    const data: any = {
      sapId: row['SAP ID'] ? String(row['SAP ID']).trim() : null,
      name,
      city: row['城市'] ? String(row['城市']).trim() : null,
      region: row['业务区域划分'] ? String(row['业务区域划分']).trim() : null,
      address: row['地址'] ? String(row['地址']).trim() : null,
      area: row['所在地区'] ? String(row['所在地区']).trim() : null,
      storePhone: row['店鋪電話'] ? String(row['店鋪電話']).trim() : null,
      floorManager: row['樓面負責人'] ? String(row['樓面負責人']).trim() : null,
      floorManagerPhone: row['樓面聯係電話'] ? String(row['樓面聯係電話']).trim() : null,
      merchantContact: row['商家負責人'] ? String(row['商家負責人']).trim() : null,
      merchantContactPhone: row['商家負責人联系电话'] ? String(row['商家負責人联系电话']).trim() : null,
      keyman: row['Keyman（决定性人员）'] ? String(row['Keyman（决定性人员）']).trim() : null,
      website: row['官網'] ? String(row['官網']).trim() : null,
      type: row['類型'] ? String(row['類型']).trim() : null,
      storeType: row['店鋪類型'] ? String(row['店鋪類型']).trim() : null,
      storeSize: row['店鋪規模'] ? String(row['店鋪規模']).trim() : null,
      notes: row['备注'] ? String(row['备注']).trim() : null,
      posStatus: excelCheckToInterest(row['POS']),
      psWebsiteStatus: excelCheckToInterest(row['PS官网']),
      smtStatus: excelCheckToInterest(row['SMT']),
      platformManagedStatus: excelCheckToInterest(row['平台托管']),
      aiCamStatus: excelCheckToInterest(row['AI Cam']),
      omeStatus: excelCheckToInterest(row['OME']),
      smartRobotStatus: excelCheckToInterest(row['智能機器人']),
      contactStatus: row['Proton接觸状态'] ? String(row['Proton接觸状态']).trim() : null,
      followerId: followerId || null,
    }

    try {
      await prisma.customer.create({ data })
      count++
    } catch (err: any) {
      console.error(`    ❌ Failed: ${name} - ${err.message}`)
    }
  }

  console.log(`  ✅ ${count} customers imported`)
  return count
}

async function importPipelines(rows: any[]) {
  console.log(`  Importing ${rows.length} pipeline records...`)
  let pipelineCount = 0
  let commCount = 0

  for (const row of rows) {
    const merchantName = String(row['商家名稱Merchant'] || '').trim()
    if (!merchantName) continue

    const customer = await prisma.customer.findFirst({
      where: { name: { contains: merchantName, mode: 'insensitive' } },
    })
    if (!customer) {
      console.error(`    ❌ Pipeline: Customer not found: ${merchantName}`)
      continue
    }

    let salesPersonId: number | undefined
    const personName = row['人员Person']
    if (personName) {
      const name = String(personName).split('(')[0].trim()
      const person = await prisma.user.findFirst({
        where: { name: { contains: name, mode: 'insensitive' } },
      })
      if (person) salesPersonId = person.id
    }

    let lastContactDate = null
    if (row['最新聯絡日期']) {
      try {
        lastContactDate = new Date(row['最新聯絡日期'])
        if (isNaN(lastContactDate.getTime())) lastContactDate = null
      } catch { lastContactDate = null }
    }

    const pipeline = await prisma.pipeline.create({
      data: {
        customerId: customer.id,
        salesPersonId: salesPersonId || null,
        status: String(row['當前狀態'] || '已建联'),
        smt: row['SMT'] ? String(row['SMT']) : null,
        psWebsite: row['PS官網'] ? String(row['PS官網']) : null,
        aiCam: row['AI Cam'] ? String(row['AI Cam']) : null,
        agencyManaged: row['代運營'] ? String(row['代運營']) : null,
        lastContactDate,
        notes: row['備注'] ? String(row['備注']) : null,
      },
    })
    pipelineCount++

    // Import communications
    for (let i = 1; i <= 6; i++) {
      const contactDate = row[`Contact ${i}`]
      const record = row[`Communication Record ${i}`]
      if (contactDate && record) {
        let parsedDate: Date | null = null
        try {
          if (typeof contactDate === 'number') {
            // Excel serial date number
            const dateInfo = XLSX.SSF.parse_date_code(contactDate)
            if (dateInfo) {
              parsedDate = new Date(dateInfo.y, dateInfo.m - 1, dateInfo.d)
            }
          } else {
            parsedDate = new Date(contactDate)
          }
          if (parsedDate && isNaN(parsedDate.getTime())) parsedDate = null
        } catch { parsedDate = null }

        if (parsedDate) {
          try {
            await prisma.communication.create({
              data: {
                pipelineId: pipeline.id,
                contactDate: parsedDate,
                record: String(record).trim(),
                contactOrder: i,
              },
            })
            commCount++
          } catch (err: any) {
            console.error(`    ❌ Communication: ${err.message}`)
          }
        }
      }
    }
  }

  console.log(`  ✅ ${pipelineCount} pipelines, ${commCount} communications imported`)
  return { pipelineCount, commCount }
}

async function main() {
  const args = process.argv.slice(2)
  if (args.length === 0) {
    console.error('Usage: npx tsx scripts/import-excel.ts <path-to-xlsx>')
    process.exit(1)
  }

  const filePath = path.resolve(args[0])
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`)
    process.exit(1)
  }

  console.log(`📂 Reading: ${filePath}`)
  const workbook = XLSX.readFile(filePath)
  const sheetNames = workbook.SheetNames
  console.log(`📄 Sheets: ${sheetNames.join(', ')}`)

  // Import CRM客户明細
  if (sheetNames.includes('CRM客户明細')) {
    console.log('\n--- CRM客户明細 ---')
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets['CRM客户明細'], { defval: '' })
    await importCustomers(rows)
  }

  // Import 10開10目標跟蹤
  if (sheetNames.includes('10開10目標跟蹤')) {
    console.log('\n--- 10開10目標跟蹤 ---')
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets['10開10目標跟蹤'], { defval: '' })
    await importPipelines(rows)
  }

  console.log('\n🎉 Import completed!')
  process.exit(0)
}

main().catch(err => {
  console.error('Import failed:', err)
  process.exit(1)
})
