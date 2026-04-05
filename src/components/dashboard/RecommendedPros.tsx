import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getRecommendedPros } from "../../services/firestoreService";

export default function RecommendedPros({ uid }: { uid: string }) {
  const navigate = useNavigate();
  const [pros, setPros] = useState<Record<string, unknown>[]>([]);

  useEffect(() => { getRecommendedPros(uid, 4).then(setPros).catch(() => {}); }, [uid]);

  if (!pros.length) return null;

  return (
    <div style={{
      background: "#fff", borderRadius: 14, border: "1px solid var(--border)", overflow: "hidden",
    }}>
      <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>⭐ Top Pros</span>
        <Link to="/browse" style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, textDecoration: "none" }}>View all</Link>
      </div>
      <div style={{ padding: 10 }}>
        {pros.map(p => {
          const initials = ((p.displayName as string) || "?").split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
          return (
            <div key={p.uid as string} onClick={() => navigate(`/pro/${p.uid}`)}
              style={{
                display: "flex", alignItems: "center", gap: 10, padding: "10px 8px",
                borderRadius: 10, cursor: "pointer", transition: "background 0.15s",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--surface-2)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              <div style={{
                width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                background: "linear-gradient(135deg, var(--accent-dim), var(--surface-2))",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "var(--accent)", fontWeight: 700, fontSize: 12,
                overflow: "hidden",
              }}>
                {(p.photoURL as string) ? <img src={p.photoURL as string} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initials}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{(p.displayName as string) || "Pro"}</div>
                <div style={{ fontSize: 11, color: "var(--muted)", display: "flex", alignItems: "center", gap: 6 }}>
                  <span>★ {(p.rating as number) ? (p.rating as number).toFixed(1) : "New"}</span>
                  {(p.tower as string) && (
                    <span style={{ fontSize: 10, background: "var(--surface-2)", padding: "1px 6px", borderRadius: 4, fontWeight: 600 }}>🏙️ {p.tower as string}</span>
                  )}
                </div>
              </div>
              <button className="btn btn-primary btn-xs" style={{ fontSize: 11, padding: "3px 12px", borderRadius: 8, flexShrink: 0 }}
                onClick={e => { e.stopPropagation(); navigate(`/book/${p.uid}`); }}>Book</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
