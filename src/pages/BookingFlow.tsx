import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { createBooking, getUserProfile } from "../services/firestoreService";
import { useEffect } from "react";

export default function BookingFlow() {
  const { id: proId } = useParams<{ id: string }>();
  const { user, userProfile } = useAuth();
  const navigate = useNavigate();
  const [pro, setPro] = useState<Record<string, unknown> | null>(null);
  const [step, setStep] = useState(1);
  const [date, setDate] = useState("");
  const [timeSlot, setTimeSlot] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!proId) return;
    getUserProfile(proId).then((p) => setPro(p));
  }, [proId]);

  const timeSlots = [
    "09:00 AM", "10:00 AM", "11:00 AM", "12:00 PM",
    "02:00 PM", "03:00 PM", "04:00 PM", "05:00 PM",
    "06:00 PM", "07:00 PM",
  ];

  const handleSubmit = async () => {
    if (!date || !timeSlot) {
      setError("Please select a date and time slot.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await createBooking({
        clientId: user!.uid,
        clientName: userProfile?.displayName || user!.displayName || user!.email,
        proId: proId!,
        proName: (pro?.displayName as string) || "",
        serviceName: `Consultation with ${(pro?.displayName as string) || "Professional"}`,
        date,
        timeSlot,
        notes,
        isPaid: !(pro?.isFreeConsultation as boolean),
        amount: (pro?.isFreeConsultation as boolean) ? 0 : (pro?.hourlyRate as number) || 0,
      });
      setStep(3); // success
    } catch {
      setError("Failed to create booking. Please try again.");
    }
    setLoading(false);
  };

  if (!pro) {
    return (
      <div style={{ textAlign: "center", padding: 80 }}>
        <div className="loader" style={{ margin: "0 auto" }} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 560, margin: "0 auto" }}>
      <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)} style={{ marginBottom: 16 }}>
        ← Back
      </button>

      <h1 className="page-title" style={{ marginBottom: 24 }}>Book Consultation</h1>

      {/* Progress indicator */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 32 }}>
        {[1, 2, 3].map((s) => (
          <div key={s} style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
            <div
              style={{
                width: 32, height: 32, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 14, fontWeight: 700,
                background: step >= s ? "var(--accent)" : "var(--surface-2)",
                color: step >= s ? "#fff" : "var(--muted)",
                transition: "all 0.2s",
              }}
            >
              {step > s ? "✓" : s}
            </div>
            {s < 3 && (
              <div style={{
                flex: 1, height: 2,
                background: step > s ? "var(--accent)" : "var(--border)",
                transition: "all 0.2s",
              }} />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Select date & time */}
      {step === 1 && (
        <div className="card">
          <h3 className="card-title" style={{ marginBottom: 4 }}>Select Date & Time</h3>
          <p className="text-muted text-sm" style={{ marginBottom: 20 }}>
            Choose when you'd like to consult with {(pro.displayName as string) || "the professional"}
          </p>

          <div className="form-group">
            <label className="form-label">Date</label>
            <input
              type="date"
              className="form-input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              min={new Date().toISOString().split("T")[0]}
              id="booking-date-input"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Time Slot</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
              {timeSlots.map((t) => (
                <button
                  key={t}
                  className={`chip${timeSlot === t ? " active" : ""}`}
                  onClick={() => setTimeSlot(t)}
                  style={{ justifyContent: "center" }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Notes (optional)</label>
            <textarea
              className="form-input"
              placeholder="Describe what you need help with…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              id="booking-notes-input"
            />
          </div>

          {error && <div className="error-box">{error}</div>}

          <button
            className="btn btn-primary btn-lg"
            style={{ width: "100%", marginTop: 8 }}
            onClick={() => {
              if (!date || !timeSlot) {
                setError("Please select a date and time slot.");
                return;
              }
              setError("");
              setStep(2);
            }}
          >
            Continue
          </button>
        </div>
      )}

      {/* Step 2: Confirm */}
      {step === 2 && (
        <div className="card">
          <h3 className="card-title" style={{ marginBottom: 16 }}>Confirm Booking</h3>

          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
              <span className="text-muted">Professional</span>
              <span style={{ fontWeight: 600 }}>{(pro.displayName as string) || "Professional"}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
              <span className="text-muted">Date</span>
              <span style={{ fontWeight: 600 }}>{date}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
              <span className="text-muted">Time</span>
              <span style={{ fontWeight: 600 }}>{timeSlot}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
              <span className="text-muted">Price</span>
              <span style={{ fontWeight: 700, color: (pro.isFreeConsultation as boolean) ? "var(--accent2)" : "var(--text)" }}>
                {(pro.isFreeConsultation as boolean) ? "Free" : `₹${(pro.hourlyRate as number) || 0}`}
              </span>
            </div>
            {notes && (
              <div style={{ padding: "10px 0" }}>
                <span className="text-muted" style={{ display: "block", marginBottom: 4 }}>Notes</span>
                <span style={{ fontSize: 14, color: "var(--text-2)" }}>{notes}</span>
              </div>
            )}
          </div>

          {error && <div className="error-box">{error}</div>}

          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setStep(1)}>
              Back
            </button>
            <button
              className="btn btn-primary"
              style={{ flex: 2 }}
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? "Booking…" : "Confirm Booking"}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Success */}
      {step === 3 && (
        <div className="card" style={{ textAlign: "center", padding: 48 }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
          <h2 style={{ marginBottom: 8 }}>Booking Confirmed!</h2>
          <p className="text-muted" style={{ marginBottom: 24 }}>
            Your consultation with {(pro.displayName as string)} is scheduled for {date} at {timeSlot}.
            You'll receive a notification when they confirm.
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button className="btn btn-secondary" onClick={() => navigate("/bookings")}>
              View Bookings
            </button>
            <button className="btn btn-primary" onClick={() => navigate("/dashboard")}>
              Go to Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
