import { useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import {
  getAllDisputes, updateDisputeStatus,
  type Dispute, type DisputeStatus,
} from "../../services/supportService";
import { formatTimestamp } from "../../services/firestoreService";
import { logAudit } from "./AdminAuditLog";

const STATUS_LABELS: Record<DisputeStatus, string> = {
  raised:           "🔴 Raised",
  under_review:     "🟡 Under Review",
  resolved_client:  "🟢 Resolved (Client)",
  resolved_pro:     "🟢 Resolved (Pro)",
  dismissed:        "⚫ Dismissed",
};
const STATUS_BADGE: Record<DisputeStatus, string> = {
  raised:           "badge-error",
  under_review:     "badge-warning",
  resolved_client:  "badge-success",
  resolved_pro:     "badge-success",
  dismissed:        "badge-muted",
};
const TRANSITIONS: DisputeStatus[] = ["raised","under_review","resolved_client","resolved_pro","dismissed"];

export default function AdminDisputes() {
  const { userProfile } = useAuth();
  const adminId   = userProfile?.uid || "admin";
  const adminName = userProfile?.displayName || "Admin";

  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading]   = useState(true);
  const [selected, setSelected] = useState<Dispute | null>(null);
  const [note, setNote]         = useState("");
  const [saving, setSaving]     = useState(false);
  const [filter, setFilter]     = useState<DisputeStatus | "all">("all");

  const load = async () => {
    setLoading(true);
    const data = await getAllDisputes();
    setDisputes(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleUpdate = async (status: DisputeStatus) => {
    if (!selected?.id) return;
    setSaving(true);
    await updateDisputeStatus(selected.id, status, note.trim() || undefined);
    await logAudit("dispute.update", adminId, adminName, `Dispute ${selected.id?.slice(0,8)} → ${status}${note ? ` | Note: ${note}` : ""}`, selected.id);
    setSelected(prev => prev ? { ...prev, status, adminNote: note || prev.adminNote } : null);
    await load();
    setSaving(false);
  };

  const visible = filter === "all" ? disputes : disputes.filter(d => d.status === filter);

  const counts: Record<string, number> = { all: disputes.length };
  TRANSITIONS.forEach(s => { counts[s] = disputes.filter(d => d.status === s).length; });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Disputes</h1>
          <p className="page-subtitle">Review and resolve booking disputes</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {(["all", "raised", "under_review", "resolved_client", "resolved_pro", "dismissed"] as const).map(s => (
            <button key={s} className={`chip${filter === s ? " active" : ""}`} style={{ fontSize: 11 }} onClick={() => setFilter(s)}>
              {s === "all" ? "All" : s.replace(/_/g, " ")} ({counts[s] ?? 0})
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 60 }}><div className="loader" style={{ margin: "0 auto" }} /></div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 1fr" : "1fr", gap: 20 }}>
          {/* List */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {visible.length === 0 ? (
              <div className="empty-state"><div className="empty-state-icon">⚖️</div><div className="empty-state-title">No disputes</div></div>
            ) : visible.map(d => (
              <div key={d.id} className="card" style={{ cursor: "pointer", border: selected?.id === d.id ? "2px solid var(--accent)" : undefined, padding: "16px 20px" }} onClick={() => { setSelected(d); setNote(d.adminNote || ""); }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{d.reason}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>Raised by <strong>{d.raisedByName}</strong> · Booking {d.bookingId.slice(0, 8)}…</div>
                    <div style={{ fontSize: 12, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.description}</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
                    <span className={`badge ${STATUS_BADGE[d.status]}`} style={{ fontSize: 10 }}>{STATUS_LABELS[d.status]}</span>
                    <span style={{ fontSize: 11, color: "var(--muted)" }}>{formatTimestamp(d.createdAt)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Detail panel */}
          {selected && (
            <div className="card" style={{ position: "sticky", top: 80, alignSelf: "start" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h3 className="card-title">Dispute Detail</h3>
                <button className="btn btn-ghost btn-sm" onClick={() => setSelected(null)}>✕</button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
                {[
                  ["Booking ID", selected.bookingId],
                  ["Raised By",  `${selected.raisedByName} (${selected.raisedByUid.slice(0,8)}…)`],
                  ["Against",    selected.againstUid.slice(0, 8) + "…"],
                  ["Reason",     selected.reason],
                  ["Status",     STATUS_LABELS[selected.status]],
                ].map(([label, value]) => (
                  <div key={label} style={{ display: "flex", gap: 12 }}>
                    <span style={{ fontSize: 12, color: "var(--muted)", minWidth: 80, flexShrink: 0 }}>{label}</span>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{value}</span>
                  </div>
                ))}
                <div>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>Description</div>
                  <div style={{ fontSize: 13, background: "var(--surface-2)", borderRadius: 8, padding: "10px 14px", lineHeight: 1.6 }}>{selected.description}</div>
                </div>
                {selected.adminNote && (
                  <div>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>Previous admin note</div>
                    <div style={{ fontSize: 13, background: "rgba(27,107,138,0.08)", borderRadius: 8, padding: "10px 14px", lineHeight: 1.6, color: "var(--accent)" }}>{selected.adminNote}</div>
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Admin Note (optional)</label>
                <textarea className="form-input" placeholder="Internal note or resolution details…" value={note} onChange={e => setNote(e.target.value)} style={{ minHeight: 80 }} />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {TRANSITIONS.filter(s => s !== selected.status).map(s => (
                  <button key={s} className="btn btn-secondary btn-sm" disabled={saving} onClick={() => handleUpdate(s)} style={{ justifyContent: "flex-start" }}>
                    {saving ? "Saving…" : `→ Mark as "${STATUS_LABELS[s]}"`}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

