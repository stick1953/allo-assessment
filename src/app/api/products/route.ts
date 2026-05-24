import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
)

export async function GET() {
  try {
    const { data: products, error } = await supabase
      .from('Product')
      .select('*, stocks:Stock(*, warehouse:Warehouse(*))')
      
    if (error) throw error
    
    // Calculate available stock
    const mappedProducts = (products || []).map(product => {
      return {
        ...product,
        stocks: (product.stocks || []).map((stock: any) => ({
          ...stock,
          availableUnits: stock.totalUnits - stock.reservedUnits
        }))
      }
    })

    return NextResponse.json(mappedProducts)
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to fetch products', details: error.message }, { status: 500 })
  }
}
