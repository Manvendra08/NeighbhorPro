import { Link } from "react-router-dom";
import { useState } from "react";

export default function StatsStrip({ coins, upcoming, proRequests, rating, reviewDistribution, isPro, loading }: {
  coins: number;
  upcoming: number;
  proRequests: number;
  rating: number | null;
  reviewDistribution: Record<number, number>;
  isPro: boolean;
  loading: boolean;
}) {
  const [showRatingDetails, setShowRatingDetails] = useState(false);

  const items = [
    { label: "NC Balance", value: coins.toLocaleString("en-IN"), icon: "🪙", to: "/wallet", color: "#C4882A", helper: "Wallet balance" },
    { label: "Upcoming", value: loading ? "…" : String(upcoming), icon: "📅", to: "/bookings", color: "#1B6B8A", helper: "Scheduled sessions" },
    ...(isPro ? [{ label: "Requests", value: loading ? "…" : String(proRequests), icon: "🔔", to: "/bookings", color: "#D45C3B", helper: "Pending confirmations" }] : []),
    { label: "Rating", value: rating ? `${rating.toFixed(1)}★` : "—", icon: "⭐", to: "/profile", color: "#D4A03B", helper: "Tap for star breakdown" },
  ];

  const totalReviews = Object.values(reviewDistribution || {}).reduce((sum, count) => sum + (Number(count) || 0), 0);

  return (
    <div style={{
      display: "flex", gap: 12, flexWrap: "wrap",
    }}>
      {items.map(item => (
        item.label === "Rating" ? (
          <div key={item.label} style={{ position: "relative", flex: "1 1 0", minWidth: 100 }}>
            <button
              type="button"
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 10,
                background: "#fff",
                border: "1px solid var(--border)",
                borderRadius: 12,
                padding: "12px 14px",
                textAlign: "left",
                cursor: "pointer",
                transition: "border-color 0.15s, box-shadow 0.15s",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = item.color; e.currentTarget.style.boxShadow = `0 2px 12px ${item.color}15`; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.boxShadow = "none"; }}
              onClick={() => setShowRatingDetails(prev => !prev)}
            >
              <span style={{ fontSize: 20 }}>{item.icon}</span>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text)", lineHeight: 1.1 }}>{item.value}</div>
                <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>{item.label}</div>
                <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>{item.helper}</div>
              </div>
            </button>

            {showRatingDetails && (
              <div style={{
                position: "absolute",
                top: "calc(100% + 8px)",
                right: 0,
                zIndex: 20,
                width: 220,
                background: "#fff",
                border: "1px solid var(--border)",
                borderRadius: 10,
                padding: "10px 12px",
                boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Review Breakdown</div>
                {[5, 4, 3, 2, 1].map(star => (
                  <div key={star} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "2px 0" }}>
                    <span>{star}★</span>
                    <span>{reviewDistribution?.[star] || 0}</span>
                  </div>
                ))}
                <div style={{ borderTop: "1px solid var(--border)", marginTop: 8, paddingTop: 8, fontSize: 11, color: "var(--muted)" }}>
                  Total reviews: {totalReviews}
                </div>
              </div>
            )}
          </div>
        ) : (
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
        )
      ))}
    </div>
  );
}
