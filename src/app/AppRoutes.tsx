import { Navigate, Route, Routes } from 'react-router-dom'
import EntryPage from './EntryPage'
import ShopApp from '../shop/ShopApp'
import DashboardApp from '../dashboard/DashboardApp'

// One app, one deployment, two routes. Unknown paths go back to the entry page.
export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<EntryPage />} />
      <Route path="/shop" element={<ShopApp />} />
      <Route path="/dashboard/*" element={<DashboardApp />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
