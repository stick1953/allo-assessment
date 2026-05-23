import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      include: {
        stocks: {
          include: {
            warehouse: true
          }
        }
      }
    })
    
    // Calculate available stock
    const mappedProducts = products.map(product => {
      return {
        ...product,
        stocks: product.stocks.map(stock => ({
          ...stock,
          availableUnits: stock.totalUnits - stock.reservedUnits
        }))
      }
    })

    return NextResponse.json(mappedProducts)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
  }
}
