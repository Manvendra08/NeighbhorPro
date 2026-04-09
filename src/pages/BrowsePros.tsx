import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { listProfessionals, BROWSE_PAGE_SIZE } from "../services/firestoreService";
import { useAuth } from "../contexts/AuthContext";
import { QueryDocumentSnapshot, DocumentData } from "firebase/firestore";
import { useIsMobile } from "../hooks/useIsMobile";
import type { UserSummary } from "../types";
import { sortProfessionalsByLoyalty } from "../services/loyaltyService";
import EmptyState from "../components/common/EmptyState";
import ProCard from "../components/common/ProCard";
import SkeletonLoader from "../components/common/SkeletonLoader";
import FormField from "../components/common/FormField";

type BrowsePro = UserSummary & Record<string, unknown> & {
  category?: string;
};

const CATEGORIES = [
  "All", "Tax & CA", "Investment", "Legal", "Health", "Mental Health",
  "Fitness", "Nutrition", "Tutoring", "IT & Tech",
  "Design", "Photography", "Music", "Career", "Language",
  "Events", "Beauty", "Pet Care", "Other",
];

const CATEGORY_ICONS: Record<string, string> = {
  "All": "🌐", "Tax & CA": "📊", "Investment": "📈", "Legal": "⚖️", "Health": "🏥",
  "Mental Health": "🧠", "Fitness": "💪", "Nutrition": "🥗", "Tutoring": "📚",
  "IT & Tech": "💻", "Design": "🎨", "Photography": "📷", "Music": "🎵",
  "Career": "🚀", "Language": "🌍", "Events": "🎉", "Beauty": "💄",
  "Pet Care": "🐾", "Other": "✨",
};

