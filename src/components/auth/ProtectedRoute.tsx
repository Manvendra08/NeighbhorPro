import { Navigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
  adminOnly?: boolean;
  userOnly?: boolean;
  requireVerified?: boolean;
}

export function ProtectedRoute({ children, adminOnly, userOnly, requireVerified }: ProtectedRouteProps) {
  const { user, userProfile, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--surface)", // respects dark/light mode
      }}>
        <div className="loader" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (userProfile?.disabled || userProfile?.deleted) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && userProfile?.role !== "admin") {
    return <Navigate to="/dashboard" replace />;
  }
  if (userOnly && userProfile?.role === "admin") {
    return <Navigate to="/admin" replace />;
  }

  if (requireVerified && userProfile?.role !== "admin") {
    const isPasswordProvider = user.providerData?.some(p => p.providerId === "password");
    const isEmailApprovedByAdmin = userProfile?.emailVerified === true;
    if (isPasswordProvider && !user.emailVerified && !isEmailApprovedByAdmin) {
      return <Navigate to="/dashboard?verifyEmail=1" replace />;
    }
  }

  return <>{children}</>;
}

