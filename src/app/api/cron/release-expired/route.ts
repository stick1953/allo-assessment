import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
)

// This endpoint can be triggered by Vercel Cron or any other external scheduler every minute
export async function GET(req: Request) {
  // Optional: Verify Vercel Cron Authorization header in production
  try {
    const { data: expiredReservations, error: fetchError } = await supabase
      .from('Reservation')
      .select('*')
      .eq('status', 'PENDING')
      .lt('expiresAt', new Date().toISOString())

    if (fetchError) throw fetchError

    let releasedCount = 0

    for (const res of (expiredReservations || [])) {
      try {
        const { error } = await supabase.rpc('release_reservation', {
          p_reservation_id: res.id
        })
        if (!error) {
          releasedCount++
        }
      } catch (e) {
        console.error(`Failed to automatically release reservation ${res.id}`, e)
      }
    }

    return NextResponse.json({ success: true, releasedCount })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Cron failure' }, { status: 500 })
  }
}
