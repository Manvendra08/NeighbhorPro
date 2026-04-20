import { useEffect, useState } from "react";
import { getAllSocieties, createSociety, updateSociety, deleteSociety } from "../../services/firestoreService";
import { useAuth } from "../../contexts/AuthContext";
import { logAudit } from "./AdminAuditLog";
import { Link } from "react-router-dom";

type SubscriptionFilter = "all" | "free" | "premium";

export default function AdminSocieties() {
  const { userProfile } = useAuth();
  const adminId = userProfile?.uid || "unknown";
  const adminName = userProfile?.displayName || "Admin";

  const [societies, setSocieties] = useState<Record<string, unknown>[]>([]);
  const [search, setSearch] = useState("");
  const [subscriptionFilter, setSubscriptionFilter] = useState<SubscriptionFilter>("all");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [locality, setLocality] = useState("");
  const [city, setCity] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<Record<string, unknown> | null>(null);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [editSociety, setEditSociety] = useState<Record<string, unknown> | null>(null);
  const [editName, setEditName] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editLocality, setEditLocality] = useState("");
  const [editCity, setEditCity] = useState("");
  const [toast, setToast] = useState("");

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const load = async () => {
    setLoading(true);
    try {
      const res = await getAllSocieties();
      setSocieties(res.data || []);
    } catch (e) { console.error("Load error:", e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClick = () => setActiveMenu(null);
    if (activeMenu) {
      document.addEventListener("click", handleClick);
      return () => document.removeEventListener("click", handleClick);
    }
  }, [activeMenu]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveMenu(null);
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);

  const handleCreate = async () => {
    if (!name.trim()) return;
    const normalized = name.trim().toLowerCase();
    const duplicate = societies.some(s => ((s.name as string) || "").trim().toLowerCase() === normalized);
    if (duplicate) {
      showToast("A society with this name already exists");
      return;
    }

    try {
      const id = await createSociety({ name: name.trim(), address, locality: locality.trim(), city });
      await logAudit("society.create", adminId, adminName, `Created society: ${name.trim()}, ${city}`, id);
      showToast(`Society "${name.trim()}" created`);
      setName(""); setAddress(""); setLocality(""); setCity("");
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

  const openEdit = (s: Record<string, unknown>) => {
    setEditSociety(s);
    setEditName((s.name as string) || "");
    setEditAddress((s.address as string) || "");
    setEditLocality((s.locality as string) || "");
    setEditCity((s.city as string) || "");
  };

  const handleEditSave = async () => {
    if (!editSociety?.id || !editName.trim()) return;
    const normalized = editName.trim().toLowerCase();
    const duplicate = societies.some(s =>
      (s.id as string) !== (editSociety.id as string) &&
      ((s.name as string) || "").trim().toLowerCase() === normalized
    );
    if (duplicate) {
      showToast("Another society with this name already exists");
      return;
    }

    try {
      await updateSociety(editSociety.id as string, {
        name: editName.trim(),
        address: editAddress.trim(),
        locality: editLocality.trim(),
        city: editCity.trim(),
      });
      await logAudit("society.update", adminId, adminName, `Updated society: ${editName.trim()}`, editSociety.id as string);
      showToast(`"${editName.trim()}" updated`);
      setEditSociety(null);
      await load();
    } catch {
      showToast("Failed to update society");
    }
  };

  const counts = {
    all: societies.length,
    free: societies.filter(s => (s.subscription as string) !== "premium").length,
    premium: societies.filter(s => (s.subscription as string) === "premium").length,
  };

  const filtered = societies.filter(s => {
    const matchSearch = !search || (s.name as string).toLowerCase().includes(search.toLowerCase());
    const matchSub = subscriptionFilter === "all" || (s.subscription as string) === subscriptionFilter;
    return matchSearch && matchSub;
  });

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
            <label className="form-label">Locality</label>
            <input className="form-input" value={locality} onChange={e => setLocality(e.target.value)} placeholder="e.g., Baner" />
          </div>
          <div className="form-group">
            <label className="form-label">City</label>
            <input className="form-input" value={city} onChange={e => setCity(e.target.value)} placeholder="e.g., Pune" />
          </div>
          <button className="btn btn-success" onClick={handleCreate} disabled={!name.trim()}>Create Society</button>
        </div>
      )}

      {/* FIX: Added working subscription filter with state and counts */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
        <div className="tabs" style={{ marginBottom: 0, border: "none" }}>
          {(["all", "free", "premium"] as SubscriptionFilter[]).map(f => (
            <button key={f} className={`tab${subscriptionFilter === f ? " active" : ""}`} onClick={() => setSubscriptionFilter(f)}>
              {f.charAt(0).toUpperCase() + f.slice(1)} ({counts[f]})
            </button>
          ))}
        </div>
        <input
          className="form-input"
          placeholder="Search societies..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ maxWidth: 320 }}
        />
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 60 }}><div className="loader" style={{ margin: "0 auto" }} /></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🏘️</div>
          <div className="empty-state-title">No societies found</div>
          <div className="empty-state-desc">
            {societies.length === 0 ? "Add your first community to get started" : "No societies match your filters"}
          </div>
        </div>
      ) : (
        <div className="grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 24 }}>
          {filtered.map(s => (
            <div className="card" key={s.id as string} style={{ position: "relative" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <Link to={`/admin/societies/${s.id}`} style={{ textDecoration: "none", color: "inherit", flex: 1 }}>
                  <h3 style={{ marginBottom: 4, cursor: "pointer" }}>{s.name as string}</h3>
                  <p className="text-muted text-sm">{(s.address as string) || (s.city as string) || "—"}</p>
                </Link>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className={`badge ${(s.subscription as string) === "premium" ? "badge-accent" : "badge-muted"}`}>
                    {(s.subscription as string) || "free"}
                  </span>

                  <div style={{ position: "relative" }}>
                    <button
                      className="btn btn-ghost btn-sm btn-icon"
                      onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === s.id ? null : s.id as string); }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setActiveMenu(activeMenu === s.id ? null : s.id as string);
                        }
                      }}
                      aria-label={`Open actions for ${(s.name as string) || "society"}`}
                      aria-haspopup="menu"
                      aria-expanded={activeMenu === s.id}
                      style={{ fontSize: 18, width: 32, height: 32 }}
                    >
                      ⋮
                    </button>

                    {activeMenu === s.id && (
                      <div
                        className="card"
                        role="menu"
                        style={{
                          position: "absolute", top: "100%", right: 0, zIndex: 10,
                          padding: 4, width: 140, boxShadow: "var(--shadow-lg)",
                        }}
                      >
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ width: "100%", justifyContent: "flex-start" }}
                          onClick={() => { openEdit(s); setActiveMenu(null); }}
                        >
                          ✏ Edit
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ width: "100%", justifyContent: "flex-start", color: "var(--error)" }}
                          onClick={() => { setDeleteConfirm(s); setActiveMenu(null); }}
                        >
                          🗑 Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="text-muted text-sm" style={{ marginBottom: 16 }}>
                Members: {(s.memberCount as number) || 0}
              </div>

              <div>
                <button
                  className={`btn btn-sm ${(s.subscription as string) === "premium" ? "btn-secondary" : "btn-primary"}`}
                  style={{ width: "100%" }}
                  onClick={() => handleTogglePremium(s.id as string, (s.subscription as string) || "free", s.name as string)}
                >
                  {(s.subscription as string) === "premium" ? "Downgrade to Free" : "Upgrade to Premium"}
                </button>
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
              <button className="modal-close" onClick={() => setDeleteConfirm(null)} aria-label="Close delete society dialog">✕</button>
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

      {editSociety && (
        <div className="modal-overlay" onClick={() => setEditSociety(null)}>
          <div className="modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Edit Society</h3>
              <button className="modal-close" onClick={() => setEditSociety(null)} aria-label="Close edit society dialog">✕</button>
            </div>
            <div className="form-group">
              <label className="form-label">Society Name</label>
              <input className="form-input" value={editName} onChange={e => setEditName(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Address</label>
              <input className="form-input" value={editAddress} onChange={e => setEditAddress(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Locality</label>
              <input className="form-input" value={editLocality} onChange={e => setEditLocality(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">City</label>
              <input className="form-input" value={editCity} onChange={e => setEditCity(e.target.value)} />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary btn-sm" onClick={() => setEditSociety(null)}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={handleEditSave} disabled={!editName.trim()}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
