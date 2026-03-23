import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useDarkMode } from "../../hooks/useDarkMode";
import { usePushNotifications } from "../../hooks/usePushNotifications";

export default function TopBar() {
  const { user, userProfile, logout } = useAuth();
  const { dark, toggle: toggleDark }  = useDarkMode();
  const { permission, requestPermission } = usePushNotifications(user?.uid);
  const isAdmin   = userProfile?.role === "admin";
  const navigate  = useNavigate();
  const location  = useLocation();
  const dropRef   = useRef<HTMLDivElement>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const searchParam = new URLSearchParams(location.search).get("q") ?? "";
  const [searchValue, setSearchValue]   = useState(searchParam);

  useEffect(() => { setSearchValue(new URLSearchParams(location.search).get("q") ?? ""); }, [location.search]);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (dropRef.current && !dropRef.current.contains(e.target as Node)) setDropdownOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setSearchValue(q);
    if (q.trim()) navigate(`/browse?q=${encodeURIComponent(q.trim())}`);
    else if (location.pathname === "/browse") navigate("/browse");
  };

  const initials = (userProfile?.displayName || user?.displayName || user?.email || "?")
    .split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();

  const handleLogout = async () => { await logout(); navigate("/login"); };

  return (
    <header className="topbar">
      <div className="topbar-search">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        <input type="text" placeholder="Search professionals, services…" id="topbar-search-input" value={searchValue} onChange={handleSearch} />
      </div>

      <div className="topbar-actions" ref={dropRef}>
        {/* Dark mode toggle */}
        <button className="topbar-btn" onClick={toggleDark} title={dark ? "Light mode" : "Dark mode"} aria-label="Toggle theme">
          {dark
            ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
            : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>}
        </button>

        {/* Push notifications — prompt if not granted */}
        {permission === "default" && (
          <button className="topbar-btn" onClick={requestPermission} title="Enable notifications" aria-label="Enable push notifications">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
          </button>
        )}

        {!isAdmin && (
          <Link to="/wallet" title="Wallet" style={{ display: "flex", alignItems: "center", gap: 6, background: "linear-gradient(135deg,rgba(27,107,138,0.12),rgba(27,107,138,0.06))", border: "1px solid rgba(27,107,138,0.2)", borderRadius: 50, padding: "5px 14px", color: "#1B6B8A", textDecoration: "none", fontSize: "0.82rem", fontWeight: 700 }}>
            <span style={{ fontSize: "0.9rem" }}>🪙</span>
            {(userProfile?.coinBalance ?? 0).toLocaleString("en-IN")} NC
          </Link>
        )}

        <button className="topbar-btn" aria-label="Notifications">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
          {permission === "granted" && <span className="topbar-badge" />}
        </button>

        <div className="topbar-avatar" onClick={() => setDropdownOpen(!dropdownOpen)} title={userProfile?.displayName || user?.email || ""}>
          {user?.photoURL ? <img src={user.photoURL} alt="avatar" /> : initials}
        </div>

        {dropdownOpen && (
          <div className="user-dropdown">
            <div style={{ padding: "8px 12px", marginBottom: 4 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{userProfile?.displayName || "User"}</div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>{user?.email}</div>
            </div>
            <div className="user-dropdown-divider" />
            <Link to="/account" className="user-dropdown-item" onClick={() => setDropdownOpen(false)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              My Profile
            </Link>
            {!isAdmin && (
              <Link to="/wallet" className="user-dropdown-item" onClick={() => setDropdownOpen(false)}>
                <span style={{ fontSize: "1rem" }}>🪙</span>
                Wallet · {(userProfile?.coinBalance ?? 0).toLocaleString("en-IN")} NC
              </Link>
            )}
            <button className="user-dropdown-item" onClick={toggleDark} style={{ border: "none", cursor: "pointer", background: "none", width: "100%", textAlign: "left" }}>
              {dark ? "☀️ Light Mode" : "🌙 Dark Mode"}
            </button>
            <div className="user-dropdown-divider" />
            <button className="user-dropdown-item danger" onClick={handleLogout}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              Sign Out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

