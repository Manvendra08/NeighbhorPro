import { useEffect, useMemo, useRef, useState } from "react";
import { getAllUserRows, getAllBookings, getTransactions, getAllSocieties, formatTimestamp } from "../../services/firestoreService";

type FinancialTab = "revenue" | "commission" | "proEarnings";

type NormalizedTransaction = {
  id: string;
  createdAt: unknown;
  status: string;
  amount: number;
  commission: number;
  proEarning: number;
  serviceName: string;
  proName: string;
  clientName: string;
  source: "transaction" | "booking";
};

const toNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toTransaction = (tx: Record<string, unknown>): NormalizedTransaction => {
  const amount = toNumber(tx.amount);
  const rawCommission = toNumber(tx.commission ?? tx.platformFee);
  const rawProEarning = toNumber(tx.proEarning);

  const commission = rawCommission > 0
    ? rawCommission
    : rawProEarning > 0
      ? Math.max(0, amount - rawProEarning)
      : 0;

  const proEarning = rawProEarning > 0
    ? rawProEarning
    : Math.max(0, amount - commission);

  return {
    id: String(tx.id ?? ""),
    createdAt: tx.createdAt,
    status: String(tx.status ?? "pending"),
    amount,
    commission,
    proEarning,
    serviceName: String(tx.serviceName ?? "Consultation"),
    proName: String(tx.proName ?? tx.proId ?? "—"),
    clientName: String(tx.clientName ?? tx.userName ?? "—"),
    source: "transaction",
  };
};

const bookingToTransaction = (booking: Record<string, unknown>): NormalizedTransaction => {
  const amount = toNumber(booking.amount ?? booking.escrowCoins);
  const platformFee = toNumber(booking.platformFee);
  const explicitProEarning = toNumber(booking.proEarning);
  const commission = platformFee > 0 ? platformFee : Math.round(amount * 0.1);
  const proEarning = explicitProEarning > 0 ? explicitProEarning : Math.max(0, amount - commission);

  return {
    id: String(booking.id ?? ""),
    createdAt: booking.updatedAt ?? booking.createdAt,
    status: String(booking.status ?? "completed"),
    amount,
    commission,
    proEarning,
    serviceName: String(booking.serviceName ?? "Consultation"),
    proName: String(booking.proName ?? booking.proId ?? "—"),
    clientName: String(booking.clientName ?? booking.clientId ?? "—"),
    source: "booking",
  };
};

