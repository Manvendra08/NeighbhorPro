import { useEffect, useState } from "react";
import { collection, addDoc, getDocs, query, orderBy, serverTimestamp, doc, updateDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../contexts/AuthContext";
import { getAllUsers, getAllSocieties } from "../../services/firestoreService";
import { logAudit } from "./AdminAuditLog";

type Announcement = Record<string, unknown>;

const MSG_TYPES = ["Announcement", "Maintenance Alert", "New Feature", "Promotional", "Security Notice"];
const TARGETS = ["All Users", "Service Professionals", "Admins Only", "Society-Specific"];

export default function AdminBroadcast() {
  const { userProfile } = useAuth();
  const adminId = userProfile?.uid || "unknown";
  const adminName = userProfile?.displayName || "Admin";

  const [history, setHistory] = useState<Announcement[]>([]);
  const [societies, setSocieties] = useState<Record<string, unknown>[]>([]);
  const [userCount, setUserCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState("");

  const [form, setForm] = useState({
    title: "", body: "", type: "Announcement", target: "All Users",
    targetSociety: "", priority: "normal",
  });

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const load = async () => {
    try {
      const [userRes, socRes, snap] = await Promise.all([
        getAllUsers(), getAllSocieties(),
        getDocs(query(collection(db, "announcements"), orderBy("createdAt", "desc"))),
      ]);
      setUserCount(userRes.data.length);
      setSocieties(socRes.data);
      setHistory(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch { /* ignore */ }
    setLoading(false);
  };

  const handleDeactivate = async (id: string) => {
    try {
      await updateDoc(doc(db, "announcements", id), { status: "inactive" });
      await logAudit("broadcast.deactivate", adminId, adminName, `Deactivated broadcast ${id}`, id);
      load();
    } catch { /* ignore */ }
  };

  useEffect(() => { load(); }, []);

  const estimateReach = () => {
    if (form.target === "All Users") return userCount;
    if (form.target === "Admins Only") return "Admins";
    if (form.target === "Service Professionals") return "Pros";
    if (form.target === "Society-Specific" && form.targetSociety) {
      const soc = societies.find(s => s.id === form.targetSociety);
      return (soc?.memberCount as number) || "?";
    }
    return "—";
  };

  const handleSend = async () => {
    if (!form.title.trim() || !form.body.trim()) return;
    setSending(true);
    try {
      const ref = await addDoc(collection(db, "announcements"), {
        title: form.title.trim(), body: form.body.trim(), type: form.type,
        target: form.target, targetSociety: form.targetSociety || null,
        priority: form.priority, sentAt: serverTimestamp(), createdAt: serverTimestamp(), status: "active",
      });
      await logAudit(
        "broadcast.send", adminId, adminName,
        `Sent "${form.type}" broadcast: "${form.title.trim()}" → ${form.target} [${form.priority}]`,
        ref.id
      );
      setForm({ title: "", body: "", type: "Announcement", target: "All Users", targetSociety: "", priority: "normal" });
      showToast("✓ Broadcast sent successfully");
      load();
    } catch { showToast("Failed to send"); }
    setSending(false);
  };

  const typeColors: Record<string, string> = {
    "Announcement": "badge-accent", "Maintenance Alert": "badge-warning",
    "New Feature": "badge-success", "Promotional": "badge-muted", "Security Notice": "badge-error",
  };
  const priorityIcon = (p: string) => p === "urgent" ? "🔴" : p === "high" ? "🟠" : "🔵";

  return (
    <div>
      {toast && <div style={{ position: "fixed", top: 20, right: 24, zIndex: 9999, background: "var(--success)", color: "#fff", padding: "10px 20px", borderRadius: "var(--radius-sm)", fontWeight: 600, fontSize: 13, boxShadow: "var(--shadow-lg)" }}>{toast}</div>}

      <div className="page-header">
        <div>
          <h1 className="page-title">Broadcast & Announcements</h1>
          <p className="page-subtitle">Push messages and platform-wide notifications</p>
        </div>
        <div style={{ background: "var(--accent-dim)", color: "var(--accent)", padding: "8px 16px", borderRadius: "var(--radius-sm)", fontSize: 13, fontWeight: 600 }}>
          📡 {userCount} users reachable
        </div>
      </div>

      <div className="grid grid-2" style={{ gap: 24, alignItems: "start" }}>
        <div className="card">
          <h3 className="card-title" style={{ marginBottom: 20 }}>✍ Compose Broadcast</h3>

          <div className="form-group">
            <label className="form-label">Message Type</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {MSG_TYPES.map(t => <button key={t} className={`chip${form.type === t ? " active" : ""}`} onClick={() => set("type", t)} style={{ fontSize: 12 }}>{t}</button>)}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Title *</label>
            <input className="form-input" placeholder="e.g., Scheduled Maintenance on Sunday" value={form.title} onChange={e => set("title", e.target.value)} maxLength={100} />
            <span className="form-hint">{form.title.length}/100</span>
          </div>

          <div className="form-group">
            <label className="form-label">Message *</label>
            <textarea className="form-input" placeholder="Write your announcement here…" value={form.body} onChange={e => set("body", e.target.value)} rows={4} maxLength={500} />
            <span className="form-hint">{form.body.length}/500</span>
          </div>

          <div className="grid grid-2" style={{ gap: 14, marginBottom: 18 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Target Audience</label>
              <select className="form-input" value={form.target} onChange={e => set("target", e.target.value)}>
                {TARGETS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Priority</label>
              <select className="form-input" value={form.priority} onChange={e => set("priority", e.target.value)}>
                <option value="normal">🔵 Normal</option>
                <option value="high">🟠 High</option>
                <option value="urgent">🔴 Urgent</option>
              </select>
            </div>
          </div>

          {form.target === "Society-Specific" && (
            <div className="form-group">
              <label className="form-label">Select Society</label>
              <select className="form-input" value={form.targetSociety} onChange={e => set("targetSociety", e.target.value)}>
                <option value="">— Choose society —</option>
                {societies.map(s => <option key={s.id as string} value={s.id as string}>{s.name as string}</option>)}
              </select>
            </div>
          )}

          {(form.title || form.body) && (
            <div style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "14px 16px", marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Preview</div>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <div style={{ fontSize: 22 }}>📣</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{form.title || "Title"}</div>
                  <div style={{ fontSize: 13, color: "var(--muted)" }}>{form.body || "Message body…"}</div>
                  <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                    <span className={`badge ${typeColors[form.type] || "badge-muted"}`} style={{ fontSize: 10 }}>{form.type}</span>
                    <span style={{ fontSize: 11, color: "var(--muted)" }}>→ {form.target} {priorityIcon(form.priority)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, color: "var(--muted)" }}>
              Estimated reach: <strong style={{ color: "var(--accent)" }}>{estimateReach()}</strong>
            </span>
            <button className="btn btn-primary" onClick={handleSend} disabled={sending || !form.title.trim() || !form.body.trim()}>
              {sending ? "Sending…" : "📡 Send Broadcast"}
            </button>
          </div>
        </div>

        <div>
          <h3 style={{ fontFamily: "var(--font-heading)", fontSize: 16, fontWeight: 700, marginBottom: 16 }}>
            📜 Broadcast History
            <span style={{ fontSize: 12, color: "var(--muted)", fontFamily: "var(--font-body)", fontWeight: 400, marginLeft: 8 }}>{history.length} sent</span>
          </h3>
          {loading ? (
            <div style={{ textAlign: "center", padding: 40 }}><div className="loader" style={{ margin: "0 auto" }} /></div>
          ) : history.length === 0 ? (
            <div className="empty-state" style={{ padding: "40px 20px" }}>
              <div className="empty-state-icon">📭</div><div className="empty-state-title">No broadcasts yet</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {history.map(a => (
                <div key={a.id as string} className="card" style={{ padding: "14px 16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{a.title as string}</div>
                    <span className={`badge ${typeColors[a.type as string] || "badge-muted"}`} style={{ fontSize: 10, flexShrink: 0, marginLeft: 8 }}>{a.type as string}</span>
                  </div>
                  <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 8 }}>{a.body as string}</div>
                  <div style={{ display: "flex", gap: 12, fontSize: 11, color: "var(--muted)", alignItems: "center" }}>
                    <span>→ {a.target as string}</span>
                    <span>{priorityIcon(a.priority as string)}</span>
                    <span className={`badge ${a.status === "active" ? "badge-success" : "badge-muted"}`} style={{ fontSize: 10 }}>
                      {a.status === "active" ? "Active" : "Inactive"}
                    </span>
                    {a.status === "active" && (
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ fontSize: 10, padding: "2px 8px", color: "var(--error)" }}
                        onClick={() => handleDeactivate(a.id as string)}
                      >Stop</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

