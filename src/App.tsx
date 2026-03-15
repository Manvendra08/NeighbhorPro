import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { LoginPage, RegisterPage } from "./components/auth/AuthPages";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import Layout from "./components/layout/Layout";

// Pages
import Dashboard from "./pages/Dashboard";
import BrowsePros from "./pages/BrowsePros";
import ProDetail from "./pages/ProDetail";
import BookingFlow from "./pages/BookingFlow";
import MyBookings from "./pages/MyBookings";
import Profile from "./pages/Profile";
import Messages from "./pages/Messages";

// Admin pages
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminSocieties from "./pages/admin/AdminSocieties";
import AdminTransactions from "./pages/admin/AdminTransactions";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Protected routes with layout shell */}
          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/browse" element={<BrowsePros />} />
            <Route path="/pro/:id" element={<ProDetail />} />
            <Route path="/book/:id" element={<BookingFlow />} />
            <Route path="/bookings" element={<MyBookings />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/messages" element={<Messages />} />

            {/* Admin routes */}
            <Route path="/admin" element={<ProtectedRoute adminOnly><AdminDashboard /></ProtectedRoute>} />
            <Route path="/admin/users" element={<ProtectedRoute adminOnly><AdminUsers /></ProtectedRoute>} />
            <Route path="/admin/societies" element={<ProtectedRoute adminOnly><AdminSocieties /></ProtectedRoute>} />
            <Route path="/admin/transactions" element={<ProtectedRoute adminOnly><AdminTransactions /></ProtectedRoute>} />
          </Route>

          {/* Redirect everything else to dashboard */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
