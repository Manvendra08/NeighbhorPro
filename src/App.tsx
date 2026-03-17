import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { LoginPage, RegisterPage, ForgotPasswordPage } from "./components/auth/AuthPages";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import Layout from "./components/layout/Layout";

import Dashboard from "./pages/Dashboard";
import BrowsePros from "./pages/BrowsePros";
import ProDetail from "./pages/ProDetail";
import BookingFlow from "./pages/BookingFlow";
import MyBookings from "./pages/MyBookings";
import Messages from "./pages/Messages";
import Support from "./pages/Support";
import MyAccount from "./pages/MyAccount";

import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminSocieties from "./pages/admin/AdminSocieties";
import AdminBroadcast from "./pages/admin/AdminBroadcast";
import AdminSupport from "./pages/admin/AdminSupport";
import AdminAuditLog from "./pages/admin/AdminAuditLog";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminServices from "./pages/admin/AdminServices";
import AdminReviews from "./pages/admin/AdminReviews";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />

          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/browse" element={<BrowsePros />} />
            <Route path="/pro/:id" element={<ProDetail />} />
            <Route path="/book/:id" element={<BookingFlow />} />
            <Route path="/bookings" element={<MyBookings />} />
            <Route path="/profile" element={<Navigate to="/account" replace />} />
            <Route path="/account" element={<MyAccount />} />
            <Route path="/messages" element={<Messages />} />
            <Route path="/support" element={<Support />} />

            {/* Admin routes */}
            <Route path="/admin" element={<ProtectedRoute adminOnly><AdminDashboard /></ProtectedRoute>} />
            <Route path="/admin/users" element={<ProtectedRoute adminOnly><AdminUsers /></ProtectedRoute>} />
            <Route path="/admin/societies" element={<ProtectedRoute adminOnly><AdminSocieties /></ProtectedRoute>} />
            <Route path="/admin/broadcast" element={<ProtectedRoute adminOnly><AdminBroadcast /></ProtectedRoute>} />
            <Route path="/admin/support" element={<ProtectedRoute adminOnly><AdminSupport /></ProtectedRoute>} />
            <Route path="/admin/audit" element={<ProtectedRoute adminOnly><AdminAuditLog /></ProtectedRoute>} />
            <Route path="/admin/settings" element={<ProtectedRoute adminOnly><AdminSettings /></ProtectedRoute>} />
            <Route path="/admin/services" element={<ProtectedRoute adminOnly><AdminServices /></ProtectedRoute>} />
            <Route path="/admin/reviews" element={<ProtectedRoute adminOnly><AdminReviews /></ProtectedRoute>} />
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
