"use client"

import { useEffect, useState } from "react"
import { formatDistanceToNowStrict } from "date-fns"

export default function CheckoutModal({ reservation, productName, onClose }: { reservation: any, productName: string, onClose: () => void }) {
  const [timeLeft, setTimeLeft] = useState<string>("")
  const [errorMsg, setErrorMsg] = useState("")
  // Track status implicitly from the reservation object
  const [status, setStatus] = useState<string>(reservation.status)
  const [loading, setLoading] = useState(false)

  const expiryDate = new Date(reservation.expiresAt)
  const formattedExpiry = expiryDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })

  // Countdown timer
  useEffect(() => {
    if (status === 'CONFIRMED' || status === 'RELEASED') {
      setTimeLeft("-")
      return
    }

    const updateTimer = () => {
      if (new Date() > expiryDate) {
        setTimeLeft("Expired")
        setStatus("RELEASED") // Optimistic frontend UI update
      } else {
        setTimeLeft(formatDistanceToNowStrict(expiryDate))
      }
    }
    
    updateTimer()
    const interval = setInterval(updateTimer, 1000)
    return () => clearInterval(interval)
  }, [expiryDate, status])

  const handleConfirm = async () => {
    setLoading(true)
    setErrorMsg("")
    try {
      const res = await fetch(`/api/reservations/${reservation.id}/confirm`, {
        method: 'POST'
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to confirm")
      }
      setStatus("CONFIRMED")
    } catch (e: any) {
      setErrorMsg(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = async () => {
    setLoading(true)
    try {
      await fetch(`/api/reservations/${reservation.id}/release`, {
        method: 'POST'
      })
    } finally {
      setLoading(false)
      setStatus("RELEASED")
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-6 shadow-xl">
        
        {status === 'CONFIRMED' ? (
          <div className="text-center space-y-4">
            <div className="mx-auto w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-2xl">✓</div>
            <h2 className="text-2xl font-bold">Purchase Confirmed!</h2>
            <p className="text-gray-500">Your reservation of <strong>{reservation.quantity}x {productName}</strong> is complete.</p>
            <div className="bg-gray-50 px-4 py-3 rounded-lg text-sm flex justify-between items-center text-gray-700">
                <span className="font-medium">Status</span>
                <span className="bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded uppercase tracking-wider text-xs">CONFIRMED</span>
            </div>
            <button onClick={onClose} className="mt-4 w-full bg-black text-white rounded-lg py-2.5 font-medium hover:bg-gray-800">
              Return to Store
            </button>
          </div>
        ) : (
          <>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Checkout</h2>
              <p className="text-sm text-gray-500 mt-1">Complete your purchase to secure your item.</p>
            </div>

            {errorMsg && (
              <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-200 font-medium">
                {errorMsg}
              </div>
            )}

            <div className="space-y-4">
                <div className="border border-gray-100 rounded-lg p-4 space-y-3">
                    <div className="flex justify-between font-medium">
                        <span>{productName}</span>
                        <span>Qty: {reservation.quantity}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm border-t border-gray-100 pt-3">
                        <span className="text-gray-500 font-medium">Reservation Status</span>
                        <span className={`font-bold px-2 py-0.5 rounded uppercase tracking-wider text-xs ${status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-700'}`}>
                            {status}
                        </span>
                    </div>
                    {status === 'PENDING' && (
                        <div className="flex justify-between items-center text-sm border-t border-gray-100 pt-3">
                            <span className="text-gray-500 font-medium">Expires At</span>
                            <span className="font-mono text-gray-700">{formattedExpiry}</span>
                        </div>
                    )}
                </div>

                {status === 'PENDING' && (
                    <div className="bg-orange-50 border border-orange-100 rounded-lg p-4 flex items-center justify-between">
                        <div className="text-orange-800 font-medium text-sm">Reservation runs out in:</div>
                        <div className="text-orange-600 font-mono font-bold tracking-tight text-lg">{timeLeft}</div>
                    </div>
                )}
            </div>

            <div className="flex gap-3 pt-2">
              <button 
                onClick={handleCancel} 
                disabled={loading}
                className="flex-1 px-4 py-2.5 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button 
                onClick={handleConfirm} 
                disabled={loading || timeLeft === "Expired" || status !== 'PENDING'}
                className="flex-1 px-4 py-2.5 text-white bg-black hover:bg-gray-800 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {loading ? 'Processing...' : 'Confirm Purchase'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