export default function AdminDashboard() {
  const [stats, setStats] = useState({ users: 0, bookings: 0, revenue: 0, commission: 0, societies: 0, proEarnings: 0 });
  const [recentBookings, setRecentBookings] = useState<Record<string, unknown>[]>([]);
  const [allBookings, setAllBookings] = useState<Record<string, unknown>[]>([]);
  const [transactions, setTransactions] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [financialTab, setFinancialTab] = useState<FinancialTab>("revenue");
  const financialSectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [users, bookingsRes, txnsRes, societiesRes] = await Promise.all([
          getAllUserRows(),
          getAllBookings(),
          getTransactions(),
          getAllSocieties(),
        ]);

        const bookings = bookingsRes?.data || [];
        const txns = txnsRes?.data || [];
        const societies = societiesRes?.data || [];

        const txnRows = txns.map(toTransaction);
        const txnRevenue = txnRows.reduce((s, t) => s + t.amount, 0);
        const txnCommission = txnRows.reduce((s, t) => s + t.commission, 0);
        const txnProEarnings = txnRows.reduce((s, t) => s + t.proEarning, 0);

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

        setStats({
          users: users.length,
          bookings: bookings.length,
          revenue: txnRevenue > 0 ? txnRevenue : bookingRevenue,
          commission: txnCommission > 0 ? txnCommission : bookingCommission,
          proEarnings: txnProEarnings > 0 ? txnProEarnings : bookingProEarnings,
          societies: societies.length,
        });

        setRecentBookings(bookings.slice(0, 8));
        setAllBookings(bookings);
        setTransactions(txns);
      } catch (e) {
        console.error("Dashboard load error:", e);
      }
      setLoading(false);
    };

    load();
  }, []);

  const txRows = useMemo(() => transactions.map(toTransaction), [transactions]);
  const bookingRows = useMemo(
    () => allBookings
      .filter(b => {
        const status = (b.status as string) || "";
        return status === "completed" || status === "reviewed";
      })
      .map(bookingToTransaction),
    [allBookings]
  );
  const transactionBaseRows = txRows.length > 0 ? txRows : bookingRows;

  const financialRows = useMemo(() => {
    if (financialTab === "commission") return transactionBaseRows.filter(t => t.commission > 0);
    if (financialTab === "proEarnings") return transactionBaseRows.filter(t => t.proEarning > 0);
    return transactionBaseRows.filter(t => t.amount > 0);
  }, [financialTab, transactionBaseRows]);

  const statusColor: Record<string, string> = {
    pending: "badge-warning",
    confirmed: "badge-accent",
    completed: "badge-success",
    cancelled: "badge-error",
  };

  const ICON = {
    users: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    bookings: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/></svg>,
    revenue: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
    commission: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>,
    societies: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  };

  const cards: Array<{
    label: string;
    value: string | number;
    icon: JSX.Element;
    color: string;
    action?: { label: string; to: string };
    financialTab?: FinancialTab;
  }> = [
    { label: "Total Users", value: stats.users, icon: ICON.users, color: "var(--accent)", action: { label: "Manage", to: "/admin/users" } },
    { label: "Total Bookings", value: stats.bookings, icon: ICON.bookings, color: "var(--accent2)", action: { label: "Manage", to: "/admin/bookings" } },
    { label: "Total Revenue", value: `Rs ${stats.revenue.toLocaleString()}`, icon: ICON.revenue, color: "var(--success)", financialTab: "revenue" },
    { label: "Commission", value: `Rs ${stats.commission.toLocaleString()}`, icon: ICON.commission, color: "var(--warning)", financialTab: "commission" },
    { label: "Pro Earnings", value: `Rs ${stats.proEarnings.toLocaleString()}`, icon: ICON.users, color: "var(--accent2)", financialTab: "proEarnings" },
    { label: "Societies", value: stats.societies, icon: ICON.societies, color: "var(--accent)", action: { label: "Manage", to: "/admin/societies" } },
  ];

  const openFinancialTab = (tab: FinancialTab) => {
    setFinancialTab(tab);
    requestAnimationFrame(() => {
      financialSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
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
            {cards.map((c) => {
              const isFinancial = Boolean(c.financialTab);
              const isActiveFinancialCard = isFinancial && c.financialTab === financialTab;
              return (
                <div
                  className="stat-card"
                  key={c.label}
                  onClick={isFinancial ? () => openFinancialTab(c.financialTab as FinancialTab) : undefined}
                  role={isFinancial ? "button" : undefined}
                  tabIndex={isFinancial ? 0 : undefined}
                  onKeyDown={isFinancial ? (event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openFinancialTab(c.financialTab as FinancialTab);
                    }
                  } : undefined}
                  style={{
                    cursor: isFinancial ? "pointer" : "default",
                    border: isActiveFinancialCard ? "1.5px solid var(--accent)" : "1px solid var(--border)",
                  }}
                >
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
              );
            })}
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
                          <td>{(b.amount as number) === 0 ? "Free" : `Rs ${b.amount}`}</td>
                          <td><span className={`badge ${statusColor[(b.status as string)] || "badge-muted"}`}>{(b.status as string)}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="card" style={{ marginTop: 24 }} ref={financialSectionRef}>
            <div className="card-header">
              <h3 className="card-title">Financial Overview</h3>
              <span className="badge badge-muted">
                {financialRows.length} transaction{financialRows.length === 1 ? "" : "s"}
              </span>
            </div>

            <div className="tabs" style={{ marginBottom: 16 }}>
              <button className={`tab${financialTab === "revenue" ? " active" : ""}`} onClick={() => setFinancialTab("revenue")}>Total Revenue</button>
              <button className={`tab${financialTab === "commission" ? " active" : ""}`} onClick={() => setFinancialTab("commission")}>Commission</button>
              <button className={`tab${financialTab === "proEarnings" ? " active" : ""}`} onClick={() => setFinancialTab("proEarnings")}>Pro Earnings</button>
            </div>

            {financialRows.length === 0 ? (
              <p className="text-muted">
                {financialTab === "revenue" ? "No revenue transactions yet." : financialTab === "commission" ? "No commission transactions yet." : "No pro earnings transactions yet."}
              </p>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Date</th>
                      <th>Service</th>
                      <th>Client</th>
                      <th>Pro</th>
                      <th>Status</th>
                      <th>Source</th>
                      <th style={{ textAlign: "right" }}>{financialTab === "revenue" ? "Revenue" : financialTab === "commission" ? "Commission" : "Pro Earnings"}</th>
                      <th style={{ textAlign: "right" }}>{financialTab === "revenue" ? "Commission" : financialTab === "commission" ? "Revenue" : "Commission"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {financialRows.map((t) => {
                      const primaryValue = financialTab === "revenue"
                        ? t.amount
                        : financialTab === "commission"
                          ? t.commission
                          : t.proEarning;
                      const secondaryValue = financialTab === "revenue"
                        ? t.commission
                        : financialTab === "commission"
                          ? t.amount
                          : t.commission;

                      return (
                        <tr key={t.id || `${t.proName}-${t.createdAt}`}>
                          <td className="text-muted text-sm" style={{ fontFamily: "monospace" }}>{(t.id || "").slice(0, 8)}…</td>
                          <td>{formatTimestamp(t.createdAt) || "—"}</td>
                          <td>{t.serviceName}</td>
                          <td>{t.clientName}</td>
                          <td>{t.proName}</td>
                          <td>
                            <span className={`badge ${statusColor[t.status] || "badge-muted"}`}>
                              {t.status || "—"}
                            </span>
                          </td>
                          <td>
                            <span className="badge badge-muted" style={{ fontSize: 10 }}>
                              {t.source === "transaction" ? "Transaction" : "Booking"}
                            </span>
                          </td>
                          <td style={{ textAlign: "right", fontWeight: 700 }}>Rs {primaryValue.toLocaleString("en-IN")}</td>
                          <td style={{ textAlign: "right", color: "var(--muted)" }}>Rs {secondaryValue.toLocaleString("en-IN")}</td>
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

