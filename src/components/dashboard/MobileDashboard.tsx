import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { subscribeToFeed, deleteFeedPost } from "../../services/firestoreService";
import { greetingByTime } from "../../utils/time";
import LoyaltyStreakWidget from "../LoyaltyStreakWidget";
import type { LoyaltyPreview } from "../../services/loyaltyService";
import FeedPostCard from "./FeedPostCard";
import FeedComposer from "./FeedComposer";

export default function MobileDashboard({
  userProfile, user, upcomingBookings, proBookings,
  loading, computedRating, reviewDistribution: _reviewDistribution, lastBookedPro, lastCompletedBooking, loyaltyPreview,
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
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>Keep your loyalty streak</div>
                {(lastBookedPro.tower as string) && (
                  <span style={{ fontSize: 9, background: "var(--surface-2)", padding: "0px 6px", borderRadius: 4, fontWeight: 700 }}>🏢 {lastBookedPro.tower as string}</span>
                )}
              </div>
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
