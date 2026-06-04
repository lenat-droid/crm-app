// Backfill: Create MerchantProfile records for existing customers
// Run: npx tsx prisma/backfill-merchant-profile.ts

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Backfilling MerchantProfile for existing customers...')

  const customers = await prisma.customer.findMany({
    where: {
      profile: null, // only customers without a profile
    },
    select: { id: true, name: true, city: true, storePhone: true, website: true, notes: true },
  })

  console.log(`Found ${customers.length} customers without MerchantProfile`)

  let created = 0
  for (const c of customers) {
    // Extract city info — if Customer has city, we can map it
    await prisma.merchantProfile.create({
      data: {
        customerId: c.id,
        // Optionally pre-fill from existing Customer data
        dataSource: 'MANUAL',
      },
    })
    created++
    if (created % 100 === 0) {
      console.log(`  Progress: ${created}/${customers.length}`)
    }
  }

  console.log(`Done! Created ${created} MerchantProfile records.`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
