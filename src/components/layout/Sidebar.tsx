import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

/* ── SVG Icons as inline components ── */
const Icons = {
  dashboard: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  ),
  browse: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
    </svg>
  ),
  bookings: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>
    </svg>
  ),
  messages: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  ),
  profile: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  admin: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  ),
  users: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  societies: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  ),
  transactions: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
    </svg>
  ),
  collapse: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>
    </svg>
  ),
};

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { userProfile } = useAuth();
  const location = useLocation();
  const isAdmin = userProfile?.role === "admin";

  const linkClass = (path: string) => {
    const active = location.pathname === path || location.pathname.startsWith(path + "/");
    return `nav-link${active ? " active" : ""}`;
  };

  return (
    <aside className={`sidebar${collapsed ? " collapsed" : ""}`}>
      <div className="sidebar-header">
        {!collapsed && <div className="sidebar-logo">NeighborPro</div>}
        <button className="sidebar-toggle" onClick={onToggle} aria-label="Toggle sidebar">
          {Icons.collapse}
        </button>
      </div>

      <nav className="sidebar-nav">
        {!collapsed && <div className="sidebar-section-label">Menu</div>}
        <NavLink to="/dashboard" className={linkClass("/dashboard")}>
          {Icons.dashboard}
          {!collapsed && <span className="nav-link-label">Dashboard</span>}
        </NavLink>
        <NavLink to="/browse" className={linkClass("/browse")}>
          {Icons.browse}
          {!collapsed && <span className="nav-link-label">Browse Pros</span>}
        </NavLink>
        <NavLink to="/bookings" className={linkClass("/bookings")}>
          {Icons.bookings}
          {!collapsed && <span className="nav-link-label">My Bookings</span>}
        </NavLink>
        <NavLink to="/messages" className={linkClass("/messages")}>
          {Icons.messages}
          {!collapsed && <span className="nav-link-label">Messages</span>}
        </NavLink>
        <NavLink to="/profile" className={linkClass("/profile")}>
          {Icons.profile}
          {!collapsed && <span className="nav-link-label">My Profile</span>}
        </NavLink>

        {isAdmin && (
          <>
            {!collapsed && <div className="sidebar-section-label">Admin</div>}
            <NavLink to="/admin" className={linkClass("/admin")} end>
              {Icons.admin}
              {!collapsed && <span className="nav-link-label">Overview</span>}
            </NavLink>
            <NavLink to="/admin/users" className={linkClass("/admin/users")}>
              {Icons.users}
              {!collapsed && <span className="nav-link-label">Manage Users</span>}
            </NavLink>
            <NavLink to="/admin/societies" className={linkClass("/admin/societies")}>
              {Icons.societies}
              {!collapsed && <span className="nav-link-label">Societies</span>}
            </NavLink>
            <NavLink to="/admin/transactions" className={linkClass("/admin/transactions")}>
              {Icons.transactions}
              {!collapsed && <span className="nav-link-label">Transactions</span>}
            </NavLink>
          </>
        )}
      </nav>

      {!collapsed && (
        <div className="sidebar-footer">
          <div style={{ fontSize: 11, color: "var(--muted)" }}>
            © 2026 NeighborPro
          </div>
        </div>
      )}
    </aside>
  );
}
