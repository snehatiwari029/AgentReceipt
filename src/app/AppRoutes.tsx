import { Navigate, Route, Routes } from 'react-router-dom'
import EntryPage from './EntryPage'
import ShopApp from '../shop/ShopApp'
import DashboardApp from '../dashboard/DashboardApp'
import ChatApp from '../chat/ChatApp'

// One app, one deployment, three routes. Unknown paths go back to the entry page.
export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<EntryPage />} />
      <Route path="/chat" element={<ChatApp />} />
      <Route path="/shop" element={<ShopApp />} />
      <Route path="/dashboard/*" element={<DashboardApp />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
