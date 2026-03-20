import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  getBookingsForUser,
  getBookingsForPro,
  getTransactionsForPro,
  formatTimestamp,
  formatTimestampTime,
} from "../services/firestoreService";
import { Timestamp } from "firebase/firestore";

export default function Dashboard() {
  const { user, userProfile } = useAuth();
  const [upcomingBookings, setUpcomingBookings] = useState<Record<string, unknown>[]>([]);
  const [proBookings, setProBookings] = useState<Record<string, unknown>[]>([]);
  const [proTransactions, setProTransactions] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const [client, pro] = await Promise.all([
          getBookingsForUser(user.uid),
          getBookingsForPro(user.uid),
        ]);
        setUpcomingBookings(client.filter((b) => b.status === "pending" || b.status === "confirmed"));
        setProBookings(pro.filter((b) => b.status === "pending" || b.status === "confirmed"));
      } catch { /* ignore */ }
      setLoading(false);
    };
    load();
  }, [user]);

  useEffect(() => {
    if (!user || userProfile?.isServiceProvider !== true) return;
    const loadEarnings = async () => {
      try {
        const txns = await getTransactionsForPro(user.uid);
        setProTransactions(txns);
      } catch {
        // ignore
      }
    };
    loadEarnings();
  }, [user, userProfile?.isServiceProvider]);

  const earningsSummary = useMemo(() => {
    if (!proTransactions.length) {
      return { lifetime: 0, thisMonth: 0, lastMonth: 0 };
    }
    const now = new Date();
    const thisMonthKey = `${now.getFullYear()}-${now.getMonth()}`;
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthKey = `${lastMonthDate.getFullYear()}-${lastMonthDate.getMonth()}`;

    let lifetime = 0;
    let thisMonth = 0;
    let lastMonth = 0;

    proTransactions.forEach((t) => {
      const amount = (t.proEarning as number) || 0;
      const ts = t.createdAt;
      lifetime += amount;
      if (ts instanceof Timestamp) {
        const d = ts.toDate();
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        if (key === thisMonthKey) thisMonth += amount;
        if (key === lastMonthKey) lastMonth += amount;
      }
    });

    return { lifetime, thisMonth, lastMonth };
  }, [proTransactions]);

  const ICON = {
    bookings: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/></svg>,
    requests: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
    rating: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
    earnings: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
    skills: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a2 2 0 0 1-2.83-2.83l-3.94 3.6Z"/><path d="m14.7 6.3 3.6-3.94a2 2 0 0 1 2.83 2.83l-3.77 3.77a1 1 0 0 1-1.4 0L14.7 7.7a1 1 0 0 1 0-1.4Z"/><path d="M17.2 11.7a1 1 0 0 0-1.4 0l-1.6 1.6a1 1 0 0 0 0 1.4l3.94 3.6a2 2 0 0 0 2.83-2.83l-3.77-3.77Z"/><path d="m17.2 11.7-3.77 3.77a2 2 0 0 0 2.83 2.83l3.94-3.6a1 1 0 0 0 0-1.4l-1.6-1.6a1 1 0 0 0-1.4 0Z"/><path d="M18 20h2"/><path d="M16 16v2"/><path d="M21 15v2"/><path d="M9 22H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3"/><path d="M13 22h-2"/><path d="M9 4v4"/><path d="M15 4v4"/></svg>
  };
  
  const stats = [
    {
      label: "Upcoming Bookings",
      value: upcomingBookings.length,
      icon: ICON.bookings,
      color: "var(--accent)",
      action: upcomingBookings.length === 0 ? { label: "Book Now", to: "/browse" } : null,
    },
    {
      label: "Client Requests",
      value: proBookings.length,
      icon: ICON.requests,
      color: "var(--accent2)",
      action: proBookings.length === 0 ? { label: "Manage", to: "/bookings" } : null,
    },
    {
      label: "Rating",
      value: userProfile?.rating ? `${userProfile.rating} ★` : 0,
      icon: ICON.rating,
      color: "var(--warning)",
      action: !userProfile?.rating ? { label: "My Profile", to: "/profile" } : null,
    },
  ];

  if (userProfile?.isServiceProvider) {
    stats.push({
      label: "Lifetime Earnings",
      value: `₹${earningsSummary.lifetime.toLocaleString()}`,
      icon: ICON.earnings,
      color: "var(--accent2)",
      action: earningsSummary.lifetime === 0 ? { label: "Get Paid", to: "/profile" } : null,
    });
  } else {
    stats.push({
      label: "Skills Listed",
      value: userProfile?.skills?.length || 0,
      icon: ICON.skills,
      color: "var(--error)",
      action: (userProfile?.skills?.length || 0) === 0 ? { label: "Add Skills", to: "/profile" } : null,
    });
  }

  return (
    <div>
      <div className="page-header" style={{
        backgroundImage: "linear-gradient(to right, rgba(15, 23, 42, 0.85), rgba(15, 23, 42, 0.5)), url('/images/hero_banner.png')",
        backgroundSize: "cover",
        backgroundPosition: "top center",
        padding: "48px 32px",
        borderRadius: "var(--radius-lg)",
      }}>
        <div>
          <h1 className="page-title" style={{ color: "white" }}>
            Welcome back, {userProfile?.displayName || user?.displayName || "there"} 👋
          </h1>
          <p className="page-subtitle" style={{ color: "rgba(255, 255, 255, 0.9)" }}>Here's what's happening in your neighborhood</p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-4" style={{ marginBottom: 32 }}>
        {stats.map((s) => (
          <div className="stat-card" key={s.label}>
            <div className="stat-card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div
                className="stat-icon"
                style={{ background: s.color, color: "white" }}
              >
                {s.icon}
              </div>
              {s.action && (
                <Link to={s.action.to} className="btn btn-ghost btn-xs" style={{ fontSize: 10, padding: "2px 8px" }}>
                  {s.action.label}
                </Link>
              )}
            </div>
            <div>
              <div className="stat-value">{loading ? "…" : s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="grid grid-2" style={{ marginBottom: 32 }}>
        <Link to="/browse" className="card" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 16, cursor: "pointer" }}>
          <div style={{ fontSize: 32 }}>🔍</div>
          <div>
            <h3 style={{ marginBottom: 4 }}>Browse Professionals</h3>
            <p className="text-muted text-sm">Find experts in your community</p>
          </div>
        </Link>
        <Link to="/profile" className="card" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 16, cursor: "pointer" }}>
          <div style={{ fontSize: 32 }}>✨</div>
          <div>
            <h3 style={{ marginBottom: 4 }}>Update Your Profile</h3>
            <p className="text-muted text-sm">Add skills and start offering services</p>
          </div>
        </Link>
      </div>

      {/* Upcoming bookings */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <h3 className="card-title">Upcoming Bookings</h3>
          <Link to="/bookings" className="btn btn-ghost btn-sm">View All</Link>
        </div>
        {loading ? (
          <div style={{ textAlign: "center", padding: 32 }}>
            <div className="loader" style={{ margin: "0 auto" }} />
          </div>
        ) : upcomingBookings.length === 0 ? (
          <div className="empty-state" style={{ padding: "32px 20px" }}>
            <div className="empty-state-icon">📅</div>
            <div className="empty-state-title">No upcoming bookings</div>
            <div className="empty-state-desc">
              Browse professionals and book a consultation to get started
            </div>
            <Link to="/browse" className="btn btn-primary btn-sm" style={{ marginTop: 8 }}>Browse Pros</Link>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {upcomingBookings.slice(0, 5).map((b) => (
              <div
                key={b.id as string}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "12px 14px",
                  background: "var(--surface-2)",
                  borderRadius: "var(--radius-sm)",
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{(b.serviceName as string) || "Consultation"}</div>
                  <div className="text-muted text-sm">
                    {(b.date as string) || formatTimestamp(b.createdAt)} · {(b.timeSlot as string) || "TBD"}
                  </div>
                </div>
                <span className={`badge ${b.status === "confirmed" ? "badge-success" : "badge-warning"}`}>
                  {(b.status as string) || "pending"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Incoming requests (if user is a pro) */}
      {proBookings.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Incoming Client Requests</h3>
            <Link to="/bookings" className="btn btn-ghost btn-sm">Manage</Link>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {proBookings.slice(0, 5).map((b) => (
              <div
                key={b.id as string}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "12px 14px",
                  background: "var(--surface-2)",
                  borderRadius: "var(--radius-sm)",
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{(b.serviceName as string) || "Consultation"}</div>
                  <div className="text-muted text-sm">{(b.clientName as string) || "Client"}</div>
                </div>
                <span className="badge badge-accent">
                  {(b.status as string) || "pending"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Earnings Overview - Only for Pros */}
      {userProfile?.isServiceProvider === true && (
        <div className="card" style={{ marginTop: 24 }}>
          <div className="card-header">
            <h3 className="card-title">Earnings Overview</h3>
            <span className="badge badge-muted">
              {proTransactions.length} payout{proTransactions.length === 1 ? "" : "s"}
            </span>
          </div>
          {proTransactions.length === 0 ? (
            <p className="text-muted">No paid consultations yet. Your earnings will appear here.</p>
          ) : (
            <>
              <div className="grid grid-3" style={{ marginBottom: 16 }}>
                <div className="stat-card">
                  <div className="stat-icon" style={{ background: "var(--accent2-dim)", color: "var(--accent2)" }}>💰</div>
                  <div className="stat-value">₹{earningsSummary.lifetime.toLocaleString()}</div>
                  <div className="stat-label">Lifetime Earnings</div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon" style={{ background: "var(--accent-dim)", color: "var(--accent)" }}>📆</div>
                  <div className="stat-value">₹{earningsSummary.thisMonth.toLocaleString()}</div>
                  <div className="stat-label">This Month</div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon" style={{ background: "rgba(255,179,71,0.1)", color: "var(--warning)" }}>📅</div>
                  <div className="stat-value">₹{earningsSummary.lastMonth.toLocaleString()}</div>
                  <div className="stat-label">Last Month</div>
                </div>
              </div>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Service</th>
                      <th>Client</th>
                      <th>Amount</th>
                      <th>Your Earning</th>
                    </tr>
                  </thead>
                  <tbody>
                    {proTransactions.slice(0, 10).map((t) => (
                      <tr key={t.id as string}>
                        <td>
                          {formatTimestamp(t.createdAt)}{" "}
                          <span className="text-muted text-sm">
                            {formatTimestampTime(t.createdAt)}
                          </span>
                        </td>
                        <td>{(t.serviceName as string) || "Consultation"}</td>
                        <td>{(t.clientName as string) || "—"}</td>
                        <td>₹{((t.amount as number) || 0).toLocaleString()}</td>
                        <td style={{ color: "var(--accent2)", fontWeight: 500 }}>
                          ₹{((t.proEarning as number) || 0).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
