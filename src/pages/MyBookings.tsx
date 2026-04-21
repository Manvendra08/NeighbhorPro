import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  getBookingsForUser, getBookingsForPro, updateBookingStatus, updateBookingFields,
  getOrCreateConversation, addResidentReview, hasResidentReview,
} from "../services/firestoreService";
import { releaseEscrow, cancelBookingAndRefund, earnCoins, rewardReferral } from "../services/coinService";
import { logActivity } from "../services/activityService";
import { formatBookingDateTime } from "../utils/time";

function buildRecurringRebookQuery(booking: Record<string, unknown>): string {
  const params = new URLSearchParams();
  if (booking.serviceId) params.set("serviceId", String(booking.serviceId));
  if (booking.timeSlot) params.set("timeSlot", String(booking.timeSlot));
  const base = booking.date ? new Date(String(booking.date)) : new Date();
  const next = new Date(base);
  next.setDate(next.getDate() + 7);
  params.set("date", next.toISOString().split("T")[0]);
  params.set("rebook", "1");
  if (booking.id) params.set("bookingId", String(booking.id));
  const queryString = params.toString();
  return queryString ? `?${queryString}` : "";
}

export default function MyBookings() {
  const { user, userProfile } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"client" | "pro">("client");
  const [clientBookings, setClientB] = useState<Record<string, unknown>[]>([]);
  const [proBookings, setProB] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setAL] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [reviewBid, setReviewBid] = useState<string | null>(null);
  const [reviewRating, setRR] = useState(5);
  const [reviewComment, setRC] = useState("");
  const [reviewSub, setRS] = useState(false);
  const [residentReviewBid, setResidentReviewBid] = useState<string | null>(null);
  const [residentReviewRating, setResidentReviewRating] = useState(5);
  const [residentReviewComment, setResidentReviewComment] = useState("");
  const [residentReviewSub, setResidentReviewSub] = useState(false);
  const [residentReviewedMap, setResidentReviewedMap] = useState<Record<string, boolean>>({});
  const [cancelRequest, setCancelRequest] = useState<{ booking: Record<string, unknown>; role: "client" | "pro" } | null>(null);
  const [cancelComment, setCancelComment] = useState("");
  const [completeRequest, setCompleteRequest] = useState<Record<string, unknown> | null>(null);

  const [subTab, setSubTab] = useState<"upcoming" | "past">("upcoming");
  const [searchQ, setSearchQ] = useState("");

  const load = async () => {
    if (!user) return;
    setLoading(true); setError("");
    try {
      const [c, p] = await Promise.all([getBookingsForUser(user.uid), getBookingsForPro(user.uid)]);
      setClientB(c); setProB(p);

      const completedForPro = p.filter((b) => ["completed", "reviewed"].includes(String(b.status || "")) && Boolean(b.id));
      if (completedForPro.length) {
        const entries = await Promise.all(
          completedForPro.map(async (b) => {
            const bid = String(b.id);
            const rated = await hasResidentReview(bid, user.uid).catch(() => false);
            return [bid, rated] as const;
          })
        );
        setResidentReviewedMap(Object.fromEntries(entries));
      } else {
        setResidentReviewedMap({});
      }
    } catch { setError("Failed to load bookings. Please refresh."); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const openChat = async (otherUid: string, bookingId: string) => {
    if (!user) return;
    try {
      const cid = await getOrCreateConversation(user.uid, otherUid, { bookingId });
      navigate(`/messages?conv=${cid}`);
    } catch {
      setError("Unable to open chat right now. Please try from booking details.");
    }
  };

  const openCancellationDialog = (booking: Record<string, unknown>, role: "client" | "pro") => {
    setCancelRequest({ booking, role });
    setCancelComment("");
    setError("");
  };

  const submitCancellation = async () => {
    if (!cancelRequest || !user) return;

    const b = cancelRequest.booking;
    const role = cancelRequest.role;
    const id = b.id as string;

    setAL(id);
    try {
      const result = await cancelBookingAndRefund(user.uid, id, role);
      if (!result.success) throw new Error(result.reason || "CANCEL_FAILED");

      await updateBookingFields(id, {
        cancellationComment: cancelComment.trim(),
        cancellationCommentBy: user.uid,
        cancellationCommentRole: role,
      }).catch(() => {});

      if (role === "client") {
        logActivity(user.uid, "booking.cancelled", `Cancelled booking: ${(b.serviceName as string) || id} with ${(b.proName as string) || b.proId}`, {
          bookingId: id,
          role: "client",
          escrowRefunded: (b.escrowCoins as number) || 0,
          comment: cancelComment.trim(),
        });
      } else {
        logActivity(user.uid, "booking.cancelled", `Declined booking: ${(b.serviceName as string) || id} from ${(b.clientName as string) || b.clientId}`, {
          bookingId: id,
          role: "pro",
          escrowRefunded: (b.escrowCoins as number) || 0,
          comment: cancelComment.trim(),
        });
      }

      setCancelRequest(null);
      setCancelComment("");
    } catch {
      setError(role === "client" ? "Failed to cancel. Please try again." : "Failed to decline booking.");
    }
    setAL(null);
    load();
  };

  // Pro confirms booking
  const handleConfirm = async (id: string) => {
    setAL(id);
    try { await updateBookingStatus(id, "confirmed"); }
    catch { setError("Failed to confirm booking."); }
    setAL(null); load();
  };

  // Pro confirms completion after explicit confirmation
  const submitCompletion = async () => {
    if (!completeRequest) return;
    const b = completeRequest;
    const id = b.id as string;
    setAL(id);
    try {
      const escrowCoins = (b.escrowCoins as number) || 0;
      if (escrowCoins === 0) {
        // Free session completed -> PRO earns free consult reward
        await earnCoins(user!.uid, "earn_free_consult", id).catch((err) => {
          console.error(`Failed to earn coins for free consult. User: ${user?.uid}, Booking: ${id}`, err);
        });
      }
      // Release escrow FIRST, then update status
      const result = await releaseEscrow(user!.uid, id, (b.serviceName as string) || "Session");
      if (!result.success) { setError("Failed to release payment. Contact support."); setAL(null); return; }
      await rewardReferral(b.clientId as string, id).catch(() => {});
      logActivity(user!.uid, "booking.completed", `Completed booking: ${(b.serviceName as string) || id} for ${(b.clientName as string) || b.clientId}`, { bookingId: id, role: "pro", escrowReleased: (b.escrowCoins as number) || 0 });
      setCompleteRequest(null);
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
        await addReview(reviewBid, booking.proId as string, reviewRating, reviewComment);
        await updateBookingStatus(reviewBid, "reviewed");
        await earnCoins(user!.uid, "earn_review", reviewBid).catch((err) => {
          console.error(`Failed to earn coins for review. User: ${user?.uid}, Booking: ${reviewBid}`, err);
        });
      }
      setReviewBid(null); setRR(5); setRC(""); load();
    } catch { setError("Failed to submit review."); }
    setRS(false);
  };

  const handleResidentReviewSubmit = async () => {
    if (!residentReviewBid || !user) return;
    setResidentReviewSub(true);
    setError("");
    try {
      const booking = proBookings.find((b) => String(b.id) === residentReviewBid);
      if (!booking) throw new Error("Booking not found");
      await addResidentReview(residentReviewBid, booking.clientId as string, residentReviewRating, residentReviewComment);
      setResidentReviewedMap((prev) => ({ ...prev, [residentReviewBid]: true }));
      setResidentReviewBid(null);
      setResidentReviewRating(5);
      setResidentReviewComment("");
      await load();
    } catch {
      setError("Failed to submit resident rating.");
    }
    setResidentReviewSub(false);
  };

  const bookings = tab === "client" ? clientBookings : proBookings;

  const parseBookingDate = (b: Record<string, unknown>) => {
    const rawDate = (b.date as string) || "";
    if (!rawDate) return null;
    const parsed = new Date(`${rawDate}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const isPastBooking = (b: Record<string, unknown>) => {
    const status = (b.status as string) || "";
    if (!["pending", "confirmed"].includes(status)) return true;
    const bookingDate = parseBookingDate(b);
    if (!bookingDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return bookingDate < today;
  };

  const filtered = bookings.filter(b => {
    // search match
    const match = !searchQ || [b.serviceCategory, b.proName, b.clientName, b.serviceName]
      .some(val => (val as string)?.toLowerCase().includes(searchQ.toLowerCase()));

    // subtab match
    const isPast = isPastBooking(b);
    const isUpcoming = !isPast;
    const subMatch = subTab === "upcoming" ? isUpcoming : isPast;

    return match && subMatch;
  });

  const STATUS_COLOR: Record<string, string> = {
    pending: "badge-warning", confirmed: "badge-accent",
    completed: "badge-success", reviewed: "badge-success", cancelled: "badge-error", closed: "badge-muted",
  };

  const STATUS_LABEL: Record<string, string> = {
    pending: "⏳ Awaiting confirmation",
    confirmed: "✅ Confirmed",
    completed: "✔ Completed",
    reviewed: "⭐ Reviewed",
    cancelled: "✕ Cancelled",
    closed: "🔒 Closed",
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
                const id = b.id as string;
                const busy = actionLoading === id;
                const status = b.status as string;
                const escrowCoins = (b.escrowCoins as number) || 0;
                const amountCoins = (b.amount as number) || 0;
                const billedCoins = amountCoins > 0 ? amountCoins : escrowCoins;
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
                          <span className="text-sm">📅 {formatBookingDateTime(b.date, b.timeSlot, b.createdAt) || "TBD"}</span>
                          <span className="text-sm">🕐 {(b.timeSlot as string) || "TBD"}</span>
                          {billedCoins > 0 ? (
                            <span className="text-sm">
                              🔒 {billedCoins} NC {status === "completed" || status === "reviewed" ? "released" : "in escrow"}
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
                          {/* ── Message button — always available unless cancelled or closed ── */}
                          {status !== "cancelled" && status !== "closed" && (
                            <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => openChat(otherUid, id)}>
                              💬 Message
                            </button>
                          )}

                          {/* ── Pro actions ── */}
                          {tab === "pro" && status === "pending" && (
                            <>
                              <button className="btn btn-success btn-sm" disabled={busy} onClick={() => handleConfirm(id)}>✓ Confirm</button>
                              <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => openCancellationDialog(b, "pro")}>✕ Decline</button>
                            </>
                          )}
                          {tab === "pro" && status === "confirmed" && (
                            <button className="btn btn-success btn-sm" disabled={busy} onClick={() => setCompleteRequest(b)}>
                              {busy ? "Processing…" : "✓ Mark Complete"}
                            </button>
                          )}
                          {tab === "pro" && (status === "completed" || status === "reviewed") && !residentReviewedMap[id] && (
                            <button className="btn btn-primary btn-sm" onClick={() => setResidentReviewBid(id)}>⭐ Rate Resident</button>
                          )}

                          {/* ── Client actions ── */}
                          {tab === "client" && status === "pending" && (
                            <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => openCancellationDialog(b, "client")}>
                              {busy ? "Cancelling…" : `Cancel${escrowCoins > 0 ? " & Refund" : ""}`}
                            </button>
                          )}
                          {tab === "client" && status === "completed" && (
                            <>
                              <button className="btn btn-primary btn-sm" onClick={() => setReviewBid(id)}>⭐ Review</button>
                              <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/book/${b.proId as string}${buildRecurringRebookQuery(b)}`)}>↻ Book Next Session</button>
                            </>
                          )}
                          {tab === "client" && status === "reviewed" && (
                            <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/book/${b.proId as string}${buildRecurringRebookQuery(b)}`)}>↻ Book Next Session</button>
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
                {[1, 2, 3, 4, 5].map(n => (
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

      {residentReviewBid && (
        <div className="modal-overlay" onClick={() => setResidentReviewBid(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Rate Resident</h3>
              <button className="modal-close" onClick={() => setResidentReviewBid(null)}>✕</button>
            </div>
            <div className="form-group">
              <label className="form-label">Rating</label>
              <div className="stars">
                {[1, 2, 3, 4, 5].map(n => (
                  <button key={n} className={`star ${n <= residentReviewRating ? "filled" : "empty"}`} onClick={() => setResidentReviewRating(n)}>★</button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Comment</label>
              <textarea className="form-input" placeholder="How was resident experience?" value={residentReviewComment} onChange={e => setResidentReviewComment(e.target.value)} />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setResidentReviewBid(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleResidentReviewSubmit} disabled={residentReviewSub || !residentReviewComment.trim()}>
                {residentReviewSub ? "Submitting…" : "Submit Rating"}
              </button>
            </div>
          </div>
        </div>
      )}

      {cancelRequest && (
        <div className="modal-overlay" onClick={() => setCancelRequest(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Confirm {cancelRequest.role === "client" ? "Cancellation" : "Decline"}</h3>
              <button className="modal-close" onClick={() => setCancelRequest(null)}>✕</button>
            </div>
            <div className="form-group">
              <label className="form-label">Comment</label>
              <textarea
                className="form-input"
                placeholder="Add reason for cancellation..."
                value={cancelComment}
                onChange={e => setCancelComment(e.target.value)}
              />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setCancelRequest(null)}>Keep Booking</button>
              <button
                className="btn btn-danger"
                onClick={submitCancellation}
                disabled={Boolean(actionLoading) || !cancelComment.trim()}
              >
                {actionLoading ? "Submitting..." : (cancelRequest.role === "client" ? "Cancel Booking" : "Decline Booking")}
              </button>
            </div>
          </div>
        </div>
      )}

      {completeRequest && (
        <div className="modal-overlay" onClick={() => setCompleteRequest(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Confirm Completion</h3>
              <button className="modal-close" onClick={() => setCompleteRequest(null)}>✕</button>
            </div>
            <p style={{ marginBottom: 16, color: "var(--muted)" }}>
              Are you sure? This will release payment and close the session.
            </p>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setCompleteRequest(null)} disabled={Boolean(actionLoading)}>
                Keep Open
              </button>
              <button className="btn btn-success" onClick={submitCompletion} disabled={Boolean(actionLoading)}>
                {actionLoading ? "Processing..." : "Yes, Mark Completed"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
