import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  getBookingsForUser,
  getBookingsForPro,
  subscribeToFeed,
  createFeedPost,
  deleteFeedPost,
  reportFeedPost,
  toggleLikeFeedPost,
  getRecommendedPros,
  getLastCompletedBookingForUser,
  getUserProfile,
  type FeedReportReason,
} from "../services/firestoreService";
import { useIsMobile } from "../hooks/useIsMobile";
import { relativeTime, greetingByTime } from "../utils/time";
import LoyaltyStreakWidget from "../components/LoyaltyStreakWidget";
import { getLoyaltyPreview, type LoyaltyPreview } from "../services/loyaltyService";

/* ─── CONSTANTS ─────────────────────────────────────────────────────────── */
const EMOJI_ROWS = [
  ["😀","😂","🥰","😎","🤔","😢","🔥","💯","👍","👎"],
  ["❤️","🎉","🙏","✅","⭐","💪","🏠","📢","🤝","💡"],
  ["👋","🫡","😤","🥳","😴","🤑","🧘","📚","🎵","🐾"],
];

const REPORT_REASONS: { value: FeedReportReason; label: string; icon: string }[] = [
  { value: "offensive", label: "Offensive language", icon: "🚫" },
  { value: "scam",      label: "Scam or fraud",     icon: "⚠️" },
  { value: "spam",      label: "Spam",               icon: "📧" },
  { value: "policy_violation", label: "Violates app policies", icon: "📋" },
  { value: "other",     label: "Other",              icon: "❓" },
];

/* ─── EMOJI PICKER ──────────────────────────────────────────────────────── */
function EmojiPicker({ onSelect, onClose }: { onSelect: (e: string) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div ref={ref} style={{
      position: "absolute", bottom: "100%", left: 0, marginBottom: 8,
      background: "#fff", border: "1px solid var(--border)", borderRadius: 12,
      padding: 10, boxShadow: "0 8px 32px rgba(0,0,0,0.12)", zIndex: 50,
      width: "min(320px, 90vw)",
    }}>
      {EMOJI_ROWS.map((row, i) => (
        <div key={i} style={{ display: "flex", gap: 2, marginBottom: i < EMOJI_ROWS.length - 1 ? 4 : 0 }}>
          {row.map(emoji => (
            <button key={emoji} onClick={() => onSelect(emoji)} style={{
              background: "none", border: "none", fontSize: 20, cursor: "pointer",
              padding: "4px 5px", borderRadius: 6, transition: "background 0.15s",
            }}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--surface-2)")}
              onMouseLeave={e => (e.currentTarget.style.background = "none")}
            >{emoji}</button>
          ))}
        </div>
      ))}
    </div>
  );
}

