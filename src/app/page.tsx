import ProductList from '@/components/ProductList'

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50 text-gray-900 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Allo Store</h1>
        </header>
        
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <ProductList />
        </div>
      </div>
    </main>
  )
}
