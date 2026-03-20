import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { LoginPage, RegisterPage, ForgotPasswordPage } from "./components/auth/AuthPages";
import { EmailVerifiedPage } from "./components/auth/EmailVerifiedPage";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import Layout from "./components/layout/Layout";

import LandingPage from "./pages/LandingPage";
import Dashboard from "./pages/Dashboard";
import BrowsePros from "./pages/BrowsePros";
import ProDetail from "./pages/ProDetail";
import BookingFlow from "./pages/BookingFlow";
import MyBookings from "./pages/MyBookings";
import Messages from "./pages/Messages";
import Support from "./pages/Support";
import MyAccount from "./pages/MyAccount";
import Wallet from "./pages/Wallet";
import TermsOfService from "./pages/TermsOfService";
import PrivacyPolicy from "./pages/PrivacyPolicy";

import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminSocieties from "./pages/admin/AdminSocieties";
import AdminBroadcast from "./pages/admin/AdminBroadcast";
import AdminSupport from "./pages/admin/AdminSupport";
import AdminAuditLog from "./pages/admin/AdminAuditLog";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminServices from "./pages/admin/AdminServices";
import AdminReviews from "./pages/admin/AdminReviews";
import AdminWallet from "./pages/admin/AdminWallet";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/email-verified" element={<EmailVerifiedPage />} />
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />

          {/* Protected app shell */}
          <Route element={<Layout />}>
            <Route path="/dashboard" element={<ProtectedRoute userOnly><Dashboard /></ProtectedRoute>} />
            <Route path="/browse"    element={<ProtectedRoute userOnly><BrowsePros /></ProtectedRoute>} />
            <Route path="/pro/:id"   element={<ProtectedRoute userOnly><ProDetail /></ProtectedRoute>} />
            <Route path="/book/:id"  element={<ProtectedRoute userOnly><BookingFlow /></ProtectedRoute>} />
            <Route path="/bookings"  element={<ProtectedRoute userOnly><MyBookings /></ProtectedRoute>} />
            <Route path="/wallet"    element={<ProtectedRoute userOnly><Wallet /></ProtectedRoute>} />
            <Route path="/profile"   element={<Navigate to="/account" replace />} />
            <Route path="/account"   element={<ProtectedRoute><MyAccount /></ProtectedRoute>} />
            <Route path="/messages"  element={<ProtectedRoute userOnly><Messages /></ProtectedRoute>} />
            <Route path="/support"   element={<ProtectedRoute userOnly><Support /></ProtectedRoute>} />

            <Route path="/admin"                element={<ProtectedRoute adminOnly><AdminDashboard /></ProtectedRoute>} />
            <Route path="/admin/users"          element={<ProtectedRoute adminOnly><AdminUsers /></ProtectedRoute>} />
            <Route path="/admin/societies"      element={<ProtectedRoute adminOnly><AdminSocieties /></ProtectedRoute>} />
            <Route path="/admin/broadcast"      element={<ProtectedRoute adminOnly><AdminBroadcast /></ProtectedRoute>} />
            <Route path="/admin/support"        element={<ProtectedRoute adminOnly><AdminSupport /></ProtectedRoute>} />
            <Route path="/admin/audit"          element={<ProtectedRoute adminOnly><AdminAuditLog /></ProtectedRoute>} />
            <Route path="/admin/settings"       element={<ProtectedRoute adminOnly><AdminSettings /></ProtectedRoute>} />
            <Route path="/admin/services"       element={<ProtectedRoute adminOnly><AdminServices /></ProtectedRoute>} />
            <Route path="/admin/reviews"        element={<ProtectedRoute adminOnly><AdminReviews /></ProtectedRoute>} />
            <Route path="/admin/wallet"         element={<ProtectedRoute adminOnly><AdminWallet /></ProtectedRoute>} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
