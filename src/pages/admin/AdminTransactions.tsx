import { useEffect, useState } from "react";
import { getTransactions, formatTimestamp } from "../../services/firestoreService";

export default function AdminTransactions() {
  const [transactions, setTransactions] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [totals, setTotals] = useState({ revenue: 0, commission: 0, proEarnings: 0 });

  useEffect(() => {
    const load = async () => {
      try {
        const data = await getTransactions();
        setTransactions(data);
        const revenue = data.reduce((s, t) => s + ((t.amount as number) || 0), 0);
        const commission = data.reduce((s, t) => s + ((t.commission as number) || 0), 0);
        const proEarnings = data.reduce((s, t) => s + ((t.proEarning as number) || 0), 0);
        setTotals({ revenue, commission, proEarnings });
      } catch { /* ignore */ }
      setLoading(false);
    };
    load();
  }, []);

  const statusColor: Record<string, string> = {
    completed: "badge-success",
    pending: "badge-warning",
    refunded: "badge-error",
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Transactions</h1>
          <p className="page-subtitle">Financial overview and transaction history</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-3" style={{ marginBottom: 28 }}>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: "var(--accent2-dim)", color: "var(--accent2)" }}>💰</div>
          <div className="stat-value">₹{totals.revenue.toLocaleString()}</div>
          <div className="stat-label">Total Revenue</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: "var(--accent-dim)", color: "var(--accent)" }}>🏦</div>
          <div className="stat-value">₹{totals.commission.toLocaleString()}</div>
          <div className="stat-label">Platform Commission</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: "rgba(255,179,71,0.1)", color: "var(--warning)" }}>👤</div>
          <div className="stat-value">₹{totals.proEarnings.toLocaleString()}</div>
          <div className="stat-label">Pro Earnings</div>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 60 }}><div className="loader" style={{ margin: "0 auto" }} /></div>
      ) : transactions.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">💳</div>
          <div className="empty-state-title">No transactions yet</div>
          <div className="empty-state-desc">Transactions will appear here when paid consultations are completed</div>
        </div>
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
  );
}
