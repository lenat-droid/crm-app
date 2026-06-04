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

// Helper to safely get string value from row
function getStr(row, key) {
  const val = row[key];
  if (val === undefined || val === null) return null;
  const s = String(val).trim();
  return s || null;
}

async function main() {
  // === Sheet 1: CRM客户明细 ===
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets['CRM客户明細'], { defval: '' });
  console.log('CRM客户明細 rows:', rows.length);
  console.log('Columns:', Object.keys(rows[0]).join(', '));

  let imported = 0;
  for (const row of rows) {
    const name = getStr(row, '商家名稱');
    if (!name) continue;

    try {
      await prisma.customer.create({
        data: {
          name,
          sapId: getStr(row, 'SAP ID'),
          city: getStr(row, '城市'),
          region: getStr(row, '业务区域划分'),
          address: getStr(row, '地址'),
          area: getStr(row, '所在地区'),
          storePhone: getStr(row, '店鋪電話'),
          floorManager: getStr(row, '樓面負責人'),
          floorManagerPhone: getStr(row, '樓面聯係電話'),
          merchantContact: getStr(row, '商家負責人'),
          merchantContactPhone: getStr(row, '商家負責人联系电话'),
          keyman: getStr(row, 'Keyman（决定性人员）'),
          website: getStr(row, '官網'),
          type: getStr(row, '類型'),
          storeType: getStr(row, '店鋪類型'),
          storeSize: getStr(row, '店鋪規模'),
          notes: getStr(row, '备注'),
          posStatus: toInterest(row['POS']),
          psWebsiteStatus: toInterest(row['PS官网']),
          smtStatus: toInterest(row['SMT']),
          platformManagedStatus: toInterest(row['平台托管']),
          aiCamStatus: toInterest(row['AI Cam']),
          omeStatus: toInterest(row['OME']),
          smartRobotStatus: toInterest(row['智能機器人']),
          contactStatus: getStr(row, 'Proton接觸状态'),
        }
      });
      imported++;
      if (imported % 200 === 0) console.log('  Progress:', imported);
    } catch(e) {
      console.error('  Failed:', name, '-', e.message);
    }
  }
  console.log('✅ Customers imported:', imported);

  // === Sheet 2: 10開10目標跟蹤 ===
  const pipeSheet = workbook.Sheets['10開10目標跟蹤'];
  if (pipeSheet) {
    const pipeRows = XLSX.utils.sheet_to_json(pipeSheet, { defval: '' });
    console.log('\n10開10目標跟蹤 rows:', pipeRows.length);
    console.log('Pipeline columns:', Object.keys(pipeRows[0]).join(', '));

    let pipeCount = 0, commCount = 0;

    for (const row of pipeRows) {
      const name = getStr(row, '商家名稱Merchant');
      if (!name) continue;

      // Try exact name first, then startsWith
      let customer = await prisma.customer.findFirst({ where: { name } });
      if (!customer) {
        customer = await prisma.customer.findFirst({ where: { name: { startsWith: name.substring(0, 15) } } });
      }

      if (!customer) {
        console.log('  ⚠️ Customer not found:', name);
        continue;
      }

      let lastContact = null;
      const rawDate = row['最新聯絡日期'];
      if (rawDate) {
        try {
          if (typeof rawDate === 'number') {
            // Excel serial date
            const d = new Date((rawDate - 25569) * 86400 * 1000);
            if (!isNaN(d.getTime())) lastContact = d;
          } else {
            const d = new Date(rawDate);
            if (!isNaN(d.getTime())) lastContact = d;
          }
        } catch {}
      }

      try {
        const pipeline = await prisma.pipeline.create({
          data: {
            customerId: customer.id,
            status: getStr(row, '當前狀態') || '已建联',
            lastContactDate: lastContact,
            notes: getStr(row, '備注'),
          }
        });
        pipeCount++;

        // Import communications (Contact 1-6)
        for (let i = 1; i <= 6; i++) {
          const cd = row[`Contact ${i}`];
          const rec = row[`Communication Record ${i}`];
          if (cd && rec) {
            let d = null;
            try {
              if (typeof cd === 'number') {
                d = new Date((cd - 25569) * 86400 * 1000);
              } else {
                d = new Date(cd);
              }
              if (d && isNaN(d.getTime())) d = null;
            } catch { d = null; }

            if (d) {
              await prisma.communication.create({
                data: { pipelineId: pipeline.id, contactDate: d, record: String(rec).trim(), contactOrder: i }
              });
              commCount++;
            }
          }
        }
      } catch(e) { console.error('  ❌ Pipeline failed:', name, '-', e.message); }
    }
    console.log('✅ Pipelines:', pipeCount, 'Communications:', commCount);
  }

  console.log('\n🎉 Import completed! Total customers:', imported);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
