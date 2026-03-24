import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  getUserProfile, getServicesByUser, getReviewsForUser,
  formatTimestamp, trackProView,
} from "../services/firestoreService";
import { raiseDispute } from "../services/supportService";
import { getBookingsForUser } from "../services/firestoreService";
import { useAuth } from "../contexts/AuthContext";

/* Skeleton block */
function Skel({ w = "100%", h = 16, radius = 6, mb = 0 }: { w?: string | number; h?: number; radius?: number; mb?: number }) {
  return <div className="skeleton" style={{ width: w, height: h, borderRadius: radius, marginBottom: mb, flexShrink: 0 }} />;
}

function ProDetailSkeleton() {
  return (
    <div>
      <Skel w={80} h={30} mb={16} />
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
          <Skel w={80} h={80} radius={40} />
          <div style={{ flex: 1 }}>
            <Skel w="40%" h={24} mb={8} /><Skel w="25%" h={14} mb={12} />
            <Skel w="90%" h={14} mb={6} /><Skel w="75%" h={14} />
          </div>
        </div>
      </div>
      <div className="card" style={{ marginBottom: 24 }}>
        <Skel w="20%" h={18} mb={14} />
        <div style={{ display: "flex", gap: 8 }}>{[80,100,70,90].map((w,i) => <Skel key={i} w={w} h={26} radius={50} />)}</div>
      </div>
      <div className="card">
        <Skel w="25%" h={18} mb={16} />
        {[1,2].map(i => <div key={i} style={{ padding:"14px 16px",background:"var(--surface-2)",borderRadius:8,marginBottom:10 }}><Skel w="35%" h={14} mb={8}/><Skel w="90%" h={12} mb={4}/><Skel w="70%" h={12}/></div>)}
      </div>
    </div>
  );
}

// ── Pro response time badge ────────────────────────────────────────────────
function ResponseTimeBadge({ avgResponseHours }: { avgResponseHours: number | null }) {
  if (avgResponseHours === null) return null;
  const label = avgResponseHours < 1 ? "< 1 hr" : avgResponseHours < 4 ? "< 4 hrs" : avgResponseHours < 24 ? "Same day" : "1-2 days";
  const color = avgResponseHours < 4 ? "#16a34a" : avgResponseHours < 24 ? "#C4882A" : "var(--muted)";
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 5, background: color + "15", border: `1px solid ${color}40`, borderRadius: 50, padding: "3px 10px", fontSize: 12, color, fontWeight: 600 }}>
      ⚡ Responds {label}
    </div>
  );
}

