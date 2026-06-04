import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 10)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@crm.com' },
    update: {},
    create: {
      email: 'admin@crm.com',
      name: '管理员',
      password: adminPassword,
      role: 'ADMIN',
    },
  })
  console.log(`  ✅ Admin user created: admin@crm.com / admin123`)

  // Create sample sales users
  const salesUsers = [
    { email: 'mark@crm.com', name: 'Mark W-UT', region: 'UTAH' },
    { email: 'kc@crm.com', name: 'KC.F(KC)', region: 'LA EAST' },
    { email: 'lena@crm.com', name: 'LENA.T', region: 'LA EAST' },
    { email: 'andrew@crm.com', name: 'ANDREW.T', region: 'LA DOWNTOWN' },
    { email: 'alex@crm.com', name: 'Alex Mgr', region: 'LA EAST' },
  ]

  for (const u of salesUsers) {
    const password = await bcrypt.hash('sales123', 10)
    const role = u.email === 'alex@crm.com' ? 'SALES_MGR' : 'SALES'
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        email: u.email,
        name: u.name,
        password,
        role,
        region: u.region,
      },
    })
    console.log(`  ✅ ${role} user created: ${u.email} / sales123`)
  }

  // Seed ProductCatalog (the 7 existing products)
  const products = [
    { key: 'posStatus', name: 'POS', category: 'CORE', sortOrder: 1 },
    { key: 'psWebsiteStatus', name: 'PS Website', category: 'ADDON', sortOrder: 2 },
    { key: 'smtStatus', name: 'SMT', category: 'ADDON', sortOrder: 3 },
    { key: 'aiCamStatus', name: 'AI Cam', category: 'HARDWARE', sortOrder: 4 },
    { key: 'platformManagedStatus', name: 'Platform Managed', category: 'SERVICE', sortOrder: 5 },
    { key: 'omeStatus', name: 'OME', category: 'ADDON', sortOrder: 6 },
    { key: 'smartRobotStatus', name: 'Smart Robot', category: 'ADDON', sortOrder: 7 },
  ]

  for (const p of products) {
    await prisma.productCatalog.upsert({
      where: { key: p.key },
      update: { name: p.name, category: p.category, sortOrder: p.sortOrder },
      create: p,
    })
    console.log(`  ✅ Product catalog: ${p.key} (${p.name})`)
  }

  console.log('\n🎉 Seed completed!')
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
