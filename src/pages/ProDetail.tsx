import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  getPublicProfile, getServicesByUser, getReviewsForUser, trackProView, formatTimestamp,
} from "../services/firestoreService";
import { useAuth } from "../contexts/AuthContext";

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
            <Skel w="40%" h={24} mb={8} />
            <Skel w="25%" h={14} mb={12} />
            <Skel w="90%" h={14} mb={6} />
            <Skel w="75%" h={14} />
          </div>
        </div>
      </div>
      <div className="card" style={{ marginBottom: 24 }}>
        <Skel w="20%" h={18} mb={14} />
        <div style={{ display: "flex", gap: 8 }}>{[80, 100, 70, 90].map((width, index) => <Skel key={index} w={width} h={26} radius={50} />)}</div>
      </div>
      <div className="card">
        <Skel w="25%" h={18} mb={16} />
        {[1, 2].map(index => (
          <div key={index} style={{ padding: "14px 16px", background: "var(--surface-2)", borderRadius: 8, marginBottom: 10 }}>
            <Skel w="35%" h={14} mb={8} />
            <Skel w="90%" h={12} mb={4} />
            <Skel w="70%" h={12} />
          </div>
        ))}
      </div>
    </div>
  );
}

function ResponseTimeBadge({ avgResponseHours }: { avgResponseHours: number | null }) {
  if (avgResponseHours === null) return null;

  const label = avgResponseHours < 1 ? "< 1 hr" : avgResponseHours < 4 ? "< 4 hrs" : avgResponseHours < 24 ? "Same day" : "1-2 days";
  const color = avgResponseHours < 4 ? "#16a34a" : avgResponseHours < 24 ? "#C4882A" : "var(--muted)";

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 5, background: `${color}15`, border: `1px solid ${color}40`, borderRadius: 50, padding: "3px 10px", fontSize: 12, color, fontWeight: 600 }}>
      Responds {label}
    </div>
  );
}

