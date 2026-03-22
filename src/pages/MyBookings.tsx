import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  getBookingsForUser, getBookingsForPro, updateBookingStatus,
  getOrCreateConversation, formatTimestamp,
} from "../services/firestoreService";
import { releaseEscrow, refundEscrow, earnCoins } from "../services/coinService";

export default function MyBookings() {
  const { user, userProfile } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab]             = useState<"client" | "pro">("client");
  const [clientBookings, setClientB] = useState<Record<string, unknown>[]>([]);
  const [proBookings, setProB]    = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading]     = useState(true);
  const [actionLoading, setAL]    = useState<string | null>(null);
  const [error, setError]         = useState("");
  const [reviewBid, setReviewBid] = useState<string | null>(null);
  const [reviewRating, setRR]     = useState(5);
  const [reviewComment, setRC]    = useState("");
  const [reviewSub, setRS]        = useState(false);
  
  const [subTab, setSubTab]       = useState<"upcoming" | "past">("upcoming");
  const [searchQ, setSearchQ]     = useState("");

  const load = async () => {
    if (!user) return;
    setLoading(true); setError("");
    try {
      const [c, p] = await Promise.all([getBookingsForUser(user.uid), getBookingsForPro(user.uid)]);
      setClientB(c); setProB(p);
    } catch { setError("Failed to load bookings. Please refresh."); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const openChat = async (otherUid: string) => {
    const cid = await getOrCreateConversation(user!.uid, otherUid);
    navigate(`/messages?conv=${cid}`);
  };

  // Client cancels → full refund from escrow
  const handleCancel = async (b: Record<string, unknown>) => {
    const id = b.id as string;
    setAL(id);
    try {
      await updateBookingStatus(id, "cancelled");
      await refundEscrow(user!.uid, id, (b.serviceName as string) || "Booking");
    } catch { setError("Failed to cancel. Please try again."); }
    setAL(null); load();
  };

  // Pro confirms booking
  const handleConfirm = async (id: string) => {
    setAL(id);
    try { await updateBookingStatus(id, "confirmed"); }
    catch { setError("Failed to confirm booking."); }
    setAL(null); load();
  };

  // Pro declines → refund escrow to client
  const handleDecline = async (b: Record<string, unknown>) => {
    const id = b.id as string;
    setAL(id);
    try {
      await updateBookingStatus(id, "cancelled");
      await refundEscrow(b.clientId as string, id, (b.serviceName as string) || "Booking");
    } catch { setError("Failed to decline booking."); }
    setAL(null); load();
  };

  // Pro marks complete → release escrow to pro
  const handleComplete = async (b: Record<string, unknown>) => {
    const id = b.id as string;
    setAL(id);
    try {
      // Release escrow FIRST, then update status
      const result = await releaseEscrow(user!.uid, id, (b.serviceName as string) || "Session");
      if (!result.success) { setError("Failed to release payment. Contact support."); setAL(null); return; }
      await updateBookingStatus(id, "completed");
    } catch { setError("Failed to complete booking."); }
    setAL(null); load();
  };

  const handleReviewSubmit = async () => {
    if (!reviewBid) return;
    setRS(true);
    try {
      const booking = clientBookings.find(b => b.id === reviewBid);
      if (booking) {
        const { addReview } = await import("../services/firestoreService");
        await addReview({ bookingId: reviewBid, reviewerId: user!.uid, reviewerName: user!.displayName || user!.email, proId: booking.proId, rating: reviewRating, comment: reviewComment });
        await updateBookingStatus(reviewBid, "reviewed");
        await earnCoins(user!.uid, "earn_review", reviewBid);
      }
      setReviewBid(null); setRR(5); setRC(""); load();
    } catch { setError("Failed to submit review."); }
    setRS(false);
  };

  const bookings = tab === "client" ? clientBookings : proBookings;

  const filtered = bookings.filter(b => {
    // search match
    const match = !searchQ || [b.serviceCategory, b.proName, b.clientName, b.serviceName]
      .some(val => (val as string)?.toLowerCase().includes(searchQ.toLowerCase()));
      
    // subtab match
    const isPast = ["completed", "reviewed", "cancelled"].includes(b.status as string);
    const isUpcoming = ["pending", "confirmed"].includes(b.status as string);
    const subMatch = subTab === "upcoming" ? isUpcoming : isPast;
    
    return match && subMatch;
  });

  const STATUS_COLOR: Record<string, string> = {
    pending: "badge-warning", confirmed: "badge-accent",
    completed: "badge-success", reviewed: "badge-success", cancelled: "badge-error",
  };

  const STATUS_LABEL: Record<string, string> = {
    pending: "⏳ Awaiting confirmation",
    confirmed: "✅ Confirmed",
    completed: "✔ Completed",
    reviewed: "⭐ Reviewed",
    cancelled: "✕ Cancelled",
  };

  return (
    <div>
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 className="page-title">My Bookings</h1>
          <p className="page-subtitle">Manage your consultations</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate("/browse")}>+ New Booking</button>
      </div>

      <div className="tabs">
        <button className={`tab${tab === "client" ? " active" : ""}`} onClick={() => setTab("client")}>As Client</button>
        {userProfile?.isServiceProvider && (
          <button className={`tab${tab === "pro" ? " active" : ""}`} onClick={() => setTab("pro")}>As Professional</button>
        )}
      </div>

      {error && (
        <div className="error-box" style={{ marginBottom: 16 }}>
          {error} <button onClick={load} style={{ marginLeft: 8, background: "none", border: "none", color: "inherit", textDecoration: "underline", cursor: "pointer" }}>Retry</button>
        </div>
      )}

      {loading && (
        <div style={{ textAlign: "center", padding: 60 }}><div className="loader" style={{ margin: "0 auto" }} /></div>
      )}

      {/* Main Container */}
      {!loading && (
        <div style={{ display: "flex", gap: 24, flexDirection: "column" }}>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", gap: 8, background: "var(--surface-2)", padding: 4, borderRadius: "var(--radius)" }}>
                <button className={`btn btn-sm ${subTab === "upcoming" ? "btn-primary" : "btn-ghost"}`} onClick={() => setSubTab("upcoming")} style={{ borderRadius: "var(--radius-sm)" }}>Upcoming</button>
                <button className={`btn btn-sm ${subTab === "past" ? "btn-primary" : "btn-ghost"}`} onClick={() => setSubTab("past")} style={{ borderRadius: "var(--radius-sm)" }}>Past</button>
              </div>
              <input type="text" className="form-input" placeholder="Search bookings..." value={searchQ} onChange={e => setSearchQ(e.target.value)} style={{ maxWidth: 300 }} />
            </div>

            {filtered.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">📅</div>
                <div className="empty-state-title">No bookings found</div>
                <div className="empty-state-desc">{searchQ ? "No bookings match your search" : (tab === "client" ? "Browse professionals and book a consultation" : "Client bookings will appear here")}</div>
                {tab === "client" && !searchQ && <a href="/browse" className="btn btn-primary" style={{ marginTop: 16 }}>Book Now</a>}
              </div>
            ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filtered.map(b => {
            const id    = b.id as string;
            const busy  = actionLoading === id;
            const status = b.status as string;
            const escrowCoins = (b.escrowCoins as number) || 0;
            const otherUid = tab === "client" ? (b.proId as string) : (b.clientId as string);

            return (
              <div className="card" key={id} style={{ opacity: busy ? 0.65 : 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                  <div style={{ flex: 1, cursor: "pointer" }} onClick={() => navigate(`/bookings/${id}`)}>
                    <h4 style={{ marginBottom: 4 }}>Consultation for {(b.serviceCategory as string) || "Other"}</h4>
                    <p className="text-muted text-sm">
                      {tab === "client" ? `with ${(b.proName as string) || "Professional"}` : `from ${(b.clientName as string) || "Client"}`}
                    </p>
                    <div style={{ display: "flex", gap: 16, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <span className="text-sm">📅 {(b.date as string) || formatTimestamp(b.createdAt)}</span>
                      <span className="text-sm">🕐 {(b.timeSlot as string) || "TBD"}</span>
                      {escrowCoins > 0 ? (
                        <span className="text-sm">
                          🔒 {escrowCoins} NC {status === "completed" || status === "reviewed" ? "released" : "in escrow"}
                        </span>
                      ) : (
                        <span className="text-sm" style={{ color: "var(--accent2)" }}>Free</span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                    <span className={`badge ${STATUS_COLOR[status] || "badge-muted"}`}>
                      {STATUS_LABEL[status] || status}
                    </span>

                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      {/* ── Message button — always available unless cancelled ── */}
                      {status !== "cancelled" && (
                        <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => openChat(otherUid)}>
                          💬 Message
                        </button>
                      )}

                      {/* ── Pro actions ── */}
                      {tab === "pro" && status === "pending" && (
                        <>
                          <button className="btn btn-success btn-sm" disabled={busy} onClick={() => handleConfirm(id)}>✓ Confirm</button>
                          <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => handleDecline(b)}>✕ Decline</button>
                        </>
                      )}
                      {tab === "pro" && status === "confirmed" && (
                        <button className="btn btn-success btn-sm" disabled={busy} onClick={() => handleComplete(b)}>
                          {busy ? "Processing…" : "✓ Mark Complete"}
                        </button>
                      )}

                      {/* ── Client actions ── */}
                      {tab === "client" && status === "pending" && (
                        <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => handleCancel(b)}>
                          {busy ? "Cancelling…" : `Cancel${escrowCoins > 0 ? " & Refund" : ""}`}
                        </button>
                      )}
                      {tab === "client" && status === "completed" && (
                        <button className="btn btn-primary btn-sm" onClick={() => setReviewBid(id)}>⭐ Review</button>
                      )}

                      <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/bookings/${id}`)}>View Details</button>
                    </div>
                  </div>
                </div>

                {/* Escrow status bar for pending/confirmed paid bookings */}
                {escrowCoins > 0 && (status === "pending" || status === "confirmed") && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8, fontSize: "0.8rem", color: "#1B6B8A" }}>
                    🔒 <span><strong>{escrowCoins} NC</strong> held in escrow — released to pro when session is marked complete</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
            )}
        </div>
      )}

      {/* Review modal */}
      {reviewBid && (
        <div className="modal-overlay" onClick={() => setReviewBid(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Leave a Review</h3>
              <button className="modal-close" onClick={() => setReviewBid(null)}>✕</button>
            </div>
            <div className="form-group">
              <label className="form-label">Rating</label>
              <div className="stars">
                {[1,2,3,4,5].map(n => (
                  <button key={n} className={`star ${n <= reviewRating ? "filled" : "empty"}`} onClick={() => setRR(n)}>★</button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Comment</label>
              <textarea className="form-input" placeholder="Share your experience…" value={reviewComment} onChange={e => setRC(e.target.value)} />
            </div>
            <p style={{ fontSize: "0.8rem", color: "#16a34a", marginBottom: 12 }}>🏆 You'll earn +10 NC for leaving a verified review</p>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setReviewBid(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleReviewSubmit} disabled={reviewSub || !reviewComment.trim()}>
                {reviewSub ? "Submitting…" : "Submit Review"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
