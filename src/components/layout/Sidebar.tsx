import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

const I = {
  dashboard: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  browse: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>,
  bookings: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/></svg>,
  messages: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  wallet: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M16 12h.01"/><path d="M2 10h20"/></svg>,
  account: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  support: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  admin: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  users: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  societies: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  broadcast: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.44 2 2 0 0 1 3.6 1.26h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.84a16 16 0 0 0 6 6l.94-.94a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.73 16"/></svg>,
  audit: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  services: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>,
  reviews: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  settings: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>,
  collapse: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>,
};

interface SidebarProps { collapsed: boolean; onToggle: () => void; }

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { userProfile } = useAuth();
  const location = useLocation();
  const isAdmin = userProfile?.role === "admin";

  const lc = (path: string) => {
    const exact = path === "/dashboard" || path === "/admin";
    const active = exact
      ? location.pathname === path
      : location.pathname === path || location.pathname.startsWith(path + "/");
    return `nav-link${active ? " active" : ""}`;
  };

  const SLink = ({ to, icon, label, badge }: { to: string; icon: keyof typeof I; label: string; badge?: string }) => (
    <NavLink to={to} className={lc(to)} title={collapsed ? label : undefined} style={{ position: "relative" }}>
      {I[icon]}
      {!collapsed && <span className="nav-link-label">{label}</span>}
      {badge && !collapsed && (
        <span style={{ marginLeft: "auto", background: "linear-gradient(135deg,#1B6B8A,#0F4E68)", color: "#fff", fontSize: "0.68rem", fontWeight: 700, padding: "1px 7px", borderRadius: 50 }}>{badge}</span>
      )}
    </NavLink>
  );

  const coinBadge = userProfile?.coinBalance != null
    ? `${userProfile.coinBalance.toLocaleString("en-IN")} NC`
    : undefined;

  return (
    <aside className={`sidebar${collapsed ? " collapsed" : ""}`}>
      <div className="sidebar-header" style={{ padding: "0 16px" }}>
        {!collapsed && (
          <div className="sidebar-logo" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <img src="/images/logo.png" alt="Logo" style={{ width: "24px", height: "24px", objectFit: "contain", borderRadius: "4px" }} />
            ProNeighbour
          </div>
        )}
        <button className="sidebar-toggle" onClick={onToggle} aria-label="Toggle sidebar">{I.collapse}</button>
      </div>

      <nav className="sidebar-nav">
        {!collapsed && !isAdmin && <div className="sidebar-section-label">Menu</div>}
        {!isAdmin && (
          <>
            <SLink to="/dashboard" icon="dashboard" label="Dashboard" />
            <SLink to="/browse"   icon="browse"   label="Browse Pros" />
            <SLink to="/bookings" icon="bookings" label="My Bookings" />
            <SLink to="/messages" icon="messages" label="Messages" />
            <SLink to="/wallet"   icon="wallet"   label="Wallet" badge={coinBadge} />
            <SLink to="/account"  icon="account"  label="My Account" />
            <SLink to="/support"  icon="support"  label="Support" />
          </>
        )}

        {isAdmin && (
          <>
            {!collapsed && <div className="sidebar-section-label">Overview</div>}
            <SLink to="/admin" icon="admin" label="Dashboard" />

            {!collapsed && <div className="sidebar-section-label">Users & Content</div>}
            <SLink to="/admin/users"     icon="users"     label="Users" />
            <SLink to="/admin/societies" icon="societies" label="Societies" />
            <SLink to="/admin/services"  icon="services"  label="Services" />
            <SLink to="/admin/reviews"   icon="reviews"   label="Reviews" />

            {!collapsed && <div className="sidebar-section-label">Operations</div>}
            <SLink to="/admin/broadcast" icon="broadcast" label="Broadcast" />
            <SLink to="/admin/support"   icon="support"   label="Support" />

            {!collapsed && <div className="sidebar-section-label">Finance</div>}
            <SLink to="/admin/wallet"    icon="wallet"    label="Wallet Admin" />

            {!collapsed && <div className="sidebar-section-label">System</div>}
            <SLink to="/admin/audit"     icon="audit"     label="Audit Log" />
            <SLink to="/admin/settings"  icon="settings"  label="Settings" />
          </>
        )}
      </nav>

      {!collapsed && (
        <div className="sidebar-footer">
          <div style={{ fontSize: 11, color: "var(--muted)" }}>© 2026 ProNeighbour</div>
        </div>
      )}
    </aside>
  );
}
