import { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy, doc, deleteDoc, updateDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../contexts/AuthContext";
import { formatTimestamp } from "../../services/firestoreService";
import { logAudit } from "./AdminAuditLog";

type Review = Record<string, unknown>;

export default function AdminReviews() {
  const { userProfile } = useAuth();
  const adminId = userProfile?.uid || "unknown";
  const adminName = userProfile?.displayName || "Admin";

  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "flagged" | "1" | "2">("all");
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState("");
  const [confirm, setConfirm] = useState<Review | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const load = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, "reviews"), orderBy("createdAt", "desc")));
      setReviews(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleFlag = async (r: Review) => {
    const nowFlagged = !r.flagged;
    const ok = window.confirm(
      nowFlagged
        ? "Flag this review? It will be queued for moderation review."
        : "Remove moderation flag from this review?"
    );
    if (!ok) return;

    await updateDoc(doc(db, "reviews", r.id as string), { flagged: nowFlagged });
    await logAudit(
      nowFlagged ? "review.flag" : "review.unflag", adminId, adminName,
      `${nowFlagged ? "Flagged" : "Unflagged"} review by ${r.clientName as string || "user"} for ${r.proName as string || "pro"} (★${r.rating})`,
      r.id as string
    );
    showToast(nowFlagged ? "Review flagged" : "Flag removed");
    load();
  };

  const handleDelete = async (r: Review) => {
    await deleteDoc(doc(db, "reviews", r.id as string));
    await logAudit(
      "review.delete", adminId, adminName,
      `Deleted ${r.rating as number}-star review by ${r.clientName as string || "user"} for ${r.proName as string || "pro"}`,
      r.id as string
    );
    showToast("Review deleted");
    setConfirm(null);
    load();
  };

  const filtered = reviews.filter(r => {
    const matchFilter =
      filter === "all" ? true :
      filter === "flagged" ? !!r.flagged :
      filter === "1" ? (r.rating as number) === 1 :
      filter === "2" ? (r.rating as number) <= 2 : true;
    const q = search.toLowerCase();
    const matchSearch = !q || ((r.comment as string) || "").toLowerCase().includes(q) || ((r.clientName as string) || "").toLowerCase().includes(q);
    return matchFilter && matchSearch;
  });

  const stars = (n: number) => "★".repeat(Math.max(0, n)) + "☆".repeat(Math.max(0, 5 - n));

  return (
    <div>
      {toast && <div style={{ position: "fixed", top: 20, right: 24, zIndex: 9999, background: "var(--success)", color: "#fff", padding: "10px 20px", borderRadius: "var(--radius-sm)", fontWeight: 600, fontSize: 13, boxShadow: "var(--shadow-lg)" }}>{toast}</div>}

      <div className="page-header">
        <div>
          <h1 className="page-title">Review Moderation</h1>
          <p className="page-subtitle">{reviews.length} total reviews · {reviews.filter(r => !!r.flagged).length} flagged</p>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        <div className="tabs" style={{ marginBottom: 0, border: "none" }}>
          {([["all", "All"], ["flagged", "🚩 Flagged"], ["1", "★ 1-Star"], ["2", "★ 1-2 Star"]] as const).map(([k, l]) => (
            <button key={k} className={`tab${filter === k ? " active" : ""}`} onClick={() => setFilter(k)}>{l}</button>
          ))}
        </div>
        <input className="form-input" placeholder="Search reviews…" value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 240, padding: "8px 12px", marginLeft: "auto" }} />
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 60 }}><div className="loader" style={{ margin: "0 auto" }} /></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state"><div className="empty-state-icon">⭐</div><div className="empty-state-title">No reviews found</div></div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filtered.map(r => (
            <div key={r.id as string} className="card" style={{ padding: "16px 20px", borderColor: r.flagged ? "rgba(255,92,92,0.4)" : undefined, background: r.flagged ? "rgba(255,92,92,0.03)" : undefined }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <span style={{ color: "var(--warning)", fontSize: 16, letterSpacing: 1 }}>{stars(r.rating as number)}</span>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{(r.rating as number) > 0 ? `${r.rating as number}.0` : "—"}</span>
                    {!!r.flagged && <span className="badge badge-error" style={{ fontSize: 10 }}>🚩 Flagged</span>}
                  </div>
                  <p style={{ fontSize: 14, color: "var(--text)", marginBottom: 10, lineHeight: 1.5 }}>
                    {(r.comment as string) || <em style={{ color: "var(--muted)" }}>No comment</em>}
                  </p>
                  <div style={{ display: "flex", gap: 16, fontSize: 12, color: "var(--muted)" }}>
                    <span>By: <strong style={{ color: "var(--text-2)" }}>{(r.clientName as string) || "User"}</strong></span>
                    <span>For: <strong style={{ color: "var(--text-2)" }}>{(r.proName as string) || "Pro"}</strong></span>
                    <span>{formatTimestamp(r.createdAt)}</span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  <button className={`btn btn-sm ${r.flagged ? "btn-secondary" : "btn-danger"}`} onClick={() => handleFlag(r)}>
                    {r.flagged ? "Unflag" : "🚩 Flag"}
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => setConfirm(r)}>🗑 Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {confirm && (
        <div className="modal-overlay" onClick={() => setConfirm(null)}>
          <div className="modal" style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ color: "var(--error)" }}>Delete Review?</h3>
              <button className="modal-close" onClick={() => setConfirm(null)}>✕</button>
            </div>
            <p style={{ fontSize: 14, color: "var(--muted)", marginBottom: 4 }}>
              Permanently remove this {confirm.rating as number}-star review by <strong>{confirm.clientName as string || "user"}</strong>? This cannot be undone.
            </p>
            <div className="modal-actions">
              <button className="btn btn-secondary btn-sm" onClick={() => setConfirm(null)}>Cancel</button>
              <button className="btn btn-danger btn-sm" onClick={() => handleDelete(confirm)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

