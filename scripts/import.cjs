const { PrismaClient } = require('@prisma/client');
const XLSX = require('xlsx');

const prisma = new PrismaClient();
const filePath = '/Users/tianziyi/Desktop/CRM.xlsx';
const workbook = XLSX.readFile(filePath);

function toInterest(val) {
  if (!val || String(val).trim() === '') return 'NOT_CONTACTED';
  const v = String(val).trim();
  if (v === '✅' || v === 'TRUE' || v === 'true') return 'PURCHASED';
  if (v === '□' || v === 'FALSE' || v === 'false') return 'NOT_CONTACTED';
  if (v.includes('意向') || v.includes('兴趣')) return 'INTERESTED';
  return 'NOT_CONTACTED';
}

async function main() {
  // === Sheet 1: CRM客户明細 ===
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets['CRM客户明細'], { defval: '' });
  console.log('CRM客户明細 rows:', rows.length);

  let imported = 0;
  for (const row of rows) {
    const name = String(row['商家名稱'] || '').trim(); // 商家名稱
    if (!name) continue;

    try {
      await prisma.customer.create({
        data: {
          name,
          sapId: row['SAP ID'] ? String(row['SAP ID']).trim() : null,
          city: row['城市'] ? String(row['城市']).trim() : null,
          region: row['业务区域划分'] ? String(row['业务区域划分']).trim() : null,
          address: row['地址'] ? String(row['地址']).trim() : null,
          area: row['所在地区'] ? String(row['所在地区']).trim() : null,
          storePhone: row['店铺電話'] ? String(row['店铺電話']).trim() : null,
          floorManager: row['樓面負責人'] ? String(row['樓面負責人']).trim() : null,
          floorManagerPhone: row['樓面聯系電話'] ? String(row['樓面聯系電話']).trim() : null,
          merchantContact: row['商家負責人'] ? String(row['商家負責人']).trim() : null,
          merchantContactPhone: row['商家負責人联系电话'] ? String(row['商家負責人联系电话']).trim() : null,
          keyman: row['Keyman（决定性人员）'] ? String(row['Keyman（决定性人员）']).trim() : null,
          website: row['官網'] ? String(row['官網']).trim() : null,
          type: row['類型'] ? String(row['類型']).trim() : null,
          storeType: row['店铺類型'] ? String(row['店铺類型']).trim() : null,
          storeSize: row['店铺規模'] ? String(row['店铺規模']).trim() : null,
          notes: row['备注'] ? String(row['备注']).trim() : null,
          posStatus: toInterest(row['POS']),
          psWebsiteStatus: toInterest(row['PS官网']),
          smtStatus: toInterest(row['SMT']),
          platformManagedStatus: toInterest(row['平台托管']),
          aiCamStatus: toInterest(row['AI Cam']),
          omeStatus: toInterest(row['OME']),
          smartRobotStatus: toInterest(row['智能機器人']),
          contactStatus: row['Proton接觸状态'] ? String(row['Proton接觸状态']).trim() : null,
        }
      });
      imported++;
      if (imported % 100 === 0) console.log('  Progress:', imported);
    } catch(e) {
      console.error('  Failed:', name, '-', e.message);
    }
  }
  console.log('Customers imported:', imported);

  // === Sheet 2: 10開10目標跟蹤 ===
  const pipeSheet = workbook.Sheets['10開10目標跟蹤'];
  if (pipeSheet) {
    const pipeRows = XLSX.utils.sheet_to_json(pipeSheet, { defval: '' });
    console.log('\n10開10目標跟蹤 rows:', pipeRows.length);
    let pipeCount = 0, commCount = 0;

    for (const row of pipeRows) {
      const name = String(row['商家名稱Merchant'] || '').trim();
      if (!name) continue;

      const customer = await prisma.customer.findFirst({ where: { name: { contains: name } } });
      if (!customer) { console.log('  Customer not found:', name); continue; }

      let lastContact = null;
      if (row['最新聯絡日期']) {
        try { lastContact = new Date(row['最新聯絡日期']); if (isNaN(lastContact.getTime())) lastContact = null; } catch {}
      }

      try {
        const pipeline = await prisma.pipeline.create({
          data: {
            customerId: customer.id,
            status: String(row['當前狀態'] || '已建联'),
            lastContactDate: lastContact,
            notes: row['備注'] ? String(row['備注']).trim() : null,
          }
        });
        pipeCount++;

        for (let i = 1; i <= 6; i++) {
          const cd = row['Contact ' + i];
          const rec = row['Communication Record ' + i];
          if (cd && rec) {
            let d = null;
            try { d = new Date(cd); if (isNaN(d.getTime())) d = null; } catch { d = null; }
            if (d) {
              await prisma.communication.create({
                data: { pipelineId: pipeline.id, contactDate: d, record: String(rec).trim(), contactOrder: i }
              });
              commCount++;
            }
          }
        }
      } catch(e) { console.error('  Pipeline failed:', name, '-', e.message); }
    }
    console.log('Pipelines:', pipeCount, 'Communications:', commCount);
  }

  console.log('\nImport completed!');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
