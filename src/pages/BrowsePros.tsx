import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listProfessionals } from "../services/firestoreService";

const CATEGORIES = [
  "All", "Tutoring", "IT & Tech", "Health", "Legal", "Plumbing",
  "Electrical", "Fitness", "Finance", "Design", "Cooking", "Music", "Other"
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
        // Only show users who have at least one skill
        const withSkills = data.filter((u) => (u.skills as string[])?.length > 0);
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

  const initials = (name: string) =>
    name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Browse Professionals</h1>
          <p className="page-subtitle">Find trusted experts in your community</p>
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
        <div className="grid grid-3">
          {filtered.map((p) => (
            <div
              key={p.uid as string}
              className="pro-card"
              onClick={() => navigate(`/pro/${p.uid}`)}
            >
              <div className="pro-card-img">
                {(p.photoURL as string) ? (
                  <img src={p.photoURL as string} alt={p.displayName as string} />
                ) : (
                  <span>{initials((p.displayName as string) || "?")}</span>
                )}
              </div>
              <div className="pro-card-body">
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
                <div className="pro-card-footer">
                  {(p.isFreeConsultation as boolean) ? (
                    <span className="badge badge-success">Free Consultation</span>
                  ) : (
                    <span className="pro-card-rate">₹{(p.hourlyRate as number) || 0}/hr</span>
                  )}
                  <div className="pro-card-rating">
                    ★ {(p.rating as number) || 0}
                    <span className="text-muted text-xs">({(p.reviewCount as number) || 0})</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
