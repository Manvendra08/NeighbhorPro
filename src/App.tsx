import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { LoginPage, RegisterPage, ForgotPasswordPage } from "./components/auth/AuthPages";
import { EmailVerifiedPage } from "./components/auth/EmailVerifiedPage";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import ErrorBoundary from "./components/ErrorBoundary";
import Layout from "./components/layout/Layout";
import PWAInstallBanner from "./components/PWAInstallBanner";
import PWASplashScreen from "./components/PWASplashScreen";
import { useAuth } from "./contexts/AuthContext";
import { usePushNotifications } from "./hooks/usePushNotifications";

import LandingPage    from "./pages/LandingPage";
import Contact        from "./pages/Contact";
import Dashboard      from "./pages/Dashboard";
import BrowsePros     from "./pages/BrowsePros";
import ProDetail      from "./pages/ProDetail";
import BookingFlow    from "./pages/BookingFlow";
import MyBookings     from "./pages/MyBookings";
import Messages       from "./pages/Messages";
import Support        from "./pages/Support";
import MyAccount      from "./pages/MyAccount";
import Wallet         from "./pages/Wallet";
import SubscriptionManage from "./pages/SubscriptionManage";
import TermsOfService from "./pages/TermsOfService";
import PrivacyPolicy  from "./pages/PrivacyPolicy";
import BookingDetail  from "./pages/BookingDetail";

import AdminDashboard  from "./pages/admin/AdminDashboard";
import AdminUsers      from "./pages/admin/AdminUsers";
import AdminSocieties  from "./pages/admin/AdminSocieties";
import AdminBroadcast  from "./pages/admin/AdminBroadcast";
import AdminAuditLog   from "./pages/admin/AdminAuditLog";
import AdminSettings   from "./pages/admin/AdminSettings";
import AdminServices   from "./pages/admin/AdminServices";
import AdminReviews    from "./pages/admin/AdminReviews";
import AdminWallet     from "./pages/admin/AdminWallet";
import AdminTickets    from "./pages/admin/AdminTickets";
import AdminBookings   from "./pages/admin/AdminBookings";

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <PWASplashScreen />
        <AuthProvider>
          <Routes>
          <Route path="/"               element={<LandingPage />} />
          <Route path="/login"          element={<LoginPage />} />
          <Route path="/register"       element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/email-verified" element={<EmailVerifiedPage />} />
          <Route path="/terms"          element={<TermsOfService />} />
          <Route path="/privacy"        element={<PrivacyPolicy />} />
          <Route path="/contact"        element={<Contact />} />

          <Route element={<Layout />}>
            <Route path="/dashboard"        element={<ProtectedRoute userOnly><Dashboard /></ProtectedRoute>} />
            <Route path="/browse"           element={<ProtectedRoute userOnly><BrowsePros /></ProtectedRoute>} />
            <Route path="/pro/:id"          element={<ProtectedRoute userOnly><ProDetail /></ProtectedRoute>} />
            <Route path="/book/:id"         element={<ProtectedRoute userOnly><BookingFlow /></ProtectedRoute>} />
            <Route path="/bookings"         element={<ProtectedRoute userOnly><MyBookings /></ProtectedRoute>} />
            <Route path="/bookings/:id"     element={<ProtectedRoute userOnly><BookingDetail /></ProtectedRoute>} />
            <Route path="/wallet"           element={<ProtectedRoute><Wallet /></ProtectedRoute>} />
            <Route path="/profile/subscription" element={<ProtectedRoute><SubscriptionManage /></ProtectedRoute>} />
            <Route path="/profile"          element={<Navigate to="/account" replace />} />
            <Route path="/account"          element={<ProtectedRoute><MyAccount /></ProtectedRoute>} />
            <Route path="/messages"         element={<ProtectedRoute><Messages /></ProtectedRoute>} />
            <Route path="/support"          element={<ProtectedRoute><Support /></ProtectedRoute>} />

            <Route path="/admin"                element={<ProtectedRoute adminOnly><AdminDashboard /></ProtectedRoute>} />
            <Route path="/admin/users"          element={<ProtectedRoute adminOnly><AdminUsers /></ProtectedRoute>} />
            <Route path="/admin/verifications"  element={<Navigate to="/admin/users?tab=verification" replace />} />
            <Route path="/admin/societies"      element={<ProtectedRoute adminOnly><AdminSocieties /></ProtectedRoute>} />
            <Route path="/admin/services"       element={<ProtectedRoute adminOnly><AdminServices /></ProtectedRoute>} />
            <Route path="/admin/reviews"        element={<ProtectedRoute adminOnly><AdminReviews /></ProtectedRoute>} />
            <Route path="/admin/broadcast"      element={<ProtectedRoute adminOnly><AdminBroadcast /></ProtectedRoute>} />
            <Route path="/admin/tickets"        element={<ProtectedRoute adminOnly><AdminTickets /></ProtectedRoute>} />
            <Route path="/admin/audit"          element={<ProtectedRoute adminOnly><AdminAuditLog /></ProtectedRoute>} />
            <Route path="/admin/settings"       element={<ProtectedRoute adminOnly><AdminSettings /></ProtectedRoute>} />
            <Route path="/admin/wallet"         element={<ProtectedRoute adminOnly><AdminWallet /></ProtectedRoute>} />
            <Route path="/admin/bookings"       element={<ProtectedRoute adminOnly><AdminBookings /></ProtectedRoute>} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>

        <PWAWrapper />
      </AuthProvider>
    </BrowserRouter>
    </ErrorBoundary>
  );
}

function PWAWrapper() {
  const auth = useAuth();
  
  // Initialize push notifications for logged-in users
  usePushNotifications(auth?.user?.uid);
  
  // Only show install banner when user is logged in (inside the webapp)
  // AND not on landing page
  const isLandingPage = window.location.pathname === "/";
  if (!auth?.user || isLandingPage) return null;
  return <PWAInstallBanner />;
}
