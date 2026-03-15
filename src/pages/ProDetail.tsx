import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getUserProfile, getServicesByUser, getReviewsForUser, formatTimestamp } from "../services/firestoreService";
import { useAuth } from "../contexts/AuthContext";

export default function ProDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [pro, setPro] = useState<Record<string, unknown> | null>(null);
  const [services, setServices] = useState<Record<string, unknown>[]>([]);
  const [reviews, setReviews] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      try {
        const [profile, svcs, revs] = await Promise.all([
          getUserProfile(id),
          getServicesByUser(id),
          getReviewsForUser(id),
        ]);
        setPro(profile);
        setServices(svcs);
        setReviews(revs);
      } catch { /* ignore */ }
      setLoading(false);
    };
    load();
  }, [id]);

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 80 }}>
        <div className="loader" style={{ margin: "0 auto" }} />
      </div>
    );
  }

  if (!pro) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">❓</div>
        <div className="empty-state-title">Professional not found</div>
        <button className="btn btn-primary btn-sm" onClick={() => navigate("/browse")}>
          Back to Browse
        </button>
      </div>
    );
  }

  const initials = ((pro.displayName as string) || "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const isOwnProfile = user?.uid === id;

  return (
    <div>
      <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)} style={{ marginBottom: 16 }}>
        ← Back
      </button>

      {/* Profile header */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", gap: 24, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div className="avatar avatar-xl" style={{ fontSize: 28 }}>
            {(pro.photoURL as string) ? (
              <img src={pro.photoURL as string} alt="" />
            ) : (
              initials
            )}
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <h1 style={{ fontSize: 24, marginBottom: 4 }}>{(pro.displayName as string) || "Anonymous"}</h1>
            <p className="text-muted" style={{ marginBottom: 8 }}>
              {(pro.society as string) || "Community Member"}
            </p>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 12 }}>
              <span style={{ color: "var(--warning)", fontWeight: 600 }}>
                ★ {(pro.rating as number) || 0} <span className="text-muted text-sm">({(pro.reviewCount as number) || 0} reviews)</span>
              </span>
              {(pro.isFreeConsultation as boolean) ? (
                <span className="badge badge-success">Offers Free Consultation</span>
              ) : (
                <span style={{ fontWeight: 700, color: "var(--accent2)" }}>
                  ₹{(pro.hourlyRate as number) || 0}/hr
                </span>
              )}
            </div>
            <p style={{ color: "var(--text-2)", lineHeight: 1.6 }}>
              {(pro.bio as string) || "No bio available."}
            </p>
          </div>
          {!isOwnProfile && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button
                className="btn btn-primary"
                onClick={() => navigate(`/book/${id}`)}
              >
                Book Consultation
              </button>
              <button
                className="btn btn-secondary"
                onClick={async () => {
                  const { getOrCreateConversation } = await import("../services/firestoreService");
                  const convId = await getOrCreateConversation(user!.uid, id!);
                  navigate(`/messages?conv=${convId}`);
                }}
              >
                Send Message
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Skills */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h3 className="card-title" style={{ marginBottom: 14 }}>Skills & Expertise</h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {((pro.skills as string[]) || []).length > 0 ? (
            (pro.skills as string[]).map((s: string) => (
              <span className="skill-tag" key={s}>{s}</span>
            ))
          ) : (
            <span className="text-muted">No skills listed</span>
          )}
        </div>
      </div>

      {/* Services offered */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h3 className="card-title" style={{ marginBottom: 14 }}>Services Offered</h3>
        {services.length === 0 ? (
          <p className="text-muted">No services listed yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {services.map((svc) => (
              <div
                key={svc.id as string}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "14px 16px",
                  background: "var(--surface-2)",
                  borderRadius: "var(--radius-sm)",
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 2 }}>{(svc.title as string)}</div>
                  <div className="text-muted text-sm">{(svc.description as string)?.slice(0, 80)}</div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontWeight: 700, color: (svc.price as number) === 0 ? "var(--accent2)" : "var(--text)" }}>
                    {(svc.price as number) === 0 ? "Free" : `₹${svc.price}`}
                  </div>
                  {(svc.duration as string) && (
                    <div className="text-muted text-xs">{svc.duration as string}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reviews */}
      <div className="card">
        <h3 className="card-title" style={{ marginBottom: 14 }}>
          Reviews ({reviews.length})
        </h3>
        {reviews.length === 0 ? (
          <p className="text-muted">No reviews yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {reviews.map((r) => (
              <div
                key={r.id as string}
                style={{
                  padding: "14px 16px",
                  background: "var(--surface-2)",
                  borderRadius: "var(--radius-sm)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontWeight: 600 }}>{(r.reviewerName as string) || "Anonymous"}</span>
                  <span style={{ color: "var(--warning)" }}>
                    {"★".repeat((r.rating as number) || 0)}{"☆".repeat(5 - ((r.rating as number) || 0))}
                  </span>
                </div>
                <p style={{ color: "var(--text-2)", fontSize: 14, lineHeight: 1.5 }}>
                  {(r.comment as string)}
                </p>
                <div className="text-muted text-xs" style={{ marginTop: 6 }}>
                  {formatTimestamp(r.createdAt)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