/* ─── REPORT MODAL ──────────────────────────────────────────────────────── */
function ReportModal({ postId, uid, onClose }: { postId: string; uid: string; onClose: () => void }) {
  const [reason, setReason] = useState<FeedReportReason | "">("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!reason) return;
    setSubmitting(true);
    const res = await reportFeedPost(postId, uid, reason as FeedReportReason);
    setResult(res.alreadyReported ? "You've already reported this post." : "Report submitted. Our team will review it.");
    setSubmitting(false);
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20,
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "#fff", borderRadius: 16, width: "100%", maxWidth: 400,
        padding: "28px 24px", boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
      }}>
        {result ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            <p style={{ fontWeight: 600, marginBottom: 20 }}>{result}</p>
            <button className="btn btn-primary" onClick={onClose} style={{ width: "100%" }}>Done</button>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Report Post</h3>
              <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "var(--muted)" }}>✕</button>
            </div>
            <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16 }}>
              Why are you reporting this post?
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
              {REPORT_REASONS.map(r => (
                <label key={r.value} style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
                  borderRadius: 10, cursor: "pointer", transition: "all 0.15s",
                  border: `2px solid ${reason === r.value ? "var(--accent)" : "var(--border)"}`,
                  background: reason === r.value ? "rgba(27,107,138,0.04)" : "transparent",
                }}>
                  <input type="radio" name="report" value={r.value} checked={reason === r.value}
                    onChange={() => setReason(r.value)} style={{ display: "none" }} />
                  <span style={{ fontSize: 18 }}>{r.icon}</span>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{r.label}</span>
                  {reason === r.value && <span style={{ marginLeft: "auto", color: "var(--accent)", fontWeight: 700 }}>✓</span>}
                </label>
              ))}
            </div>
            <button className="btn btn-primary" onClick={handleSubmit}
              disabled={!reason || submitting}
              style={{ width: "100%", opacity: !reason ? 0.5 : 1 }}>
              {submitting ? "Submitting…" : "Submit Report"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* ─── FEED POST CARD ────────────────────────────────────────────────────── */
function FeedPostCard({ post, uid, onDelete }: {
  post: Record<string, unknown>; uid: string; onDelete: (id: string) => void;
}) {
  const [showReport, setShowReport] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isOwn = (post.authorId as string) === uid;
  const isHidden = post.hidden === true;

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  if (isHidden && !isOwn) return null; // Hide reported posts from others

  const initials = ((post.authorName as string) || "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <>
      <div style={{
        padding: "16px 18px", background: "#fff", borderRadius: 14,
        border: "1px solid var(--border)", transition: "box-shadow 0.2s",
        ...(isHidden ? { opacity: 0.45 } : {}),
      }}
        onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.06)")}
        onMouseLeave={e => (e.currentTarget.style.boxShadow = "none")}
      >
        {/* Author row */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
            background: "linear-gradient(135deg, var(--accent-dim), var(--surface-2))",
            color: "var(--accent)", fontWeight: 700, fontSize: 13,
          }}>{initials}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text)" }}>
              {(post.authorName as string) || "Neighbor"}
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>{relativeTime(post.createdAt)}</div>
          </div>
          {/* Context menu */}
          <div style={{ position: "relative" }} ref={menuRef}>
            <button onClick={() => setMenuOpen(!menuOpen)} style={{
              background: "none", border: "none", cursor: "pointer", fontSize: 16,
              color: "var(--muted)", padding: "4px 6px", borderRadius: 6,
            }}>⋯</button>
            {menuOpen && (
              <div style={{
                position: "absolute", right: 0, top: "100%", marginTop: 4,
                background: "#fff", border: "1px solid var(--border)", borderRadius: 10,
                boxShadow: "0 6px 20px rgba(0,0,0,0.1)", overflow: "hidden", zIndex: 30,
                minWidth: 160,
              }}>
                {isOwn ? (
                  <button onClick={() => { setMenuOpen(false); onDelete(post.id as string); }} style={{
                    display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "10px 14px",
                    background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "var(--error)",
                  }}>🗑️ Delete post</button>
                ) : (
                  <button onClick={() => { setMenuOpen(false); setShowReport(true); }} style={{
                    display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "10px 14px",
                    background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#D45C3B",
                  }}>🚩 Report post</button>
                )}
              </div>
            )}
          </div>
        </div>
        {/* Content */}
        <p style={{ fontSize: 14, lineHeight: 1.65, color: "var(--text-2)", margin: 0, whiteSpace: "pre-wrap" }}>
          {post.content as string}
        </p>

        {/* Action Bar: Reactions */}
        <div style={{ display: "flex", gap: 16, marginTop: 14, paddingTop: 12, borderTop: "1px solid rgba(0,0,0,0.03)" }}>
          <button
            onClick={() => toggleLikeFeedPost(post.id as string, uid)}
            style={{
              display: "flex", alignItems: "center", gap: 6, background: "none", border: "none",
              cursor: "pointer", fontSize: 13, color: (post.likes as string[])?.includes(uid) ? "#E0245E" : "var(--muted)",
              transition: "transform 0.1s", padding: 0,
            }}
            onMouseDown={e => (e.currentTarget.style.transform = "scale(0.92)")}
            onMouseUp={e => (e.currentTarget.style.transform = "scale(1)")}
          >
            <span>{(post.likes as string[])?.includes(uid) ? "❤️" : "🤍"}</span>
            <span style={{ fontWeight: 600 }}>{(post.likes as string[])?.length || 0}</span>
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--muted)" }}>
            <span>💬</span>
            <span style={{ fontWeight: 600 }}>{(post.commentCount as number) || 0}</span>
          </div>
        </div>

        {isHidden && isOwn && (
          <div style={{ marginTop: 8, fontSize: 11, color: "var(--error)", fontStyle: "italic" }}>
            This post has been flagged for review.
          </div>
        )}
      </div>

      {showReport && <ReportModal postId={post.id as string} uid={uid} onClose={() => setShowReport(false)} />}
    </>
  );
}

