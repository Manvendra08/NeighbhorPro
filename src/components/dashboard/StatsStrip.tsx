import { Link } from "react-router-dom";

export default function StatsStrip({ coins, upcoming, proRequests, rating, isPro, loading }: {
  coins: number; upcoming: number; proRequests: number; rating: number | null; isPro: boolean; loading: boolean;
}) {
  const items = [
    { label: "NC Balance", value: coins.toLocaleString("en-IN"), icon: "🪙", to: "/wallet", color: "#C4882A", helper: "Wallet balance" },
    { label: "Upcoming", value: loading ? "…" : String(upcoming), icon: "📅", to: "/bookings", color: "#1B6B8A", helper: "Scheduled sessions" },
    ...(isPro ? [{ label: "Requests", value: loading ? "…" : String(proRequests), icon: "🔔", to: "/bookings", color: "#D45C3B", helper: "Pending confirmations" }] : []),
    { label: "Rating", value: rating ? `${rating}★` : "—", icon: "⭐", to: "/profile", color: "#D4A03B", helper: "After completed reviews" },
  ];

  return (
    <div style={{
      display: "flex", gap: 12, flexWrap: "wrap",
    }}>
      {items.map(item => (
        <Link key={item.label} to={item.to} style={{
          flex: "1 1 0", minWidth: 100,
          display: "flex", alignItems: "center", gap: 10,
          background: "#fff", border: "1px solid var(--border)", borderRadius: 12,
          padding: "12px 14px", textDecoration: "none", transition: "border-color 0.15s, box-shadow 0.15s",
        }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = item.color; e.currentTarget.style.boxShadow = `0 2px 12px ${item.color}15`; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.boxShadow = "none"; }}
        >
          <span style={{ fontSize: 20 }}>{item.icon}</span>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text)", lineHeight: 1.1 }}>{item.value}</div>
            <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>{item.label}</div>
            <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>{item.helper}</div>
          </div>
        </Link>
      ))}
    </div>
  );
}
