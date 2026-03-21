import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { createBooking, getUserProfile, getServicesByUser, getBookingsForProOnDate, updateBookingFields } from "../services/firestoreService";
import { payForBooking, earnCoins } from "../services/coinService";
import { useToast } from "../components/layout/Toast";

export default function BookingFlow() {
  const { id: proId } = useParams<{ id: string }>();
  const { user, userProfile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [pro, setPro] = useState<Record<string, unknown> | null>(null);
  const [proNotFound, setProNotFound] = useState(false);
  const [services, setServices] = useState<Record<string, unknown>[]>([]);
  const [takenSlots, setTakenSlots] = useState<string[]>([]);
  const [selectedService, setSelectedService] = useState<Record<string, unknown> | null>(null);
  
  const [step, setStep] = useState(1);
  const [date, setDate] = useState("");
  const [timeSlot, setTimeSlot] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!proId) return;
    Promise.all([
      getUserProfile(proId),
      getServicesByUser(proId)
    ])
      .then(([p, s]) => { 
        if (p) {
          setPro(p);
          setServices(s);
          if (s.length === 0) {
            setSelectedService({
              id: "generic",
              title: `Consultation with ${p.displayName || "Professional"}`,
              price: p.isFreeConsultation ? 0 : (p.hourlyRate || 0),
              duration: "60 minutes"
            });
          }
        } else setProNotFound(true); 
      })
      .catch(() => setProNotFound(true));
  }, [proId]);

  useEffect(() => {
    if (!proId || !date) return;
    getBookingsForProOnDate(proId, date).then((bookings) => {
      setTakenSlots(bookings.map((b) => b.timeSlot as string));
    });
  }, [proId, date]);

  const timeSlots = ["09:00 AM","10:00 AM","11:00 AM","12:00 PM","02:00 PM","03:00 PM","04:00 PM","05:00 PM","06:00 PM","07:00 PM"];

  const isSelf    = user?.uid === proId;
  const isFree    = selectedService ? (selectedService.price as number) === 0 : !!(pro?.isFreeConsultation as boolean);
  const feeCoins  = selectedService ? (selectedService.price as number) : (isFree ? 0 : ((pro?.hourlyRate as number) || 0));
  const serviceName = selectedService ? (selectedService.title as string) : `Consultation with ${(pro?.displayName as string) || "Professional"}`;
  const balance   = userProfile?.coinBalance ?? 0;
  const hasEnough = isFree || balance >= feeCoins;

  const handleSubmit = async () => {
    if (!date || !timeSlot || !selectedService) { toast.error("Please select a service, date, and time slot."); return; }
    if (!hasEnough) { toast.error(`Insufficient balance. You need ${feeCoins} NC but have ${balance} NC.`); return; }
    setLoading(true);
    try {
      const bookingId = await createBooking({
        clientId:   user!.uid,
        clientName: userProfile?.displayName || user!.displayName || user!.email,
        proId:      proId!,
        proName:    (pro?.displayName as string) || "",
        serviceId:  selectedService.id,
        serviceName, date, timeSlot, notes,
        isPaid: !isFree, amount: feeCoins, coinsPaid: false, paidInCoins: 0,
      });

      if (!isFree && feeCoins > 0) {
        const result = await payForBooking(user!.uid, proId!, bookingId, feeCoins, serviceName);
        if (!result.success) {
          toast.error(result.reason === "INSUFFICIENT_BALANCE"
            ? "Insufficient NC balance. Please top up your wallet."
            : "Payment failed. Please try again.");
          setLoading(false); return;
        }
        // IMPORTANT: Mark booking as paid since coins were deducted
        await updateBookingFields(bookingId, { coinsPaid: true, paidInCoins: feeCoins });
      }

      if (isFree) await earnCoins(proId!, "earn_free_consult", bookingId);
      toast.success("Booking confirmed!");
      setStep(3);
    } catch {
      toast.error("Failed to create booking. Please try again.");
    }
    setLoading(false);
  };

  // Important #7: self-booking guard
  if (isSelf) return (
    <div style={{ maxWidth: 480, margin: "80px auto", textAlign: "center" }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🚫</div>
      <h2 style={{ marginBottom: 8 }}>Can't book yourself</h2>
      <p className="text-muted" style={{ marginBottom: 24 }}>You can't book your own services. Share your profile link with others.</p>
      <button className="btn btn-primary" onClick={() => navigate("/browse")}>Browse Other Pros</button>
    </div>
  );

  if (proNotFound) return (
    <div style={{ maxWidth: 480, margin: "80px auto", textAlign: "center" }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
      <h2 style={{ marginBottom: 8 }}>Professional not found</h2>
      <p className="text-muted" style={{ marginBottom: 24 }}>This profile may have been removed or the link is incorrect.</p>
      <button className="btn btn-primary" onClick={() => navigate("/browse")}>Browse Professionals</button>
    </div>
  );

  if (!pro) return <div style={{ textAlign: "center", padding: 80 }}><div className="loader" style={{ margin: "0 auto" }} /></div>;

  return (
    <div style={{ maxWidth: 560, margin: "0 auto" }}>
      <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)} style={{ marginBottom: 16 }}>← Back</button>
      <h1 className="page-title" style={{ marginBottom: 24 }}>Book Consultation</h1>

      {/* Progress */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 32 }}>
        {[1, 2, 3].map((s) => (
          <div key={s} style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, transition: "all 0.2s", background: step >= s ? "var(--accent)" : "var(--surface-2)", color: step >= s ? "#fff" : "var(--muted)" }}>
              {step > s ? "✓" : s}
            </div>
            {s < 3 && <div style={{ flex: 1, height: 2, transition: "all 0.2s", background: step > s ? "var(--accent)" : "var(--border)" }} />}
          </div>
        ))}
      </div>

      {/* Step 1 */}
      {step === 1 && (
        <div className="card">
          <h3 className="card-title" style={{ marginBottom: 4 }}>Select Service & Time</h3>
          <p className="text-muted text-sm" style={{ marginBottom: 20 }}>Book time with {(pro.displayName as string) || "the professional"}</p>
          
          {services.length > 0 && (
            <div className="form-group" style={{ marginBottom: 24 }}>
              <label className="form-label">Service</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {services.map(svc => (
                  <div 
                    key={svc.id as string} 
                    onClick={() => setSelectedService(svc)}
                    style={{ 
                      padding: "12px 16px", 
                      border: "2px solid",
                      borderColor: selectedService?.id === svc.id ? "var(--accent)" : "var(--border)",
                      background: selectedService?.id === svc.id ? "rgba(245, 105, 44, 0.05)" : "var(--surface-2)",
                      borderRadius: "var(--radius-sm)",
                      cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center"
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: selectedService?.id === svc.id ? 700 : 600 }}>{svc.title as string}</div>
                      {(svc.duration as string) && <div className="text-muted text-sm" style={{ marginTop: 2 }}>{svc.duration as string}</div>}
                    </div>
                    <div style={{ fontWeight: 700, color: (svc.price as number) === 0 ? "var(--accent2)" : "var(--text)" }}>
                      {(svc.price as number) === 0 ? "Free" : `${svc.price as number} NC`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Date</label>
            <input type="date" className="form-input" value={date} onChange={(e) => { setDate(e.target.value); setTimeSlot(""); }} min={new Date().toISOString().split("T")[0]} />
          </div>
          <div className="form-group">
            <label className="form-label">Time Slot</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 8 }}>
              {timeSlots.map((t) => {
                const isTaken = takenSlots.includes(t);
                return (
                  <button 
                    key={t} 
                    disabled={isTaken}
                    className={`chip${timeSlot === t ? " active" : ""}`} 
                    onClick={() => setTimeSlot(t)} 
                    style={{ justifyContent: "center", position: "relative", opacity: isTaken ? 0.5 : 1, cursor: isTaken ? "not-allowed" : "pointer" }}
                  >
                    {t}
                    {isTaken && <span style={{ position: "absolute", fontSize: 10, color: "var(--error)", background: "var(--surface)", padding: "2px 4px", borderRadius: 4, right: 4, top: -6 }}>Booked</span>}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Notes (optional)</label>
            <textarea className="form-input" placeholder="Describe what you need help with…" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <button className="btn btn-primary btn-lg" style={{ width: "100%", marginTop: 8 }} onClick={() => { if (!date || !timeSlot || !selectedService) { toast.error("Please select a service, date, and time slot."); return; } setStep(2); }}>Continue</button>
        </div>
      )}

      {/* Step 2 */}
      {step === 2 && (
        <div className="card">
          <h3 className="card-title" style={{ marginBottom: 16 }}>Confirm & Pay</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 0, marginBottom: 20 }}>
            {[["Professional", (pro.displayName as string) || "Professional"], ["Date", date], ["Time", timeSlot]].map(([label, value]) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "11px 0", borderBottom: "1px solid var(--border)" }}>
                <span className="text-muted">{label}</span><span style={{ fontWeight: 600 }}>{value}</span>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0", borderBottom: "1px solid var(--border)" }}>
              <span className="text-muted">Payment</span>
              {isFree ? <span style={{ fontWeight: 700, color: "#16a34a" }}>Free 🎁</span> : (
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 800, fontSize: "1.05rem", color: "#1B6B8A" }}>🪙 {feeCoins.toLocaleString("en-IN")} NC</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>= ₹{feeCoins} · debited from your wallet</div>
                </div>
              )}
            </div>
            {!isFree && (
              <div style={{ display: "flex", justifyContent: "space-between", padding: "11px 0" }}>
                <span className="text-muted">Your balance</span>
                <span style={{ fontWeight: 600, color: hasEnough ? "var(--text)" : "#dc2626" }}>{balance.toLocaleString("en-IN")} NC {!hasEnough && "⚠️ insufficient"}</span>
              </div>
            )}
          </div>
            {!hasEnough && (
            <div style={{ background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.25)", borderRadius: 10, padding: "12px 16px", marginBottom: 16, fontSize: "0.88rem", color: "#dc2626" }}>
              You need {feeCoins} NC but have {balance} NC.{" "}
              <button onClick={() => navigate("/wallet")} style={{ background: "none", border: "none", color: "#dc2626", textDecoration: "underline", cursor: "pointer", fontSize: "inherit" }}>Top up wallet →</button>
            </div>
          )}
          {notes && <div style={{ padding: "10px 0 16px" }}><span className="text-muted" style={{ display: "block", marginBottom: 4, fontSize: 13 }}>Notes</span><span style={{ fontSize: 14, color: "var(--text-2)" }}>{notes}</span></div>}
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setStep(1)}>Back</button>
            <button className="btn btn-primary" style={{ flex: 2 }} onClick={handleSubmit} disabled={loading || !hasEnough}>
              {loading ? "Processing…" : isFree ? "Confirm Booking" : `Pay ${feeCoins} NC & Confirm`}
            </button>
          </div>
        </div>
      )}

      {/* Step 3 — Success */}
      {step === 3 && (
        <div className="card" style={{ textAlign: "center", padding: 48 }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
          <h2 style={{ marginBottom: 8 }}>Booking Confirmed!</h2>
          <p className="text-muted" style={{ marginBottom: 16 }}>Consultation with {pro.displayName as string} on {date} at {timeSlot}.</p>
          {!isFree && <div style={{ display: "inline-block", background: "rgba(27,107,138,0.1)", borderRadius: 10, padding: "8px 20px", marginBottom: 20, color: "#1B6B8A", fontWeight: 600, fontSize: "0.9rem" }}>🪙 {feeCoins} NC deducted · Remaining: {(balance - feeCoins).toLocaleString("en-IN")} NC</div>}
          {isFree && <div style={{ display: "inline-block", background: "rgba(22,163,74,0.1)", borderRadius: 10, padding: "8px 20px", marginBottom: 20, color: "#16a34a", fontWeight: 600, fontSize: "0.9rem" }}>🏆 Pro earns +50 NC for this free consultation</div>}
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button className="btn btn-secondary" onClick={() => navigate("/bookings")}>View Bookings</button>
            <button className="btn btn-primary" onClick={() => navigate("/dashboard")}>Dashboard</button>
          </div>
        </div>
      )}
    </div>
  );
}
