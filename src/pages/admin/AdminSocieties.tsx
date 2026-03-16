import { useEffect, useState } from "react";
import { getAllSocieties, createSociety, updateSociety, deleteSociety } from "../../services/firestoreService";
import { useAuth } from "../../contexts/AuthContext";
import { logAudit } from "./AdminAuditLog";

export default function AdminSocieties() {
  const { userProfile } = useAuth();
  const adminId = userProfile?.uid || "unknown";
  const adminName = userProfile?.displayName || "Admin";

  const [societies, setSocieties] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<Record<string, unknown> | null>(null);
  const [toast, setToast] = useState("");

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const load = async () => {
    setLoading(true);
    try { setSocieties(await getAllSocieties()); } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!name.trim()) return;
    try {
      const id = await createSociety({ name: name.trim(), address, city });
      await logAudit("society.create", adminId, adminName, `Created society: ${name.trim()}, ${city}`, id);
      showToast(`Society "${name.trim()}" created`);
      setName(""); setAddress(""); setCity("");
      setShowForm(false);
      load();
    } catch { showToast("Failed to create society"); }
  };

  const handleTogglePremium = async (id: string, current: string, societyName: string) => {
    const next = current === "premium" ? "free" : "premium";
    await updateSociety(id, { subscription: next });
    await logAudit(
      "society.subscription_change", adminId, adminName,
      `Changed "${societyName}" subscription: ${current} → ${next}`, id
    );
    showToast(`${societyName} → ${next}`);
    load();
  };

  const handleDelete = async (s: Record<string, unknown>) => {
    try {
      await deleteSociety(s.id as string);
      await logAudit("society.delete", adminId, adminName, `Deleted society: ${s.name as string}`, s.id as string);
      showToast(`"${s.name as string}" deleted`);
      setDeleteConfirm(null);
      load();
    } catch { showToast("Delete failed"); }
  };

  return (
    <div>
      {toast && <div style={{ position: "fixed", top: 20, right: 24, zIndex: 9999, background: "var(--success)", color: "#fff", padding: "10px 20px", borderRadius: "var(--radius-sm)", fontWeight: 600, fontSize: 13, boxShadow: "var(--shadow-lg)" }}>{toast}</div>}

      <div className="page-header">
        <div>
          <h1 className="page-title">Manage Societies</h1>
          <p className="page-subtitle">{societies.length} registered communities</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ Add Society"}
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 24, maxWidth: 520 }}>
          <h3 className="card-title" style={{ marginBottom: 16 }}>New Society</h3>
          <div className="form-group">
            <label className="form-label">Society Name</label>
            <input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Sunflower Heights" />
          </div>
          <div className="form-group">
            <label className="form-label">Address</label>
            <input className="form-input" value={address} onChange={e => setAddress(e.target.value)} placeholder="Full address" />
          </div>
          <div className="form-group">
            <label className="form-label">City</label>
            <input className="form-input" value={city} onChange={e => setCity(e.target.value)} placeholder="e.g., Pune" />
          </div>
          <button className="btn btn-success" onClick={handleCreate} disabled={!name.trim()}>Create Society</button>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: 60 }}><div className="loader" style={{ margin: "0 auto" }} /></div>
      ) : societies.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🏘️</div>
          <div className="empty-state-title">No societies yet</div>
          <div className="empty-state-desc">Add your first community to get started</div>
        </div>
      ) : (
        <div className="grid grid-3">
          {societies.map(s => (
            <div className="card" key={s.id as string}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div>
                  <h3 style={{ marginBottom: 4 }}>{s.name as string}</h3>
                  <p className="text-muted text-sm">{(s.address as string) || (s.city as string) || "—"}</p>
                </div>
                <span className={`badge ${(s.subscription as string) === "premium" ? "badge-accent" : "badge-muted"}`}>
                  {(s.subscription as string) || "free"}
                </span>
              </div>
              <div className="text-muted text-sm" style={{ marginBottom: 12 }}>
                Members: {(s.memberCount as number) || 0}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-ghost btn-sm"
                  onClick={() => handleTogglePremium(s.id as string, (s.subscription as string) || "free", s.name as string)}>
                  {(s.subscription as string) === "premium" ? "Downgrade" : "Upgrade to Premium"}
                </button>
                <button className="btn btn-danger btn-sm" onClick={() => setDeleteConfirm(s)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ color: "var(--error)" }}>⚠ Delete Society</h3>
              <button className="modal-close" onClick={() => setDeleteConfirm(null)}>✕</button>
            </div>
            <p style={{ fontSize: 14, color: "var(--muted)", marginBottom: 16 }}>
              Permanently delete <strong style={{ color: "var(--text)" }}>{deleteConfirm.name as string}</strong>?
              This will not remove associated users.
            </p>
            <div className="modal-actions">
              <button className="btn btn-secondary btn-sm" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button className="btn btn-danger btn-sm" onClick={() => handleDelete(deleteConfirm)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
