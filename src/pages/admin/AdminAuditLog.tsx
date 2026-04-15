import { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "../../firebase";
import { formatTimestamp } from "../../services/firestoreService";
import { captureAuditEvent, type AuditMetadata } from "../../services/auditService";

type LogEntry = Record<string, unknown>;

const ACTION_TYPES = ["All", "user.disable", "user.enable", "user.delete", "user.role_change", "society.create", "society.delete", "broadcast.send", "ticket.close", "settings.update", "service.approve", "service.reject", "review.delete"];

export async function logAudit(
  action: string,
  adminId: string,
  adminName: string,
  details: string,
  targetId?: string,
  metadata?: Record<string, unknown>
) {
  try {
    await captureAuditEvent({
      action,
      adminId,
      adminName,
      details,
      targetId: targetId || null,
      metadata: metadata || {},
    } as unknown as AuditMetadata);
  } catch { /* best-effort */ }
}

export default function AdminAuditLog() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [usersById, setUsersById] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [userFilter, setUserFilter] = useState("All");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const toMillis = (value: unknown): number => {
    if (!value) return 0;
    if (typeof value === "object" && value !== null) {
      const maybeTimestamp = value as { toDate?: () => Date; seconds?: number };
      if (typeof maybeTimestamp.toDate === "function") {
        return maybeTimestamp.toDate().getTime();
      }
      if (typeof maybeTimestamp.seconds === "number") {
        return maybeTimestamp.seconds * 1000;
      }
    }
    return 0;
  };

  useEffect(() => {
    const load = async () => {
      try {
        const [auditSnap, activitySnap, usersSnap] = await Promise.all([
          getDocs(query(collection(db, "auditLogs"), orderBy("createdAt", "desc"))),
          getDocs(query(collection(db, "activityLogs"), orderBy("timestamp", "desc"))),
          getDocs(collection(db, "users")),
        ]);

        const nameMap: Record<string, string> = {};
        usersSnap.docs.forEach((docRow) => {
          const data = docRow.data() as Record<string, unknown>;
          nameMap[docRow.id] = (data.displayName as string) || (data.email as string) || docRow.id;
        });
        setUsersById(nameMap);

        const auditRows = auditSnap.docs.map((d) => ({ id: d.id, source: "audit", ...d.data() }));
        const activityRows = activitySnap.docs.map((d) => {
          const row = d.data() as Record<string, unknown>;
          const userId = (row.userId as string) || "";
          return {
            id: `activity-${d.id}`,
            source: "activity",
            action: `activity.${(row.event as string) || "unknown"}`,
            adminId: userId,
            adminName: nameMap[userId] || "User",
            targetId: userId,
            details: (row.details as string) || "",
            metadata: (row.metadata as Record<string, unknown>) || {},
            createdAt: row.timestamp,
            timestamp: row.timestamp,
          };
        });

        setLogs([...auditRows, ...activityRows]);
      } catch { /* ignore */ }
      setLoading(false);
    };
    load();
  }, []);

  const filtered = logs.filter(l => {
    const matchFilter = filter === "All" || l.action === filter;
    const actorId = (l.adminId as string) || (l.userId as string) || "";
    const targetId = (l.targetId as string) || "";
    const matchUserFilter = userFilter === "All" || actorId === userFilter || targetId === userFilter;
    const q = search.toLowerCase();
    const matchSearch = !q ||
      ((l.action as string) || "").includes(q) ||
      ((l.adminName as string) || "").toLowerCase().includes(q) ||
      ((l.details as string) || "").toLowerCase().includes(q) ||
      actorId.toLowerCase().includes(q) ||
      targetId.toLowerCase().includes(q);
    const createdAtMillis = toMillis(l.createdAt);

    let inDateRange = true;
    if (fromDate) {
      const from = new Date(`${fromDate}T00:00:00`).getTime();
      if (!Number.isNaN(from)) {
        inDateRange = inDateRange && createdAtMillis >= from;
      }
    }
    if (toDate) {
      const to = new Date(`${toDate}T23:59:59.999`).getTime();
      if (!Number.isNaN(to)) {
        inDateRange = inDateRange && createdAtMillis <= to;
      }
    }

    return matchFilter && matchSearch && matchUserFilter && inDateRange;
  });

  const userOptions = Array.from(new Set(
    logs.flatMap((item) => [
      (item.adminId as string) || "",
      (item.targetId as string) || "",
    ]).filter(Boolean)
  )).sort((a, b) => {
    const aLabel = usersById[a] || a;
    const bLabel = usersById[b] || b;
    return aLabel.localeCompare(bLabel);
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
            .concat(filtered.map(l => `"${formatTimestamp(l.createdAt)}","${l.adminName}","${l.action}","${l.details}","${l.targetId || ""}"` ))
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
        <select
          className="form-input"
          style={{ maxWidth: 240, padding: "8px 12px" }}
          value={userFilter}
          onChange={e => setUserFilter(e.target.value)}
        >
          <option value="All">All Users</option>
          {userOptions.map((uid) => (
            <option key={uid} value={uid}>{usersById[uid] ? `${usersById[uid]} (${uid.slice(0, 8)}...)` : uid}</option>
          ))}
        </select>
        <select className="form-input" style={{ maxWidth: 200, padding: "8px 12px" }} value={filter} onChange={e => setFilter(e.target.value)}>
          {ACTION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <input
          className="form-input"
          type="date"
          value={fromDate}
          onChange={e => setFromDate(e.target.value)}
          style={{ maxWidth: 170, padding: "8px 12px" }}
          aria-label="Filter from date"
        />
        <input
          className="form-input"
          type="date"
          value={toDate}
          onChange={e => setToDate(e.target.value)}
          style={{ maxWidth: 170, padding: "8px 12px" }}
          aria-label="Filter to date"
        />
        {(fromDate || toDate) && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setFromDate("");
              setToDate("");
            }}
          >
            Clear Dates
          </button>
        )}
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
                <th>Actor</th>
                <th>Action</th>
                <th>Details</th>
                <th>User</th>
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
                  <td style={{ fontSize: 13, color: "var(--muted)", maxWidth: 300 }}>
                    {(l.details as string) || "—"}
                    {Object.keys((l.metadata as Record<string, unknown>) || {}).length > 0 && (
                      <div style={{ marginTop: 6, fontSize: 11, color: "var(--muted)" }}>
                        {JSON.stringify(l.metadata).slice(0, 180)}
                      </div>
                    )}
                  </td>
                  <td style={{ fontSize: 11, fontFamily: "monospace", color: "var(--muted)" }}>
                    {l.targetId ? `${usersById[l.targetId as string] || "User"} (${(l.targetId as string).slice(0, 8)}...)` : "—"}
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

