import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { getBookingById, updateBookingStatus, getOrCreateConversation, formatTimestamp, addReview } from "../services/firestoreService";
import { releaseEscrow, refundEscrow, earnCoins } from "../services/coinService";
import { logActivity } from "../services/activityService";

export default function BookingDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [booking, setBooking] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setAL] = useState<string | null>(null);
  const [error, setError] = useState("");
  
  const [showReview, setShowReview] = useState(false);
  const [reviewRating, setRR] = useState(5);
  const [reviewComment, setRC] = useState("");
  const [reviewSub, setRS] = useState(false);

  const load = async () => {
    if (!id || !user) return;
    setLoading(true); setError("");
    try {
      const b = await getBookingById(id);
      if (b && (b.clientId === user.uid || b.proId === user.uid)) {
        setBooking(b);
      } else {
        setError("Booking not found or access denied.");
      }
    } catch {
      setError("Failed to load booking details.");
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [id, user]);

  if (loading) return <div style={{ textAlign: "center", padding: 80 }}><div className="loader" style={{ margin: "0 auto" }} /></div>;
  if (error || !booking) return <div className="error-box" style={{ maxWidth: 600, margin: "40px auto" }}>{error || "Booking not found"}</div>;

  const isClient = user?.uid === booking.clientId;
  const isPro = user?.uid === booking.proId;
  const status = booking.status as string;
  const otherUid = isClient ? (booking.proId as string) : (booking.clientId as string);
  const escrowCoins = (booking.escrowCoins as number) || 0;

  const handleCancel = async () => {
    setAL("cancel");
    try {
      await updateBookingStatus(id!, "cancelled");
      if (escrowCoins > 0 && isClient) {
        await refundEscrow(user!.uid, id!, (booking.serviceName as string) || "Booking");
      } else if (escrowCoins > 0 && isPro) {
        await refundEscrow(booking.clientId as string, id!, (booking.serviceName as string) || "Booking");
      }
      const role = isClient ? "client" : "pro";
      const counterparty = isClient ? (booking.proName as string) || booking.proId : (booking.clientName as string) || booking.clientId;
      logActivity(user!.uid, "booking.cancelled", `${isClient ? "Cancelled" : "Declined"} booking: ${(booking.serviceName as string) || id} ${isClient ? "with" : "from"} ${counterparty}`, { bookingId: id, role, escrowRefunded: escrowCoins });
      await load();
    } catch { setError("Failed to cancel."); }
    setAL(null);
  };

  const handleConfirm = async () => {
    setAL("confirm");
    try { await updateBookingStatus(id!, "confirmed"); await load(); }
    catch { setError("Failed to confirm."); }
    setAL(null);
  };

  const handleComplete = async () => {
    setAL("complete");
    try {
      const result = await releaseEscrow(user!.uid, id!, (booking.serviceName as string) || "Session");
      if (!result.success) { setError("Failed to release payment. Contact support."); setAL(null); return; }
      await updateBookingStatus(id!, "completed");
      logActivity(user!.uid, "booking.completed", `Completed booking: ${(booking.serviceName as string) || id} for ${(booking.clientName as string) || booking.clientId}`, { bookingId: id, role: "pro", escrowReleased: escrowCoins });
      await load();
    } catch { setError("Failed to complete booking."); }
    setAL(null);
  };

  const handleReviewSubmit = async () => {
    setRS(true); setError("");
    try {
      await addReview(id!, booking!.proId as string, reviewRating, reviewComment);
      await updateBookingStatus(id!, "reviewed");
      await earnCoins(user!.uid, "earn_review", id!);
      setShowReview(false);
      setRR(5); setRC("");
      await load();
    } catch { setError("Failed to submit review."); }
    setRS(false);
  };

  const openChat = async () => {
    const cid = await getOrCreateConversation(user!.uid, otherUid);
    navigate(`/messages?conv=${cid}`);
  };

  const STATUS_COLOR: Record<string, string> = {
    pending: "badge-warning", confirmed: "badge-accent",
    completed: "badge-success", reviewed: "badge-success", cancelled: "badge-error",
  };

  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)} style={{ marginBottom: 16 }}>← Back</button>
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16, marginBottom: 24 }}>
          <div>
            <h1 className="card-title" style={{ fontSize: 24, marginBottom: 4 }}>{booking.serviceName as string}</h1>
            <p className="text-muted">Category: {(booking.serviceCategory as string) || "Other"}</p>
          </div>
          <span className={`badge ${STATUS_COLOR[status] || "badge-muted"}`} style={{ fontSize: 14, padding: "6px 12px" }}>
            {status.toUpperCase()}
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 24, padding: 16, background: "var(--surface-2)", borderRadius: "var(--radius)" }}>
          <div>
            <div className="text-muted text-sm" style={{ marginBottom: 4 }}>{isClient ? "Professional" : "Client"}</div>
            <div style={{ fontWeight: 600 }}>{isClient ? (booking.proName as string) : (booking.clientName as string)}</div>
          </div>
          <div>
            <div className="text-muted text-sm" style={{ marginBottom: 4 }}>Date & Time</div>
            <div style={{ fontWeight: 600 }}>{(booking.date as string) || formatTimestamp(booking.createdAt)} • {(booking.timeSlot as string) || "TBD"}</div>
          </div>
          <div>
            <div className="text-muted text-sm" style={{ marginBottom: 4 }}>Price</div>
            <div style={{ fontWeight: 600 }}>
              {(booking.isPaid as boolean) ? `${booking.amount as number} NC` : "Free"}
            </div>
          </div>
          <div>
            <div className="text-muted text-sm" style={{ marginBottom: 4 }}>Payment Status</div>
            <div style={{ fontWeight: 600 }}>
              {escrowCoins > 0 ? `Held in Escrow (${escrowCoins} NC)` : (booking.coinsPaid as boolean ? "Paid" : "Unpaid")}
            </div>
          </div>
        </div>

        {(booking.notes as string) && (
          <div style={{ marginBottom: 24 }}>
            <h4 style={{ marginBottom: 8 }}>Brief of service</h4>
            <div style={{ padding: 16, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", whiteSpace: "pre-wrap" }}>
              {(booking.notes as string)}
            </div>
          </div>
        )}

        {(booking.attachmentUrl as string) && (
          <div style={{ marginBottom: 24 }}>
            <h4 style={{ marginBottom: 8 }}>Attachment</h4>
            <a href={booking.attachmentUrl as string} target="_blank" rel="noopener noreferrer" className="btn btn-outline" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              📎 {(booking.attachmentName as string) || "View Attachment"}
            </a>
          </div>
        )}

        <div style={{ display: "flex", gap: 12, borderTop: "1px solid var(--border)", paddingTop: 24, flexWrap: "wrap" }}>
          <button className="btn btn-primary" onClick={openChat}>💬 Message {isClient ? "Professional" : "Client"}</button>
          
          {isPro && status === "pending" && (
            <>
              <button className="btn btn-success" disabled={!!actionLoading} onClick={handleConfirm}>{actionLoading === "confirm" ? "..." : "✓ Confirm Booking"}</button>
              <button className="btn btn-danger" disabled={!!actionLoading} onClick={handleCancel}>{actionLoading === "cancel" ? "..." : "✕ Decline"}</button>
            </>
          )}

          {isPro && status === "confirmed" && (
            <button className="btn btn-success" disabled={!!actionLoading} onClick={handleComplete}>
              {actionLoading === "complete" ? "Processing..." : "✓ Mark as Completed"}
            </button>
          )}

          {isClient && (status === "pending" || status === "confirmed") && (
            <button className="btn btn-danger" disabled={!!actionLoading} onClick={handleCancel}>
              {actionLoading === "cancel" ? "Cancelling..." : `Cancel Booking${escrowCoins > 0 ? " & Request Refund" : ""}`}
            </button>
          )}

          {isClient && status === "completed" && (
            <button className="btn btn-primary" onClick={() => setShowReview(true)}>⭐ Leave Review</button>
          )}
        </div>
      </div>

      {/* Review modal */}
      {showReview && (
        <div className="modal-overlay" onClick={() => setShowReview(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Leave a Review</h3>
              <button className="modal-close" onClick={() => setShowReview(false)}>✕</button>
            </div>
            <div className="form-group">
              <label className="form-label">Rating</label>
              <div className="stars" style={{ display: "flex", gap: 4, fontSize: 24, cursor: "pointer" }}>
                {[1,2,3,4,5].map(n => (
                  <button key={n} type="button" style={{ background: "none", border: "none", color: n <= reviewRating ? "#fbbf24" : "var(--muted)", cursor: "pointer", fontSize: 28 }} onClick={() => setRR(n)}>★</button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Comment</label>
              <textarea className="form-input" placeholder="Share your experience…" value={reviewComment} onChange={e => setRC(e.target.value)} />
            </div>
            <p style={{ fontSize: "0.8rem", color: "#16a34a", marginBottom: 12 }}>🏆 You'll earn +10 NC for leaving a verified review</p>
            <div className="modal-actions" style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
              <button className="btn btn-secondary" disabled={reviewSub} onClick={() => setShowReview(false)}>Cancel</button>
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

