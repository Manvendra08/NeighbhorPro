import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  getBookingsForUser,
  getBookingsForPro,
  subscribeToFeed,
  createFeedPost,
  deleteFeedPost,
  getRecommendedPros,
  getLastCompletedBookingForUser,
  getUserProfile,
} from "../services/firestoreService";
import { useIsMobile } from "../hooks/useIsMobile";
import { relativeTime, greetingByTime } from "../utils/time";
import LoyaltyStreakWidget from "../components/LoyaltyStreakWidget";
import { buildRecurringRebookQuery, getLoyaltyPreview, type LoyaltyPreview } from "../services/loyaltyService";

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

  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <div className="card-header">
        <h3 className="card-title">📣 Local Feed{locality ? ` — ${locality}` : ""}</h3>
      </div>
      <div style={{ display: "flex", gap: 10, marginBottom: 16, padding: "0 16px" }}>
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
      <div style={{ padding: "0 16px 16px" }}>
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
    </div>
  );
}

// ─── Recommended Pros Widget ───────────────────────────────────────────────
function RecommendedPros({ uid }: { uid: string }) {
  const navigate = useNavigate();
  const [pros, setPros] = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    getRecommendedPros(uid, 4).then(setPros).catch(() => { });
  }, [uid]);

  if (!pros.length) return null;

  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <div className="card-header">
        <h3 className="card-title">⭐ Recommended for You</h3>
        <Link to="/browse" className="btn btn-ghost btn-sm">See all</Link>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10, padding: "0 16px 16px" }}>
        {pros.map(p => {
          const initials = ((p.displayName as string) || "?").split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
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
  userProfile, user, upcomingBookings, proBookings, loading, lastBookedPro, lastCompletedBooking, loyaltyPreview,
}: {
  userProfile: Record<string, unknown> | null;
  user: any;
  upcomingBookings: Record<string, unknown>[];
  proBookings: Record<string, unknown>[];
  loading: boolean;
  lastBookedPro: Record<string, unknown> | null;
  lastCompletedBooking: Record<string, unknown> | null;
  loyaltyPreview: LoyaltyPreview | null;
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
                  <div className="m-action-card-title">{(b.serviceName as string) || "Consultation"}</div>
                  <div className="m-action-card-sub">{(b.date as string)} · {(b.timeSlot as string) || ""}</div>
                </div>
                <span className={`badge ${b.status === "confirmed" ? "badge-success" : "badge-warning"}`} style={{ fontSize: 10 }}>{b.status as string}</span>
              </div>
            ))}
            {proBookings.slice(0, 1).map(b => (
              <div key={b.id as string} className="m-action-card" onClick={() => navigate("/bookings")}>
                <div className="m-action-card-icon" style={{ background: "rgba(212,92,59,0.1)", color: "#D45C3B" }}>🔔</div>
                <div className="m-action-card-body">
                  <div className="m-action-card-title">New request from {(b.clientName as string) || "client"}</div>
                  <div className="m-action-card-sub">{(b.serviceName as string) || "Consultation"}</div>
                </div>
                <span className="badge badge-accent" style={{ fontSize: 10 }}>Pending</span>
              </div>
            ))}
          </div>
        </div>
      )}

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

      {lastBookedPro && lastCompletedBooking && (
        <div className="m-section">
          <span className="m-section-label">Quick Re-book</span>
          <div className="card" style={{ padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: loyaltyPreview ? 12 : 0 }}>
              <div>
                <div style={{ fontWeight: 700 }}>Continue with {(lastBookedPro.displayName as string) || "your last pro"}</div>
                <div className="text-muted text-sm">Same pro, same service, next recurring slot</div>
              </div>
              <button className="btn btn-primary btn-sm" onClick={() => navigate(`/book/${lastBookedPro.uid as string}${buildRecurringRebookQuery(lastCompletedBooking)}`)}>Book Again</button>
            </div>
            {loyaltyPreview && (
              <LoyaltyStreakWidget
                streakCount={loyaltyPreview.streakCount}
                tier={loyaltyPreview.tier}
                cashbackPct={loyaltyPreview.cashbackPct}
                cashbackCoins={loyaltyPreview.cashbackCoins}
                nextTier={loyaltyPreview.nextTier}
                bookingsToNextTier={loyaltyPreview.bookingsToNextTier}
                compact
                projected
              />
            )}
          </div>
        </div>
      )}

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