/* ─── FEED COMPOSER (with emoji) ────────────────────────────────────────── */
function FeedComposer({ uid, displayName, locality }: { uid: string; displayName: string; locality?: string }) {
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const handlePost = async () => {
    if (!text.trim() || posting) return;
    setPosting(true);
    try {
      await createFeedPost({ authorId: uid, authorName: displayName, content: text.trim(), locality });
      setText(""); setShowEmoji(false);
    } finally { setPosting(false); }
  };

  const insertEmoji = (emoji: string) => {
    if (!textRef.current) { setText(prev => prev + emoji); return; }
    const ta = textRef.current;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const newText = text.slice(0, start) + emoji + text.slice(end);
    setText(newText);
    setTimeout(() => { ta.selectionStart = ta.selectionEnd = start + emoji.length; ta.focus(); }, 0);
  };

  return (
    <div style={{
      background: "#fff", borderRadius: 14, border: "1px solid var(--border)",
      padding: "18px", marginTop: 8,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <span style={{ fontSize: 16 }}>✍️</span>
        <span style={{ fontWeight: 700, fontSize: 14, color: "var(--text)" }}>Share with your neighborhood</span>
      </div>
      <textarea
        ref={textRef}
        className="form-input"
        placeholder="What's on your mind? Ask for recommendations, share updates…"
        value={text}
        onChange={e => setText(e.target.value)}
        rows={3}
        style={{ width: "100%", resize: "none", fontSize: 14, borderRadius: 10, marginBottom: 10 }}
      />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ position: "relative" }}>
          <button onClick={() => setShowEmoji(!showEmoji)} style={{
            background: showEmoji ? "var(--accent-dim)" : "none",
            border: "1px solid var(--border)", borderRadius: 8, padding: "6px 10px",
            cursor: "pointer", fontSize: 18,
          }} title="Add emoji">😊</button>
          {showEmoji && <EmojiPicker onSelect={insertEmoji} onClose={() => setShowEmoji(false)} />}
        </div>
        <button className="btn btn-primary" disabled={!text.trim() || posting} onClick={handlePost}
          style={{ padding: "8px 24px", borderRadius: 10 }}>
          {posting ? "Posting…" : "Post"}
        </button>
      </div>
    </div>
  );
}

