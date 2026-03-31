import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getAllBookings } from "../../services/firestoreService";
import { logAudit } from "./AdminAuditLog";
import { useAuth } from "../../contexts/AuthContext";

type BookingRow = Record<string, unknown>;
type FilterTab = "all" | "pending" | "confirmed" | "completed" | "cancelled";

export default function AdminBookings() {
  const { userProfile, user } = useAuth();
  const adminId = userProfile?.uid || user?.uid || "unknown";
  const adminName = userProfile?.displayName || "Admin";

  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<FilterTab>("all");
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await getAllBookings();
      setBookings(res?.data || []);
    } catch (e) {
      console.error("Error loading bookings:", e);
      showToast("Failed to load bookings", "error");
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const counts = {
    all: bookings.length,
    pending: bookings.filter(b => b.status === "pending").length,
    confirmed: bookings.filter(b => b.status === "confirmed").length,
    completed: bookings.filter(b => b.status === "completed").length,
    cancelled: bookings.filter(b => b.status === "cancelled").length,
  };

  const filtered = bookings.filter((b) => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      ((b.serviceName as string) || "").toLowerCase().includes(q) ||
      ((b.clientName as string) || "").toLowerCase().includes(q) ||
      ((b.proName as string) || "").toLowerCase().includes(q);
    const matchTab = tab === "all" ? true : b.status === tab;
    return matchSearch && matchTab;
  });

  const tabs: { key: FilterTab; label: string }[] = [
    { key: "all", label: "All" },
    { key: "pending", label: "Pending" },
    { key: "confirmed", label: "Confirmed" },
    { key: "completed", label: "Completed" },
    { key: "cancelled", label: "Cancelled" },
  ];

  const statusColor: Record<string, string> = {
    pending: "badge-warning",
    confirmed: "badge-accent",
    completed: "badge-success",
    cancelled: "badge-error",
  };

  return (
    <div>
      {toast && (
        <div style={{
          position: "fixed", top: 20, right: 24, zIndex: 9999,
          background: toast.type === "success" ? "var(--success)" : "var(--error)",
          color: "#fff", padding: "10px 20px", borderRadius: "var(--radius-sm)",
          fontWeight: 600, fontSize: 13, boxShadow: "var(--shadow-lg)", animation: "dropIn 0.2s ease",
        }}>{toast.msg}</div>
      )}

      <div className="page-header">
        <div>
          <h1 className="page-title">Booking Management</h1>
          <p className="page-subtitle">{bookings.length} total platform bookings</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => {
            const csv = ["ID,Service,Client,Professional,Date,Amount,Status"]
              .concat(bookings.map((b) => `"${b.id}","${b.serviceName}","${b.clientName}","${b.proName}","${b.date}","${b.amount}","${b.status}"`))
              .join("\n");
            const a = document.createElement("a");
            a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
            a.download = "bookings.csv"; a.click();
            logAudit("admin.export", adminId, adminName, "Exported Bookings list to CSV", "bookings");
          }}>⬇ Export CSV</button>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 8 }}>
        <div className="tabs" style={{ marginBottom: 0, border: "none" }}>
          {tabs.map(t => (
            <button key={t.key} className={`tab${tab === t.key ? " active" : ""}`} onClick={() => setTab(t.key)}>
              {t.label} <span style={{ marginLeft: 6, fontSize: 11, opacity: 0.7 }}>({counts[t.key]})</span>
            </button>
          ))}
        </div>
        <input className="form-input" placeholder="Search service, client, pro…" value={search}
          onChange={e => setSearch(e.target.value)} style={{ maxWidth: 280, padding: "8px 12px" }} />
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 60 }}><div className="loader" style={{ margin: "0 auto" }} /></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state"><div className="empty-state-icon">📅</div><div className="empty-state-title">No bookings found</div></div>
      ) : (
        <div className="table-wrap card">
          <table className="table">
            <thead>
              <tr>
                <th>Booking ID</th>
                <th>Service</th>
                <th>Client</th>
                <th>Professional</th>
                <th>Date & Time</th>
                <th>Price</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(b => (
                <tr key={b.id as string}>
                  <td className="text-muted" style={{ fontFamily: "monospace", fontSize: 13 }}>
                    <Link to={`/bookings/${b.id}`} style={{ color: "var(--accent)" }}>
                      #{((b.id as string) || "").slice(-6).toUpperCase()}
                    </Link>
                  </td>
                  <td style={{ fontWeight: 500 }}>{(b.serviceName as string) || "Consultation"}</td>
                  <td>{(b.clientName as string) || "—"}</td>
                  <td>{(b.proName as string) || "—"}</td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{(b.date as string) || "—"}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>{(b.time as string) || "—"}</div>
                  </td>
                  <td style={{ fontWeight: 600 }}>{(b.amount as number) === 0 ? "Free" : `₹${b.amount}`}</td>
                  <td>
                    <span className={`badge ${statusColor[b.status as string] || "badge-muted"}`}>
                      {(b.status as string) || "Unknown"}
                    </span>
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