// ─── Desktop Dashboard ────────────────────────────────────────
function DesktopDashboard({
  userProfile, user, upcomingBookings, proBookings,
  loading, lastBookedPro, lastCompletedBooking, loyaltyPreview,
}: {
  userProfile: Record<string, unknown> | null;
  user: Record<string, unknown> | null;
  upcomingBookings: Record<string, unknown>[];
  proBookings: Record<string, unknown>[];
  loading: boolean;
  lastBookedPro: Record<string, unknown> | null;
  lastCompletedBooking: Record<string, unknown> | null;
  loyaltyPreview: LoyaltyPreview | null;
}) {
  const navigate = useNavigate();
  const isPro = (userProfile as { isServiceProvider?: boolean } | null)?.isServiceProvider === true;
  const firstName = ((userProfile as { displayName?: string } | null)?.displayName || (user as { displayName?: string } | null)?.displayName || "there").split(" ")[0];

  return (
    <div style={{ maxWidth: 1300, margin: "0 auto", padding: "0 20px" }}>
      {/* ─── Innovative Header ─── */}
      <div style={{ padding: "40px 0 24px" }}>
        <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: -1, margin: 0 }}>
          {greetingByTime()}, <span style={{ color: "var(--accent)" }}>{firstName}</span> 👋
        </h1>
        <p style={{ color: "var(--muted)", marginTop: 4 }}>Here's what's happening in your neighborhood today.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr 340px", gap: "32px", alignItems: "flex-start" }}>
        {/* ── LEFT COLUMN: STATS & NAVIGATION ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px", position: "sticky", top: "100px" }}>
          
          {/* Main Stats Card */}
          <div className="card" style={{ padding: 0, overflow: "hidden", border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.06)" }}>
            <div style={{ padding: "20px", background: "linear-gradient(135deg, var(--accent), var(--accent2))", color: "#fff" }}>
              <div style={{ fontSize: 13, opacity: 0.8, fontWeight: 600 }}>COIN BALANCE</div>
              <div style={{ fontSize: 32, fontWeight: 800, margin: "4px 0" }}>{((userProfile as { coinBalance?: number } | null)?.coinBalance || 0).toLocaleString("en-IN")} <span style={{ fontSize: 16 }}>NC</span></div>
              <Link to="/wallet" className="btn btn-sm" style={{ background: "rgba(255,255,255,0.2)", color: "#fff", border: "none", padding: "4px 12px", borderRadius: 20 }}>Manage Wallet</Link>
            </div>
            <div style={{ padding: "8px 0" }}>
              <div style={{ padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border)" }}>
                <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 600 }}>UPCOMING</span>
                <span style={{ fontWeight: 700 }}>{loading ? "…" : upcomingBookings.length}</span>
              </div>
              {isPro && (
                <div style={{ padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border)" }}>
                  <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 600 }}>PRO REQUESTS</span>
                  <span style={{ fontWeight: 700 }}>{loading ? "…" : proBookings.length}</span>
                </div>
              )}
              <div style={{ padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 600 }}>RATING</span>
                <span style={{ fontWeight: 700 }}>{(userProfile as { rating?: number } | null)?.rating ? `${(userProfile as { rating: number }).rating}★` : "—"}</span>
              </div>
            </div>
          </div>

          {/* Quick Links Nav */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { to: "/browse", icon: "🔍", label: "Find Professionals", color: "var(--accent)" },
              { to: "/bookings", icon: "📅", label: "My Bookings", color: "#D45C3B" },
              { to: "/messages", icon: "💬", label: "Messages", color: "#5B7A5B" },
              { to: "/support", icon: "📧", label: "Support", color: "#4A6B8A" },
            ].map(link => (
              <Link key={link.to} to={link.to} className="card" style={{ textDecoration: "none", padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, transition: "all 0.2s" }} onMouseEnter={e => (e.currentTarget.style.background = link.color + "08")} onMouseLeave={e => (e.currentTarget.style.background = "var(--surface)")}>
                <span style={{ fontSize: 18, color: link.color }}>{link.icon}</span>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{link.label}</span>
              </Link>
            ))}
          </div>

          {isPro && (
            <Link to="/profile" className="card" style={{ textDecoration: "none", padding: "16px", background: "var(--surface-2)", textAlign: "center" }}>
              <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>PRO MODE ACTIVE</div>
              <div style={{ fontWeight: 700, color: "var(--accent)" }}>Manage Skills & Prices →</div>
            </Link>
          )}

        </div>

        {/* ── CENTER COLUMN: FEED (THE HEART) ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          
          {/* Hero Re-book Banner */}
          {lastBookedPro && lastCompletedBooking && !loading && (
            <div style={{ background: "linear-gradient(135deg, var(--surface-2), #fff)", borderRadius: "var(--radius)", padding: "24px", display: "flex", flexDirection: "column", gap: 16, border: "1px solid var(--border)", boxShadow: "0 10px 30px rgba(0,0,0,0.04)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <div className="avatar">
                    {(lastBookedPro.photoURL as string) ? <img src={lastBookedPro.photoURL as string} alt="" /> : ((lastBookedPro.displayName as string) || "?").slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 style={{ fontSize: 16, margin: 0 }}>Ready for your next session?</h3>
                    <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>Continue with {(lastBookedPro.displayName as string) || "Professional"}</p>
                  </div>
                </div>
                <Link to={`/book/${lastBookedPro.uid as string}?rebook=true`} className="btn btn-primary" style={{ padding: "10px 24px" }}>
                  Book Now
                </Link>
              </div>

              {loyaltyPreview && (
                <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
                  <LoyaltyStreakWidget
                    streakCount={loyaltyPreview.streakCount}
                    tier={loyaltyPreview.tier}
                    cashbackPct={loyaltyPreview.cashbackPct}
                    cashbackCoins={loyaltyPreview.cashbackCoins}
                    nextTier={loyaltyPreview.nextTier}
                    bookingsToNextTier={loyaltyPreview.bookingsToNextTier}
                    compact
                    projected
                  />
                </div>
              )}
            </div>
          )}

          {/* Social Feed */}
          <div style={{ minHeight: 600 }}>
             <LocalFeedWidget uid={user!.uid as string} displayName={(userProfile as { displayName?: string } | null)?.displayName || (user as { displayName?: string } | null)?.displayName || "User"} locality={(userProfile as { locality?: string } | null)?.locality} />
          </div>
        </div>

        {/* ── RIGHT COLUMN: ACTIVITIES & PROS ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px", position: "sticky", top: "100px" }}>
          
          {/* Recommended Pros */}
          <RecommendedPros uid={user!.uid as string} />

          {/* Activity Widget */}
          <div className="card" style={{ padding: 0 }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontSize: 14, margin: 0, fontWeight: 700 }}>Upcoming Activity</h3>
              <Link to="/bookings" className="btn btn-ghost btn-xs">See All</Link>
            </div>
            <div style={{ maxHeight: 300, overflowY: "auto" }}>
              {loading ? (
                 <div style={{ padding: 20, textAlign: "center" }}><div className="loader" style={{ width: 20, height: 20 }} /></div>
              ) : upcomingBookings.length === 0 ? (
                 <div style={{ padding: "32px 20px", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>No upcoming bookings. Time to explore?</div>
              ) : (
                upcomingBookings.slice(0, 5).map(b => (
                  <div key={b.id as string} style={{ padding: "12px 20px", borderBottom: "1px solid var(--border)", display: "flex", gap: 12, alignItems: "center" }}>
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--accent-dim)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🗓️</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                       <div style={{ fontWeight: 600, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{(b.serviceName as string) || "Session"}</div>
                       <div style={{ fontSize: 11, color: "var(--muted)" }}>{(b.date as string)} · {(b.timeSlot as string) || "TBD"}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Pro Context Card (Conditional) */}
          {isPro && proBookings.length > 0 && (
            <div className="card" style={{ border: "2px solid var(--accent2)", padding: 16, background: "rgba(var(--accent2-rgb), 0.02)" }}>
               <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <span style={{ fontWeight: 700, color: "var(--accent2)", fontSize: 13 }}>NEW REQUESTS</span>
                  <span className="badge badge-error" style={{ fontSize: 10 }}>{proBookings.length}</span>
               </div>
               <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {proBookings.slice(0, 2).map(b => (
                    <div key={b.id as string} style={{ background: "#fff", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)" }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{(b.clientName as string) || "Client"}</div>
                      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{((b.serviceName as string) || "Consultation")}</div>
                      <button className="btn btn-ghost btn-xs" style={{ width: "100%", marginTop: 8, paddingTop: 4 }} onClick={() => navigate("/bookings")}>Review Request →</button>
                    </div>
                  ))}
               </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

// ─── Main export ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const { user, userProfile } = useAuth();
  const isMobile = useIsMobile();
  const [upcomingBookings, setUpcomingBookings] = useState<Record<string, unknown>[]>([]);
  const [proBookings, setProBookings] = useState<Record<string, unknown>[]>([]);
  const [lastBookedPro, setLastBookedPro] = useState<Record<string, unknown> | null>(null);
  const [lastCompletedBooking, setLastCompletedBooking] = useState<Record<string, unknown> | null>(null);
  const [loyaltyPreview, setLoyaltyPreview] = useState<LoyaltyPreview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const [client, pro] = await Promise.all([getBookingsForUser(user.uid), getBookingsForPro(user.uid)]);
        setUpcomingBookings(client.filter(b => b.status === "pending" || b.status === "confirmed"));
        setProBookings(pro.filter(b => b.status === "pending" || b.status === "confirmed"));
        const lastBooking = await getLastCompletedBookingForUser(user.uid);
        if (lastBooking) {
          setLastCompletedBooking(lastBooking);
          const lastProId = lastBooking.proId as string;
          const profile = await getUserProfile(lastProId);
          if (profile) setLastBookedPro(profile);
          const preview = await getLoyaltyPreview(user.uid, lastProId, ((lastBooking.amount as number) || (lastBooking.escrowCoins as number) || 0));
          setLoyaltyPreview(preview);
        }
      } catch { /* ignore */ }
      setLoading(false);
    };
    load();
  }, [user]);

  if (isMobile) {
    return (
      <MobileDashboard
        userProfile={userProfile as Record<string, unknown> | null}
        user={user as Record<string, unknown> | null}
        upcomingBookings={upcomingBookings}
        proBookings={proBookings}
        loading={loading}
        lastBookedPro={lastBookedPro}
        lastCompletedBooking={lastCompletedBooking}
        loyaltyPreview={loyaltyPreview}
      />
    );
  }

  return (
    <DesktopDashboard
      userProfile={userProfile as Record<string, unknown> | null}
      user={user as Record<string, unknown> | null}
      upcomingBookings={upcomingBookings}
      proBookings={proBookings}
      loading={loading}
      lastBookedPro={lastBookedPro}
      lastCompletedBooking={lastCompletedBooking}
      loyaltyPreview={loyaltyPreview}
    />
  );
}
