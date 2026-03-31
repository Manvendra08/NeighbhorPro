import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { listProfessionals, BROWSE_PAGE_SIZE } from "../services/firestoreService";
import { useAuth } from "../contexts/AuthContext";
import { QueryDocumentSnapshot, DocumentData } from "firebase/firestore";
import { useIsMobile } from "../hooks/useIsMobile";
import type { LoyaltyTier } from "../types";
import { getLoyaltyTierLabel, getLoyaltyTierWeight, sortProfessionalsByLoyalty } from "../services/loyaltyService";

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
  const [allPros, setAllPros] = useState<Record<string, unknown>[]>([]);
  const [filtered, setFiltered] = useState<Record<string, unknown>[]>([]);
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

  const loadPage = async (reset = false) => {
    if (reset) { setLoading(true); cursorRef.current = null; }
    else setLoadingMore(true);
    try {
      const { data, nextCursor } = await listProfessionals(reset ? null : cursorRef.current);
      cursorRef.current = nextCursor;
      setHasMore(nextCursor !== null);
      const withSkills = data.filter(u =>
        u.isServiceProvider && (u.skills as string[])?.length > 0 && u.uid !== user?.uid
      );
      setAllPros(prev => reset ? withSkills : [...prev, ...withSkills]);
    } catch (err) { console.error("Browse load error:", err); }
    setLoading(false);
    setLoadingMore(false);
  };

  useEffect(() => { loadPage(true); }, []);

  useEffect(() => {
    let result = allPros;
    if (category !== "All") {
      result = result.filter(p =>
        (p.skills as string[])?.some(s => s.toLowerCase().includes(category.toLowerCase()))
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
        (p.skills as string[])?.some(s => s.toLowerCase().includes(q))
      );
    }
    setFiltered(sortProfessionalsByLoyalty(result));
  }, [category, search, allPros, localityFilter, towerFilter]);

  const handleSearch = (val: string) => {
    val ? setSearchParams({ q: val }) : setSearchParams({});
  };

  const initials = (name: string) => name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  // ── Mobile pro card — full-width list with avatar ──────────────────────
  const MobileProCard = ({ p }: { p: Record<string, unknown> }) => {
    const uid = p.uid as string;
    const loyaltyTier = (((p.highestLoyaltyTier as string | undefined) ?? "none") as LoyaltyTier);
    return (
      <div className="m-pro-card" onClick={() => navigate(`/pro/${uid}`)}>
        <div className="m-pro-avatar">
          {(p.photoURL as string)
            ? <img src={p.photoURL as string} alt={p.displayName as string} />
            : <span>{initials((p.displayName as string) || "?")}</span>}
          <span className="m-pro-verified">✓</span>
        </div>
        <div className="m-pro-info">
          <div className="m-pro-name">
            {(p.displayName as string) || "Anonymous"}
            {(p.residentVerificationStatus as string) === "verified" && (
              <span style={{ marginLeft: 6, fontSize: 10, color: "var(--success)", fontWeight: 600 }}>✓ Verified</span>
            )}
          </div>
          <div className="m-pro-society">📍 {(p.locality as string) || (p.society as string) || "Community Member"}{(p.tower as string) ? `, ${p.tower}` : ""}</div>
          <div className="m-pro-skills">
            {((p.skills as string[]) || []).slice(0, 2).map(s => (
              <span key={s} className="skill-tag" style={{ fontSize: 10, padding: "2px 8px" }}>{s}</span>
            ))}
            {((p.skills as string[]) || []).length > 2 && (
              <span className="skill-tag" style={{ fontSize: 10, padding: "2px 8px" }}>+{(p.skills as string[]).length - 2}</span>
            )}
          </div>
          {getLoyaltyTierWeight(loyaltyTier) >= getLoyaltyTierWeight("silver") && (
            <div style={{ marginTop: 6, display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 8px", borderRadius: 999, background: "rgba(13,107,107,0.08)", color: "#0d6b6b", fontSize: 10, fontWeight: 700 }}>
              ✨ {getLoyaltyTierLabel(loyaltyTier)} Featured
            </div>
          )}
        </div>
        <div className="m-pro-right">
          <div className="m-pro-rate">
            {(p.priceAfterQuote as boolean) ? "Quote" : (p.hourlyRate as number) === 0 ? "Free" : `₹${p.hourlyRate}/hr`}
          </div>
          <div className="m-pro-rating">★ {(p.rating as number) || 0}</div>
          <button
            className="btn btn-primary btn-sm"
            style={{ marginTop: 6, padding: "6px 14px", fontSize: 12 }}
            onClick={e => { e.stopPropagation(); navigate(`/book/${uid}`); }}
          >Book</button>
        </div>
      </div>
    );
  };

  // ── Desktop pro card (existing) ────────────────────────────────────────
  const DesktopProCard = ({ p }: { p: Record<string, unknown> }) => {
    const uid = p.uid as string;
    const isGrid = viewMode === "grid";
    const loyaltyTier = (((p.highestLoyaltyTier as string | undefined) ?? "none") as LoyaltyTier);
    return (
      <div className={isGrid ? "pro-card" : "pro-card-list"}>
        <div onClick={() => navigate(`/pro/${uid}`)} style={{ cursor: "pointer" }}>
          <div className="pro-card-img" style={{ position: "relative", aspectRatio: "4/3", overflow: "hidden", background: "var(--surface-3)" }}>
            {(p.photoURL as string)
              ? <img src={p.photoURL as string} alt={p.displayName as string} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 700, color: "var(--accent)" }}>{initials((p.displayName as string) || "?")}</div>}
            <div style={{ position: "absolute", bottom: 8, right: 8, background: "var(--success)", color: "#fff", width: 22, height: 22, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #fff", fontSize: 11, fontWeight: "bold", zIndex: 1 }}>✓</div>
          </div>
          <div className="pro-card-body">
            <div className="pro-card-main-info">
              <div className="pro-card-name">
                {(p.displayName as string) || "Anonymous"}
                {(p.residentVerificationStatus as string) === "verified" && (
                  <span style={{ marginLeft: 8, fontSize: 10, background: "rgba(0,229,176,0.12)", color: "var(--success)", padding: "2px 8px", borderRadius: 10, fontWeight: 600 }}>✓ Verified Resident</span>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <div className="pro-card-society" style={{ marginBottom: 4 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 4, verticalAlign: "middle" }}><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>
                  {(p.locality as string) || (p.society as string) || "Community Member"}{(p.tower as string) ? `, ${p.tower}` : ""}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {((p.skills as string[]) || []).slice(0, 3).map((s: string) => <span className="skill-tag" key={s} style={{ fontSize: 10, padding: "2px 6px" }}>{s}</span>)}
                  {((p.skills as string[]) || []).length > 3 && <span className="skill-tag" style={{ fontSize: 10, padding: "2px 6px" }}>+{(p.skills as string[]).length - 3}</span>}
                </div>
                {getLoyaltyTierWeight(loyaltyTier) >= getLoyaltyTierWeight("silver") && (
                  <div style={{ marginTop: 6 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 999, background: "rgba(13,107,107,0.08)", color: "#0d6b6b", fontSize: 11, fontWeight: 700 }}>
                      ✨ {getLoyaltyTierLabel(loyaltyTier)} Featured Pro
                    </span>
                  </div>
                )}
              </div>
            </div>
            <div className="pro-card-footer">
              {(p.priceAfterQuote as boolean)
                ? <span className="badge badge-accent">Quote-based</span>
                : <span className="pro-card-rate">{(p.hourlyRate as number) === 0 ? "Free" : `₹${p.hourlyRate as number}/hr`}</span>}
              <div className="pro-card-rating">★ {(p.rating as number) || 0}<span className="text-muted text-xs"> ({(p.reviewCount as number) || 0})</span></div>
            </div>
          </div>
        </div>
        <div style={{ padding: "0 14px 14px", display: "flex", gap: 8 }}>
          <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={e => { e.stopPropagation(); navigate(`/book/${uid}`); }}>Book</button>
          <button className="btn btn-secondary btn-sm" onClick={e => { e.stopPropagation(); navigate(`/pro/${uid}`); }}>View Profile</button>
        </div>
      </div>
    );
  };

  const SkeletonCards = () => (
    <>
      {isMobile
        ? [1, 2, 3, 4].map(i => (
          <div key={i} className="m-pro-card" style={{ pointerEvents: "none" }}>
            <div className="skeleton" style={{ width: 56, height: 56, borderRadius: "50%", flexShrink: 0 }} />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
              <div className="skeleton" style={{ height: 16, width: "55%" }} />
              <div className="skeleton" style={{ height: 12, width: "40%" }} />
              <div style={{ display: "flex", gap: 6 }}>
                <div className="skeleton" style={{ height: 18, width: 60, borderRadius: 10 }} />
                <div className="skeleton" style={{ height: 18, width: 70, borderRadius: 10 }} />
              </div>
            </div>
          </div>
        ))
        : [1, 2, 3, 4, 5, 6].map(i => (
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
        ))
      }
    </>
  );

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
          {loading ? <SkeletonCards /> : filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🔍</div>
              <div className="empty-state-title">No professionals found</div>
              <div className="empty-state-desc">{search || category !== "All" ? "Try different filters" : "Be the first! Update your profile."}</div>
            </div>
          ) : (
            <>
              {filtered.map(p => <MobileProCard key={p.uid as string} p={p} />)}
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
          <div style={{ flex: 1, minWidth: 320, position: "relative" }}>
            <span style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", fontSize: 18 }}>🔍</span>
            <input
              className="form-input"
              type="text"
              placeholder="Search by name, skill, or service category..."
              value={search}
              onChange={e => handleSearch(e.target.value)}
              style={{ paddingLeft: 48, height: 56, borderRadius: 14, fontSize: 16, background: "var(--surface)", border: "2px solid transparent", transition: "all 0.2s" }}
              onFocus={e => e.currentTarget.style.borderColor = "var(--accent)"}
              onBlur={e => e.currentTarget.style.borderColor = "transparent"}
            />
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div style={{ position: "relative" }}>
               <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 14, opacity: 0.6 }}>📍</span>
               <input className="form-input" type="text" placeholder="Locality..."
                 value={localityFilter} onChange={e => setLocalityFilter(e.target.value)} style={{ width: 160, height: 56, borderRadius: 14, fontSize: 14, paddingLeft: 34 }} />
            </div>
            <div style={{ position: "relative" }}>
               <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 14, opacity: 0.6 }}>🏢</span>
               <input className="form-input" type="text" placeholder="Tower"
                 value={towerFilter} onChange={e => setTowerFilter(e.target.value)} style={{ width: 110, height: 56, borderRadius: 14, fontSize: 14, paddingLeft: 34 }} />
            </div>
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
        <div className={viewMode === "grid" ? "grid grid-3" : "pro-list-layout"}><SkeletonCards /></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🔍</div>
          <div className="empty-state-title">No professionals found</div>
          <div className="empty-state-desc">{search || category !== "All" ? "Try adjusting your search or filters" : "Be the first! Update your profile to list your skills."}</div>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
             <h2 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: "var(--muted)" }}>
               Showing {filtered.length} experts {category !== "All" ? `in ${category}` : ""}
             </h2>
          </div>
          <div className={viewMode === "grid" ? "grid grid-3" : "pro-list-layout"}>
            {filtered.map(p => <DesktopProCard key={p.uid as string} p={p} />)}
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

