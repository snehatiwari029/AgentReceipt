import { Link } from 'react-router-dom'

// Demo entry page. It is the only place that points at both views.
export default function EntryPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">AgentReceipt demo</h1>
        <p className="mt-2 text-sm text-slate-700">Simulated store and merchant view. No real payments.</p>
      </div>
      <Link to="/shop" className="rounded-md border border-slate-300 px-4 py-3 font-semibold text-slate-900 hover:bg-slate-50">
        Open the Northwind store
      </Link>
      <Link to="/dashboard" className="rounded-md border border-slate-300 px-4 py-3 font-semibold text-slate-900 hover:bg-slate-50">
        Open the merchant dashboard
      </Link>
    </main>
  )
}
