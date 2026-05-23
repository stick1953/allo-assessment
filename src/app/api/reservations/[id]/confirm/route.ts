import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params
    const { id } = params

    const result = await prisma.$transaction(async (tx) => {
      // Lock reservation
      const reservations: any[] = await tx.$queryRaw`
        SELECT * FROM "Reservation"
        WHERE id = ${id}
        FOR UPDATE
      `
      if (!reservations || reservations.length === 0) {
        throw new Error('NOT_FOUND')
      }

      const reservation = reservations[0]

      if (reservation.status === 'CONFIRMED' || reservation.status === 'RELEASED') {
        return reservation // Idempotent behavior gracefully handled
      }

      if (new Date() > new Date(reservation.expiresAt)) {
        // If expired, release it
        await tx.stock.updateMany({
          where: { warehouseId: reservation.warehouseId, productId: reservation.productId },
          data: { reservedUnits: { decrement: reservation.quantity } }
        })
        const updated = await tx.reservation.update({
          where: { id },
          data: { status: 'RELEASED' }
        })
        throw new Error('EXPIRED')
      }

      // Confirm: permanent deduction
      await tx.stock.updateMany({
        where: { warehouseId: reservation.warehouseId, productId: reservation.productId },
        data: { 
          totalUnits: { decrement: reservation.quantity },
          reservedUnits: { decrement: reservation.quantity }
        }
      })

      const confirmedRes = await tx.reservation.update({
        where: { id },
        data: { status: 'CONFIRMED' }
      })

      return confirmedRes
    })

    return NextResponse.json(result)
  } catch (error: any) {
    if (error.message === 'NOT_FOUND') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    if (error.message === 'EXPIRED') {
      return NextResponse.json({ error: 'Reservation has expired' }, { status: 410 })
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
