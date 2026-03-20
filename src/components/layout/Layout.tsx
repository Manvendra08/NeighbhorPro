import { useState } from "react";
import { Outlet, NavLink, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import { useAuth } from "../../contexts/AuthContext";

const MobileIcons = {
  dashboard: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  browse:    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>,
  bookings:  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/></svg>,
  messages:  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  wallet:    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M16 12h.01"/><path d="M2 10h20"/></svg>,
};

// Blocker #2: banner shown to email/password users who haven't verified yet
function EmailVerificationBanner() {
  const { user, resendVerificationEmail } = useAuth();
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  // Only show for email/password accounts (Google accounts are pre-verified)
  const isEmailProvider = user?.providerData.some(p => p.providerId === "password");
  if (!user || user.emailVerified || !isEmailProvider) return null;

  const handleResend = async () => {
    setSending(true);
    await resendVerificationEmail();
    setSent(true);
    setSending(false);
  };

  return (
    <div style={{
      background: "rgba(245,105,44,0.1)", borderBottom: "1px solid rgba(245,105,44,0.25)",
      padding: "10px 24px", display: "flex", alignItems: "center",
      justifyContent: "space-between", gap: 12, flexWrap: "wrap",
      fontSize: "0.85rem",
    }}>
      <span style={{ color: "#c2410c" }}>
        ⚠️ Please verify your email address to access all features.
        Check your inbox at <strong>{user.email}</strong>.
      </span>
      <button
        onClick={handleResend}
        disabled={sending || sent}
        style={{
          background: "none", border: "1px solid rgba(245,105,44,0.5)",
          color: "#F5692C", borderRadius: 6, padding: "4px 12px",
          fontSize: "0.82rem", fontWeight: 600, cursor: sending || sent ? "default" : "pointer",
          opacity: sent ? 0.6 : 1, whiteSpace: "nowrap",
        }}
      >
        {sent ? "✓ Email sent" : sending ? "Sending…" : "Resend email"}
      </button>
    </div>
  );
}

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const isMobileActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + "/");

  return (
    <div className="app-layout">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />

      <div className={`app-main${collapsed ? " sidebar-collapsed" : ""}`}>
        <TopBar />
        <EmailVerificationBanner />
        <div className="app-content">
          <Outlet />
        </div>
      </div>

      <nav className="mobile-nav">
        <NavLink to="/dashboard" className={`mobile-nav-item${isMobileActive("/dashboard") ? " active" : ""}`}>
          {MobileIcons.dashboard}<span>Home</span>
        </NavLink>
        <NavLink to="/browse" className={`mobile-nav-item${isMobileActive("/browse") ? " active" : ""}`}>
          {MobileIcons.browse}<span>Browse</span>
        </NavLink>
        <NavLink to="/bookings" className={`mobile-nav-item${isMobileActive("/bookings") ? " active" : ""}`}>
          {MobileIcons.bookings}<span>Bookings</span>
        </NavLink>
        <NavLink to="/messages" className={`mobile-nav-item${isMobileActive("/messages") ? " active" : ""}`}>
          {MobileIcons.messages}<span>Chat</span>
        </NavLink>
        <NavLink to="/wallet" className={`mobile-nav-item${isMobileActive("/wallet") ? " active" : ""}`}>
          {MobileIcons.wallet}<span>Wallet</span>
        </NavLink>
      </nav>
    </div>
  );
}
