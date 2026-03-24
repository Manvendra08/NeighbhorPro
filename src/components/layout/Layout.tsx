import { useState } from "react";
import { Outlet, NavLink, useLocation, useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import { ToastContainer } from "./Toast";
import { useAuth } from "../../contexts/AuthContext";
import { useIsMobile } from "../../hooks/useIsMobile";

const NAV = [
  {
    to: "/dashboard", label: "Home",
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
    iconActive: <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>,
  },
  {
    to: "/browse", label: "Explore",
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>,
    iconActive: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>,
  },
  {
    to: "/bookings", label: "Bookings",
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>,
    iconActive: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" fill="currentColor" fillOpacity="0.15"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>,
  },
  {
    to: "/messages", label: "Chat",
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
    iconActive: <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  },
  {
    to: "/account", label: "Profile",
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
    iconActive: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4" fill="currentColor" fillOpacity="0.2"/></svg>,
  },
];

function EmailVerificationBanner() {
  const { user, resendVerificationEmail } = useAuth();
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
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
      padding: "10px 20px", display: "flex", alignItems: "center",
      justifyContent: "space-between", gap: 12, flexWrap: "wrap", fontSize: "0.83rem",
    }}>
      <span style={{ color: "#c2410c" }}>⚠️ Verify your email — <strong>{user.email}</strong></span>
      <button onClick={handleResend} disabled={sending || sent} style={{
        background: "none", border: "1px solid rgba(245,105,44,0.5)",
        color: "#F5692C", borderRadius: 6, padding: "4px 12px",
        fontSize: "0.82rem", fontWeight: 600, cursor: sending || sent ? "default" : "pointer",
        opacity: sent ? 0.6 : 1, whiteSpace: "nowrap",
      }}>
        {sent ? "✓ Sent" : sending ? "Sending…" : "Resend"}
      </button>
    </div>
  );
}

// Mobile header — compact, contextual
function MobileHeader() {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const routeTitles: Record<string, string> = {
    "/dashboard": "ProNeighbor",
    "/browse": "Explore",
    "/bookings": "My Bookings",
    "/messages": "Messages",
    "/account": "Profile",
    "/wallet": "Wallet",
    "/support": "Support",
    "/admin": "Admin Dashboard",
    "/admin/users": "Users",
    "/admin/tickets": "Tickets",
    "/admin/disputes": "Disputes",
    "/admin/broadcast": "Broadcast",
    "/admin/services": "Services",
    "/admin/reviews": "Reviews",
    "/admin/societies": "Societies",
    "/admin/audit": "Audit Log",
    "/admin/settings": "Settings",
    "/admin/wallet": "Wallet Admin",
    "/admin/support": "Legacy Support",
  };

  const isDashboard = location.pathname === "/dashboard" || location.pathname === "/admin";
  const title = routeTitles[location.pathname] || "ProNeighbor";

  return (
    <header className="mobile-header">
      <div className="mobile-header-left">
        {isDashboard ? (
          <div className="mobile-header-brand">
            <img src="/images/logo.png" alt="PN" className="mobile-header-logo" />
            <span>ProNeighbor</span>
          </div>
        ) : (
          <h1 className="mobile-header-title">{title}</h1>
        )}
      </div>

      <div className="mobile-header-right">
        {isDashboard && (
          <button className="mobile-icon-btn" onClick={() => navigate("/browse")} aria-label="Search">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          </button>
        )}
        <button className="mobile-icon-btn" aria-label="Notifications">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
          <span className="mobile-notif-dot" />
        </button>
        <button className="mobile-avatar" onClick={() => navigate("/wallet")} title="Wallet">
          <span className="mobile-coin-badge">🪙 {(userProfile?.coinBalance ?? 0).toLocaleString("en-IN")}</span>
        </button>
      </div>
    </header>
  );
}

// Mobile bottom tab bar
function MobileTabBar() {
  const location = useLocation();
  const { userProfile } = useAuth();
  const isAdmin = userProfile?.role === "admin";

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + "/");

  const adminNav = [
    {
      to: "/admin", label: "Dashboard",
      icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
      iconActive: <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>,
    },
    {
      to: "/admin/users", label: "Users",
      icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
      iconActive: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4" fill="currentColor" fillOpacity="0.2"/></svg>,
    },
    {
      to: "/admin/tickets", label: "Tickets",
      icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z"/></svg>,
      iconActive: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z" fill="currentColor" fillOpacity="0.15"/></svg>,
    },
    {
      to: "/admin/broadcast", label: "Broadcast",
      icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.44 2 2 0 0 1 3.6 1.26h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.84a16 16 0 0 0 6 6l.94-.94a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.73 16"/></svg>,
      iconActive: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.44 2 2 0 0 1 3.6 1.26h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.84a16 16 0 0 0 6 6l.94-.94a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.73 16"/></svg>,
    },
    {
      to: "/account", label: "Profile",
      icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
      iconActive: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4" fill="currentColor" fillOpacity="0.2"/></svg>,
    },
  ];

  const nav = isAdmin ? adminNav : NAV;

  return (
    <nav className="mobile-tab-bar">
      {nav.map(item => {
        const active = isActive(item.to);
        return (
          <NavLink key={item.to} to={item.to} className={`mobile-tab-item${active ? " active" : ""}`} end={item.to === "/admin"}>
            <div className="mobile-tab-icon">
              {active ? item.iconActive : item.icon}
              {active && <span className="mobile-tab-pip" />}
            </div>
            <span className="mobile-tab-label">{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div className="mobile-shell">
        <MobileHeader />
        <EmailVerificationBanner />
        <main className="mobile-content">
          <Outlet />
        </main>
        <MobileTabBar />
        <ToastContainer />
      </div>
    );
  }

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
      <ToastContainer />
    </div>
  );
}