export default function ProDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate  = useNavigate();
  const [pro, setPro]           = useState<Record<string, unknown> | null>(null);
  const [services, setServices] = useState<Record<string, unknown>[]>([]);
  const [reviews, setReviews]   = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [avgResponseHrs, setAvgRespHrs] = useState<number | null>(null);

  // Report state
  const [showReport, setShowReport]     = useState(false);
  const [reportReason, setReportReason] = useState("Spam / Fake Profile");
  const [reportComment, setRC]          = useState("");
  const [reportSub, setRS]              = useState(false);

  // Dispute state
  const [showDispute, setShowDispute]   = useState(false);
  const [disputeBookingId, setDBId]     = useState("");
  const [disputeReason, setDReason]     = useState("");
  const [disputeDesc, setDDesc]         = useState("");
  const [disputeSub, setDS]             = useState(false);
  const [disputeMsg, setDMsg]           = useState("");
  const [myBookingsWithPro, setMyBwP]   = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      try {
        const [profile, svcs, revs] = await Promise.all([
          getUserProfile(id), getServicesByUser(id), getReviewsForUser(id),
        ]);
        if (!profile) { setError("not_found"); }
        else {
          setPro(profile);
          // Calculate avg response time from bookings (pending → confirmed delta)
          computeResponseTime(id).then(setAvgRespHrs);
        }
        setServices(svcs); setReviews(revs);
        if (user?.uid && user.uid !== id) trackProView(user.uid, id).catch(() => {});
      } catch { setError("load_failed"); }
      setLoading(false);
    };
    load();
  }, [id]);

  // Load user's bookings with this pro for dispute form
  useEffect(() => {
    if (!user || !id) return;
    getBookingsForUser(user.uid).then(all => {
      setMyBwP(all.filter(b => b.proId === id && (b.status === "completed" || b.status === "confirmed")));
    });
  }, [user, id]);

  async function computeResponseTime(proId: string): Promise<number | null> {
    try {
      const { getAllBookings } = await import("../services/firestoreService");
      const res = await getAllBookings();
      const bookings = res.data;
      const proBookings = bookings.filter(b => b.proId === proId && b.confirmedAt && b.createdAt);
      if (proBookings.length === 0) return null;
      const { Timestamp } = await import("firebase/firestore");
      const deltas = proBookings.map(b => {
        const created   = b.createdAt instanceof Timestamp ? b.createdAt.toMillis() : 0;
        const confirmed = b.confirmedAt instanceof Timestamp ? b.confirmedAt.toMillis() : 0;
        return confirmed > created ? (confirmed - created) / 3600000 : null;
      }).filter((d): d is number => d !== null);
      if (deltas.length === 0) return null;
      return Math.round(deltas.reduce((s, d) => s + d, 0) / deltas.length * 10) / 10;
    } catch { return null; }
  }

  const handleReportSubmit = async () => {
    setRS(true);
    try {
      const { reportProfessional } = await import("../services/firestoreService");
      await reportProfessional(id!, reportReason, reportComment);
      setShowReport(false); setRC("");
      alert("Report submitted and is pending review.");
    } catch { alert("Failed to submit report."); }
    setRS(false);
  };

  const handleDisputeSubmit = async () => {
    if (!user || !id || !disputeBookingId || !disputeReason.trim() || !disputeDesc.trim()) {
      setDMsg("Please fill all fields."); return;
    }
    setDS(true); setDMsg("");
    try {
      await raiseDispute({
        bookingId: disputeBookingId,
        raisedByUid: user.uid,
        raisedByName: user.displayName || "User",
        againstUid: id,
        reason: disputeReason,
        description: disputeDesc,
      });
      setDMsg("✅ Dispute raised. We'll review within 48 hours.");
      setTimeout(() => { setShowDispute(false); setDMsg(""); setDReason(""); setDDesc(""); setDBId(""); }, 2500);
    } catch { setDMsg("Failed to raise dispute. Try again."); }
    setDS(false);
  };

  if (loading) return <ProDetailSkeleton />;
  if (error === "not_found" || !pro) return (
    <div className="empty-state">
      <div className="empty-state-icon">❓</div>
      <div className="empty-state-title">Professional not found</div>
      <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={() => navigate("/browse")}>Back to Browse</button>
    </div>
  );
  if (error === "load_failed") return (
    <div className="empty-state">
      <div className="empty-state-icon">⚠️</div>
      <div className="empty-state-title">Failed to load profile</div>
      <button className="btn btn-secondary btn-sm" style={{ marginTop: 12 }} onClick={() => window.location.reload()}>Retry</button>
    </div>
  );

  const initials    = ((pro.displayName as string) || "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const isOwnProfile = user?.uid === id;

  return (
    <div>
      <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)} style={{ marginBottom: 16 }}>← Back</button>

      {/* Header */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", gap: 24, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div style={{ position: "relative" }}>
            <div className="avatar avatar-xl" style={{ fontSize: 28 }}>
              {(pro.photoURL as string) ? <img src={pro.photoURL as string} alt="" /> : initials}
            </div>
            {(pro.isServiceProvider as boolean) && (
              <div style={{ position: "absolute", bottom: -2, right: -2, background: "var(--success)", color: "#fff", width: 26, height: 26, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid var(--surface)", fontSize: 12, fontWeight: "bold" }} title="Verified Pro">✓</div>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <h1 style={{ fontSize: 24, marginBottom: 4 }}>{(pro.displayName as string) || "Anonymous"}</h1>
            <p className="text-muted" style={{ marginBottom: 8 }}>{(pro.society as string) || "Community Member"}</p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12, alignItems: "center" }}>
              <span style={{ color: "var(--warning)", fontWeight: 600 }}>★ {(pro.rating as number) || 0} <span className="text-muted text-sm">({(pro.reviewCount as number) || 0})</span></span>
              {(pro.priceAfterQuote as boolean)
                ? <span className="badge badge-accent">Quote-based</span>
                : <span style={{ fontWeight: 700, color: "var(--accent2)" }}>{(pro.hourlyRate as number) === 0 ? "Free Consultation" : `₹${pro.hourlyRate as number}/hr`}</span>}
              <ResponseTimeBadge avgResponseHours={avgResponseHrs} />
            </div>
            <p style={{ color: "var(--text-2)", lineHeight: 1.6 }}>{(pro.bio as string) || "No bio available."}</p>
          </div>
          {!isOwnProfile && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button className="btn btn-primary" onClick={() => navigate(`/book/${id}`)}>Book Consultation</button>
              <button className="btn btn-secondary" onClick={async () => {
                const { getOrCreateConversation } = await import("../services/firestoreService");
                const convId = await getOrCreateConversation(user!.uid, id!);
                navigate(`/messages?conv=${convId}`);
              }}>💬 Message</button>
            </div>
          )}
        </div>
      </div>

      {/* Skills */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h3 className="card-title" style={{ marginBottom: 14 }}>Skills & Expertise</h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {((pro.skills as string[]) || []).length > 0
            ? (pro.skills as string[]).map(s => <span className="skill-tag" key={s}>{s}</span>)
            : <span className="text-muted">No skills listed</span>}
        </div>
      </div>

      {/* Services */}
      {services.length > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h3 className="card-title" style={{ marginBottom: 14 }}>Services Offered</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {services.map(svc => (
              <div key={svc.id as string} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", background: "var(--surface-2)", borderRadius: "var(--radius-sm)" }}>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 2 }}>{svc.title as string}</div>
                  <div className="text-muted text-sm">{(svc.description as string)?.slice(0, 80)}</div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontWeight: 700, color: (svc.price as number) === 0 ? "var(--accent2)" : "var(--text)" }}>{(svc.price as number) === 0 ? "Free" : `₹${svc.price as number}`}</div>
                  {(svc.duration as string) && <div className="text-muted text-xs">{svc.duration as string}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reviews */}
      <div className="card">
        <h3 className="card-title" style={{ marginBottom: 14 }}>Reviews ({reviews.length})</h3>
        {reviews.length === 0 ? <p className="text-muted">No reviews yet.</p> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {reviews.map(r => (
              <div key={r.id as string} style={{ padding: "14px 16px", background: "var(--surface-2)", borderRadius: "var(--radius-sm)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontWeight: 600 }}>{(r.clientName as string) || "Anonymous"}</span>
                  <span style={{ color: "var(--warning)" }}>{"★".repeat(r.rating as number)}{"☆".repeat(5 - (r.rating as number))}</span>
                </div>
                <p style={{ color: "var(--text-2)", fontSize: 14, lineHeight: 1.5 }}>{r.comment as string}</p>
                <div className="text-muted text-xs" style={{ marginTop: 6 }}>{formatTimestamp(r.createdAt)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Action row */}
      {user && !isOwnProfile && (
        <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowReport(true)} style={{ color: "var(--error)", opacity: 0.7 }}>⚐ Report</button>
          {myBookingsWithPro.length > 0 && (
            <button className="btn btn-ghost btn-sm" onClick={() => setShowDispute(true)} style={{ color: "var(--warning)", opacity: 0.85 }}>⚠ Raise Dispute</button>
          )}
        </div>
      )}

      {/* Report modal */}
      {showReport && (
        <div className="modal-overlay" onClick={() => setShowReport(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3 className="modal-title">Report Professional</h3><button className="modal-close" onClick={() => setShowReport(false)}>✕</button></div>
            <div className="form-group">
              <label className="form-label">Reason</label>
              <select className="form-input" value={reportReason} onChange={e => setReportReason(e.target.value)}>
                {["Spam / Fake Profile","Inappropriate Behavior","Did not deliver service","Off-platform payment request","Other"].map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Details</label>
              <textarea className="form-input" placeholder="Provide details to help us investigate..." value={reportComment} onChange={e => setRC(e.target.value)} />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowReport(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleReportSubmit} disabled={reportSub || !reportComment.trim()}>{reportSub ? "Submitting…" : "Submit Report"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Dispute modal */}
      {showDispute && (
        <div className="modal-overlay" onClick={() => setShowDispute(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3 className="modal-title">⚠ Raise a Dispute</h3><button className="modal-close" onClick={() => setShowDispute(false)}>✕</button></div>
            <p style={{ fontSize: "0.84rem", color: "var(--muted)", marginBottom: 16 }}>Disputes are reviewed by our team within 48 hours. All NC remains in escrow until resolved.</p>
            <div className="form-group">
              <label className="form-label">Booking</label>
              <select className="form-input" value={disputeBookingId} onChange={e => setDBId(e.target.value)}>
                <option value="">Select a booking…</option>
                {myBookingsWithPro.map(b => <option key={b.id as string} value={b.id as string}>{(b.serviceName as string) || "Booking"} — {(b.date as string) || ""}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Reason</label>
              <select className="form-input" value={disputeReason} onChange={e => setDReason(e.target.value)}>
                <option value="">Select reason…</option>
                {["Service not delivered","Quality below expectations","No-show / late","Overcharged","Unprofessional behaviour","Other"].map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea className="form-input" placeholder="Describe the issue in detail…" value={disputeDesc} onChange={e => setDDesc(e.target.value)} style={{ minHeight: 100 }} />
            </div>
            {disputeMsg && <div style={{ padding: "10px 14px", borderRadius: 8, background: disputeMsg.startsWith("✅") ? "rgba(22,163,74,0.1)" : "rgba(220,38,38,0.1)", color: disputeMsg.startsWith("✅") ? "#16a34a" : "#dc2626", fontSize: 13, marginBottom: 14 }}>{disputeMsg}</div>}
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowDispute(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleDisputeSubmit} disabled={disputeSub || !disputeBookingId || !disputeReason || !disputeDesc.trim()}>{disputeSub ? "Submitting…" : "Submit Dispute"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

