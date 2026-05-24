"use client"

import { useEffect, useState } from "react"
import CheckoutModal from "./CheckoutModal"

type Product = {
  id: string
  name: string
  price: number
  sku: string
  stocks: {
    id: string
    warehouseId: string
    availableUnits: number
    warehouse: {
      name: string
      location: string
    }
  }[]
}

export default function ProductList() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [reservation, setReservation] = useState<any>(null)
  const [errorMsg, setErrorMsg] = useState("")
  // Keep track of quantity selected for each stock row
  const [quantities, setQuantities] = useState<Record<string, number>>({})

  const loadProducts = async () => {
    setLoading(true)
    setErrorMsg("")
    try {
      const res = await fetch("/api/products")
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.details || data.error || "Failed to load inventory")
      }
      
      if (Array.isArray(data)) {
        setProducts(data)
      } else {
        setProducts([])
        setErrorMsg("Failed to load products: Invalid data format")
      }
    } catch (e: any) {
      setErrorMsg(e.message)
      setProducts([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProducts()
  }, [])

  const handleReserve = async (productId: string, warehouseId: string, quantity: number) => {
    setErrorMsg("")
    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, warehouseId, quantity })
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.message || data.error || "Failed to reserve")
      }
      setReservation(data)
    } catch (e: any) {
      setErrorMsg(e.message)
    } finally {
      loadProducts() // refresh stock levels
    }
  }

  const handleQuantityChange = (stockId: string, val: number, max: number) => {
    let q = isNaN(val) ? 1 : val;
    q = Math.max(1, q); // Cannot go below 1
    q = Math.min(q, max); // Cannot exceed available stock
    setQuantities(prev => ({ ...prev, [stockId]: q }));
  }

  if (loading) return <div className="text-gray-500 animate-pulse">Loading store inventory...</div>

  return (
    <div className="space-y-6">
      {errorMsg && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg text-sm border border-red-200">
          {errorMsg}
        </div>
      )}

      {products.map((product) => (
        <div key={product.id} className="border border-gray-100 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-semibold">{product.name}</h2>
              <p className="text-sm text-gray-500 font-mono mt-1">{product.sku}</p>
            </div>
            <div className="text-lg font-medium">${product.price.toFixed(2)}</div>
          </div>

          <div className="space-y-3 pt-2">
            <h3 className="text-sm font-semibold text-gray-700">Availability by Warehouse:</h3>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
              {product.stocks.map((stock) => {
                const q = quantities[stock.id] || 1;
                return (
                <div key={stock.id} className="bg-gray-50 rounded-lg p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <div className="font-medium text-sm">{stock.warehouse.name}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{stock.availableUnits} available</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input 
                        type="number" 
                        min="1" 
                        max={stock.availableUnits} 
                        value={q} 
                        onChange={(e) => handleQuantityChange(stock.id, parseInt(e.target.value), stock.availableUnits)}
                        disabled={stock.availableUnits <= 0}
                        className="w-16 px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black disabled:bg-gray-100 disabled:text-gray-400 font-mono"
                    />
                    <button
                      disabled={stock.availableUnits <= 0}
                      onClick={() => {
                          setSelectedProduct(product)
                          handleReserve(product.id, stock.warehouseId, q)
                      }}
                      className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                        stock.availableUnits > 0 
                          ? 'bg-black text-white hover:bg-gray-800' 
                          : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      Reserve
                    </button>
                  </div>
                </div>
              )})}
            </div>
          </div>
        </div>
      ))}

      {reservation && (
        <CheckoutModal 
            reservation={reservation} 
            productName={selectedProduct?.name || "Product"}
            onClose={() => {
                setReservation(null)
                loadProducts()
            }} 
        />
      )}
    </div>
  )
}
