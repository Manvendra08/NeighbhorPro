import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { createBooking, getUserProfile, getServicesByUser, getOrCreateConversation } from "../services/firestoreService";
import { holdEscrow, earnCoins } from "../services/coinService";

export default function BookingFlow() {
  const { id: proId } = useParams<{ id: string }>();
  const { user, userProfile } = useAuth();
  const navigate = useNavigate();

  const [pro, setPro]             = useState<Record<string, unknown> | null>(null);
  const [proNotFound, setPNF]     = useState(false);
  const [services, setServices]   = useState<Record<string, unknown>[]>([]);
  const [selectedSvc, setSvc]     = useState<Record<string, unknown> | null>(null);
  const [step, setStep]           = useState(1);
  const [date, setDate]           = useState("");
  const [timeSlot, setTS]         = useState("");
  const [notes, setNotes]         = useState("");
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");
  const [convId, setConvId]       = useState<string | null>(null); // for success screen

  useEffect(() => {
    if (!proId) return;
    Promise.all([getUserProfile(proId), getServicesByUser(proId)])
      .then(([p, s]) => {
        if (!p) { setPNF(true); return; }
        setPro(p);
        setServices(s);
        // Pre-select default service
        const defaultSvc = s.length > 0 ? s[0] : {
          id: "generic",
          title: `Consultation with ${p.displayName || "Professional"}`,
          price: p.isFreeConsultation ? 0 : (p.hourlyRate || 0),
          duration: "60 minutes",
        };
        setSvc(defaultSvc as Record<string, unknown>);
      })
      .catch(() => setPNF(true));
  }, [proId]);

  const timeSlots = ["09:00 AM","10:00 AM","11:00 AM","12:00 PM","02:00 PM","03:00 PM","04:00 PM","05:00 PM","06:00 PM","07:00 PM"];

  const isSelf    = user?.uid === proId;
  const isFree    = (selectedSvc?.price as number) === 0;
  const feeCoins  = (selectedSvc?.price as number) || 0;
  const balance   = userProfile?.coinBalance ?? 0;
  const hasEnough = isFree || balance >= feeCoins;

  const handleSubmit = async () => {
    if (!date || !timeSlot || !selectedSvc) { setError("Please select a service, date, and time slot."); return; }
    if (!hasEnough) { setError(`Insufficient balance. You need ${feeCoins} NC but have ${balance} NC.`); return; }
    setLoading(true); setError("");
    try {
      const serviceName = selectedSvc.title as string;

      // 1. Create booking in pending state — escrow NOT yet released to pro
      const bookingId = await createBooking({
        clientId:   user!.uid,
        clientName: userProfile?.displayName || user!.displayName || user!.email,
        proId:      proId!,
        proName:    (pro?.displayName as string) || "",
        serviceId:  selectedSvc.id,
        serviceName, date, timeSlot, notes,
        isPaid: !isFree, amount: feeCoins,
        coinsPaid: false, escrowCoins: 0, escrowStatus: "none",
      });

      // 2. Debit client and hold in escrow (pro is NOT credited here)
      if (!isFree && feeCoins > 0) {
        const result = await holdEscrow(user!.uid, bookingId, feeCoins, serviceName);
        if (!result.success) {
          setError(result.reason === "INSUFFICIENT_BALANCE"
            ? "Insufficient NC balance. Please top up your wallet."
            : "Payment failed. Please try again.");
          setLoading(false); return;
        }
      }

      // 3. For free sessions, credit pro earn coins
      if (isFree) await earnCoins(proId!, "earn_free_consult", bookingId);

      // 4. Auto-create conversation so client and pro can chat immediately
      const cid = await getOrCreateConversation(user!.uid, proId!);
      setConvId(cid);

      setStep(3);
    } catch {
      setError("Failed to create booking. Please try again.");
    }
    setLoading(false);
  };

  if (isSelf) return (
    <div style={{ maxWidth: 480, margin: "80px auto", textAlign: "center" }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🚫</div>
      <h2 style={{ marginBottom: 8 }}>Can't book yourself</h2>
      <p className="text-muted" style={{ marginBottom: 24 }}>You can't book your own services.</p>
      <button className="btn btn-primary" onClick={() => navigate("/browse")}>Browse Other Pros</button>
    </div>
  );

  if (proNotFound) return (
    <div style={{ maxWidth: 480, margin: "80px auto", textAlign: "center" }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
      <h2 style={{ marginBottom: 8 }}>Professional not found</h2>
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
            {s < 3 && <div style={{ flex: 1, height: 2, background: step > s ? "var(--accent)" : "var(--border)" }} />}
          </div>
        ))}
      </div>

      {/* ── Step 1: Select service & time ── */}
      {step === 1 && (
        <div className="card">
          <h3 className="card-title" style={{ marginBottom: 4 }}>Select Service & Time</h3>
          <p className="text-muted text-sm" style={{ marginBottom: 20 }}>Book time with {(pro.displayName as string) || "the professional"}</p>

          {services.length > 0 && (
            <div className="form-group">
              <label className="form-label">Service</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {services.map(svc => (
                  <div key={svc.id as string} onClick={() => setSvc(svc)} style={{ padding: "12px 16px", border: `2px solid ${selectedSvc?.id === svc.id ? "var(--accent)" : "var(--border)"}`, background: selectedSvc?.id === svc.id ? "rgba(13,107,107,0.04)" : "var(--surface-2)", borderRadius: "var(--radius-sm)", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{svc.title as string}</div>
                      {(svc.duration as string) && <div className="text-muted text-sm">{svc.duration as string}</div>}
                    </div>
                    <span style={{ fontWeight: 700, color: (svc.price as number) === 0 ? "var(--accent2)" : "var(--text)" }}>
                      {(svc.price as number) === 0 ? "Free" : `${svc.price as number} NC`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Date</label>
            <input type="date" className="form-input" value={date} onChange={e => { setDate(e.target.value); setTS(""); }} min={new Date().toISOString().split("T")[0]} />
          </div>

          <div className="form-group">
            <label className="form-label">Time Slot</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 8 }}>
              {timeSlots.map(t => (
                <button key={t} className={`chip${timeSlot === t ? " active" : ""}`} onClick={() => setTS(t)} style={{ justifyContent: "center" }}>{t}</button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Notes (optional)</label>
            <textarea className="form-input" placeholder="Describe what you need help with…" value={notes} onChange={e => setNotes(e.target.value)} />
          </div>

          {error && <div className="error-box">{error}</div>}
          <button className="btn btn-primary btn-lg" style={{ width: "100%", marginTop: 8 }} onClick={() => { if (!date || !timeSlot || !selectedSvc) { setError("Please select a service, date and time."); return; } setError(""); setStep(2); }}>Continue</button>
        </div>
      )}

      {/* ── Step 2: Confirm & Pay ── */}
      {step === 2 && (
        <div className="card">
          <h3 className="card-title" style={{ marginBottom: 16 }}>Confirm & Pay</h3>

          {/* Escrow info banner */}
          {!isFree && (
            <div style={{ background: "rgba(27,107,138,0.06)", border: "1px solid rgba(27,107,138,0.15)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: "0.82rem", color: "#1B6B8A" }}>
              🔒 <strong>NC held securely.</strong> Payment is released to the pro only after the session is marked complete.
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", marginBottom: 20 }}>
            {[["Professional", (pro.displayName as string)], ["Service", selectedSvc?.title as string], ["Date", date], ["Time", timeSlot]].map(([label, value]) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                <span className="text-muted">{label}</span><span style={{ fontWeight: 600 }}>{value}</span>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "13px 0", borderBottom: "1px solid var(--border)" }}>
              <span className="text-muted">Payment</span>
              {isFree ? <span style={{ fontWeight: 700, color: "#16a34a" }}>Free 🎁</span> : (
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 800, color: "#1B6B8A" }}>🪙 {feeCoins.toLocaleString("en-IN")} NC</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>held in escrow until completion</div>
                </div>
              )}
            </div>
            {!isFree && (
              <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0" }}>
                <span className="text-muted">Your balance</span>
                <span style={{ fontWeight: 600, color: hasEnough ? "var(--text)" : "#dc2626" }}>{balance.toLocaleString("en-IN")} NC{!hasEnough && " ⚠️ insufficient"}</span>
              </div>
            )}
          </div>

          {!hasEnough && (
            <div style={{ background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.25)", borderRadius: 10, padding: "12px 16px", marginBottom: 16, fontSize: "0.88rem", color: "#dc2626" }}>
              You need {feeCoins} NC but have {balance} NC.{" "}
              <button onClick={() => navigate("/wallet")} style={{ background: "none", border: "none", color: "#dc2626", textDecoration: "underline", cursor: "pointer", fontSize: "inherit" }}>Top up wallet →</button>
            </div>
          )}

          {error && <div className="error-box">{error}</div>}
          {notes && <div style={{ padding: "10px 0 14px" }}><span className="text-muted" style={{ display: "block", marginBottom: 4, fontSize: 13 }}>Notes</span><span style={{ fontSize: 14 }}>{notes}</span></div>}

          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setStep(1)}>Back</button>
            <button className="btn btn-primary" style={{ flex: 2 }} onClick={handleSubmit} disabled={loading || !hasEnough}>
              {loading ? "Processing…" : isFree ? "Confirm Booking" : `Hold ${feeCoins} NC & Confirm`}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Success ── */}
      {step === 3 && (
        <div className="card" style={{ textAlign: "center", padding: 48 }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
          <h2 style={{ marginBottom: 8 }}>Booking Requested!</h2>
          <p className="text-muted" style={{ marginBottom: 16 }}>
            Your request has been sent to <strong>{pro.displayName as string}</strong> for <strong>{date}</strong> at <strong>{timeSlot}</strong>.
            NC will be released to the pro once the session is complete.
          </p>

          {!isFree && (
            <div style={{ display: "inline-block", background: "rgba(27,107,138,0.08)", border: "1px solid rgba(27,107,138,0.15)", borderRadius: 10, padding: "8px 20px", marginBottom: 20, color: "#1B6B8A", fontWeight: 600, fontSize: "0.88rem" }}>
              🔒 {feeCoins} NC held in escrow · Balance: {(balance - feeCoins).toLocaleString("en-IN")} NC
            </div>
          )}
          {isFree && (
            <div style={{ display: "inline-block", background: "rgba(22,163,74,0.1)", borderRadius: 10, padding: "8px 20px", marginBottom: 20, color: "#16a34a", fontWeight: 600, fontSize: "0.88rem" }}>
              🏆 Pro earns +50 NC for free consultations
            </div>
          )}

          {/* Next steps */}
          <div style={{ background: "var(--surface-2)", borderRadius: 12, padding: "14px 18px", marginBottom: 24, textAlign: "left" }}>
            <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>What happens next</div>
            {[
              ["1", "Pro confirms your booking", "You'll see status change to Confirmed"],
              ["2", "Attend your session", "On the agreed date & time"],
              ["3", "Pro marks it complete", "NC is released from escrow to the pro"],
              ["4", "Leave a review", "Earn +10 NC and help the community"],
            ].map(([n, title, sub]) => (
              <div key={n} style={{ display: "flex", gap: 10, marginBottom: 8, alignItems: "flex-start" }}>
                <div style={{ width: 20, height: 20, borderRadius: "50%", background: "var(--accent)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>{n}</div>
                <div>
                  <div style={{ fontSize: "0.88rem", fontWeight: 600 }}>{title}</div>
                  <div style={{ fontSize: "0.78rem", color: "var(--muted)" }}>{sub}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            {convId && (
              <button className="btn btn-primary" onClick={() => navigate(`/messages?conv=${convId}`)}>
                💬 Message {pro.displayName as string}
              </button>
            )}
            <button className="btn btn-secondary" onClick={() => navigate("/bookings")}>View Bookings</button>
          </div>
        </div>
      )}
    </div>
  );
}
