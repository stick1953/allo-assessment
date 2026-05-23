import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // Clear existing data
  await prisma.reservation.deleteMany()
  await prisma.stock.deleteMany()
  await prisma.product.deleteMany()
  await prisma.warehouse.deleteMany()

  // Create Warehouses
  const w1 = await prisma.warehouse.create({
    data: { name: 'Main NYC', location: 'New York, NY' }
  })
  const w2 = await prisma.warehouse.create({
    data: { name: 'West Coast Hub', location: 'Los Angeles, CA' }
  })

  // Create Products
  const p1 = await prisma.product.create({
    data: { name: 'Allo Smart Mug', sku: 'ALLO-MUG-001', price: 25.0 }
  })
  const p2 = await prisma.product.create({
    data: { name: 'Allo Brew Coffee Maker', sku: 'ALLO-BREW-002', price: 150.0 }
  })

  // Stock
  await prisma.stock.createMany({
    data: [
      { warehouseId: w1.id, productId: p1.id, totalUnits: 10, reservedUnits: 0 },
      { warehouseId: w2.id, productId: p1.id, totalUnits: 5, reservedUnits: 0 },
      { warehouseId: w1.id, productId: p2.id, totalUnits: 2, reservedUnits: 0 },
    ]
  })

  console.log('Database seeded successfully!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
