import { Link } from 'react-router-dom'

const doors = [
  { to: '/chat', title: 'Customer phone', note: 'Talk to Muse, the shopper agent.' },
  { to: '/shop', title: 'Northwind store', note: 'The demo snowboard and ski store.' },
  { to: '/dashboard', title: 'Merchant dashboard', note: 'The merchant view of agent orders.' },
]

// Demo entry page: one separate door per audience. Nothing here merges them into one flow.
export default function EntryPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 px-6">
      <div className="mb-2">
        <h1 className="text-2xl font-extrabold text-slate-900">AgentReceipt demo</h1>
        <p className="mt-2 text-sm text-slate-700">Simulated store, shopper agent and merchant view. No real payments.</p>
      </div>
      {doors.map((d) => (
        <Link key={d.to} to={d.to} className="rounded-md border border-slate-300 px-4 py-3 text-slate-900 hover:bg-slate-50">
          <span className="block font-semibold">{d.title}</span>
          <span className="block text-sm text-slate-600">{d.note}</span>
        </Link>
      ))}
    </main>
  )
}
