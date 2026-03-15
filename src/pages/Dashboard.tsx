import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { getBookingsForUser, getBookingsForPro, formatTimestamp } from "../services/firestoreService";

export default function Dashboard() {
  const { user, userProfile } = useAuth();
  const [upcomingBookings, setUpcomingBookings] = useState<Record<string, unknown>[]>([]);
  const [proBookings, setProBookings] = useState<Record<string, unknown>[]>([]);
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

  const stats = [
    {
      label: "Upcoming Bookings",
      value: upcomingBookings.length,
      icon: "📅",
      color: "var(--accent-dim)",
      iconColor: "var(--accent)",
    },
    {
      label: "Client Requests",
      value: proBookings.length,
      icon: "📩",
      color: "var(--accent2-dim)",
      iconColor: "var(--accent2)",
    },
    {
      label: "Rating",
      value: userProfile?.rating ? `${userProfile.rating} ★` : "—",
      icon: "⭐",
      color: "rgba(255,179,71,0.1)",
      iconColor: "var(--warning)",
    },
    {
      label: "Skills Listed",
      value: userProfile?.skills?.length || 0,
      icon: "🛠️",
      color: "rgba(255,92,92,0.08)",
      iconColor: "var(--error)",
    },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Welcome back, {userProfile?.displayName || user?.displayName || "there"} 👋
          </h1>
          <p className="page-subtitle">Here's what's happening in your neighborhood</p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-4" style={{ marginBottom: 32 }}>
        {stats.map((s) => (
          <div className="stat-card" key={s.label}>
            <div
              className="stat-icon"
              style={{ background: s.color, color: s.iconColor }}
            >
              {s.icon}
            </div>
            <div className="stat-value">{loading ? "…" : s.value}</div>
            <div className="stat-label">{s.label}</div>
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
    </div>
  );
}
