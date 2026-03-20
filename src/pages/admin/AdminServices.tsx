import { useEffect, useState } from "react";
import { getAllServices, getAllUsers } from "../../services/firestoreService";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../contexts/AuthContext";
import { logAudit } from "./AdminAuditLog";

type ServiceRow = Record<string, unknown>;
type StatusFilter = "all" | "pending" | "approved" | "rejected" | "featured";

export default function AdminServices() {
  const { userProfile } = useAuth();
  const adminId = userProfile?.uid || "unknown";
  const adminName = userProfile?.displayName || "Admin";

  const [services, setServices] = useState<ServiceRow[]>([]);
  const [users, setUsers] = useState<Record<string, any>[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedSvc, setSelectedSvc] = useState<ServiceRow | null>(null);
  const [toast, setToast] = useState("");

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const load = async () => {
    setLoading(true);
    try { 
      const [svcData, userData] = await Promise.all([getAllServices(), getAllUsers()]);
      setServices(svcData);
      setUsers(userData);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const setStatus = async (s: ServiceRow, status: string) => {
    const id = s.id as string;
    const prevStatus = (s.status as string) || "pending";
    await updateDoc(doc(db, "services", id), { status });
    await logAudit(
      `service.${status}`, adminId, adminName,
      `Changed service "${s.title as string || id}" status: ${prevStatus} → ${status}`,
      id
    );
    showToast(`Service ${status}`);
    load();
  };

  const bulkStatus = async (status: string) => {
    if (selectedIds.length === 0) return;
    await Promise.all(selectedIds.map(id => updateDoc(doc(db, "services", id), { status })));
    await logAudit(`service.bulk_${status}`, adminId, adminName, `Bulk ${status} for ${selectedIds.length} services`, selectedIds.join(", "));
    showToast(`Bulk updated to ${status}`);
    setSelectedIds([]);
    load();
  };

  const counts = {
    all: services.length,
    pending: services.filter(s => s.status === "pending" || !s.status).length,
    approved: services.filter(s => s.status === "approved").length,
    rejected: services.filter(s => s.status === "rejected").length,
    featured: services.filter(s => s.status === "featured").length,
  };

  const filtered = services.filter(s => {
    const matchTab = filter === "all" ? true
      : filter === "pending" ? (s.status === "pending" || !s.status)
      : s.status === filter;
    const q = search.toLowerCase();
    const matchSearch = !q || ((s.title as string) || "").toLowerCase().includes(q) || ((s.category as string) || "").toLowerCase().includes(q);
    return matchTab && matchSearch;
  });

  const statusBadge = (status: string) => ({
    approved: "badge-success", rejected: "badge-error", featured: "badge-warning", pending: "badge-accent"
  } as Record<string, string>)[status] || "badge-muted";

  return (
    <div>
      {toast && <div style={{ position: "fixed", top: 20, right: 24, zIndex: 9999, background: "var(--success)", color: "#fff", padding: "10px 20px", borderRadius: "var(--radius-sm)", fontWeight: 600, fontSize: 13, boxShadow: "var(--shadow-lg)" }}>{toast}</div>}

      <div className="page-header">
        <div>
          <h1 className="page-title">Service Moderation</h1>
          <p className="page-subtitle">Approve, reject or feature service listings</p>
        </div>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 20 }}>
        {[
          { k: "pending", label: "Pending Review", color: "var(--accent-dim)", ic: "var(--accent)", icon: "⏳" },
          { k: "approved", label: "Approved", color: "rgba(91,122,91,0.12)", ic: "var(--success)", icon: "✅" },
          { k: "featured", label: "Featured", color: "rgba(196,136,42,0.1)", ic: "var(--warning)", icon: "⭐" },
          { k: "rejected", label: "Rejected", color: "rgba(255,92,92,0.08)", ic: "var(--error)", icon: "❌" },
        ].map(c => (
          <div className="stat-card" key={c.k} style={{ padding: "16px 20px", cursor: "pointer", borderColor: filter === c.k ? "var(--accent)" : undefined }} onClick={() => setFilter(c.k as StatusFilter)}>
            <div className="stat-icon" style={{ background: c.color, color: c.ic }}>{c.icon}</div>
            <div className="stat-value" style={{ fontSize: 22 }}>{counts[c.k as StatusFilter]}</div>
            <div className="stat-label">{c.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div className="tabs" style={{ marginBottom: 0, border: "none" }}>
          {(["all", "pending", "approved", "featured", "rejected"] as StatusFilter[]).map(t => (
            <button key={t} className={`tab${filter === t ? " active" : ""}`} onClick={() => setFilter(t)}>
              {t.charAt(0).toUpperCase() + t.slice(1)} ({counts[t]})
            </button>
          ))}
        </div>
        
        {selectedIds.length > 0 && (
          <div style={{ display: "flex", gap: 8, padding: "4px 12px", background: "var(--accent-dim)", borderRadius: "var(--radius-sm)", alignItems: "center" }}>
            <span style={{ fontSize: 13, fontWeight: 600, marginRight: 8 }}>{selectedIds.length} Selected</span>
            <button className="btn btn-success btn-sm" onClick={() => bulkStatus("approved")}>Approve All</button>
            <button className="btn btn-danger btn-sm" onClick={() => bulkStatus("rejected")}>Reject All</button>
          </div>
        )}

        <input className="form-input" placeholder="Search title, category…" value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 240, padding: "8px 12px", marginLeft: "auto" }} />
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 60 }}><div className="loader" style={{ margin: "0 auto" }} /></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state"><div className="empty-state-icon">🛠</div><div className="empty-state-title">No services</div></div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 40 }}>
                  <input
                    type="checkbox"
                    checked={selectedIds.length === filtered.length && filtered.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedIds(filtered.map(s => s.id as string));
                      else setSelectedIds([]);
                    }}
                  />
                </th>
                <th>Service</th><th>Category</th><th>Provider</th><th>Rate</th><th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => {
                const provider = users.find(u => u.uid === s.userId);
                return (
                  <tr key={s.id as string} onClick={() => setSelectedSvc(s)} style={{ cursor: "pointer", verticalAlign: "middle" }}>
                    <td onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(s.id as string)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedIds([...selectedIds, s.id as string]);
                          else setSelectedIds(selectedIds.filter(id => id !== s.id));
                        }}
                      />
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{s.title as string || "Untitled"}</div>
                      {typeof s.description === "string" && s.description.trim() !== "" && s.description !== s.title && (
                        <div style={{ fontSize: 12, color: "var(--muted)", maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.description}</div>
                      )}
                    </td>
                    <td><span className="badge badge-muted">{s.category as string || "—"}</span></td>
                    <td style={{ fontSize: 13 }}>
                      {provider ? (
                        <a href={`/admin/users/${provider.uid}`} onClick={e => e.stopPropagation()} style={{ color: "var(--accent)", fontWeight: 500 }}>
                          {provider.displayName || provider.email}
                        </a>
                      ) : (
                        <span className="text-muted">Missing Provider</span>
                      )}
                    </td>
                    <td style={{ fontWeight: 600 }}>{s.isFree ? "Free" : s.price ? `₹${s.price}` : "Quote"}</td>
                    <td><span className={`badge ${statusBadge((s.status as string) || "pending")}`}>{(s.status as string) || "pending"}</span></td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }} onClick={e => e.stopPropagation()}>
                        {s.status !== "approved" && <button className="btn btn-success btn-sm" onClick={() => setStatus(s, "approved")}>Approve</button>}
                        {s.status !== "featured" && <button className="btn btn-ghost btn-sm" title="Mark Featured" onClick={() => setStatus(s, "featured")} style={{ fontSize: 18 }}>⭐</button>}
                        {s.status !== "rejected" && <button className="btn btn-danger btn-sm" onClick={() => setStatus(s, "rejected")}>Reject</button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selectedSvc && (
        <div className="modal-overlay" onClick={() => setSelectedSvc(null)}>
          <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Service Details</h3>
              <button className="modal-close" onClick={() => setSelectedSvc(null)}>✕</button>
            </div>
            <div style={{ paddingBottom: 20 }}>
              <div style={{ marginBottom: 16 }}>
                <span className={`badge ${statusBadge((selectedSvc.status as string) || "pending")}`} style={{ marginBottom: 8 }}>{(selectedSvc.status as string) || "pending"}</span>
                <h2 style={{ fontSize: 24, marginBottom: 4 }}>{selectedSvc.title as string}</h2>
                <div className="text-muted">{selectedSvc.category as string}</div>
              </div>
              <div style={{ background: "var(--bg-app)", padding: 16, borderRadius: 12, marginBottom: 20, fontSize: 14 }}>
                {selectedSvc.description as string || "No description provided."}
              </div>
              <div className="grid grid-2" style={{ gap: 20 }}>
                <div>
                  <div className="text-muted text-xs" style={{ textTransform: "uppercase", marginBottom: 4 }}>Pricing</div>
                  <div style={{ fontWeight: 700, fontSize: 18 }}>{selectedSvc.isFree ? "Free" : selectedSvc.price ? `₹${selectedSvc.price}` : "Upon Quote"}</div>
                </div>
                <div>
                  <div className="text-muted text-xs" style={{ textTransform: "uppercase", marginBottom: 4 }}>Duration</div>
                  <div style={{ fontWeight: 700, fontSize: 18 }}>{selectedSvc.duration as string || "—"}</div>
                </div>
              </div>
            </div>
            <div className="modal-actions">
              {selectedSvc.status !== "approved" && <button className="btn btn-success btn-sm" onClick={() => { setStatus(selectedSvc, "approved"); setSelectedSvc(null); }}>Approve</button>}
              {selectedSvc.status !== "rejected" && <button className="btn btn-danger btn-sm" onClick={() => { setStatus(selectedSvc, "rejected"); setSelectedSvc(null); }}>Reject</button>}
              <button className="btn btn-secondary btn-sm" onClick={() => setSelectedSvc(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
