import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { addMinutes } from 'date-fns'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import prisma from '@/lib/prisma'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
)

const reserveSchema = z.object({
  productId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  quantity: z.number().int().positive().default(1),
})

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const idempotencyKey = req.headers.get('Idempotency-Key')
    
    if (idempotencyKey) {
      const existing = await prisma.reservation.findUnique({
        where: { idempotencyKey }
      })
      if (existing) {
        return NextResponse.json(existing)
      }
    }

    const finalIdempotencyKey = idempotencyKey || uuidv4()
    const parsed = reserveSchema.parse(body)
    
    const { productId, warehouseId, quantity } = parsed

    const expiresAt = addMinutes(new Date(), 10).toISOString()
    
    // Call the stored procedure
    const { data: reservation, error } = await supabase.rpc('reserve_stock', {
      p_product_id: productId,
      p_warehouse_id: warehouseId,
      p_quantity: quantity,
      p_expires_at: expiresAt
    })

    if (error) {
      if (error.message.includes('Not enough available stock')) {
        return NextResponse.json({ error: 'conflict', message: 'Not enough stock available' }, { status: 409 })
      }
      throw error
    }

    const reservationId = typeof reservation === 'string' ? reservation : reservation.id;

    const updatedReservation = await prisma.reservation.update({
      where: { id: reservationId },
      data: { idempotencyKey: finalIdempotencyKey }
    }).catch(e => {
        console.error("Failed adjusting idempotency key:", e);
        return reservation;
    });

    return NextResponse.json(updatedReservation || reservation)

  } catch (error: any) {
    if (error.message === 'NOT_ENOUGH_STOCK') {
      return NextResponse.json({ error: 'conflict', message: 'Not enough stock available' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
