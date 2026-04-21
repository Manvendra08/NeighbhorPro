import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  createBooking, getPublicProfile, getServicesByUser, getOrCreateConversation,
  getProAvailability, getBookingsForProOnDate, uploadBookingAttachment, getPlatformSettings
} from "../services/firestoreService";
import { logActivity } from "../services/activityService";
import { BOOKING_BRIEF_MAX_CHARS, isBookingBriefValid } from "../utils/booking";
import { getInitialServiceCategory, getServiceCategories, shouldShowCategoryFilter } from "../utils/serviceSelection";

export default function BookingFlow() {
  const { id: proId } = useParams<{ id: string }>();
  const { user, userProfile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [pro, setPro] = useState<Record<string, unknown> | null>(null);
  const [proNotFound, setPNF] = useState(false);
  const [services, setServices] = useState<Record<string, unknown>[]>([]);
  const [selectedSvc, setSvc] = useState<Record<string, unknown> | null>(null);
  const [step, setStep] = useState(1);
  const [date, setDate] = useState("");
  const [timeSlot, setTS] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [convId, setConvId] = useState<string | null>(null); // for success screen
  const [postBookingWarning, setPostBookingWarning] = useState("");

  const [proAvail, setProAvail] = useState<Record<string, any> | null>(null);
  const [commissionRate, setCommissionRate] = useState(10);
  const [availableSlots, setAvailSlots] = useState<string[]>([]);
  const [checkingAvail, setCA] = useState(false);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [selectedCat, setCat] = useState<string>("");

  const preselectedServiceId = searchParams.get("serviceId");
  const rebookDate = searchParams.get("date") ?? "";
  const rebookTimeSlot = searchParams.get("timeSlot") ?? "";
  const isRebookFlow = searchParams.get("rebook") === "1";

  useEffect(() => {
    if (!proId) return;
    Promise.all([getPublicProfile(proId), getServicesByUser(proId), getProAvailability(proId), getPlatformSettings()])
      .then(([p, s, a, settings]) => {
        if (!p) { setPNF(true); return; }
        setPro(p);
        setServices(s);
        setProAvail(a);
        const configuredRate = Number(settings.commissionRate);
        setCommissionRate(Number.isFinite(configuredRate) && configuredRate >= 0 ? configuredRate : 10);

        // Pre-select default service
        const matchedSvc = preselectedServiceId ? s.find(service => String(service.id) === preselectedServiceId) : null;
        const defaultSvc = matchedSvc ?? (s.length > 0 ? s[0] : {
          id: "generic",
          title: `Consultation with ${p.displayName || "Professional"}`,
          price: p.isFreeConsultation ? 0 : (p.hourlyRate || 0),
          duration: "60 minutes",
        });
        setSvc(defaultSvc as Record<string, unknown>);
        setCat(getInitialServiceCategory(s, preselectedServiceId));
        if (rebookDate) setDate(rebookDate);
      })
      .catch(() => setPNF(true));
  }, [proId, preselectedServiceId, rebookDate]);

  useEffect(() => {
    if (!date || !proId || !proAvail) return;
    setCA(true);
    const [year, month, day] = date.split('-');
    const d = new Date(+year, +month - 1, +day);
    const dayName = d.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();

    const dayAvail = proAvail[dayName];
    if (!dayAvail || !dayAvail.active || !dayAvail.slots || dayAvail.slots.length === 0) {
      setAvailSlots([]);
      setCA(false);
      return;
    }

    getBookingsForProOnDate(proId, date).then(bookings => {
      const bookedSlots = bookings.filter(b => b.status !== "cancelled").map(b => b.timeSlot as string);
      const slots = (dayAvail.slots as string[]).filter(s => !bookedSlots.includes(s));
      setAvailSlots(slots);
      setCA(false);
    }).catch(() => {
      setAvailSlots([]);
      setCA(false);
    });
  }, [date, proId, proAvail]);

  useEffect(() => {
    if (!rebookTimeSlot || timeSlot || availableSlots.length === 0) return;
    if (availableSlots.includes(rebookTimeSlot)) setTS(rebookTimeSlot);
  }, [availableSlots, rebookTimeSlot, timeSlot]);

  const isSelf = user?.uid === proId;
  const selectedServicePrice = Number(selectedSvc?.price) || 0;
  const isQuoteBased = Boolean(selectedSvc?.quoteBased);
  const isFree = !isQuoteBased && selectedServicePrice === 0;
  const proFeeCoins = isQuoteBased ? 0 : selectedServicePrice;
  const appCommissionCoins = isQuoteBased || isFree ? 0 : Math.round((proFeeCoins * commissionRate) / 100);
  const feeCoins = isQuoteBased || isFree ? 0 : proFeeCoins + appCommissionCoins;
  const requiresCoinHold = feeCoins > 0;
  const balance = userProfile?.coinBalance ?? 0;
  const hasEnough = !requiresCoinHold || balance >= feeCoins;

  const categories = useMemo(() => getServiceCategories(services), [services]);

  const filteredServices = useMemo(
    () => services.filter(service => !selectedCat || service.category === selectedCat),
    [services, selectedCat],
  );

  useEffect(() => {
    if (!services.length) return;
    if (!selectedCat || !categories.includes(selectedCat)) {
      setCat(categories[0] || "Other");
    }
  }, [categories, selectedCat, services.length]);

  useEffect(() => {
    if (!selectedSvc) return;
    if (selectedCat && selectedSvc.category !== selectedCat) {
      const nextSelected = filteredServices[0] || null;
      setSvc(nextSelected);
    }
  }, [filteredServices, selectedCat, selectedSvc]);

  const missingProfileItems: string[] = [];
  if (!String(userProfile?.displayName || "").trim()) missingProfileItems.push("Full name");
  if (!String(userProfile?.society || "").trim()) missingProfileItems.push("Society");
  if (!String(userProfile?.phoneNumber || "").trim()) missingProfileItems.push("Phone number");
  if (userProfile?.residentVerificationStatus !== "verified") {
    missingProfileItems.push("Resident verification approval");
  }
  const bookingBlockedByProfile = missingProfileItems.length > 0;

  const handleSubmit = async () => {
    if (!date || !timeSlot || !selectedSvc) { setError("Please select a service, date, and time slot."); return; }
    if (!isBookingBriefValid(notes.trim())) {
      setError(`Brief of service cannot exceed ${BOOKING_BRIEF_MAX_CHARS} characters.`);
      return;
    }
    if (bookingBlockedByProfile) {
      setError("Please update your profile to start booking pros.");
      return;
    }
    if (!hasEnough) { setError(`Insufficient balance. You need ${feeCoins} NC but have ${balance} NC.`); return; }
    setLoading(true); setError("");
    setPostBookingWarning("");
    try {
      const serviceName = selectedSvc.title as string;

      let attachData;
      if (attachment) {
        attachData = await uploadBookingAttachment(null, attachment);
      }

      // 1. Create booking in pending state — escrow NOT yet released to pro
      const bookingId = await createBooking({
        clientId: user!.uid,
        clientName: userProfile?.displayName || user!.displayName || user!.email,
        proId: proId!,
        proName: (pro?.displayName as string) || "",
        serviceId: selectedSvc.id,
        serviceName,
        serviceCategory: selectedSvc.category || "Other",
        date, timeSlot, notes,
        isPaid: requiresCoinHold,
        amount: feeCoins,
        proFee: proFeeCoins,
        commissionRate,
        platformFee: appCommissionCoins,
        proEarning: proFeeCoins,
        coinsPaid: requiresCoinHold,
        escrowCoins: feeCoins,
        escrowStatus: requiresCoinHold ? "held" : "none",
        quoteBased: isQuoteBased,
        ...(attachData && { attachmentUrl: attachData.url, attachmentName: attachData.name, attachmentType: attachData.type })
      });

      // 2. Auto-create conversation so client and pro can chat immediately.
      // Booking should remain successful even if chat bootstrap fails.
      try {
        const cid = await getOrCreateConversation(user!.uid, proId!, { bookingId });
        setConvId(cid);
      } catch {
        setConvId(null);
        setPostBookingWarning("Booking confirmed, but chat could not be prepared yet. Open the booking details page and tap Message to retry.");
      }

      // 3. Log activity
      logActivity(user!.uid, "booking.created", `Booked ${selectedSvc?.title as string} with ${(pro?.displayName as string) || proId} on ${date} at ${timeSlot}`, { bookingId, proId, serviceId: selectedSvc?.id, amount: feeCoins, isFree });
      if (requiresCoinHold) {
        logActivity(user!.uid, "payment.initiated", `Escrow held: ${feeCoins} NC for booking ${bookingId}`, { bookingId, amount: feeCoins });
      }

      setStep(3);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "";
      if (message === "INSUFFICIENT_BALANCE") {
        setError("Insufficient NC balance. Please top up your wallet.");
      } else if (message === "SELF_BOOKING_NOT_ALLOWED") {
        setError("You cannot book your own service.");
      } else if (message === "NOTES_TOO_LONG") {
        setError(`Brief of service cannot exceed ${BOOKING_BRIEF_MAX_CHARS} characters.`);
      } else {
        setError("Failed to create booking. Please try again.");
      }
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

  if (bookingBlockedByProfile) {
    return (
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)} style={{ marginBottom: 16 }}>← Back</button>
        <div className="card" style={{ border: "1px solid rgba(196,136,42,0.35)", background: "rgba(196,136,42,0.05)" }}>
          <h2 style={{ marginBottom: 8 }}>Update your profile to start booking pros</h2>
          <p className="text-muted" style={{ marginBottom: 14 }}>
            You can still access My Bookings and Messages, but new bookings require a complete profile.
          </p>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Missing items:</div>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {missingProfileItems.map(item => <li key={item} style={{ marginBottom: 4 }}>{item}</li>)}
            </ul>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="btn btn-primary" onClick={() => navigate("/account")}>Go to My Account</button>
            <button className="btn btn-secondary" onClick={() => navigate("/browse")}>Back to Browse</button>
          </div>
        </div>
      </div>
    );
  }

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

          {isRebookFlow && (
            <div style={{ marginBottom: 16, padding: "12px 14px", borderRadius: 12, background: "rgba(13,107,107,0.06)", border: "1px solid rgba(13,107,107,0.15)", color: "#0d6b6b", fontSize: "0.88rem" }}>
              ↻ Quick re-book loaded with your previous service preferences. Confirm next slot and continue.
            </div>
          )}

          {services.length > 0 && shouldShowCategoryFilter(categories) && (
            <div className="form-group">
              <label className="form-label" htmlFor="service-category">Service Category</label>
              <select
                id="service-category"
                className="form-input"
                value={selectedCat}
                onChange={(e) => {
                  setCat(e.target.value);
                  const filtered = services.filter(s => ((s.category as string) || "Other") === e.target.value);
                  if (filtered.length > 0) setSvc(filtered[0]);
                }}
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          )}

          {services.length > 0 && (
            <div className="form-group">
              <label className="form-label">Select Service</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {services
                  .filter(svc => !selectedCat || svc.category === selectedCat)
                  .map(svc => {
                    const servicePrice = Number(svc.price) || 0;
                    const serviceQuoteBased = Boolean(svc.quoteBased);
                    const serviceIsFree = !serviceQuoteBased && servicePrice === 0;
                    const serviceTotal = serviceQuoteBased || serviceIsFree
                      ? 0
                      : servicePrice + Math.round((servicePrice * commissionRate) / 100);

                    return (
                      <div key={svc.id as string} onClick={() => setSvc(svc)} style={{ padding: "12px 16px", border: `2px solid ${selectedSvc?.id === svc.id ? "var(--accent)" : "var(--border)"}`, background: selectedSvc?.id === svc.id ? "rgba(13,107,107,0.04)" : "var(--surface-2)", borderRadius: "var(--radius-sm)", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                        <div>
                          <div style={{ fontWeight: 600 }}>{svc.title as string}</div>
                          {(svc.duration as string) && <div className="text-muted text-sm">{svc.duration as string}</div>}
                          {serviceQuoteBased ? (
                            <div className="text-muted text-xs">Final NC shared after reviewing your requirement</div>
                          ) : (
                            null
                          )}
                        </div>
                        <span style={{ fontWeight: 700, color: serviceQuoteBased ? "#1B6B8A" : serviceIsFree ? "var(--accent2)" : "var(--text)" }}>
                          {serviceQuoteBased ? "Quote-based" : serviceIsFree ? "Free" : `${serviceTotal.toLocaleString("en-IN")} NC`}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}



          <div style={{ display: "flex", gap: 16 }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label" htmlFor="booking-date">Date <span style={{ color: "var(--error)" }}>*</span></label>
              <input id="booking-date" type="date" className="form-input" value={date} onChange={e => { setDate(e.target.value); setTS(""); }} min={new Date().toISOString().split("T")[0]} required />
            </div>

            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label" htmlFor="start-time">Start Time <span style={{ color: "var(--error)" }}>*</span> {checkingAvail && <span style={{ fontSize: 10, color: "var(--accent)", marginLeft: 8 }}>Checking…</span>}</label>
              <select id="start-time" className="form-input" value={timeSlot} onChange={e => setTS(e.target.value)} required disabled={!date || checkingAvail}>
                <option value="">
                  {date 
                    ? (checkingAvail 
                        ? "Checking availability..." 
                        : (availableSlots.length === 0 
                            ? (proAvail && proAvail[new Date(+date.split('-')[0], +date.split('-')[1]-1, +date.split('-')[2]).toLocaleDateString("en-US", { weekday: "long" }).toLowerCase()]?.active === false 
                                ? "Pro is off this day" 
                                : "No slots available") 
                            : "Select…")) 
                    : "Pick date first"}
                </option>
                {availableSlots.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="booking-notes">Brief of service</label>
            <textarea
              id="booking-notes"
              className="form-input"
              placeholder="Describe what you need help with…"
              value={notes}
              maxLength={BOOKING_BRIEF_MAX_CHARS}
              onChange={e => {
                if (isBookingBriefValid(e.target.value)) {
                  setNotes(e.target.value);
                }
              }}
            />
            <p className="text-muted text-sm" style={{ marginTop: 4, textAlign: "right" }}>
              {notes.length}/{BOOKING_BRIEF_MAX_CHARS}
            </p>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="booking-attachment">Attachment (optional)</label>
            <input
              id="booking-attachment"
              type="file"
              className="form-input"
              accept="image/*,.pdf,.doc,.docx"
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) {
                  const mb = file.size / (1024 * 1024);
                  if (mb > 10) {
                    alert("File size must be less than 10MB.");
                    e.target.value = "";
                    setAttachment(null);
                    return;
                  }
                  
                  const allowedTypes = [
                    "image/jpeg", "image/png", "image/webp", "image/gif",
                    "application/pdf", 
                    "application/msword", 
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  ];
                  if (!allowedTypes.includes(file.type)) {
                    alert("Invalid file type. Only images, PDF, and Word documents are allowed.");
                    e.target.value = "";
                    setAttachment(null);
                    return;
                  }
                }
                setAttachment(file || null);
              }}
            />
            <p className="text-muted text-sm" style={{ marginTop: 4 }}>Upload images, PDFs, etc. to provide more context (Max 10MB).</p>
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
          {requiresCoinHold && (
            <div style={{ background: "rgba(27,107,138,0.06)", border: "1px solid rgba(27,107,138,0.15)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: "0.82rem", color: "#1B6B8A" }}>
              🔒 <strong>NC held securely.</strong> Payment is released to the pro only after the session is marked complete.
            </div>
          )}
          {isQuoteBased && (
            <div style={{ background: "rgba(27,107,138,0.06)", border: "1px solid rgba(27,107,138,0.15)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: "0.82rem", color: "#1B6B8A" }}>
              💬 <strong>Quote-based request.</strong> No NC is held now. The pro can review your requirement and share the final quote.
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
              {isQuoteBased ? (
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 800, color: "#1B6B8A" }}>Quote-based</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Final NC shared after pro reviews your request</div>
                </div>
              ) : isFree ? <span style={{ fontWeight: 700, color: "#16a34a" }}>Free 🎁</span> : (
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 800, color: "#1B6B8A" }}>🪙 {feeCoins.toLocaleString("en-IN")} NC</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>held in escrow until completion</div>
                </div>
              )}
            </div>
            {requiresCoinHold && (
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
              {loading ? "Processing…" : isQuoteBased ? "Send Quote Request" : isFree ? "Confirm Booking" : `Hold ${feeCoins} NC & Confirm`}
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
            {requiresCoinHold
              ? " NC will be released to the pro once the session is complete."
              : isQuoteBased
                ? " No NC has been held yet. The pro can now review your requirement and share pricing."
                : " This is a free consultation request."}
          </p>

          {postBookingWarning && (
            <div className="error-box" style={{ marginBottom: 16, textAlign: "left" }}>
              {postBookingWarning}
            </div>
          )}

          {requiresCoinHold && (
            <div style={{ display: "inline-block", background: "rgba(27,107,138,0.08)", border: "1px solid rgba(27,107,138,0.15)", borderRadius: 10, padding: "8px 20px", marginBottom: 20, color: "#1B6B8A", fontWeight: 600, fontSize: "0.88rem" }}>
              🔒 {feeCoins} NC held in escrow · Balance: {(balance - feeCoins).toLocaleString("en-IN")} NC
            </div>
          )}
          {isQuoteBased && (
            <div style={{ display: "inline-block", background: "rgba(27,107,138,0.08)", border: "1px solid rgba(27,107,138,0.15)", borderRadius: 10, padding: "8px 20px", marginBottom: 20, color: "#1B6B8A", fontWeight: 600, fontSize: "0.88rem" }}>
              💬 Quote-based request sent · no NC held yet
            </div>
          )}
          {isFree && (
            <div style={{ display: "inline-block", background: "rgba(22,163,74,0.1)", borderRadius: 10, padding: "8px 20px", marginBottom: 20, color: "#16a34a", fontWeight: 600, fontSize: "0.88rem" }}>
              🏆 Pro earns +100 NC for free consultations
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
