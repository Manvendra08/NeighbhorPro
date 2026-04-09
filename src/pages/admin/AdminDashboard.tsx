import { useEffect, useState } from "react";
import { getAllUserRows, getAllBookings, getTransactions, getAllSocieties, formatTimestamp } from "../../services/firestoreService";

export default function AdminDashboard() {
  const [stats, setStats] = useState({ users: 0, bookings: 0, revenue: 0, commission: 0, societies: 0, proEarnings: 0 });
  const [recentBookings, setRecentBookings] = useState<Record<string, unknown>[]>([]);
  const [transactions, setTransactions] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [users, bookingsRes, txnsRes, societiesRes] = await Promise.all([
          getAllUserRows(),
          getAllBookings(),
          getTransactions(),
          getAllSocieties(),
        ]);
        // FIX: Add null checks to prevent "Cannot read properties of undefined" crash
        const bookings = bookingsRes?.data || [];
        const txns = txnsRes?.data || [];
        const societies = societiesRes?.data || [];

        const txnRevenue = txns.reduce((s, t) => s + ((t.amount as number) || 0), 0);
        const txnCommission = txns.reduce((s, t) => s + ((t.commission as number) || 0), 0);
        const txnProEarnings = txns.reduce((s, t) => s + ((t.proEarning as number) || 0), 0);

        const settledBookings = bookings.filter(b => {
          const status = (b.status as string) || "";
          return status === "completed" || status === "reviewed";
        });

        const bookingRevenue = settledBookings.reduce((s, b) => {
          const gross = ((b.amount as number) || 0) || ((b.escrowCoins as number) || 0);
          return s + gross;
        }, 0);
        const bookingCommission = settledBookings.reduce((s, b) => {
          const gross = ((b.amount as number) || 0) || ((b.escrowCoins as number) || 0);
          const fee = (b.platformFee as number);
          return s + (typeof fee === "number" ? fee : Math.round(gross * 0.1));
        }, 0);
        const bookingProEarnings = settledBookings.reduce((s, b) => {
          const gross = ((b.amount as number) || 0) || ((b.escrowCoins as number) || 0);
          const fee = (b.platformFee as number);
          const earning = (b.proEarning as number);
          if (typeof earning === "number") return s + earning;
          const derivedFee = typeof fee === "number" ? fee : Math.round(gross * 0.1);
          return s + Math.max(0, gross - derivedFee);
        }, 0);

        const totalRevenue = txnRevenue > 0 ? txnRevenue : bookingRevenue;
        const totalCommission = txnCommission > 0 ? txnCommission : bookingCommission;
        const totalProEarnings = txnProEarnings > 0 ? txnProEarnings : bookingProEarnings;
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

      } catch (e) { console.error("Dashboard load error:", e); }
      setLoading(false);
    };
    load();
  }, []);

  const ICON = {
    users: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    bookings: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/></svg>,
    revenue: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
    commission: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>,
    societies: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  };

  // FIX: Added all stat cards including revenue, commission, pro earnings, societies
  const cards = [
    { label: "Total Users", value: stats.users, icon: ICON.users, color: "var(--accent)", action: { label: "Manage", to: "/admin/users" } },
    { label: "Total Bookings", value: stats.bookings, icon: ICON.bookings, color: "var(--accent2)", action: { label: "Manage", to: "/admin/bookings" } },
    { label: "Total Revenue", value: `₹${stats.revenue.toLocaleString()}`, icon: ICON.revenue, color: "var(--success)" },
    { label: "Commission", value: `₹${stats.commission.toLocaleString()}`, icon: ICON.commission, color: "var(--warning)" },
    { label: "Pro Earnings", value: `₹${stats.proEarnings.toLocaleString()}`, icon: ICON.users, color: "var(--accent2)" },
    { label: "Societies", value: stats.societies, icon: ICON.societies, color: "var(--accent)", action: { label: "Manage", to: "/admin/societies" } },
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
          <div className="grid grid-3" style={{ marginBottom: 32 }}>
            {cards.map((c) => (
              <div className="stat-card" key={c.label}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div className="stat-icon" style={{ background: c.color, color: "white" }}>{c.icon}</div>
                  {c.action && (
                    <a href={c.action.to} className="btn btn-ghost btn-xs" style={{ fontSize: 10, padding: "2px 8px" }}>
                      {c.action.label}
                    </a>
                  )}
                </div>
                <div>
                  <div className="stat-value">{c.value}</div>
                  <div className="stat-label">{c.label}</div>
                </div>
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
                    {recentBookings.map((b) => {
                      if (!b) return null;
                      return (
                      <tr key={b.id as string}>
                        <td style={{ fontWeight: 500 }}>{(b.serviceName as string) || "Consultation"}</td>
                        <td>{(b.clientName as string) || "—"}</td>
                        <td>{(b.proName as string) || "—"}</td>
                        <td>{(b.date as string) || "—"}</td>
                        <td>{(b.amount as number) === 0 ? "Free" : `₹${b.amount}`}</td>
                        <td><span className={`badge ${statusColor[(b.status as string)] || "badge-muted"}`}>{(b.status as string)}</span></td>
                      </tr>
                      );
                    })}
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
                    {transactions.map((t) => {
                      if (!t) return null;
                      return (
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
                      );
                    })}
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
