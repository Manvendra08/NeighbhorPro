import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { subscribeToFeed, deleteFeedPost } from "../../services/firestoreService";
import { greetingByTime } from "../../utils/time";
import LoyaltyStreakWidget from "../LoyaltyStreakWidget";
import type { LoyaltyPreview } from "../../services/loyaltyService";
import StatsStrip from "./StatsStrip";
import FeedPostCard from "./FeedPostCard";
import FeedComposer from "./FeedComposer";
import RecommendedPros from "./RecommendedPros";

export default function DesktopDashboard({
  userProfile, user, upcomingBookings, proBookings,
  loading, computedRating, reviewDistribution, lastBookedPro, lastCompletedBooking, loyaltyPreview,
}: {
  userProfile: Record<string, unknown> | null;
  user: any;
  upcomingBookings: Record<string, unknown>[];
  proBookings: Record<string, unknown>[];
  loading: boolean;
  computedRating: number | null;
  reviewDistribution: Record<number, number>;
  lastBookedPro: Record<string, unknown> | null;
  lastCompletedBooking: Record<string, unknown> | null;
  loyaltyPreview: LoyaltyPreview | null;
}) {
  const navigate = useNavigate();
  const isPro = (userProfile as { isServiceProvider?: boolean } | null)?.isServiceProvider === true;
  const firstName = ((userProfile as { displayName?: string } | null)?.displayName || (user as { displayName?: string } | null)?.displayName || "there").split(" ")[0];
  const coins = (userProfile as { coinBalance?: number } | null)?.coinBalance ?? 0;
  const rating = computedRating ?? (userProfile as { rating?: number } | null)?.rating ?? null;
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
      <StatsStrip
        coins={coins}
        upcoming={upcomingBookings.length}
        proRequests={proBookings.length}
        rating={rating}
        reviewDistribution={reviewDistribution}
        isPro={isPro}
        loading={loading}
      />

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
                  <div style={{ fontWeight: 700, fontSize: 14 }}>↻ Re-book {(lastBookedPro.displayName as string) || "Pro"}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>Keep your streak alive</span>
                    {(lastBookedPro.tower as string) && (
                      <span style={{ fontSize: 10, background: "var(--surface-2)", padding: "1px 6px", borderRadius: 4, fontWeight: 700, color: "var(--text)" }}>🏢 {lastBookedPro.tower as string}</span>
                    )}
                  </div>
                </div>
              </div>
              <Link to={`/book/${lastBookedPro.uid as string}?rebook=true`} className="btn btn-primary" style={{ padding: "9px 22px", borderRadius: 10, flexShrink: 0 }}>
                Re-book
              </Link>
            </div>
          )}

          {lastCompletedBooking && !lastBookedPro && !loading && (
            <div style={{
              background: "rgba(245,158,11,0.08)",
              borderRadius: 12,
              padding: "12px 14px",
              marginBottom: 20,
              border: "1px solid rgba(245,158,11,0.25)",
              color: "#9a6700",
              fontSize: 13,
              fontWeight: 500,
            }}>
              Could not load your last booked professional right now. You can still rebook from the bookings page.
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
            <Link to="/account?tab=availability" style={{
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
