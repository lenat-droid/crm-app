import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const p = new PrismaClient();

async function main() {
  console.log('🌱 Checking/updating seed data...\n');

  // 1. Seed ProductCatalog
  const existingProducts = await p.productCatalog.count();
  if (existingProducts === 0) {
    const products = [
      { key: 'posStatus', name: 'POS', category: 'CORE', sortOrder: 1 },
      { key: 'psWebsiteStatus', name: 'PS官網', category: 'ADDON', sortOrder: 2 },
      { key: 'smtStatus', name: 'SMT', category: 'ADDON', sortOrder: 3 },
      { key: 'aiCamStatus', name: 'AI Cam', category: 'HARDWARE', sortOrder: 4 },
      { key: 'platformManagedStatus', name: '平台托管', category: 'SERVICE', sortOrder: 5 },
      { key: 'omeStatus', name: 'OME', category: 'ADDON', sortOrder: 6 },
      { key: 'smartRobotStatus', name: '智能機器人', category: 'ADDON', sortOrder: 7 },
    ];
    for (const pdt of products) {
      await p.productCatalog.create({ data: pdt });
    }
    console.log('  ✅ Seeded 7 products');
  } else {
    console.log(`  Products already exist: ${existingProducts}`);
  }

  // 2. Ensure SALES_MGR user
  let salesMgr = await p.user.findUnique({ where: { email: 'alex@crm.com' } });
  if (!salesMgr) {
    const hash = await bcrypt.hash('sales123', 10);
    await p.user.create({
      data: { email: 'alex@crm.com', name: 'Alex Mgr', password: hash, role: 'SALES_MGR', region: 'LA EAST' },
    });
    console.log('  ✅ Created SALES_MGR: alex@crm.com / sales123');
  } else if (salesMgr.role !== 'SALES_MGR') {
    await p.user.update({ where: { id: salesMgr.id }, data: { role: 'SALES_MGR' } });
    console.log('  ✅ Updated alex@crm.com to SALES_MGR');
  } else {
    console.log('  SALES_MGR already exists');
  }

  // 3. Summary
  const counts = {
    users: await p.user.count(),
    products: await p.productCatalog.count(),
    customers: await p.customer.count(),
    pipelines: await p.pipeline.count(),
    leads: await p.lead.count(),
  };
  console.log('\n📊 Data counts:', JSON.stringify(counts));
  console.log('\n🔑 Test accounts:');
  console.log('  Admin:      admin@crm.com / admin123');
  console.log('  SALES_MGR:  alex@crm.com / sales123');
  console.log('  SALES:      mark@crm.com / sales123');
  console.log('  SALES:      kc@crm.com   / sales123');
  console.log('  SALES:      lena@crm.com / sales123');

  await p.$disconnect();
}
main().catch(e => { console.error('ERROR:', e); p.$disconnect(); });
