import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { v4 as uuidv4 } from 'uuid'
import { addMinutes } from 'date-fns'
import { z } from 'zod'

const prisma = new PrismaClient()

const reserveSchema = z.object({
  productId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  quantity: z.number().int().positive().default(1),
})

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const idempotencyKey = req.headers.get('Idempotency-Key')
    const parsed = reserveSchema.parse(body)
    
    const { productId, warehouseId, quantity } = parsed

    if (idempotencyKey) {
      const existing = await prisma.reservation.findUnique({ where: { idempotencyKey } })
      if (existing) {
        return NextResponse.json(existing)
      }
    }

    const reservation = await prisma.$transaction(async (tx) => {
      // 1. Pessimistic lock row
      const stocks: any[] = await tx.$queryRaw`
        SELECT * FROM "Stock"
        WHERE "productId" = ${productId} AND "warehouseId" = ${warehouseId}
        FOR UPDATE
      `
      
      if (!stocks || stocks.length === 0) {
        throw new Error('Stock record not found')
      }
      
      const stock = stocks[0]
      const available = stock.totalUnits - stock.reservedUnits

      if (available < quantity) {
        throw new Error('NOT_ENOUGH_STOCK')
      }

      // 2. Increment reserved units
      await tx.stock.update({
        where: { id: stock.id },
        data: { reservedUnits: { increment: quantity } }
      })

      // 3. Create Reservation (expires in 10 minutes)
      const expiresAt = addMinutes(new Date(), 10)
      const res = await tx.reservation.create({
        data: {
          productId,
          warehouseId,
          quantity,
          status: 'PENDING',
          expiresAt,
          idempotencyKey: idempotencyKey || uuidv4()
        }
      })

      return res
    })

    return NextResponse.json(reservation)

  } catch (error: any) {
    if (error.message === 'NOT_ENOUGH_STOCK') {
      return NextResponse.json({ error: 'conflict', message: 'Not enough stock available' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
