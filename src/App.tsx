import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { LoginPage, RegisterPage } from "./components/auth/AuthPages";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";

// Placeholder — replace with real Dashboard component
function Dashboard() {
  const { user, logout } = useAuth();
  return (
    <div style={{ padding: 40, fontFamily: "sans-serif", background: "#060b18", minHeight: "100vh", color: "#f0f4ff" }}>
      <h1>Welcome, {user?.displayName || user?.email}</h1>
      <button onClick={logout} style={{ marginTop: 16, padding: "8px 20px", cursor: "pointer" }}>
        Sign Out
      </button>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/dashboard" element={
            <ProtectedRoute><Dashboard /></ProtectedRoute>
          } />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
