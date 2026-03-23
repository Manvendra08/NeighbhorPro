import { useEffect, useMemo, useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  getBookingsForUser,
  getBookingsForPro,
  getTransactionsForPro,
  formatTimestamp,
  formatTimestampTime,
  subscribeToFeed,
  createFeedPost,
  deleteFeedPost,
  getRecommendedPros,
  getLastBookedPro,
  getUserProfile,
} from "../services/firestoreService";
import { Timestamp } from "firebase/firestore";
import { useIsMobile } from "../hooks/useIsMobile";
import { relativeTime, greetingByTime } from "../utils/time";

const ICON = {
  bookings: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>,
  requests: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  rating:   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  earnings: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  skills:   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>,
};

// ─── Local Feed Widget ──────────────────────────────────────────────────────
function LocalFeedWidget({ uid, displayName, locality }: { uid: string; displayName: string; locality?: string }) {
  const [posts, setPosts] = useState<Record<string, unknown>[]>([]);
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const unsub = subscribeToFeed(locality, setPosts);
    return unsub;
  }, [locality]);

  const handlePost = async () => {
    if (!text.trim() || posting) return;
    setPosting(true);
    try {
      await createFeedPost({ authorId: uid, authorName: displayName, content: text.trim(), locality });
      setText("");
    } finally { setPosting(false); }
  };

  const handleDelete = async (postId: string) => {
    if (!confirm("Delete this post?")) return;
    await deleteFeedPost(postId);
  };

  // relTime is now imported from ../utils/time as relativeTime

  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <div className="card-header">
        <h3 className="card-title">📣 Local Feed{locality ? ` — ${locality}` : ""}</h3>
      </div>
      {/* Compose */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <textarea
          ref={textRef}
          className="form-input"
          placeholder="Share something with your neighborhood…"
          value={text}
          onChange={e => setText(e.target.value)}
          rows={2}
          style={{ flex: 1, resize: "none", fontSize: 13 }}
        />
        <button className="btn btn-primary" style={{ alignSelf: "flex-end" }} disabled={!text.trim() || posting} onClick={handlePost}>
          {posting ? "…" : "Post"}
        </button>
      </div>
      {/* Posts */}
      {posts.length === 0 ? (
        <p className="text-muted" style={{ fontSize: 13 }}>No posts yet. Be the first to share something!</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {posts.map(p => (
            <div key={p.id as string} style={{ padding: "12px 14px", background: "var(--surface-2)", borderRadius: "var(--radius-sm)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <span style={{ fontWeight: 600, fontSize: 13 }}>{(p.authorName as string) || "Neighbor"}</span>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>{relativeTime(p.createdAt)}</span>
                  {(p.authorId as string) === uid && (
                    <button onClick={() => handleDelete(p.id as string)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--error)", fontSize: 12 }}>✕</button>
                  )}
                </div>
              </div>
              <p style={{ fontSize: 13, color: "var(--text-2)", margin: 0 }}>{p.content as string}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Recommended Pros Widget ───────────────────────────────────────────────
function RecommendedPros({ uid }: { uid: string }) {
  const navigate = useNavigate();
  const [pros, setPros] = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    getRecommendedPros(uid, 4).then(setPros).catch(() => {});
  }, [uid]);

  if (!pros.length) return null;

  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <div className="card-header">
        <h3 className="card-title">⭐ Recommended for You</h3>
        <Link to="/browse" className="btn btn-ghost btn-sm">See all</Link>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
        {pros.map(p => {
          const initials = ((p.displayName as string) || "?").split(" ").map((w: string) => w[0]).join("").slice(0,2).toUpperCase();
          return (
            <div key={p.uid as string} onClick={() => navigate(`/pro/${p.uid}`)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "14px 10px", background: "var(--surface-2)", borderRadius: "var(--radius-sm)", cursor: "pointer", transition: "background 0.2s" }}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--accent-dim)")}
              onMouseLeave={e => (e.currentTarget.style.background = "var(--surface-2)")}
            >
              <div className="avatar avatar-sm">
                {(p.photoURL as string) ? <img src={p.photoURL as string} alt="" /> : initials}
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 2 }}>{(p.displayName as string) || "Pro"}</div>
                {(p.rating as number) ? (
                  <div style={{ fontSize: 11, color: "var(--warning)" }}>★ {(p.rating as number).toFixed(1)}</div>
                ) : null}
              </div>
              <button className="btn btn-primary btn-xs" style={{ fontSize: 11, padding: "2px 10px" }}>Book</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Mobile Dashboard ──────────────────────────────────────────────────────
function MobileDashboard({
  userProfile, user, upcomingBookings, proBookings, loading,
}: {
  userProfile: Record<string, unknown> | null;
  user: unknown;
  upcomingBookings: Record<string, unknown>[];
  proBookings: Record<string, unknown>[];
  loading: boolean;
}) {
  const navigate = useNavigate();
  const firstName = ((userProfile as { displayName?: string } | null)?.displayName || (user as { displayName?: string } | null)?.displayName || "there").split(" ")[0];
  const coins = (userProfile as { coinBalance?: number } | null)?.coinBalance ?? 0;

  const quickActions = [
    { icon: "🔍", label: "Find a Pro", to: "/browse", color: "#1B6B8A" },
    { icon: "📅", label: "My Bookings", to: "/bookings", color: "#D45C3B" },
    { icon: "💬", label: "Messages", to: "/messages", color: "#5B7A5B" },
    { icon: "🪙", label: "Wallet", to: "/wallet", color: "#C4882A" },
    { icon: "👤", label: "My Profile", to: "/account", color: "#6B4E8A" },
    { icon: "❓", label: "Support", to: "/support", color: "#4A6B8A" },
  ];

  return (
    <div className="mobile-dashboard">

      {/* ── Hero greeting ── */}
      <div className="m-hero">
        <div className="m-hero-text">
          <p className="m-hero-greeting">{greetingByTime()} 👋</p>
          <h2 className="m-hero-name">{firstName}</h2>
        </div>
        <Link to="/wallet" className="m-coin-chip">
          <span>🪙</span>
          <span>{coins.toLocaleString("en-IN")} NC</span>
        </Link>
      </div>

      {/* ── Pending action cards (if any) ── */}
      {!loading && (upcomingBookings.length > 0 || proBookings.length > 0) && (
        <div className="m-section">
          <div className="m-section-row">
            <span className="m-section-label">Action Needed</span>
            <Link to="/bookings" className="m-section-link">See all</Link>
          </div>
          <div className="m-action-cards">
            {upcomingBookings.slice(0, 2).map(b => (
              <div key={b.id as string} className="m-action-card" onClick={() => navigate("/bookings")}>
                <div className="m-action-card-icon" style={{ background: "rgba(27,107,138,0.1)", color: "#1B6B8A" }}>📅</div>
                <div className="m-action-card-body">
                  <div className="m-action-card-title">{(b.serviceCategory as string) ? `${(b.serviceName as string) || "Consultation"} (${(b.serviceCategory as string)})` : ((b.serviceName as string) || "Consultation")}</div>
                  <div className="m-action-card-sub">{(b.date as string) || "Upcoming"} · {(b.timeSlot as string) || ""}</div>
                </div>
                <span className={`badge ${b.status === "confirmed" ? "badge-success" : "badge-warning"}`} style={{ fontSize: 10 }}>{b.status as string}</span>
              </div>
            ))}
            {proBookings.slice(0, 1).map(b => (
              <div key={b.id as string} className="m-action-card" onClick={() => navigate("/bookings")}>
                <div className="m-action-card-icon" style={{ background: "rgba(212,92,59,0.1)", color: "#D45C3B" }}>🔔</div>
                <div className="m-action-card-body">
                  <div className="m-action-card-title">New request from {(b.clientName as string) || "client"}</div>
                  <div className="m-action-card-sub">{(b.serviceCategory as string) ? `${(b.serviceName as string) || "Consultation"} (${(b.serviceCategory as string)})` : ((b.serviceName as string) || "Consultation")}</div>
                </div>
                <span className="badge badge-accent" style={{ fontSize: 10 }}>Pending</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Quick actions grid ── */}
      <div className="m-section">
        <span className="m-section-label">Quick Actions</span>
        <div className="m-quick-grid">
          {quickActions.map(a => (
            <Link key={a.to} to={a.to} className="m-quick-item">
              <div className="m-quick-icon" style={{ background: a.color + "18", color: a.color }}>{a.icon}</div>
              <span className="m-quick-label">{a.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Stats strip ── */}
      <div className="m-section">
        <span className="m-section-label">Overview</span>
        <div className="m-stats-strip">
          <div className="m-stat">
            <span className="m-stat-value">{loading ? "…" : upcomingBookings.length}</span>
            <span className="m-stat-label">Upcoming</span>
          </div>
          <div className="m-stat-divider" />
          <div className="m-stat">
            <span className="m-stat-value">{loading ? "…" : proBookings.length}</span>
            <span className="m-stat-label">Requests</span>
          </div>
          <div className="m-stat-divider" />
          <div className="m-stat">
            <span className="m-stat-value">{(userProfile as { rating?: number } | null)?.rating ? `${(userProfile as { rating: number }).rating}★` : "—"}</span>
            <span className="m-stat-label">Rating</span>
          </div>
          <div className="m-stat-divider" />
          <div className="m-stat">
            <span className="m-stat-value">{coins.toLocaleString("en-IN")}</span>
            <span className="m-stat-label">Coins</span>
          </div>
        </div>
      </div>

      {/* ── Browse CTA ── */}
      <div className="m-section">
        <Link to="/browse" className="m-browse-cta">
          <div>
            <div className="m-browse-cta-title">Find experts near you</div>
            <div className="m-browse-cta-sub">CAs, Doctors, Tutors & more</div>
          </div>
          <span className="m-browse-cta-arrow">→</span>
        </Link>
      </div>

    </div>
  );
}

// ─── Desktop Dashboard (unchanged) ────────────────────────────────────────
function DesktopDashboard({
  userProfile, user, upcomingBookings, proBookings,
  earningsSummary, proTransactions, loading,
}: {
  userProfile: Record<string, unknown> | null;
  user: Record<string, unknown> | null;
  upcomingBookings: Record<string, unknown>[];
  proBookings: Record<string, unknown>[];
  earningsSummary: { lifetime: number; thisMonth: number; lastMonth: number };
  proTransactions: Record<string, unknown>[];
  loading: boolean;
}) {
  const stats = [
    {
      label: "Upcoming Bookings",
      value: upcomingBookings.length,
      icon: ICON.bookings,
      color: "var(--accent)",
      action: upcomingBookings.length === 0 ? { label: "Book Now", to: "/browse" } : null,
    },
    {
      label: "Client Requests",
      value: proBookings.length,
      icon: ICON.requests,
      color: "var(--accent2)",
      action: proBookings.length === 0 ? { label: "Manage", to: "/bookings" } : null,
    },
    {
      label: "Rating",
      value: (userProfile as { rating?: number } | null)?.rating ? `${(userProfile as { rating: number }).rating} ★` : 0,
      icon: ICON.rating,
      color: "var(--warning)",
      action: !(userProfile as { rating?: number } | null)?.rating ? { label: "My Profile", to: "/profile" } : null,
    },
    (userProfile as { isServiceProvider?: boolean } | null)?.isServiceProvider
      ? {
        label: "Lifetime Earnings",
        value: `₹${earningsSummary.lifetime.toLocaleString()}`,
        icon: ICON.earnings,
        color: "var(--accent2)",
        action: earningsSummary.lifetime === 0 ? { label: "Get Paid", to: "/profile" } : null,
      }
      : {
        label: "Skills Listed",
        value: (userProfile as { skills?: string[] } | null)?.skills?.length || 0,
        icon: ICON.skills,
        color: "var(--error)",
        action: ((userProfile as { skills?: string[] } | null)?.skills?.length || 0) === 0 ? { label: "Add Skills", to: "/profile" } : null,
      },
  ];

  return (
    <div>
      <div className="page-header" style={{
        backgroundImage: "linear-gradient(to right, rgba(15,23,42,0.85), rgba(15,23,42,0.5)), url('/images/hero_banner.png')",
        backgroundSize: "cover", backgroundPosition: "top center",
        padding: "48px 32px", borderRadius: "var(--radius-lg)",
      }}>
        <div>
          <h1 className="page-title" style={{ color: "white" }}>
            Welcome back, {(userProfile as { displayName?: string } | null)?.displayName || (user as { displayName?: string } | null)?.displayName || "there"} 👋
          </h1>
          <p className="page-subtitle" style={{ color: "rgba(255,255,255,0.9)" }}>Here's what's happening in your neighborhood</p>
        </div>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 32 }}>
        {stats.map(s => (
          <div className="stat-card" key={s.label}>
            <div className="stat-card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div className="stat-icon" style={{ background: s.color, color: "white" }}>{s.icon}</div>
              {s.action && <Link to={s.action.to} className="btn btn-ghost btn-xs" style={{ fontSize: 10, padding: "2px 8px" }}>{s.action.label}</Link>}
            </div>
            <div>
              <div className="stat-value">{loading ? "…" : s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-2" style={{ marginBottom: 32 }}>
        <Link to="/browse" className="card" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 16, cursor: "pointer" }}>
          <div style={{ fontSize: 32 }}>🔍</div>
          <div><h3 style={{ marginBottom: 4 }}>Browse Professionals</h3><p className="text-muted text-sm">Find experts in your community</p></div>
        </Link>
        <Link to="/profile" className="card" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 16, cursor: "pointer" }}>
          <div style={{ fontSize: 32 }}>✨</div>
          <div><h3 style={{ marginBottom: 4 }}>Update Your Profile</h3><p className="text-muted text-sm">Add skills and start offering services</p></div>
        </Link>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <h3 className="card-title">Upcoming Bookings</h3>
          <Link to="/bookings" className="btn btn-ghost btn-sm">View All</Link>
        </div>
        {loading ? (
          <div style={{ textAlign: "center", padding: 32 }}><div className="loader" style={{ margin: "0 auto" }} /></div>
        ) : upcomingBookings.length === 0 ? (
          <div className="empty-state" style={{ padding: "32px 20px" }}>
            <div className="empty-state-icon">📅</div>
            <div className="empty-state-title">No upcoming bookings</div>
            <div className="empty-state-desc">Browse professionals and book a consultation to get started</div>
            <Link to="/browse" className="btn btn-primary btn-sm" style={{ marginTop: 8 }}>Browse Pros</Link>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {upcomingBookings.slice(0, 5).map(b => (
              <div key={b.id as string} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", background: "var(--surface-2)", borderRadius: "var(--radius-sm)" }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{(b.serviceCategory as string) ? `${(b.serviceName as string) || "Consultation"} (${b.serviceCategory as string})` : ((b.serviceName as string) || "Consultation")}</div>
                  <div className="text-muted text-sm">{(b.date as string) || formatTimestamp(b.createdAt)} · {(b.timeSlot as string) || "TBD"}</div>
                </div>
                <span className={`badge ${b.status === "confirmed" ? "badge-success" : "badge-warning"}`}>{(b.status as string) || "pending"}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {proBookings.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Incoming Client Requests</h3>
            <Link to="/bookings" className="btn btn-ghost btn-sm">Manage</Link>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {proBookings.slice(0, 5).map(b => (
              <div key={b.id as string} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", background: "var(--surface-2)", borderRadius: "var(--radius-sm)" }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{(b.serviceCategory as string) ? `${(b.serviceName as string) || "Consultation"} (${(b.serviceCategory as string)})` : ((b.serviceName as string) || "Consultation")}</div>
                  <div className="text-muted text-sm">{(b.clientName as string) || "Client"}</div>
                </div>
                <span className="badge badge-accent">{(b.status as string) || "pending"}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {(userProfile as { isServiceProvider?: boolean } | null)?.isServiceProvider && (
        <div className="card" style={{ marginTop: 24 }}>
          <div className="card-header">
            <h3 className="card-title">Earnings Overview</h3>
            <span className="badge badge-muted">{proTransactions.length} payout{proTransactions.length === 1 ? "" : "s"}</span>
          </div>
          {proTransactions.length === 0 ? (
            <p className="text-muted">No paid consultations yet.</p>
          ) : (
            <>
              <div className="grid grid-3" style={{ marginBottom: 16 }}>
                <div className="stat-card"><div className="stat-icon" style={{ background: "var(--accent2-dim)", color: "var(--accent2)" }}>💰</div><div className="stat-value">₹{earningsSummary.lifetime.toLocaleString()}</div><div className="stat-label">Lifetime</div></div>
                <div className="stat-card"><div className="stat-icon" style={{ background: "var(--accent-dim)", color: "var(--accent)" }}>📆</div><div className="stat-value">₹{earningsSummary.thisMonth.toLocaleString()}</div><div className="stat-label">This Month</div></div>
                <div className="stat-card"><div className="stat-icon" style={{ background: "rgba(255,179,71,0.1)", color: "var(--warning)" }}>📅</div><div className="stat-value">₹{earningsSummary.lastMonth.toLocaleString()}</div><div className="stat-label">Last Month</div></div>
              </div>
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Date</th><th>Service</th><th>Client</th><th>Amount</th><th>Your Earning</th></tr></thead>
                  <tbody>
                    {proTransactions.slice(0, 10).map(t => (
                      <tr key={t.id as string}>
                        <td>{formatTimestamp(t.createdAt)} <span className="text-muted text-sm">{formatTimestampTime(t.createdAt)}</span></td>
                        <td>{(t.serviceName as string) || "Consultation"}</td>
                        <td>{(t.clientName as string) || "—"}</td>
                        <td>₹{((t.amount as number) || 0).toLocaleString()}</td>
                        <td style={{ color: "var(--accent2)", fontWeight: 500 }}>₹{((t.proEarning as number) || 0).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main export ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const { user, userProfile } = useAuth();
  const isMobile = useIsMobile();
  const [upcomingBookings, setUpcomingBookings] = useState<Record<string, unknown>[]>([]);
  const [proBookings, setProBookings] = useState<Record<string, unknown>[]>([]);
  const [proTransactions, setProTransactions] = useState<Record<string, unknown>[]>([]);
  const [lastBookedPro, setLastBookedPro] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const locality = (userProfile as { locality?: string } | null)?.locality;
  const displayName = (userProfile as { displayName?: string } | null)?.displayName ||
    (user as { displayName?: string } | null)?.displayName || "there";

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const [client, pro] = await Promise.all([getBookingsForUser(user.uid), getBookingsForPro(user.uid)]);
        setUpcomingBookings(client.filter(b => b.status === "pending" || b.status === "confirmed"));
        setProBookings(pro.filter(b => b.status === "pending" || b.status === "confirmed"));
        // Load quick re-book
        const lastProId = await getLastBookedPro(user.uid);
        if (lastProId) {
          const profile = await getUserProfile(lastProId);
          if (profile) setLastBookedPro(profile);
        }
      } catch { /* ignore */ }
      setLoading(false);
    };
    load();
  }, [user]);

  useEffect(() => {
    if (!user || (userProfile as { isServiceProvider?: boolean } | null)?.isServiceProvider !== true) return;
    getTransactionsForPro(user.uid).then(setProTransactions).catch(() => {});
  }, [user, userProfile]);

  const earningsSummary = useMemo(() => {
    if (!proTransactions.length) return { lifetime: 0, thisMonth: 0, lastMonth: 0 };
    const now = new Date();
    const thisMonthKey = `${now.getFullYear()}-${now.getMonth()}`;
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthKey = `${lastMonthDate.getFullYear()}-${lastMonthDate.getMonth()}`;
    let lifetime = 0, thisMonth = 0, lastMonth = 0;
    proTransactions.forEach(t => {
      const amount = (t.proEarning as number) || 0;
      const ts = t.createdAt;
      lifetime += amount;
      if (ts instanceof Timestamp) {
        const d = ts.toDate();
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        if (key === thisMonthKey) thisMonth += amount;
        if (key === lastMonthKey) lastMonth += amount;
      }
    });
    return { lifetime, thisMonth, lastMonth };
  }, [proTransactions]);

  if (isMobile) {
    return (
      <MobileDashboard
        userProfile={userProfile as Record<string, unknown> | null}
        user={user as Record<string, unknown> | null}
        upcomingBookings={upcomingBookings}
        proBookings={proBookings}
        loading={loading}
      />
    );
  }

  return (
    <>
      <DesktopDashboard
        userProfile={userProfile as Record<string, unknown> | null}
        user={user as Record<string, unknown> | null}
        upcomingBookings={upcomingBookings}
        proBookings={proBookings}
        earningsSummary={earningsSummary}
        proTransactions={proTransactions}
        loading={loading}
      />

      {/* Quick Re-book Banner */}
      {lastBookedPro && !loading && (
        <div style={{ background: "linear-gradient(135deg, var(--accent-dim), var(--surface-2))", borderRadius: "var(--radius)", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, border: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div className="avatar avatar-sm">
              {(lastBookedPro.photoURL as string) ? <img src={lastBookedPro.photoURL as string} alt="" /> : ((lastBookedPro.displayName as string) || "?").slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>Quick Re-book</div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>Last consulted: {(lastBookedPro.displayName as string) || "Professional"}</div>
            </div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => navigate(`/book/${lastBookedPro.uid as string}`)}>
            Book Again →
          </button>
        </div>
      )}

      {/* Recommended Pros */}
      {user && <RecommendedPros uid={user.uid} />}

      {/* Local Feed */}
      {user && <LocalFeedWidget uid={user.uid} displayName={displayName} locality={locality} />}
    </>
  );
}