export default function BrowsePros() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [allPros, setAllPros] = useState<BrowsePro[]>([]);
  const [filtered, setFiltered] = useState<BrowsePro[]>([]);
  const [category, setCategory] = useState("All");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [searchFocused, setSearchFocused] = useState(false);
  const cursorRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get("q") ?? "";
  const [localityFilter, setLocalityFilter] = useState("");
  const [towerFilter, setTowerFilter] = useState("");

  const buildServerFilters = () => {
    const locality = localityFilter.trim();
    const tower = towerFilter.trim();
    return {
      ...(locality ? { locality } : {}),
      ...(tower ? { tower } : {}),
    };
  };

  const loadPage = async (reset = false) => {
    if (reset) { setLoading(true); cursorRef.current = null; }
    else setLoadingMore(true);
    try {
      const { data, nextCursor } = await listProfessionals(reset ? null : cursorRef.current, buildServerFilters());
      cursorRef.current = nextCursor;
      setHasMore(nextCursor !== null);
      // Server-side pro filter applied - only exclude self
      const visiblePros = data.filter(u => u.uid !== user?.uid) as unknown as BrowsePro[];
      setAllPros(prev => reset ? visiblePros : [...prev, ...visiblePros]);
    } catch (err) { console.error("Browse load error:", err); }
    setLoading(false);
    setLoadingMore(false);
  };

  useEffect(() => { loadPage(true); }, []);
  useEffect(() => { loadPage(true); }, [localityFilter, towerFilter]);

  useEffect(() => {
    let result = allPros;
    if (category !== "All") {
      result = result.filter(p =>
        (Array.isArray(p.skills) && p.skills.some(s => typeof s === "string" && s.toLowerCase().includes(category.toLowerCase())))
        || ((p.category || "").toLowerCase().includes(category.toLowerCase()))
      );
    }
    if (localityFilter.trim()) {
      const lf = localityFilter.toLowerCase();
      result = result.filter(p => ((p.locality as string) || "").toLowerCase().includes(lf));
    }
    if (towerFilter.trim()) {
      const tf = towerFilter.toLowerCase();
      result = result.filter(p => ((p.tower as string) || "").toLowerCase().includes(tf));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(p =>
        ((p.displayName as string) || "").toLowerCase().includes(q) ||
        ((p.bio as string) || "").toLowerCase().includes(q) ||
        ((p.society as string) || "").toLowerCase().includes(q) ||
        ((p.locality as string) || "").toLowerCase().includes(q) ||
        (Array.isArray(p.skills) && p.skills.some(s => typeof s === "string" && s.toLowerCase().includes(q)))
      );
    }
    setFiltered(sortProfessionalsByLoyalty(result) as unknown as BrowsePro[]);
  }, [category, search, allPros, localityFilter, towerFilter]);

  const handleSearch = (val: string) => {
    val ? setSearchParams({ q: val }) : setSearchParams({});
  };

  // ── Mobile layout ──────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div className="m-browse">
        {/* Sticky search bar */}
        <div className={`m-search-bar${searchFocused ? " focused" : ""}`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, color: "var(--muted)" }}><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
          <input
            className="m-search-input"
            type="text"
            placeholder="Search name, skill, society…"
            value={search}
            onChange={e => handleSearch(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
          />
          {search && <button className="m-search-clear" onClick={() => handleSearch("")}>✕</button>}
        </div>

        {/* Category scroll */}
        <div className="m-category-scroll">
          {CATEGORIES.map(c => (
            <button key={c} className={`m-category-pill${category === c ? " active" : ""}`} onClick={() => setCategory(c)}>
              <span>{CATEGORY_ICONS[c] || "✨"}</span>
              <span>{c}</span>
            </button>
          ))}
        </div>

        {/* Results count */}
        {!loading && (
          <div className="m-results-meta">
            {filtered.length} {filtered.length === 1 ? "professional" : "professionals"}
            {(search || category !== "All") && <button className="m-clear-filters" onClick={() => { setCategory("All"); handleSearch(""); }}>Clear filters</button>}
          </div>
        )}

        {/* Pro list */}
        <div className="m-pro-list">
          {loading ? <SkeletonLoader mobile count={4} /> : filtered.length === 0 ? (
            <EmptyState
              title="No professionals found"
              description={search || category !== "All" ? "Try different filters" : "Be the first! Update your profile."}
            />
          ) : (
            <>
              {filtered.map((pro) => (
                <ProCard
                  key={pro.uid}
                  pro={pro}
                  mobile
                  onBook={(uid) => navigate(`/book/${uid}`)}
                  onViewProfile={(uid) => navigate(`/pro/${uid}`)}
                />
              ))}
              {!search && category === "All" && (
                <div style={{ textAlign: "center", padding: "20px 0" }}>
                  {loadingMore
                    ? <div className="loader" style={{ margin: "0 auto" }} />
                    : hasMore
                      ? <button className="btn btn-secondary" onClick={() => loadPage(false)}>Load more</button>
                      : allPros.length >= BROWSE_PAGE_SIZE
                        ? <p className="text-muted text-sm">All {allPros.length} professionals loaded</p>
                        : null}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  // ── Desktop layout ─────────────────────────────────────────────────────
  return (
    <div>
      {/* Search Bar at the very top */}
      <div style={{ marginBottom: 24, background: "#fff", padding: "24px", borderRadius: 16, border: "1px solid var(--border)", boxShadow: "0 10px 30px rgba(0,0,0,0.06)", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, left: 0, width: "4px", height: "100%", background: "var(--accent)" }}></div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
          <FormField
            wrapperClassName="browse-search-field"
            icon={<span style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", fontSize: 18 }}>🔍</span>}
            type="text"
            placeholder="Search by name, skill, or service category..."
            value={search}
            onChange={e => handleSearch(e.target.value)}
            style={{ paddingLeft: 48, height: 56, borderRadius: 14, fontSize: 16, background: "var(--surface)", border: "2px solid transparent", transition: "all 0.2s" }}
            onFocus={e => e.currentTarget.style.borderColor = "var(--accent)"}
            onBlur={e => e.currentTarget.style.borderColor = "transparent"}
          />
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <FormField
              icon={<span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 14, opacity: 0.6 }}>📍</span>}
              className="form-input"
              type="text"
              placeholder="Locality..."
              value={localityFilter}
              onChange={e => setLocalityFilter(e.target.value)}
              style={{ width: 160, height: 56, borderRadius: 14, fontSize: 14, paddingLeft: 34 }}
            />
            <FormField
              icon={<span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 14, opacity: 0.6 }}>🏢</span>}
              className="form-input"
              type="text"
              placeholder="Tower"
              value={towerFilter}
              onChange={e => setTowerFilter(e.target.value)}
              style={{ width: 110, height: 56, borderRadius: 14, fontSize: 14, paddingLeft: 34 }}
            />
          </div>
        </div>

        <div className="filter-chips" style={{ display: "flex", gap: 8, overflowX: "auto", marginTop: 20, paddingBottom: 4, scrollbarWidth: "none" }}>
          {CATEGORIES.map(c => (
            <button key={c} className={`chip${category === c ? " active" : ""}`} onClick={() => setCategory(c)}
              style={{ padding: "8px 18px", borderRadius: 12, fontSize: 14, display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}>
              <span>{CATEGORY_ICONS[c] || "✨"}</span> {c}
            </button>
          ))}
        </div>
      </div>

      <div className="page-header" style={{ marginTop: 32 }}>
        <div>
          <h1 className="page-title">Browse Professionals</h1>
          <p className="page-subtitle">Find trusted experts in your neighborhood</p>
        </div>
        <div className="view-toggle-group">
          <button className={`view-toggle-btn ${viewMode === "grid" ? "active" : ""}`} onClick={() => setViewMode("grid")}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>Grid
          </button>
          <button className={`view-toggle-btn ${viewMode === "list" ? "active" : ""}`} onClick={() => setViewMode("list")}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>List
          </button>
        </div>
      </div>

      {loading ? (
        <div className={viewMode === "grid" ? "grid grid-3" : "pro-list-layout"}>
          <SkeletonLoader count={6} grid={viewMode === "grid"} />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No professionals found"
          description={search || category !== "All" ? "Try adjusting your search or filters" : "Be the first! Update your profile to list your skills."}
        />
      ) : (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
             <h2 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: "var(--muted)" }}>
               Showing {filtered.length} experts {category !== "All" ? `in ${category}` : ""}
             </h2>
          </div>
          <div className={viewMode === "grid" ? "grid grid-3" : "pro-list-layout"}>
            {filtered.map((pro) => (
              <ProCard
                key={pro.uid}
                pro={pro}
                grid={viewMode === "grid"}
                onBook={(uid) => navigate(`/book/${uid}`)}
                onViewProfile={(uid) => navigate(`/pro/${uid}`)}
              />
            ))}
          </div>
          {!search && category === "All" && (
            <div style={{ textAlign: "center", marginTop: 32 }}>
              {loadingMore
                ? <div className="loader" style={{ margin: "0 auto" }} />
                : hasMore
                  ? <button className="btn btn-secondary" onClick={() => loadPage(false)}>Load More</button>
                  : allPros.length >= BROWSE_PAGE_SIZE
                    ? <p className="text-muted text-sm">All {allPros.length} professionals loaded</p>
                    : null}
            </div>
          )}
        </>
      )}
    </div>
  );
}

