import { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase";
import { formatTimestamp } from "../../services/firestoreService";

type LogEntry = Record<string, unknown>;

const ACTION_TYPES = ["All", "user.disable", "user.enable", "user.delete", "user.role_change", "society.create", "society.delete", "broadcast.send", "ticket.close", "settings.update", "service.approve", "service.reject", "review.delete"];

export async function logAudit(action: string, adminId: string, adminName: string, details: string, targetId?: string) {
  try {
    await addDoc(collection(db, "auditLogs"), {
      action, adminId, adminName, details, targetId: targetId || null,
      timestamp: serverTimestamp(), createdAt: serverTimestamp(),
    });
  } catch { /* best-effort */ }
}

export default function AdminAuditLog() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const snap = await getDocs(query(collection(db, "auditLogs"), orderBy("createdAt", "desc")));
        setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch { /* ignore */ }
      setLoading(false);
    };
    load();
  }, []);

  const filtered = logs.filter(l => {
    const matchFilter = filter === "All" || l.action === filter;
    const q = search.toLowerCase();
    const matchSearch = !q ||
      ((l.action as string) || "").includes(q) ||
      ((l.adminName as string) || "").toLowerCase().includes(q) ||
      ((l.details as string) || "").toLowerCase().includes(q);
    return matchFilter && matchSearch;
  });

  const actionColor = (action: string) => {
    if (action.includes("delete") || action.includes("disable") || action.includes("reject")) return "badge-error";
    if (action.includes("create") || action.includes("enable") || action.includes("approve")) return "badge-success";
    if (action.includes("send") || action.includes("update")) return "badge-accent";
    return "badge-muted";
  };

  const actionIcon = (action: string) => {
    const icons: Record<string, string> = {
      "user.disable": "🚫", "user.enable": "✅", "user.delete": "🗑", "user.role_change": "🛡",
      "society.create": "🏘", "society.delete": "❌", "broadcast.send": "📡",
      "ticket.close": "🎫", "settings.update": "⚙️", "service.approve": "✓", "service.reject": "✗", "review.delete": "🗑",
    };
    for (const key of Object.keys(icons)) { if (action?.includes(key.split(".")[1])) return icons[key]; }
    return "📋";
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Audit Log</h1>
          <p className="page-subtitle">All admin actions and platform events · {logs.length} entries</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => {
          const csv = ["Timestamp,Admin,Action,Details,Target"]
            .concat(logs.map(l => `"${formatTimestamp(l.createdAt)}","${l.adminName}","${l.action}","${l.details}","${l.targetId || ""}"` ))
            .join("\n");
          const a = document.createElement("a");
          a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
          a.download = "audit-log.csv";
          a.click();
        }}>⬇ Export</button>
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        <input
          className="form-input"
          placeholder="Search actions, admin, details…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ maxWidth: 280, padding: "8px 12px" }}
        />
        <select className="form-input" style={{ maxWidth: 200, padding: "8px 12px" }} value={filter} onChange={e => setFilter(e.target.value)}>
          {ACTION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <span style={{ fontSize: 13, color: "var(--muted)" }}>{filtered.length} result{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 60 }}><div className="loader" style={{ margin: "0 auto" }} /></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📋</div>
          <div className="empty-state-title">No audit entries</div>
          <div className="empty-state-desc">Admin actions will be logged here automatically</div>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Admin</th>
                <th>Action</th>
                <th>Details</th>
                <th>Target ID</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(l => (
                <tr key={l.id as string}>
                  <td style={{ fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap" }}>{formatTimestamp(l.createdAt) || "—"}</td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{l.adminName as string || "System"}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>{(l.adminId as string || "").slice(0, 10)}…</div>
                  </td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span>{actionIcon(l.action as string)}</span>
                      <span className={`badge ${actionColor(l.action as string)}`} style={{ fontSize: 11 }}>{l.action as string}</span>
                    </div>
                  </td>
                  <td style={{ fontSize: 13, color: "var(--muted)", maxWidth: 300 }}>{l.details as string || "—"}</td>
                  <td style={{ fontSize: 11, fontFamily: "monospace", color: "var(--muted)" }}>
                    {l.targetId ? (l.targetId as string).slice(0, 12) + "…" : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

