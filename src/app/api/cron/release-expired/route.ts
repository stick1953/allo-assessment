import { NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'

// This endpoint can be triggered by Vercel Cron or any other external scheduler every minute
export async function GET(req: Request) {
  // Optional: Verify Vercel Cron Authorization header in production
  try {
    const expiredReservations = await prisma.reservation.findMany({
      where: {
        status: 'PENDING',
        expiresAt: { lt: new Date() }
      }
    })

    let releasedCount = 0

    for (const res of expiredReservations) {
      try {
        await prisma.$transaction(async (tx) => {
          // Verify it's still pending and expired
          const locked: any[] = await tx.$queryRaw`SELECT * FROM "Reservation" WHERE id=${res.id} FOR UPDATE`
          if (locked.length && locked[0].status === 'PENDING' && new Date(locked[0].expiresAt) < new Date()) {
             await tx.stock.updateMany({
               where: { warehouseId: res.warehouseId, productId: res.productId },
               data: { reservedUnits: { decrement: res.quantity } }
             })
             await tx.reservation.update({
               where: { id: res.id },
               data: { status: 'RELEASED' }
             })
             releasedCount++
          }
        })
      } catch (e) {
        console.error(`Failed to automatically release reservation ${res.id}`, e)
      }
    }

    return NextResponse.json({ success: true, releasedCount })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Cron failure' }, { status: 500 })
  }
}
