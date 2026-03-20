import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import {
  getBookingsForUser,
  getBookingsForPro,
  updateBookingStatus,
  formatTimestamp,
} from "../services/firestoreService";
import { refundBooking, earnCoins } from "../services/coinService";

export default function MyBookings() {
  const { user, userProfile } = useAuth();
  const [tab, setTab] = useState<"client" | "pro">("client");
  const [clientBookings, setClientBookings] = useState<Record<string, unknown>[]>([]);
  const [proBookings, setProBookings] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [reviewBookingId, setReviewBookingId] = useState<string | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const [c, p] = await Promise.all([
        getBookingsForUser(user.uid),
        getBookingsForPro(user.uid),
      ]);
      setClientBookings(c);
      setProBookings(p);
    } catch (err) {
      setError("Failed to load bookings. Please refresh the page.");
      console.error("Bookings load error:", err);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  // Important #6: cancellation triggers NC refund if coins were paid
  const handleCancel = async (booking: Record<string, unknown>) => {
    const id = booking.id as string;
    setActionLoading(id);
    setError("");
    try {
      await updateBookingStatus(id, "cancelled");
      // Refund if coins were debited for this booking
      if (booking.coinsPaid && (booking.paidInCoins as number) > 0) {
        await refundBooking(
          user!.uid,
          id,
          booking.paidInCoins as number,
          (booking.serviceName as string) || "Booking"
        );
      }
      load();
    } catch (err) {
      setError("Failed to cancel booking. Please try again.");
      console.error("Cancel error:", err);
    }
    setActionLoading(null);
  };

  const handleStatusChange = async (bookingId: string, status: string) => {
    setActionLoading(bookingId);
    setError("");
    try {
      await updateBookingStatus(bookingId, status);
      // Important #9: award earn_review coin when pro marks complete
      load();
    } catch (err) {
      setError("Failed to update booking status. Please try again.");
      console.error("Status change error:", err);
    }
    setActionLoading(null);
  };

  const handleReviewSubmit = async () => {
    if (!reviewBookingId) return;
    setReviewSubmitting(true);
    setError("");
    try {
      const booking = clientBookings.find((b) => b.id === reviewBookingId);
      if (booking) {
        const { addReview } = await import("../services/firestoreService");
        await addReview({
          bookingId: reviewBookingId,
          reviewerId: user!.uid,
          reviewerName: user!.displayName || user!.email,
          proId: booking.proId,
          rating: reviewRating,
          comment: reviewComment,
        });
        await updateBookingStatus(reviewBookingId, "reviewed");
        // Earn coins for leaving a review
        await earnCoins(user!.uid, "earn_review", reviewBookingId);
      }
      setReviewBookingId(null);
      setReviewRating(5);
      setReviewComment("");
      load();
    } catch (err) {
      setError("Failed to submit review. Please try again.");
      console.error("Review error:", err);
    }
    setReviewSubmitting(false);
  };

  const bookings = tab === "client" ? clientBookings : proBookings;

  const statusColor: Record<string, string> = {
    pending: "badge-warning", confirmed: "badge-accent",
    completed: "badge-success", reviewed: "badge-success", cancelled: "badge-error",
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">My Bookings</h1>
          <p className="page-subtitle">Manage your consultations</p>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab${tab === "client" ? " active" : ""}`} onClick={() => setTab("client")}>As Client</button>
        {userProfile?.isServiceProvider && (
          <button className={`tab${tab === "pro" ? " active" : ""}`} onClick={() => setTab("pro")}>As Professional</button>
        )}
      </div>

      {/* Important #9: surface errors instead of swallowing them */}
      {error && (
        <div className="error-box" style={{ marginBottom: 16 }}>
          {error} <button onClick={load} style={{ marginLeft: 8, background: "none", border: "none", color: "inherit", textDecoration: "underline", cursor: "pointer" }}>Retry</button>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: 60 }}><div className="loader" style={{ margin: "0 auto" }} /></div>
      ) : bookings.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📅</div>
          <div className="empty-state-title">No bookings yet</div>
          <div className="empty-state-desc">{tab === "client" ? "Browse professionals and book a consultation" : "When clients book your services, they'll appear here"}</div>
          {tab === "client" && <a href="/browse" className="btn btn-primary" style={{ marginTop: 16 }}>Book Now</a>}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {bookings.map((b) => {
            const id = b.id as string;
            const busy = actionLoading === id;
            return (
              <div className="card" key={id} style={{ opacity: busy ? 0.65 : 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                  <div>
                    <h4 style={{ marginBottom: 4 }}>{(b.serviceName as string) || "Consultation"}</h4>
                    <p className="text-muted text-sm">{tab === "client" ? `with ${(b.proName as string) || "Professional"}` : `from ${(b.clientName as string) || "Client"}`}</p>
                    <div style={{ display: "flex", gap: 16, marginTop: 8, flexWrap: "wrap" }}>
                      <span className="text-sm">📅 {(b.date as string) || formatTimestamp(b.createdAt)}</span>
                      <span className="text-sm">🕐 {(b.timeSlot as string) || "TBD"}</span>
                      <span className="text-sm" style={{ color: (b.amount as number) === 0 ? "var(--accent2)" : "var(--text)" }}>
                        🪙 {(b.amount as number) === 0 ? "Free" : `${b.amount as number} NC`}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                    <span className={`badge ${statusColor[(b.status as string)] || "badge-muted"}`}>{b.status as string}</span>
                    <div style={{ display: "flex", gap: 6 }}>
                      {tab === "pro" && b.status === "pending" && (
                        <>
                          <button className="btn btn-success btn-sm" disabled={busy} onClick={() => handleStatusChange(id, "confirmed")}>Confirm</button>
                          <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => handleStatusChange(id, "cancelled")}>Decline</button>
                        </>
                      )}
                      {tab === "pro" && b.status === "confirmed" && (
                        <button className="btn btn-success btn-sm" disabled={busy} onClick={() => handleStatusChange(id, "completed")}>Mark Complete</button>
                      )}
                      {/* Important #6: client cancel triggers refund */}
                      {tab === "client" && b.status === "pending" && (
                        <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => handleCancel(b)}>
                          {busy ? "Cancelling…" : `Cancel${(b.coinsPaid && (b.paidInCoins as number) > 0) ? " & Refund" : ""}`}
                        </button>
                      )}
                      {tab === "client" && b.status === "completed" && (
                        <button className="btn btn-primary btn-sm" onClick={() => setReviewBookingId(id)}>Leave Review</button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Review modal */}
      {reviewBookingId && (
        <div className="modal-overlay" onClick={() => setReviewBookingId(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Leave a Review</h3>
              <button className="modal-close" onClick={() => setReviewBookingId(null)}>✕</button>
            </div>
            <div className="form-group">
              <label className="form-label">Rating</label>
              <div className="stars">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} className={`star ${n <= reviewRating ? "filled" : "empty"}`} onClick={() => setReviewRating(n)}>★</button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Comment</label>
              <textarea className="form-input" placeholder="Share your experience…" value={reviewComment} onChange={(e) => setReviewComment(e.target.value)} id="review-comment-input" />
            </div>
            <p style={{ fontSize: "0.8rem", color: "#16a34a", marginBottom: 12 }}>🏆 You'll earn +10 NC for leaving a verified review</p>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setReviewBookingId(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleReviewSubmit} disabled={reviewSubmitting || !reviewComment.trim()}>
                {reviewSubmitting ? "Submitting…" : "Submit Review"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
