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
  const [search, setSearch] = useState("");
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
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          ((p.displayName as string) || "").toLowerCase().includes(q) ||
          ((p.bio as string) || "").toLowerCase().includes(q) ||
          (p.skills as string[])?.some((s) => s.toLowerCase().includes(q))
      );
    }
    setFiltered(result);
  }, [category, search, pros]);

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
        <div className="pro-card-img" style={{ position: "relative" }}>
          {(p.photoURL as string) ? (
            <img src={p.photoURL as string} alt={p.displayName as string} />
          ) : (
            <span>{initials((p.displayName as string) || "?")}</span>
          )}
          <div className="provider-badge" style={{ position: "absolute", bottom: 8, right: 8, background: "var(--success)", color: "#fff", width: 22, height: 22, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid var(--surface)", fontSize: 11, fontWeight: "bold", zIndex: 1 }} title="Service Provider">✓</div>
        </div>
        
        <div className="pro-card-body">
          <div className="pro-card-main-info">
            <div className="pro-card-name">{(p.displayName as string) || "Anonymous"}</div>
            <div className="pro-card-society">
              {(p.society as string) || "Community Member"}
            </div>
            <div className="pro-card-skills">
              {((p.skills as string[]) || []).slice(0, 3).map((s: string) => (
                <span className="skill-tag" key={s}>{s}</span>
              ))}
              {((p.skills as string[]) || []).length > 3 && (
                <span className="skill-tag">+{(p.skills as string[]).length - 3}</span>
              )}
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

      {/* Search */}
      <div style={{ marginBottom: 20 }}>
        <input
          className="form-input"
          type="text"
          placeholder="Search by name, skill, or keyword…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: 480 }}
          id="browse-search-input"
        />
      </div>

      {/* Category filter chips */}
      <div className="filter-chips">
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
        <div style={{ textAlign: "center", padding: 60 }}>
          <div className="loader" style={{ margin: "0 auto" }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🔍</div>
          <div className="empty-state-title">No professionals found</div>
          <div className="empty-state-desc">
            {search || category !== "All"
              ? "Try adjusting your search or filters"
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
