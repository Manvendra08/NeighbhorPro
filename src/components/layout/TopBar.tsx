import { useState, useRef, useEffect, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import DOMPurify, { type Config as DOMPurifyConfig } from "dompurify";
import { useAuth } from "../../contexts/AuthContext";
import { useDarkMode } from "../../hooks/useDarkMode";
import { collection, query, where, orderBy, limit, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase";
import { getPublicStats } from "../../services/firestoreService";
import NotificationCenter from "./NotificationCenter";
import { useAllServicesQuery } from "../../lib/queryClient";

// ── Types ─────────────────────────────────────────────────────────────────
type BroadcastDoc = {
  id: string;
  title: string;
  body: string;
  bodyHtml?: string;
  imageUrl?: string | null;
  displayMode?: "topbar" | "popup";
  type: string;
  target: string;
  priority: string;
  targetSociety?: string | null;
  targetSocietyName?: string | null;
};

// DOMPurify config — strict allowlist, no events, no JS URLs
const PURIFY_CONFIG: DOMPurifyConfig = {
  ALLOWED_TAGS: ["b", "strong", "i", "em", "u", "p", "br", "ul", "ol", "li"],
  ALLOWED_ATTR: [],
  FORBID_CONTENTS: ["script", "style"],
};

function sanitizeBroadcastHtml(rawHtml: string): string {
  if (!rawHtml) return "";
  return String(DOMPurify.sanitize(rawHtml, PURIFY_CONFIG));
}

function isRelevantBroadcast(doc: BroadcastDoc, userProfile: ReturnType<typeof useAuth>["userProfile"]): boolean {
  if (doc.target === "All Users") return true;
  if (doc.target === "Admins Only") return userProfile?.role === "admin";
  if (doc.target === "Service Professionals") return !!userProfile?.isServiceProvider;
  if (doc.target === "Society-Specific") {
    const targetSociety = (doc.targetSociety || "").trim().toLowerCase();
    const targetSocietyName = (doc.targetSocietyName || doc.targetSociety || "").trim().toLowerCase();
    if (!targetSociety && !targetSocietyName) return false;
    const profileSociety = (userProfile?.society || "").trim().toLowerCase();
    const profileLocality = (userProfile?.locality || "").trim().toLowerCase();
    return [profileSociety, profileLocality].some(value =>
      !!value && [targetSociety, targetSocietyName].some(target => !!target && value === target)
    );
  }
  return true;
}

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
      const relevant = docs.filter(doc => isRelevantBroadcast(doc, userProfile));
      setBanners(relevant.filter(doc => (doc.displayMode || "topbar") === "topbar"));
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
              {(b.bodyHtml || b.body) ? " — " : ""}
              <span dangerouslySetInnerHTML={{ __html: sanitizeBroadcastHtml((b.bodyHtml || b.body || "").trim()) }} />
            </span>
            <button
              onClick={() => dismiss(b.id)}
              title="Dismiss"
              aria-label={`Dismiss broadcast ${b.title}`}
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

function BroadcastPopup() {
  const { userProfile } = useAuth();
  const [popups, setPopups] = useState<BroadcastDoc[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(() => {
    try {
      const raw = sessionStorage.getItem("pn_dismissed_broadcast_popups");
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
      const relevant = docs.filter(doc => isRelevantBroadcast(doc, userProfile));
      setPopups(relevant.filter(doc => (doc.displayMode || "topbar") === "popup"));
    });
    return unsub;
  }, [userProfile]);

  const visible = popups.filter(p => !dismissed.has(p.id));
  if (!visible.length) return null;

  const active = visible[0];
  const dismiss = (id: string) => {
    const next = new Set([...dismissed, id]);
    setDismissed(next);
    sessionStorage.setItem("pn_dismissed_broadcast_popups", JSON.stringify([...next]));
  };

  const priorityStyle: Record<string, { bg: string; border: string; color: string; icon: string }> = {
    urgent: { bg: "#fff1f1", border: "#ef9a9a", color: "#b71c1c", icon: "🔴" },
    high: { bg: "#fff7ed", border: "#fdba74", color: "#9a3412", icon: "🟠" },
    normal: { bg: "#f0f9ff", border: "#7dd3fc", color: "#0369a1", icon: "📣" },
  };
  const s = priorityStyle[active.priority] ?? priorityStyle.normal;

  return (
    <div style={{ position: "fixed", right: 20, bottom: 20, zIndex: 1200, maxWidth: 420, width: "calc(100vw - 40px)" }}>
      <div style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 12, boxShadow: "var(--shadow-lg)", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderBottom: `1px solid ${s.border}` }}>
          <strong style={{ color: s.color, fontSize: 13 }}>{s.icon} Broadcast</strong>
          <button onClick={() => dismiss(active.id)} aria-label={`Dismiss broadcast ${active.title}`} style={{ background: "none", border: "none", cursor: "pointer", color: s.color, fontSize: 16, lineHeight: 1 }}>✕</button>
        </div>
        <div style={{ padding: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>{active.title}</div>
          {(active.bodyHtml || active.body) && (
            <div style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.5 }} dangerouslySetInnerHTML={{ __html: sanitizeBroadcastHtml(active.bodyHtml || active.body || "") }} />
          )}
          {!!active.imageUrl && (
            <img src={active.imageUrl} alt="Broadcast" loading="lazy" style={{ marginTop: 8, width: "100%", maxHeight: 180, objectFit: "cover", borderRadius: 8, border: "1px solid var(--border)" }} />
          )}
        </div>
      </div>
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
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuItemRefs = useRef<Array<HTMLAnchorElement | HTMLButtonElement | null>>([]);
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
  const focusMenuItem = (index: number) => {
    const items = menuItemRefs.current.filter(Boolean);
    if (items.length === 0) return;
    items[((index % items.length) + items.length) % items.length]?.focus();
  };

  useEffect(() => {
    if (!dropdownOpen) return;
    requestAnimationFrame(() => focusMenuItem(0));
  }, [dropdownOpen]);

  const handleMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const items = menuItemRefs.current.filter(Boolean);
    if (items.length === 0) return;

    const currentIndex = items.findIndex(item => item === document.activeElement);
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusMenuItem(currentIndex + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusMenuItem(currentIndex <= 0 ? items.length - 1 : currentIndex - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusMenuItem(0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusMenuItem(items.length - 1);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setDropdownOpen(false);
      menuButtonRef.current?.focus();
    }
  };

  return (
    <>
      <BroadcastPopup />
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

          <button
            className="topbar-avatar"
            type="button"
            ref={menuButtonRef}
            onClick={() => setDropdownOpen(!dropdownOpen)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setDropdownOpen(true);
              } else if (event.key === "Escape") {
                setDropdownOpen(false);
              }
            }}
            title={userProfile?.displayName || user?.email || ""}
            aria-label="Open user menu"
            aria-haspopup="menu"
          >
            {user?.photoURL ? <img src={user.photoURL} alt="avatar" loading="lazy" /> : initials}
          </button>

          {dropdownOpen && (
            <div className="user-dropdown" role="menu" aria-label="User menu" onKeyDown={handleMenuKeyDown}>
              <div style={{ padding: "8px 12px", marginBottom: 4 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{userProfile?.displayName || "User"}</div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>{user?.email}</div>
              </div>
              <div className="user-dropdown-divider" />
              <Link to="/account" className="user-dropdown-item" role="menuitem" ref={node => { menuItemRefs.current[0] = node; }} onClick={() => setDropdownOpen(false)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                My Profile
              </Link>
              {!isAdmin && (
                <Link to="/wallet" className="user-dropdown-item" role="menuitem" ref={node => { menuItemRefs.current[1] = node; }} onClick={() => setDropdownOpen(false)}>
                  <span style={{ fontSize: "1rem" }}>🪙</span>
                  Wallet · {(userProfile?.coinBalance ?? 0).toLocaleString("en-IN")} NC
                </Link>
              )}
              <button
                className="user-dropdown-item"
                role="menuitem"
                ref={node => { menuItemRefs.current[isAdmin ? 1 : 2] = node; }}
                onClick={toggleDark}
                style={{ border: "none", cursor: "pointer", background: "none", width: "100%", textAlign: "left" }}
              >
                {dark ? "☀️ Light Mode" : "🌙 Dark Mode"}
              </button>
              <div className="user-dropdown-divider" />
              <button className="user-dropdown-item danger" role="menuitem" ref={node => { menuItemRefs.current[isAdmin ? 2 : 3] = node; }} onClick={handleLogout}>
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
  const { data: servicesResult } = useAllServicesQuery();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const msgs: string[] = [];

        const stats = await getPublicStats();
        if (stats.totalUsers > 0) msgs.push(`${stats.totalUsers.toLocaleString()}+ neighbors are using ProNeighbor right now!`);

        if (servicesResult?.data.length) {
          const hot = servicesResult.data.slice(0, 3).map((s: Record<string, unknown>) => (s.title || (s.name as string)) as string).join(", ");
          msgs.push(`🔥 Hot Services: ${hot}`);
        }

        if (msgs.length > 0) setMessages(msgs);
      } catch {
        // silently ignore
      }
    };
    fetchData();
  }, [servicesResult]);

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
