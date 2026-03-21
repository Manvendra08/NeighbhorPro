import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { getBookingById, updateBookingStatus } from "../services/firestoreService";
import { refundBooking } from "../services/coinService";
import { useToast } from "../components/layout/Toast";

export default function BookingDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [booking, setBooking] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);

  const load = async () => {
    if (!id || !user) return;
    setLoading(true);
    try {
      const b = await getBookingById(id);
      if (b) setBooking(b);
      else toast.error("Booking not found");
    } catch {
      toast.error("Failed to load booking details");
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [id, user]);

  const handleStatusChange = async (status: string) => {
    if (!id || !booking) return;
    setActionBusy(true);
    try {
      await updateBookingStatus(id, status);
      toast.success(`Booking ${status}`);
      load();
    } catch {
      toast.error("Action failed");
    }
    setActionBusy(false);
  };

  const handleCancel = async () => {
    if (!id || !booking) return;
    setActionBusy(true);
    try {
      await updateBookingStatus(id, "cancelled");
      if (booking.coinsPaid && (booking.paidInCoins as number) > 0) {
        await refundBooking(user!.uid, id, booking.paidInCoins as number, (booking.serviceName as string) || "Booking");
      }
      toast.success("Booking cancelled" + (booking.coinsPaid ? " and refunded" : ""));
      load();
    } catch {
      toast.error("Failed to cancel booking");
    }
    setActionBusy(false);
  };

  if (loading) return <div style={{ textAlign: "center", padding: 80 }}><div className="loader" style={{ margin: "0 auto" }} /></div>;
  if (!booking) return (
    <div className="empty-state">
      <div className="empty-state-icon">❌</div>
      <div className="empty-state-title">Booking Not Found</div>
      <button className="btn btn-primary" onClick={() => navigate("/bookings")} style={{ marginTop: 12 }}>Back to Bookings</button>
    </div>
  );

  const isClient = user?.uid === booking.clientId;
  const isPro = user?.uid === booking.proId;
  const otherName = isClient ? booking.proName : booking.clientName;
  const statusColor: Record<string, string> = { pending: "badge-warning", confirmed: "badge-accent", completed: "badge-success", reviewed: "badge-success", cancelled: "badge-error" };

  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)} style={{ marginBottom: 16 }}>← Back</button>
      
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 22, marginBottom: 4 }}>{(booking.serviceName as string) || "Consultation"}</h1>
            <p className="text-muted">{isClient ? `with ${(otherName as string)}` : `from ${(otherName as string)}`}</p>
          </div>
          <span className={`badge ${statusColor[booking.status as string] || "badge-muted"}`} style={{ fontSize: 13, padding: "6px 12px" }}>
            {booking.status as string}
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
          <div style={{ background: "var(--surface-2)", padding: 16, borderRadius: 8 }}>
            <span className="text-muted text-sm" style={{ display: "block", marginBottom: 4 }}>Date</span>
            <span style={{ fontWeight: 600 }}>{booking.date as string}</span>
          </div>
          <div style={{ background: "var(--surface-2)", padding: 16, borderRadius: 8 }}>
            <span className="text-muted text-sm" style={{ display: "block", marginBottom: 4 }}>Time</span>
            <span style={{ fontWeight: 600 }}>{booking.timeSlot as string}</span>
          </div>
        </div>

        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16, marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span className="text-muted">Payment</span>
            <span style={{ fontWeight: 700 }}>
              {(booking.amount as number) === 0 ? "Free" : `${booking.amount as number} NC`}
            </span>
          </div>
          {(booking.notes as string) && (
            <div style={{ marginTop: 12 }}>
              <span className="text-muted" style={{ display: "block", marginBottom: 4 }}>Notes</span>
              <p style={{ background: "var(--surface-2)", padding: 12, borderRadius: 6, fontSize: 14 }}>{booking.notes as string}</p>
            </div>
          )}
        </div>

        {/* Actions based on role and status */}
        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", borderTop: "1px solid var(--border)", paddingTop: 16 }}>
          {isClient && booking.status === "pending" && (
            <button className="btn btn-danger" disabled={actionBusy} onClick={handleCancel}>
              {actionBusy ? "Cancelling…" : `Cancel${booking.coinsPaid ? " & Refund" : ""}`}
            </button>
          )}
          {isClient && booking.status === "completed" && (
             <button className="btn btn-primary" onClick={() => navigate("/bookings")}>Go to Bookings to Review</button>
          )}
          {isPro && booking.status === "pending" && (
            <>
              <button className="btn btn-danger" disabled={actionBusy} onClick={() => handleStatusChange("cancelled")}>Decline</button>
              <button className="btn btn-success" disabled={actionBusy} onClick={() => handleStatusChange("confirmed")}>Confirm Bookings</button>
            </>
          )}
          {isPro && booking.status === "confirmed" && (
            <button className="btn btn-success" disabled={actionBusy} onClick={() => handleStatusChange("completed")}>Mark Complete</button>
          )}
          <button className="btn btn-secondary" onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success("Link copied"); }}>
            Share Link
          </button>
        </div>
      </div>
    </div>
  );
}