function formatMemberSince(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const date = (value as { toDate?: () => Date }).toDate?.();
  if (!date || Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-IN", { month: "2-digit", year: "numeric" });
}

export default function ProDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, userProfile } = useAuth();
  const navigate = useNavigate();
  const [pro, setPro] = useState<Record<string, unknown> | null>(null);
  const [services, setServices] = useState<Record<string, unknown>[]>([]);
  const [reviews, setReviews] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [avgResponseHrs, setAvgRespHrs] = useState<number | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState("Spam / Fake Profile");
  const [reportComment, setReportComment] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;

    const load = async () => {
      try {
        const [profile, serviceRows, reviewRows] = await Promise.all([
          getPublicProfile(id),
          getServicesByUser(id),
          getReviewsForUser(id),
        ]);

        if (!profile) {
          setError("not_found");
        } else {
          setPro(profile);
          computeResponseTime(id).then(setAvgRespHrs);
        }

        setServices(serviceRows);
        setReviews(reviewRows);

        if (user?.uid && user.uid !== id) {
          trackProView(user.uid, id).catch(() => {});
        }
      } catch {
        setError("load_failed");
      }
      setLoading(false);
    };

    load();
  }, [id, user?.uid]);

  async function computeResponseTime(proId: string): Promise<number | null> {
    try {
      const { getAllBookings } = await import("../services/firestoreService");
      const { Timestamp } = await import("firebase/firestore");
      const res = await getAllBookings();
      const proBookings = res.data.filter(booking => booking.proId === proId && booking.confirmedAt && booking.createdAt);
      if (proBookings.length === 0) return null;

      const deltas = proBookings
        .map(booking => {
          const created = booking.createdAt instanceof Timestamp ? booking.createdAt.toMillis() : 0;
          const confirmed = booking.confirmedAt instanceof Timestamp ? booking.confirmedAt.toMillis() : 0;
          return confirmed > created ? (confirmed - created) / 3600000 : null;
        })
        .filter((delta): delta is number => delta !== null);

      if (deltas.length === 0) return null;
      return Math.round((deltas.reduce((sum, delta) => sum + delta, 0) / deltas.length) * 10) / 10;
    } catch {
      return null;
    }
  }

  const handleReportSubmit = async () => {
    setReportSubmitting(true);
    try {
      const { reportProfessional } = await import("../services/firestoreService");
      await reportProfessional(id!, reportReason, reportComment);
      setShowReport(false);
      setReportComment("");
      alert("Report submitted and is pending review.");
    } catch {
      alert("Failed to submit report.");
    }
    setReportSubmitting(false);
  };

  if (loading) return <ProDetailSkeleton />;
  if (error === "not_found" || !pro) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">?</div>
        <div className="empty-state-title">Profile not found</div>
        <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={() => navigate("/browse")}>Back to Browse</button>
      </div>
    );
  }
  if (error === "load_failed") {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">!</div>
        <div className="empty-state-title">Failed to load profile</div>
        <button className="btn btn-secondary btn-sm" style={{ marginTop: 12 }} onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  const initials = ((pro.displayName as string) || "?").split(" ").map(word => word[0]).join("").slice(0, 2).toUpperCase();
  const isOwnProfile = user?.uid === id;
  const publicEmail = typeof pro.email === "string" ? pro.email.trim() : "";
  const publicPhone = typeof pro.phoneNumber === "string" ? pro.phoneNumber.trim() : "";
  const publicTower = typeof pro.tower === "string" ? pro.tower.trim() : "";
  const publicFlatNumber = typeof pro.flatNumber === "string" ? pro.flatNumber.trim() : "";
  const memberSince = formatMemberSince(pro.createdAt);
  const hasPublicContact = Boolean(publicEmail || publicPhone);

  const getMissingBookingProfileItems = () => {
    const missing: string[] = [];
    if (!String(userProfile?.displayName || "").trim()) missing.push("Full name");
    if (!String(userProfile?.society || "").trim()) missing.push("Society");
    if (!String(userProfile?.phoneNumber || "").trim()) missing.push("Phone number");
    if (userProfile?.residentVerificationStatus !== "verified") {
      missing.push("Resident verification approval");
    }
    return missing;
  };

  const handleBookConsultation = () => {
    const missing = getMissingBookingProfileItems();
    if (missing.length > 0) {
      alert(`Please update your profile to start booking pros.\n\nMissing: ${missing.join(", ")}`);
      navigate("/account");
      return;
    }
    navigate(`/book/${id}`);
  };

  return (
    <div>
      <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)} style={{ marginBottom: 16 }}>Back</button>

      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", gap: 24, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div style={{ position: "relative" }}>
            <div className="avatar avatar-xl" style={{ fontSize: 28 }}>
              {(pro.photoURL as string) ? <img src={pro.photoURL as string} alt="" loading="lazy" /> : initials}
            </div>
            {(pro.isServiceProvider as boolean) && (
              <div
                style={{
                  position: "absolute",
                  bottom: -2,
                  right: -2,
                  background: "linear-gradient(135deg, #16a34a, #15803d)",
                  color: "#fff",
                  minWidth: 34,
                  height: 18,
                  borderRadius: 999,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "2px solid var(--surface)",
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: 0.3,
                  textTransform: "uppercase",
                  padding: "0 6px",
                }}
                title="Service Pro"
              >
                Pro
              </div>
            )}
          </div>

          <div style={{ flex: 1, minWidth: 220 }}>
            <h1 style={{ fontSize: 24, marginBottom: 4 }}>{(pro.displayName as string) || "Anonymous"}</h1>
            <p className="text-muted" style={{ marginBottom: 8 }}>
              {(pro.society as string) || "Community Member"}
              {publicTower ? ` | ${publicTower}` : ""}
              {publicFlatNumber ? ` | Flat ${publicFlatNumber}` : ""}
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12, alignItems: "center" }}>
              <span style={{ color: "var(--warning)", fontWeight: 600 }}>Star {(pro.rating as number) || 0} <span className="text-muted text-sm">({(pro.reviewCount as number) || 0})</span></span>
              {(pro.priceAfterQuote as boolean)
                ? <span className="badge badge-accent">Quote-based</span>
                : <span style={{ fontWeight: 700, color: "var(--accent2)" }}>{(pro.hourlyRate as number) === 0 ? "Free Consultation" : `Rs ${(pro.hourlyRate as number)}/hr`}</span>}
              <ResponseTimeBadge avgResponseHours={avgResponseHrs} />
              {memberSince && <span className="badge badge-muted">Member since {memberSince}</span>}
            </div>
            <p style={{ color: "var(--text-2)", lineHeight: 1.6 }}>{(pro.bio as string) || "No bio available."}</p>
          </div>

          {!isOwnProfile && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button className="btn btn-primary" onClick={handleBookConsultation}>Book Consultation</button>
              <button className="btn btn-secondary" onClick={async () => {
                const { getLatestBookingBetweenUsers, getOrCreateConversation } = await import("../services/firestoreService");
                const latestBooking = await getLatestBookingBetweenUsers(user!.uid, id!);
                if (!latestBooking?.id) {
                  alert("Messaging is enabled after a booking is created.");
                  return;
                }
                const convId = await getOrCreateConversation(user!.uid, id!, { bookingId: latestBooking.id as string });
                navigate(`/messages?conv=${convId}`);
              }}>Message</button>
            </div>
          )}
        </div>
      </div>

      {hasPublicContact && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h3 className="card-title" style={{ marginBottom: 14 }}>Contact</h3>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {publicEmail && (
              <a href={`mailto:${publicEmail}`} className="btn btn-secondary btn-sm" style={{ textDecoration: "none" }}>
                Email: {publicEmail}
              </a>
            )}
            {publicPhone && (
              <a href={`tel:${publicPhone}`} className="btn btn-secondary btn-sm" style={{ textDecoration: "none" }}>
                Call: {publicPhone}
              </a>
            )}
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: 24 }}>
        <h3 className="card-title" style={{ marginBottom: 14 }}>Skills & Expertise</h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {((pro.skills as string[]) || []).length > 0
            ? (pro.skills as string[]).map(skill => <span className="skill-tag" key={skill}>{skill}</span>)
            : <span className="text-muted">No skills listed</span>}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <h3 className="card-title" style={{ marginBottom: 14 }}>Services Offered</h3>
        {services.length === 0 ? (
          <p className="text-muted">No services listed.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {services.map(service => (
              <div key={service.id as string} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", background: "var(--surface-2)", borderRadius: "var(--radius-sm)" }}>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 2 }}>{service.title as string}</div>
                  <div className="text-muted text-sm">{(service.description as string)?.slice(0, 80) || "No description provided."}</div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontWeight: 700, color: (service.price as number) === 0 ? "var(--accent2)" : "var(--text)" }}>
                    {(service.price as number) === 0 ? "Free" : `Rs ${service.price as number}`}
                  </div>
                  {(service.duration as string) && <div className="text-muted text-xs">{service.duration as string}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <h3 className="card-title" style={{ marginBottom: 14 }}>Reviews ({reviews.length})</h3>
        {reviews.length === 0 ? (
          <p className="text-muted">No reviews yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {reviews.map(review => (
              <div key={review.id as string} style={{ padding: "14px 16px", background: "var(--surface-2)", borderRadius: "var(--radius-sm)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontWeight: 600 }}>{(review.clientName as string) || "Anonymous"}</span>
                  <span style={{ color: "var(--warning)" }}>{"*".repeat(review.rating as number)}{".".repeat(5 - (review.rating as number))}</span>
                </div>
                <p style={{ color: "var(--text-2)", fontSize: 14, lineHeight: 1.5 }}>{review.comment as string}</p>
                <div className="text-muted text-xs" style={{ marginTop: 6 }}>{formatTimestamp(review.createdAt)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {user && !isOwnProfile && (
        <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowReport(true)} style={{ color: "var(--error)", opacity: 0.7 }}>Report Profile</button>
        </div>
      )}

      {showReport && (
        <div className="modal-overlay" onClick={() => setShowReport(false)}>
          <div className="modal" onClick={event => event.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Report Profile</h3>
              <button className="modal-close" onClick={() => setShowReport(false)}>x</button>
            </div>
            <div className="form-group">
              <label className="form-label">Reason</label>
              <select className="form-input" value={reportReason} onChange={event => setReportReason(event.target.value)}>
                {["Spam / Fake Profile", "Inappropriate Behavior", "Did not deliver service", "Off-platform payment request", "Other"].map(reason => <option key={reason}>{reason}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Details</label>
              <textarea className="form-input" placeholder="Provide details to help us investigate..." value={reportComment} onChange={event => setReportComment(event.target.value)} />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowReport(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleReportSubmit} disabled={reportSubmitting || !reportComment.trim()}>{reportSubmitting ? "Submitting..." : "Submit Report"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
