import { useState, useRef, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useDarkMode } from "../../hooks/useDarkMode";
import { collection, query, where, orderBy, limit, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase";
import { getAllUsers, getAllServices } from "../../services/firestoreService";
import NotificationCenter from "./NotificationCenter";

// ── Types ─────────────────────────────────────────────────────────────────
type BroadcastDoc = {
  id: string;
  title: string;
  body: string;
  type: string;
  target: string;
  priority: string;
  targetSociety?: string | null;
};

// ── Broadcast Flash Banner ─────────────────────────────────────────────────
// Sits above the TopBar; real-time, audience-filtered, dismissable per session.
function BroadcastBanner() {
  const { userProfile } = useAuth();
  const [banners, setBanners] = useState<BroadcastDoc[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(() => {
    try {
      const raw = sessionStorage.getItem("pn_dismissed_broadcasts");
      return raw ? new Set(JSON.parse(raw)) : new Set<string>();
    } catch {
      return new Set<string>();
    }
  });

  useEffect(() => {
    const q = query(
      collection(db, "announcements"),
      where("status", "==", "active"),
      orderBy("createdAt", "desc"),
      limit(10)
    );
    const unsub = onSnapshot(q, snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as BroadcastDoc));
      const relevant = docs.filter(doc => {
        if (doc.target === "All Users") return true;
        if (doc.target === "Admins Only") return userProfile?.role === "admin";
        if (doc.target === "Service Professionals") return !!userProfile?.isServiceProvider;
        if (doc.target === "Society-Specific") {
          return !!doc.targetSociety && (
            userProfile?.society === doc.targetSociety ||
            userProfile?.locality === doc.targetSociety
          );
        }
        return true;
      });
      setBanners(relevant);
    });
    return unsub;
  }, [userProfile]);

  const visible = banners.filter(b => !dismissed.has(b.id));
  if (!visible.length) return null;

  const dismiss = (id: string) => {
    const next = new Set([...dismissed, id]);
    setDismissed(next);
    sessionStorage.setItem("pn_dismissed_broadcasts", JSON.stringify([...next]));
  };

  const priorityStyle: Record<string, { bg: string; border: string; color: string; icon: string }> = {
    urgent: { bg: "rgba(220,38,38,0.11)", border: "rgba(220,38,38,0.38)", color: "#dc2626", icon: "🔴" },
    high: { bg: "rgba(234,88,12,0.09)", border: "rgba(234,88,12,0.32)", color: "#ea580c", icon: "🟠" },
    normal: { bg: "rgba(27,107,138,0.09)", border: "rgba(27,107,138,0.28)", color: "var(--accent)", icon: "📣" },
  };

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {visible.map(b => {
        const s = priorityStyle[b.priority] ?? priorityStyle.normal;
        return (
          <div
            key={b.id}
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              background: s.bg, borderBottom: `1px solid ${s.border}`,
              padding: "7px 20px", gap: 12, fontSize: "0.82rem", lineHeight: 1.4,
            }}
          >
            <span style={{ color: s.color, fontWeight: 600, flex: 1, minWidth: 0 }}>
              {s.icon}&nbsp;
              <strong>{b.title}</strong>
              {b.body ? ` — ${b.body}` : ""}
            </span>
            <button
              onClick={() => dismiss(b.id)}
              title="Dismiss"
              style={{
                flexShrink: 0, background: "none", border: "none",
                cursor: "pointer", color: s.color, opacity: 0.65,
                fontSize: 15, lineHeight: 1, padding: "0 2px",
              }}
            >✕</button>
          </div>
        );
      })}
    </div>
  );
}

// ── TopBar ─────────────────────────────────────────────────────────────────
export default function TopBar() {
  const { user, userProfile, logout } = useAuth();
  const { dark, toggle: toggleDark } = useDarkMode();
  const isAdmin = userProfile?.role === "admin";
  const navigate = useNavigate();
  const dropRef = useRef<HTMLDivElement>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setDropdownOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const initials = (userProfile?.displayName || user?.displayName || user?.email || "?")
    .split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();

  const handleLogout = async () => { await logout(); navigate("/login"); };

  return (
    <>
      <BroadcastBanner />
      <header className="topbar">
        <div className="topbar-left">
          <MessageTicker />
        </div>

        <div className="topbar-actions" ref={dropRef}>
          {!isAdmin && (
            <Link
              to="/wallet"
              title="Wallet"
              style={{
                display: "flex", alignItems: "center", gap: 6,
                background: "linear-gradient(135deg,rgba(27,107,138,0.12),rgba(27,107,138,0.06))",
                border: "1px solid rgba(27,107,138,0.2)", borderRadius: 50,
                padding: "5px 14px", color: "#1B6B8A", textDecoration: "none",
                fontSize: "0.82rem", fontWeight: 700,
              }}
            >
              <span style={{ fontSize: "0.9rem" }}>🪙</span>
              {(userProfile?.coinBalance ?? 0).toLocaleString("en-IN")} NC
            </Link>
          )}

          <NotificationCenter />

          <div
            className="topbar-avatar"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            title={userProfile?.displayName || user?.email || ""}
          >
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
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                My Profile
              </Link>
              {!isAdmin && (
                <Link to="/wallet" className="user-dropdown-item" onClick={() => setDropdownOpen(false)}>
                  <span style={{ fontSize: "1rem" }}>🪙</span>
                  Wallet · {(userProfile?.coinBalance ?? 0).toLocaleString("en-IN")} NC
                </Link>
              )}
              <button
                className="user-dropdown-item"
                onClick={toggleDark}
                style={{ border: "none", cursor: "pointer", background: "none", width: "100%", textAlign: "left" }}
              >
                {dark ? "☀️ Light Mode" : "🌙 Dark Mode"}
              </button>
              <div className="user-dropdown-divider" />
              <button className="user-dropdown-item danger" onClick={handleLogout}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                Sign Out
              </button>
            </div>
          )}
        </div>
      </header>
    </>
  );
}

// ── Message Ticker (platform stats / non-broadcast messages) ───────────────
function MessageTicker() {
  const [messages, setMessages] = useState<string[]>(["Welcome to ProNeighbor!"]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const msgs: string[] = [];

        const userRes = await getAllUsers();
        if (userRes.data.length > 0) msgs.push(`${userRes.data.length} neighbors are using ProNeighbor right now!`);

        const svcRes = await getAllServices();
        if (svcRes.data.length > 0) {
          const hot = svcRes.data.slice(0, 3).map((s: Record<string, unknown>) => (s.title || s.name) as string).join(", ");
          msgs.push(`🔥 Hot Services: ${hot}`);
        }

        if (msgs.length > 0) setMessages(msgs);
      } catch {
        // silently ignore
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (messages.length <= 1) return;
    const timer = setInterval(() => setIndex(prev => (prev + 1) % messages.length), 6000);
    return () => clearInterval(timer);
  }, [messages]);

  return (
    <div className="topbar-ticker">
      <div className="ticker-content" key={index}>{messages[index]}</div>
    </div>
  );
}