/* ─── RECOMMENDED PROS WIDGET ────────────────────────────────────────────── */
function RecommendedPros({ uid }: { uid: string }) {
  const navigate = useNavigate();
  const [pros, setPros] = useState<Record<string, unknown>[]>([]);

  useEffect(() => { getRecommendedPros(uid, 4).then(setPros).catch(() => {}); }, [uid]);

  if (!pros.length) return null;

  return (
    <div style={{
      background: "#fff", borderRadius: 14, border: "1px solid var(--border)", overflow: "hidden",
    }}>
      <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>⭐ Top Pros</span>
        <Link to="/browse" style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, textDecoration: "none" }}>View all</Link>
      </div>
      <div style={{ padding: 10 }}>
        {pros.map(p => {
          const initials = ((p.displayName as string) || "?").split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
          return (
            <div key={p.uid as string} onClick={() => navigate(`/pro/${p.uid}`)}
              style={{
                display: "flex", alignItems: "center", gap: 10, padding: "10px 8px",
                borderRadius: 10, cursor: "pointer", transition: "background 0.15s",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--surface-2)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              <div style={{
                width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                background: "linear-gradient(135deg, var(--accent-dim), var(--surface-2))",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "var(--accent)", fontWeight: 700, fontSize: 12,
                overflow: "hidden",
              }}>
                {(p.photoURL as string) ? <img src={p.photoURL as string} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initials}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{(p.displayName as string) || "Pro"}</div>
                <div style={{ fontSize: 11, color: "var(--muted)", display: "flex", alignItems: "center", gap: 6 }}>
                  <span>★ {(p.rating as number) ? (p.rating as number).toFixed(1) : "New"}</span>
                  {(p.tower as string) && (
                    <span style={{ fontSize: 10, background: "var(--surface-2)", padding: "1px 6px", borderRadius: 4, fontWeight: 600 }}>🏙️ {p.tower as string}</span>
                  )}
                </div>
              </div>
              <button className="btn btn-primary btn-xs" style={{ fontSize: 11, padding: "3px 12px", borderRadius: 8, flexShrink: 0 }}
                onClick={e => { e.stopPropagation(); navigate(`/book/${p.uid}`); }}>Book</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── COMPACT STATS STRIP ────────────────────────────────────────────────── */
function StatsStrip({ coins, upcoming, proRequests, rating, isPro, loading }: {
  coins: number; upcoming: number; proRequests: number; rating: number | null; isPro: boolean; loading: boolean;
}) {
  const items = [
    { label: "NC Balance", value: coins.toLocaleString("en-IN"), icon: "🪙", to: "/wallet", color: "#C4882A" },
    { label: "Upcoming", value: loading ? "…" : String(upcoming), icon: "📅", to: "/bookings", color: "#1B6B8A" },
    ...(isPro ? [{ label: "Requests", value: loading ? "…" : String(proRequests), icon: "🔔", to: "/bookings", color: "#D45C3B" }] : []),
    { label: "Rating", value: rating ? `${rating}★` : "—", icon: "⭐", to: "/profile", color: "#D4A03B" },
  ];

  return (
    <div style={{
      display: "flex", gap: 12, flexWrap: "wrap",
    }}>
      {items.map(item => (
        <Link key={item.label} to={item.to} style={{
          flex: "1 1 0", minWidth: 100,
          display: "flex", alignItems: "center", gap: 10,
          background: "#fff", border: "1px solid var(--border)", borderRadius: 12,
          padding: "12px 14px", textDecoration: "none", transition: "border-color 0.15s, box-shadow 0.15s",
        }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = item.color; e.currentTarget.style.boxShadow = `0 2px 12px ${item.color}15`; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.boxShadow = "none"; }}
        >
          <span style={{ fontSize: 20 }}>{item.icon}</span>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text)", lineHeight: 1.1 }}>{item.value}</div>
            <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>{item.label}</div>
          </div>
        </Link>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   DESKTOP DASHBOARD
   ═══════════════════════════════════════════════════════════════════════════ */
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
  const coins = (userProfile as { coinBalance?: number } | null)?.coinBalance ?? 0;
  const rating = (userProfile as { rating?: number } | null)?.rating ?? null;
  const uid = user!.uid as string;
  const displayName = (userProfile as { displayName?: string } | null)?.displayName || (user as { displayName?: string } | null)?.displayName || "User";
  const locality = (userProfile as { locality?: string } | null)?.locality;

  const [posts, setPosts] = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    const unsub = subscribeToFeed(locality, setPosts);
    return unsub;
  }, [locality]);

  const handleDelete = async (postId: string) => {
    if (!confirm("Delete this post?")) return;
    await deleteFeedPost(postId);
  };

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 20px" }}>
      {/* ── Header ── */}
      <div style={{ padding: "32px 0 20px" }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: -0.5, margin: 0, color: "var(--text)" }}>
          {greetingByTime()}, <span style={{ color: "var(--accent)" }}>{firstName}</span> 👋
        </h1>
        <p style={{ color: "var(--muted)", marginTop: 4, fontSize: 14 }}>Your neighborhood at a glance</p>
      </div>

      {/* ── Stats Strip ── */}
      <StatsStrip coins={coins} upcoming={upcomingBookings.length} proRequests={proBookings.length} rating={rating} isPro={isPro} loading={loading} />

      {/* ── 2-Column Layout ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 28, marginTop: 28, alignItems: "flex-start" }}>
        {/* CENTER: Feed */}
        <div>
          {/* Re-book Banner */}
          {lastBookedPro && lastCompletedBooking && !loading && (
            <div style={{
              background: "linear-gradient(135deg, rgba(27,107,138,0.06), rgba(212,92,59,0.04))",
              borderRadius: 14, padding: "18px 20px", marginBottom: 20,
              border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: "50%", overflow: "hidden",
                  background: "var(--accent-dim)", display: "flex", alignItems: "center", justifyContent: "center",
                  color: "var(--accent)", fontWeight: 700, fontSize: 14,
                }}>
                  {(lastBookedPro.photoURL as string)
                    ? <img src={lastBookedPro.photoURL as string} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : ((lastBookedPro.displayName as string) || "?").slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>Continue with {(lastBookedPro.displayName as string) || "Pro"}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>Keep your streak alive — book your next session</div>
                </div>
              </div>
              <Link to={`/book/${lastBookedPro.uid as string}?rebook=true`} className="btn btn-primary" style={{ padding: "9px 22px", borderRadius: 10, flexShrink: 0 }}>
                Re-book
              </Link>
            </div>
          )}

          {loyaltyPreview && lastBookedPro && (
            <div style={{ marginBottom: 20 }}>
              <LoyaltyStreakWidget
                streakCount={loyaltyPreview.streakCount} tier={loyaltyPreview.tier}
                cashbackPct={loyaltyPreview.cashbackPct} cashbackCoins={loyaltyPreview.cashbackCoins}
                nextTier={loyaltyPreview.nextTier} bookingsToNextTier={loyaltyPreview.bookingsToNextTier}
                compact projected
              />
            </div>
          )}

          {/* Feed Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "var(--text)" }}>
              📣 Neighborhood Feed{locality ? ` — ${locality}` : ""}
            </h2>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>{posts.filter(p => p.hidden !== true).length} posts</span>
          </div>

          {/* Feed Posts */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12, minHeight: 300 }}>
            {posts.filter(p => p.hidden !== true || (p.authorId as string) === uid).length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--muted)" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🏘️</div>
                <p style={{ fontWeight: 600, marginBottom: 4 }}>No posts yet</p>
                <p style={{ fontSize: 13 }}>Be the first to share something with your neighbors!</p>
              </div>
            ) : (
              posts.map(p => (
                <FeedPostCard key={p.id as string} post={p} uid={uid} onDelete={handleDelete} />
              ))
            )}
          </div>

          {/* Composer at BOTTOM */}
          <FeedComposer uid={uid} displayName={displayName} locality={locality} />
        </div>

        {/* RIGHT SIDEBAR */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20, position: "sticky", top: 90 }}>

          {/* Recommended Pros */}
          <RecommendedPros uid={uid} />

          {/* Upcoming Bookings */}
          <div style={{ background: "#fff", borderRadius: 14, border: "1px solid var(--border)", overflow: "hidden" }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>📅 Upcoming</span>
              <Link to="/bookings" style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, textDecoration: "none" }}>All</Link>
            </div>
            <div style={{ maxHeight: 280, overflowY: "auto" }}>
              {loading ? (
                <div style={{ padding: 24, textAlign: "center" }}><div className="loader" style={{ width: 18, height: 18 }} /></div>
              ) : upcomingBookings.length === 0 ? (
                <div style={{ padding: "28px 18px", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
                  No upcoming bookings
                </div>
              ) : (
                upcomingBookings.slice(0, 5).map((b, i, arr) => (
                  <div key={b.id as string} style={{
                    padding: "12px 18px", display: "flex", gap: 10, alignItems: "center",
                    borderBottom: i < arr.length - 1 ? "1px solid var(--border)" : "none",
                  }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                      background: "var(--accent-dim)", color: "var(--accent)", fontSize: 14,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>🗓️</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {(b.serviceName as string) || "Session"}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>{(b.date as string)} · {(b.timeSlot as string) || "TBD"}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Pro: New Requests */}
          {isPro && proBookings.length > 0 && (
            <div style={{
              background: "#fff", borderRadius: 14, border: "2px solid var(--accent2)", overflow: "hidden",
            }}>
              <div style={{
                padding: "14px 18px", borderBottom: "1px solid var(--border)",
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <span style={{ fontWeight: 700, fontSize: 14, color: "var(--accent2)" }}>🔔 New Requests</span>
                <span className="badge badge-error" style={{ fontSize: 10 }}>{proBookings.length}</span>
              </div>
              {proBookings.slice(0, 3).map((b, i, arr) => (
                <div key={b.id as string} onClick={() => navigate("/bookings")} style={{
                  padding: "12px 18px", cursor: "pointer", transition: "background 0.15s",
                  borderBottom: i < arr.length - 1 ? "1px solid var(--border)" : "none",
                }}
                  onMouseEnter={e => (e.currentTarget.style.background = "var(--surface-2)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{(b.clientName as string) || "Client"}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{(b.serviceName as string) || "Consultation"}</div>
                </div>
              ))}
            </div>
          )}

          {/* Pro: Manage link */}
          {isPro && (
            <Link to="/profile" style={{
              display: "block", textDecoration: "none", background: "linear-gradient(135deg, var(--accent), var(--accent2))",
              borderRadius: 12, padding: "14px 18px", color: "#fff", textAlign: "center",
              fontWeight: 700, fontSize: 13, transition: "opacity 0.2s",
            }}
              onMouseEnter={e => (e.currentTarget.style.opacity = "0.9")}
              onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
            >
              ⚡ Manage Skills & Availability
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MOBILE DASHBOARD
   ═══════════════════════════════════════════════════════════════════════════ */
function MobileDashboard({
  userProfile, user, upcomingBookings, proBookings,
  loading, lastBookedPro, lastCompletedBooking, loyaltyPreview,
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
  const isPro = (userProfile as { isServiceProvider?: boolean } | null)?.isServiceProvider === true;
  const firstName = ((userProfile as { displayName?: string } | null)?.displayName || (user as { displayName?: string } | null)?.displayName || "there").split(" ")[0];
  const coins = (userProfile as { coinBalance?: number } | null)?.coinBalance ?? 0;
  const rating = (userProfile as { rating?: number } | null)?.rating ?? null;
  const uid = user!.uid as string;
  const displayName = (userProfile as { displayName?: string } | null)?.displayName || (user as { displayName?: string } | null)?.displayName || "User";
  const locality = (userProfile as { locality?: string } | null)?.locality;

  const [posts, setPosts] = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    const unsub = subscribeToFeed(locality, setPosts);
    return unsub;
  }, [locality]);

  const handleDelete = async (postId: string) => {
    if (!confirm("Delete this post?")) return;
    await deleteFeedPost(postId);
  };

  return (
    <div style={{ padding: "0 4px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 12px 12px" }}>
        <div>
          <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>{greetingByTime()} 👋</p>
          <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: -0.5 }}>{firstName}</h2>
        </div>
        <Link to="/wallet" style={{
          display: "flex", alignItems: "center", gap: 6, background: "#fff",
          border: "1px solid var(--border)", borderRadius: 20, padding: "6px 14px",
          textDecoration: "none", fontWeight: 700, fontSize: 13, color: "var(--text)",
        }}>
          <span>🪙</span> {coins.toLocaleString("en-IN")} NC
        </Link>
      </div>

      {/* Compact Stats */}
      <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: "4px 12px 16px", WebkitOverflowScrolling: "touch" }}>
        {[
          { label: "Upcoming", value: loading ? "…" : String(upcomingBookings.length), icon: "📅" },
          ...(isPro ? [{ label: "Requests", value: loading ? "…" : String(proBookings.length), icon: "🔔" }] : []),
          { label: "Rating", value: rating ? `${rating}★` : "—", icon: "⭐" },
        ].map(s => (
          <div key={s.label} style={{
            background: "#fff", border: "1px solid var(--border)", borderRadius: 10,
            padding: "10px 14px", display: "flex", alignItems: "center", gap: 8, flexShrink: 0,
          }}>
            <span style={{ fontSize: 16 }}>{s.icon}</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 600 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Re-book Banner */}
      {lastBookedPro && lastCompletedBooking && !loading && (
        <div style={{
          margin: "0 12px 16px", padding: "14px 16px", borderRadius: 12, background: "#fff",
          border: "1px solid var(--border)",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: loyaltyPreview ? 10 : 0 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>↻ Re-book {(lastBookedPro.displayName as string) || "Pro"}</div>
              <div style={{ fontSize: 11, color: "var(--muted)" }}>Keep your loyalty streak</div>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => navigate(`/book/${lastBookedPro.uid as string}?rebook=true`)} style={{ borderRadius: 8 }}>Book</button>
          </div>
          {loyaltyPreview && (
            <LoyaltyStreakWidget
              streakCount={loyaltyPreview.streakCount} tier={loyaltyPreview.tier}
              cashbackPct={loyaltyPreview.cashbackPct} cashbackCoins={loyaltyPreview.cashbackCoins}
              nextTier={loyaltyPreview.nextTier} bookingsToNextTier={loyaltyPreview.bookingsToNextTier}
              compact projected
            />
          )}
        </div>
      )}

      {/* Action cards (Upcoming + Pro Requests) */}
      {!loading && (upcomingBookings.length > 0 || proBookings.length > 0) && (
        <div style={{ padding: "0 12px 16px" }}>
          {upcomingBookings.slice(0, 2).map(b => (
            <div key={b.id as string} onClick={() => navigate("/bookings")} style={{
              display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
              background: "#fff", border: "1px solid var(--border)", borderRadius: 12,
              marginBottom: 8, cursor: "pointer",
            }}>
              <span style={{ fontSize: 20 }}>📅</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{(b.serviceName as string) || "Session"}</div>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>{(b.date as string)} · {(b.timeSlot as string) || ""}</div>
              </div>
              <span className={`badge ${b.status === "confirmed" ? "badge-success" : "badge-warning"}`} style={{ fontSize: 10 }}>{b.status as string}</span>
            </div>
          ))}
          {proBookings.slice(0, 1).map(b => (
            <div key={b.id as string} onClick={() => navigate("/bookings")} style={{
              display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
              background: "#fff", border: "2px solid var(--accent2)", borderRadius: 12,
              marginBottom: 8, cursor: "pointer",
            }}>
              <span style={{ fontSize: 20 }}>🔔</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>New request: {(b.clientName as string) || "Client"}</div>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>{(b.serviceName as string) || "Consultation"}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Feed Header */}
      <div style={{ padding: "0 12px", marginBottom: 12 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>📣 Feed{locality ? ` — ${locality}` : ""}</h3>
      </div>

      {/* Feed */}
      <div style={{ padding: "0 12px", display: "flex", flexDirection: "column", gap: 10, minHeight: 200 }}>
        {posts.filter(p => p.hidden !== true || (p.authorId as string) === uid).length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 16px", color: "var(--muted)" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🏘️</div>
            <p style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>No posts yet</p>
            <p style={{ fontSize: 12 }}>Share something with your neighbors!</p>
          </div>
        ) : (
          posts.map(p => (
            <FeedPostCard key={p.id as string} post={p} uid={uid} onDelete={handleDelete} />
          ))
        )}
      </div>

      {/* Composer at bottom */}
      <div style={{ padding: "0 12px 24px" }}>
        <FeedComposer uid={uid} displayName={displayName} locality={locality} />
      </div>

      {/* Browse CTA */}
      <div style={{ padding: "0 12px 24px" }}>
        <Link to="/browse" style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "linear-gradient(135deg, var(--accent), var(--accent2))", color: "#fff",
          borderRadius: 14, padding: "16px 20px", textDecoration: "none",
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Find experts near you</div>
            <div style={{ fontSize: 12, opacity: 0.8 }}>CAs, Doctors, Tutors & more</div>
          </div>
          <span style={{ fontSize: 22, fontWeight: 700 }}>→</span>
        </Link>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN EXPORT
   ═══════════════════════════════════════════════════════════════════════════ */
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
        upcomingBookings={upcomingBookings} proBookings={proBookings}
        loading={loading} lastBookedPro={lastBookedPro}
        lastCompletedBooking={lastCompletedBooking} loyaltyPreview={loyaltyPreview}
      />
    );
  }

  return (
    <DesktopDashboard
      userProfile={userProfile as Record<string, unknown> | null}
      user={user as Record<string, unknown> | null}
      upcomingBookings={upcomingBookings} proBookings={proBookings}
      loading={loading} lastBookedPro={lastBookedPro}
      lastCompletedBooking={lastCompletedBooking} loyaltyPreview={loyaltyPreview}
    />
  );
}
