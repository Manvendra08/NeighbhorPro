import { useState } from "react";
import { Outlet, NavLink, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";

/* Mobile nav icons */
const MobileIcons = {
  dashboard: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  ),
  browse: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
    </svg>
  ),
  bookings: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>
    </svg>
  ),
  messages: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  ),
  profile: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>
  ),
};

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
        <div className="app-content">
          <Outlet />
        </div>
      </div>

      {/* Mobile bottom navigation */}
      <nav className="mobile-nav">
        <NavLink to="/dashboard" className={`mobile-nav-item${isMobileActive("/dashboard") ? " active" : ""}`}>
          {MobileIcons.dashboard}
          <span>Home</span>
        </NavLink>
        <NavLink to="/browse" className={`mobile-nav-item${isMobileActive("/browse") ? " active" : ""}`}>
          {MobileIcons.browse}
          <span>Browse</span>
        </NavLink>
        <NavLink to="/bookings" className={`mobile-nav-item${isMobileActive("/bookings") ? " active" : ""}`}>
          {MobileIcons.bookings}
          <span>Bookings</span>
        </NavLink>
        <NavLink to="/messages" className={`mobile-nav-item${isMobileActive("/messages") ? " active" : ""}`}>
          {MobileIcons.messages}
          <span>Chat</span>
        </NavLink>
        <NavLink to="/profile" className={`mobile-nav-item${isMobileActive("/profile") ? " active" : ""}`}>
          {MobileIcons.profile}
          <span>Profile</span>
        </NavLink>
      </nav>
    </div>
  );
}
