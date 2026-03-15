import { useEffect, useState } from "react";
import { getAllSocieties, createSociety, updateSociety, deleteSociety } from "../../services/firestoreService";

export default function AdminSocieties() {
  const [societies, setSocieties] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const data = await getAllSocieties();
      setSocieties(data);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!name.trim()) return;
    await createSociety({ name: name.trim(), address, city });
    setName(""); setAddress(""); setCity("");
    setShowForm(false);
    load();
  };

  const handleTogglePremium = async (id: string, current: string) => {
    await updateSociety(id, { subscription: current === "premium" ? "free" : "premium" });
    load();
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this society?")) {
      await deleteSociety(id);
      load();
    }
  };

  return (
    <div>
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
            <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Sunflower Heights" id="society-name-input" />
          </div>
          <div className="form-group">
            <label className="form-label">Address</label>
            <input className="form-input" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Full address" id="society-address-input" />
          </div>
          <div className="form-group">
            <label className="form-label">City</label>
            <input className="form-input" value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g., Pune" id="society-city-input" />
          </div>
          <button className="btn btn-success" onClick={handleCreate} disabled={!name.trim()}>
            Create Society
          </button>
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
          {societies.map((s) => (
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
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => handleTogglePremium(s.id as string, (s.subscription as string) || "free")}
                >
                  {(s.subscription as string) === "premium" ? "Downgrade" : "Upgrade to Premium"}
                </button>
                <button className="btn btn-danger btn-sm" onClick={() => handleDelete(s.id as string)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
