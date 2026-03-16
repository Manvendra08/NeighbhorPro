import { useEffect, useState } from "react";
import { getAllUsers, getAllBookings, getTransactions, getAllSocieties, formatTimestamp } from "../../services/firestoreService";

export default function AdminDashboard() {
  const [stats, setStats] = useState({ users: 0, bookings: 0, revenue: 0, commission: 0, societies: 0, proEarnings: 0 });
  const [recentBookings, setRecentBookings] = useState<Record<string, unknown>[]>([]);
  const [transactions, setTransactions] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [users, bookings, txns, societies] = await Promise.all([
          getAllUsers(),
          getAllBookings(),
          getTransactions(),
          getAllSocieties(),
        ]);
        const totalRevenue = txns.reduce((s, t) => s + ((t.amount as number) || 0), 0);
        const totalCommission = txns.reduce((s, t) => s + ((t.commission as number) || 0), 0);
        const totalProEarnings = txns.reduce((s, t) => s + ((t.proEarning as number) || 0), 0);
        setStats({
          users: users.length,
          bookings: bookings.length,
          revenue: totalRevenue,
          commission: totalCommission,
          proEarnings: totalProEarnings,
          societies: societies.length,
        });
        setRecentBookings(bookings.slice(0, 8));
        setTransactions(txns);
      } catch { /* ignore */ }
      setLoading(false);
    };
    load();
  }, []);

  const cards = [
    { label: "Total Users", value: stats.users, icon: "👥", color: "var(--accent-dim)", iconColor: "var(--accent)" },
    { label: "Total Bookings", value: stats.bookings, icon: "📅", color: "var(--accent2-dim)", iconColor: "var(--accent2)" },
    { label: "Revenue (₹)", value: `₹${stats.revenue.toLocaleString()}`, icon: "💰", color: "rgba(255,179,71,0.1)", iconColor: "var(--warning)" },
    { label: "Commission (₹)", value: `₹${stats.commission.toLocaleString()}`, icon: "🏦", color: "rgba(255,92,92,0.08)", iconColor: "var(--error)" },
  ];

  const statusColor: Record<string, string> = {
    pending: "badge-warning", confirmed: "badge-accent", completed: "badge-success", cancelled: "badge-error",
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Admin Dashboard</h1>
          <p className="page-subtitle">Platform overview and analytics</p>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 60 }}><div className="loader" style={{ margin: "0 auto" }} /></div>
      ) : (
        <>
          <div className="grid grid-4" style={{ marginBottom: 32 }}>
            {cards.map((c) => (
              <div className="stat-card" key={c.label}>
                <div className="stat-icon" style={{ background: c.color, color: c.iconColor }}>{c.icon}</div>
                <div className="stat-value">{c.value}</div>
                <div className="stat-label">{c.label}</div>
              </div>
            ))}
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Recent Bookings</h3>
              <span className="badge badge-muted">{stats.bookings} total</span>
            </div>
            {recentBookings.length === 0 ? (
              <p className="text-muted">No bookings yet.</p>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Service</th>
                      <th>Client</th>
                      <th>Professional</th>
                      <th>Date</th>
                      <th>Amount</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentBookings.map((b) => (
                      <tr key={b.id as string}>
                        <td style={{ fontWeight: 500 }}>{(b.serviceName as string) || "Consultation"}</td>
                        <td>{(b.clientName as string) || "—"}</td>
                        <td>{(b.proName as string) || "—"}</td>
                        <td>{(b.date as string) || "—"}</td>
                        <td>{(b.amount as number) === 0 ? "Free" : `₹${b.amount}`}</td>
                        <td><span className={`badge ${statusColor[(b.status as string)] || "badge-muted"}`}>{(b.status as string)}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="card" style={{ marginTop: 24 }}>
            <div className="card-header">
              <h3 className="card-title">Financial Overview</h3>
              <span className="badge badge-muted">
                {transactions.length} transaction{transactions.length === 1 ? "" : "s"}
              </span>
            </div>

            <div className="grid grid-3" style={{ marginBottom: 20 }}>
              <div className="stat-card">
                <div className="stat-icon" style={{ background: "var(--accent2-dim)", color: "var(--accent2)" }}>💰</div>
                <div className="stat-value">₹{stats.revenue.toLocaleString()}</div>
                <div className="stat-label">Total Revenue</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon" style={{ background: "var(--accent-dim)", color: "var(--accent)" }}>🏦</div>
                <div className="stat-value">₹{stats.commission.toLocaleString()}</div>
                <div className="stat-label">Platform Commission</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon" style={{ background: "rgba(255,179,71,0.1)", color: "var(--warning)" }}>👤</div>
                <div className="stat-value">₹{stats.proEarnings.toLocaleString()}</div>
                <div className="stat-label">Pro Earnings</div>
              </div>
            </div>

            {transactions.length === 0 ? (
              <p className="text-muted">No transactions yet.</p>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Date</th>
                      <th>Amount</th>
                      <th>Commission</th>
                      <th>Pro Earning</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((t) => (
                      <tr key={t.id as string}>
                        <td className="text-muted text-sm" style={{ fontFamily: "monospace" }}>
                          {((t.id as string) || "").slice(0, 8)}…
                        </td>
                        <td>{formatTimestamp(t.createdAt) || "—"}</td>
                        <td style={{ fontWeight: 600 }}>₹{(t.amount as number) || 0}</td>
                        <td style={{ color: "var(--accent)" }}>₹{(t.commission as number) || 0}</td>
                        <td style={{ color: "var(--accent2)" }}>₹{(t.proEarning as number) || 0}</td>
                        <td>
                          <span className={`badge ${statusColor[(t.status as string)] || "badge-muted"}`}>
                            {(t.status as string) || "—"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
