import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getUserProfile, getServicesByUser, getReviewsForUser, formatTimestamp } from "../services/firestoreService";
import { useAuth } from "../contexts/AuthContext";

/* Reusable skeleton block */
function Skel({ w = "100%", h = 16, radius = 6, mb = 0 }: { w?: string | number; h?: number; radius?: number; mb?: number }) {
  return (
    <div className="skeleton" style={{ width: w, height: h, borderRadius: radius, marginBottom: mb, flexShrink: 0 }} />
  );
}

function ProDetailSkeleton() {
  return (
    <div>
      <Skel w={80} h={30} mb={16} />
      {/* Header card */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
          <Skel w={80} h={80} radius={40} />
          <div style={{ flex: 1 }}>
            <Skel w="40%" h={24} mb={8} />
            <Skel w="25%" h={14} mb={12} />
            <Skel w="30%" h={14} mb={12} />
            <Skel w="90%" h={14} mb={6} />
            <Skel w="75%" h={14} />
          </div>
        </div>
      </div>
      {/* Skills card */}
      <div className="card" style={{ marginBottom: 24 }}>
        <Skel w="20%" h={18} mb={14} />
        <div style={{ display: "flex", gap: 8 }}>
          {[80, 100, 70, 90].map((w, i) => <Skel key={i} w={w} h={26} radius={50} />)}
        </div>
      </div>
      {/* Reviews card */}
      <div className="card">
        <Skel w="25%" h={18} mb={16} />
        {[1, 2].map(i => (
          <div key={i} style={{ padding: "14px 16px", background: "var(--surface-2)", borderRadius: 8, marginBottom: 10 }}>
            <Skel w="35%" h={14} mb={8} />
            <Skel w="90%" h={12} mb={4} />
            <Skel w="70%" h={12} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ProDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [pro, setPro] = useState<Record<string, unknown> | null>(null);
  const [services, setServices] = useState<Record<string, unknown>[]>([]);
  const [reviews, setReviews] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      try {
        const [profile, svcs, revs] = await Promise.all([
          getUserProfile(id),
          getServicesByUser(id),
          getReviewsForUser(id),
        ]);
        if (!profile) { setError("not_found"); } else { setPro(profile); }
        setServices(svcs);
        setReviews(revs);
      } catch {
        setError("load_failed");
      }
      setLoading(false);
    };
    load();
  }, [id]);

  if (loading) return <ProDetailSkeleton />;

  if (error === "not_found" || !pro) return (
    <div className="empty-state">
      <div className="empty-state-icon">❓</div>
      <div className="empty-state-title">Professional not found</div>
      <div className="empty-state-desc">This profile may have been removed or the link is incorrect.</div>
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

  const initials = ((pro.displayName as string) || "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
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
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 12 }}>
              <span style={{ color: "var(--warning)", fontWeight: 600 }}>
                ★ {(pro.rating as number) || 0} <span className="text-muted text-sm">({(pro.reviewCount as number) || 0} reviews)</span>
              </span>
              {(pro.priceAfterQuote as boolean) ? (
                <span className="badge badge-accent">Quote-based pricing</span>
              ) : (
                <span style={{ fontWeight: 700, color: "var(--accent2)" }}>
                  {(pro.hourlyRate as number) === 0 ? "Free Consultation" : `₹${pro.hourlyRate as number}/hr`}
                </span>
              )}
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
              }}>Send Message</button>
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
                  <div style={{ fontWeight: 700, color: (svc.price as number) === 0 ? "var(--accent2)" : "var(--text)" }}>
                    {(svc.price as number) === 0 ? "Free" : `₹${svc.price as number}`}
                  </div>
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
        {reviews.length === 0 ? (
          <p className="text-muted">No reviews yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {reviews.map(r => (
              <div key={r.id as string} style={{ padding: "14px 16px", background: "var(--surface-2)", borderRadius: "var(--radius-sm)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontWeight: 600 }}>{(r.reviewerName as string) || "Anonymous"}</span>
                  <span style={{ color: "var(--warning)" }}>{"★".repeat(r.rating as number)}{"☆".repeat(5 - (r.rating as number))}</span>
                </div>
                <p style={{ color: "var(--text-2)", fontSize: 14, lineHeight: 1.5 }}>{r.comment as string}</p>
                <div className="text-muted text-xs" style={{ marginTop: 6 }}>{formatTimestamp(r.createdAt)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
