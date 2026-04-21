import { Navigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useEffect, useState } from "react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  adminOnly?: boolean;
  userOnly?: boolean;
  requireVerified?: boolean;
}

export function ProtectedRoute({ children, adminOnly, userOnly, requireVerified }: ProtectedRouteProps) {
  const { user, userProfile, loading, logout } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    if (!loading && user && (userProfile?.disabled || userProfile?.deleted)) {
      setIsSigningOut(true);
      logout().finally(() => {
        setIsSigningOut(false);
      });
    }
  }, [loading, user, userProfile, logout]);

  if (loading || isSigningOut) {
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
    const reason = userProfile.deleted ? "deleted" : "disabled";
    return <Navigate to={`/login?reason=${reason}`} replace />;
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

