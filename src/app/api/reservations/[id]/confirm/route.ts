import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import prisma from '@/lib/prisma'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
)

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params
    const { id } = params
    
    // Idempotency check for confirmations
    const idempotencyKey = req.headers.get('Idempotency-Key')
    if (idempotencyKey) {
        // Technically confirmation requires an ID to be in the URL,
        // but we can also just check that it might have already succeeded.
        const existing = await prisma.reservation.findUnique({
             where: { id }
        })
        if (existing?.status === 'CONFIRMED') {
            return NextResponse.json(existing) // Return existing immediately
        }
    }

    const { data: reservation, error } = await supabase.rpc('confirm_reservation', {
      p_reservation_id: id
    })

    if (error) {
      if (error.message.includes('Not found')) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
      }
      throw error
    }

    return NextResponse.json(reservation)
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
