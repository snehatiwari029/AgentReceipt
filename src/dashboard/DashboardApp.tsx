import { useState } from 'react'
import { Link, NavLink, Route, Routes } from 'react-router-dom'
import Login from './Login'
import Home from './pages/Home'
import AgentOrders from './pages/AgentOrders'
import Disputes from './pages/Disputes'
import Optimization from './pages/Optimization'
import Tamper from './pages/Tamper'
import { isSignedIn, signIn, signOut } from './session'

const NAV = [
  { to: '/dashboard', label: 'Dashboard', end: true },
  { to: '/dashboard/orders', label: 'Agent orders', end: false },
  { to: '/dashboard/disputes', label: 'Disputes', end: false },
  { to: '/dashboard/optimization', label: 'Optimization', end: false },
  { to: '/dashboard/tamper', label: 'Tamper', end: false },
]

// The merchant dashboard. Dark theme only. It reaches the store through an internal route.
export default function DashboardApp() {
  const [signedIn, setSignedIn] = useState(isSignedIn)

  if (!signedIn) {
    return (
      <Login
        onSignIn={() => {
          signIn()
          setSignedIn(true)
        }}
      />
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-dash-page-top to-dash-page-bottom text-dash-body md:flex">
      <aside className="border-b border-dash-edge bg-dash-card p-4 md:min-h-screen md:w-56 md:border-b-0 md:border-r">
        <p className="text-lg font-bold text-dash-ink">AgentReceipt</p>
        <p className="text-xs text-dash-label">Northwind Outfitters</p>
        <nav aria-label="Dashboard" className="mt-4 flex flex-wrap gap-1 md:flex-col">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `rounded-md px-3 py-2 text-sm font-semibold ${
                  isActive ? 'bg-dash-card-raised text-dash-teal' : 'text-dash-body hover:bg-dash-card-raised'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-4 flex flex-wrap gap-2 border-t border-dash-edge pt-4 md:flex-col">
          <Link to="/shop" className="rounded-md px-3 py-2 text-sm font-semibold text-dash-teal hover:bg-dash-card-raised">
            View Store
          </Link>
          <button
            type="button"
            onClick={() => {
              signOut()
              setSignedIn(false)
            }}
            className="rounded-md px-3 py-2 text-left text-sm font-semibold text-dash-body hover:bg-dash-card-raised"
          >
            Sign out
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 p-6">
        <Routes>
          <Route index element={<Home />} />
          <Route path="orders" element={<AgentOrders />} />
          <Route path="disputes" element={<Disputes />} />
          <Route path="optimization" element={<Optimization />} />
          <Route path="tamper" element={<Tamper />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </main>
    </div>
  )
}
