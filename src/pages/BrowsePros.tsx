import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listProfessionals } from "../services/firestoreService";

// ── Categories scoped to white-collar gated-society professionals (Park Street, Wakad, Pune)
const CATEGORIES = [
  "All",
  "Tax & CA",
  "Investment & Wealth",
  "Legal",
  "Health & Wellness",
  "Mental Health",
  "Fitness & Yoga",
  "Nutrition & Diet",
  "Tutoring & Academics",
  "Test Prep",
  "IT & Tech",
  "Design & Creative",
  "Photography",
  "Music & Arts",
  "Career Coaching",
  "Language Learning",
  "Event Planning",
  "Beauty & Grooming",
  "Pet Care",
  "Other",
];

export default function BrowsePros() {
  const [pros, setPros] = useState<Record<string, unknown>[]>([]);
  const [filtered, setFiltered] = useState<Record<string, unknown>[]>([]);
  const [category, setCategory] = useState("All");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      try {
        const data = await listProfessionals();
        // Only show users who are service providers and have at least one skill
        const withSkills = data.filter((u) => u.isServiceProvider && (u.skills as string[])?.length > 0);
        setPros(withSkills);
        setFiltered(withSkills);
      } catch { /* ignore */ }
      setLoading(false);
    };
    load();
  }, []);

  useEffect(() => {
    let result = pros;
    if (category !== "All") {
      result = result.filter((p) =>
        (p.skills as string[])?.some((s) => s.toLowerCase().includes(category.toLowerCase()))
      );
    }
    if (category !== "All") {
      result = result.filter((p) =>
        (p.skills as string[])?.some((s) => s.toLowerCase().includes(category.toLowerCase()))
      );
    }
    setFiltered(result);
  }, [category, pros]);

  const [viewMode, setViewMode] = useState<"grid" | "list">("list");

  const initials = (name: string) =>
    name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  const renderProCard = (p: Record<string, unknown>) => {
    const isGrid = viewMode === "grid";
    
    return (
      <div
        key={p.uid as string}
        className={isGrid ? "pro-card" : "pro-card-list"}
        onClick={() => navigate(`/pro/${p.uid}`)}
      >
        <div className="pro-card-img" style={{ 
          position: "relative", 
          aspectRatio: "4/3", 
          overflow: "hidden",
          background: "var(--surface-3)"
        }}>
          {(p.photoURL as string) ? (
            <img 
              src={p.photoURL as string} 
              alt={p.displayName as string} 
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <div style={{ 
              width: "100%", 
              height: "100%", 
              display: "flex", 
              alignItems: "center", 
              justifyContent: "center",
              fontSize: 24,
              fontWeight: 700,
              color: "var(--accent)"
            }}>
              {initials((p.displayName as string) || "?")}
            </div>
          )}
          <div className="provider-badge" style={{ position: "absolute", bottom: 8, right: 8, background: "var(--success)", color: "#fff", width: 22, height: 22, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #fff", fontSize: 11, fontWeight: "bold", zIndex: 1, boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }} title="Service Provider">✓</div>
        </div>
        
        <div className="pro-card-body">
          <div className="pro-card-main-info">
            <div className="pro-card-name">{(p.displayName as string) || "Anonymous"}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <div className="pro-card-society" style={{ marginBottom: 4 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 4, verticalAlign: "middle" }}><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                {(p.society as string) || "Community Member"}
              </div>
              <div className="pro-card-skills" style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {((p.skills as string[]) || []).slice(0, 3).map((s: string) => (
                  <span className="skill-tag" key={s} style={{ fontSize: 10, padding: "2px 6px" }}>{s}</span>
                ))}
                {((p.skills as string[]) || []).length > 3 && (
                  <span className="skill-tag" style={{ fontSize: 10, padding: "2px 6px" }}>+{(p.skills as string[]).length - 3}</span>
                )}
              </div>
            </div>
          </div>

          <div className="pro-card-footer">
            {(p.priceAfterQuote as boolean) ? (
              <span className="badge badge-accent">Quote-based</span>
            ) : (
              <span className="pro-card-rate">{(p.hourlyRate as number) === 0 ? "Free" : `₹${(p.hourlyRate as number)}/hr`}</span>
            )}
            <div className="pro-card-rating">
              ★ {(p.rating as number) || 0}
              <span className="text-muted text-xs">({(p.reviewCount as number) || 0})</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Browse Professionals</h1>
          <p className="page-subtitle">Find trusted experts in your community</p>
        </div>

        <div className="view-toggle-group">
          <button 
            className={`view-toggle-btn ${viewMode === "grid" ? "active" : ""}`}
            onClick={() => setViewMode("grid")}
            title="Grid View"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
            Grid
          </button>
          <button 
            className={`view-toggle-btn ${viewMode === "list" ? "active" : ""}`}
            onClick={() => setViewMode("list")}
            title="List View"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
            List
          </button>
        </div>
      </div>


      {/* Category filter chips */}
      <div className="filter-chips" style={{ 
        display: "flex", 
        gap: 8, 
        overflowX: "auto", 
        paddingBottom: 12,
        marginBottom: 24,
        scrollbarWidth: "none",
        msOverflowStyle: "none"
      }}>
        {CATEGORIES.map((c) => (
          <button
            key={c}
            className={`chip${category === c ? " active" : ""}`}
            onClick={() => setCategory(c)}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Results */}
      {loading ? (
        <div className={viewMode === "grid" ? "grid grid-3" : "pro-list-layout"}>
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className={viewMode === "grid" ? "pro-card" : "pro-card-list"} style={{ pointerEvents: "none" }}>
              <div className="skeleton" style={{ aspectRatio: "4/3", borderRadius: "12px 12px 0 0" }} />
              <div className="pro-card-body" style={{ padding: 16 }}>
                <div className="skeleton" style={{ height: 18, width: "60%", marginBottom: 8 }} />
                <div className="skeleton" style={{ height: 12, width: "40%", marginBottom: 12 }} />
                <div style={{ display: "flex", gap: 6 }}>
                  <div className="skeleton" style={{ height: 20, width: 60, borderRadius: 10 }} />
                  <div className="skeleton" style={{ height: 20, width: 80, borderRadius: 10 }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🔍</div>
          <div className="empty-state-title">No professionals found</div>
          <div className="empty-state-desc">
            {category !== "All"
              ? "Try adjusting your filters"
              : "Be the first! Update your profile to list your skills."}
          </div>
        </div>
      ) : (
        <div className={viewMode === "grid" ? "grid grid-3" : "pro-list-layout"}>
          {filtered.map((p) => renderProCard(p))}
        </div>
      )}
    </div>
  );
}
