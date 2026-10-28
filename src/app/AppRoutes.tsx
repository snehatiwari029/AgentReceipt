import { Navigate, Route, Routes } from 'react-router-dom'
import SitePage from '../site/SitePage'
import ShopApp from '../shop/ShopApp'
import DashboardApp from '../dashboard/DashboardApp'
import ChatApp from '../chat/ChatApp'

// One app, one deployment. / is the B2B site; the store, the dashboard and the phone keep their routes.
// Unknown paths go back to the site.
export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<SitePage />} />
      <Route path="/chat" element={<ChatApp />} />
      <Route path="/shop" element={<ShopApp />} />
      <Route path="/dashboard/*" element={<DashboardApp />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
