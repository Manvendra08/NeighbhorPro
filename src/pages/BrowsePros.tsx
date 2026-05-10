import { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { listProfessionals, BROWSE_PAGE_SIZE, getPlatformSettings, getAllSocieties, getAllServicesUnpaginated } from "../services/firestoreService";
import { useAuth } from "../contexts/AuthContext";
import { QueryDocumentSnapshot, DocumentData } from "firebase/firestore";
import { useIsMobile } from "../hooks/useIsMobile";
import type { UserSummary } from "../types";
import EmptyState from "../components/common/EmptyState";
import ProCard from "../components/common/ProCard";
import SkeletonLoader from "../components/common/SkeletonLoader";
import FormField from "../components/common/FormField";
import { DEFAULT_SERVICE_CATEGORIES, normalizeServiceCategories, CATEGORY_GROUPS } from "../constants/serviceCatalog";
import { getBrowseEmptyDescription, getBrowseFallbackNotice } from "../utils/browse";
import { captureError } from "../lib/sentry";
import ActiveProPill from "../components/ActiveProPill";

type BrowsePro = UserSummary & Record<string, unknown> & {
  category?: string;
};

export default function BrowsePros() {
  const { user, userProfile } = useAuth();
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
  const categoryParam = searchParams.get("category") ?? "All";
  const [localityFilter, setLocalityFilter] = useState("");
  const [towerFilter, setTowerFilter] = useState("");
  const [serviceCategories, setServiceCategories] = useState<string[]>(DEFAULT_SERVICE_CATEGORIES);
  const [svcCategoryGroup, setSvcCategoryGroup] = useState<string>(searchParams.get("serviceGroup") ?? "");
  const [svcCategory, setSvcCategory] = useState<string>(searchParams.get("service") ?? "");
  const categories = ["All", ...serviceCategories];
  const [societies, setSocieties] = useState<{id: string, name: string}[]>([]);
  const [fallbackNotice, setFallbackNotice] = useState("");
  const loadSequenceRef = useRef(0);

  const getMissingBookingProfileItems = () => {
    const missing: string[] = [];
    if (!String(userProfile?.displayName || "").trim()) missing.push("Full name");
    if (!String(userProfile?.society || "").trim()) missing.push("Society");
    if (!String(userProfile?.phoneNumber || "").trim()) missing.push("Phone number");
    if (userProfile?.residentVerificationStatus !== "verified") {
      missing.push("Resident verification approval");
    }
    return missing;
  };

  const handleBookNavigation = (uid: string) => {
    const missing = getMissingBookingProfileItems();
    if (missing.length > 0) {
      alert(`Please update your profile to start booking pros.\n\nMissing: ${missing.join(", ")}`);
      navigate("/account");
      return;
    }
    navigate(`/book/${uid}`);
  };

  const buildServerFilters = () => {
    const society = localityFilter.trim();
    const tower = towerFilter.trim();
    return {
      ...(society ? { society } : {}),
      ...(tower ? { tower } : {}),
    };
  };

  const applyBusinessCategoryJoinFilter = async (pros: BrowsePro[]): Promise<BrowsePro[]> => {
    const normalizedCategory = categoryParam.trim();
    const wantsBusiness =
      normalizedCategory !== "All" &&
      (normalizedCategory === "Business" ||
        businessLeafCategories.some(c => c.trim().toLowerCase() === normalizedCategory.toLowerCase()));
    if (!wantsBusiness) return pros;

    const leafCats =
      normalizedCategory === "Business"
        ? businessLeafCategories
        : [normalizedCategory];

    const services = await getAllServicesUnpaginated();

    // services.userId is the schema used by createService(...), so prefer it for reliable joins.
    const leafCatsLower = leafCats.map(c => String(c).trim().toLowerCase());
    const matchingProUids = new Set(
      services
        .filter((svc) => leafCatsLower.includes(String(svc.category || "").trim().toLowerCase()))
        .map((svc) => {
          const uidRaw = svc.userId ?? svc.user_id ?? "";
          return typeof uidRaw === "string" ? uidRaw.trim() : String(uidRaw || "").trim();
        })
        .filter((uid): uid is string => Boolean(uid))
    );

    return pros.filter((p) => matchingProUids.has(String(p.uid).trim()));
  };

  const applyServiceJoinFilter = async (pros: BrowsePro[]): Promise<BrowsePro[]> => {
    // If no service filters selected, fall back to business-category join logic
    const group = String(svcCategoryGroup || "").trim();
    const service = String(svcCategory || "").trim();
    if (!group && !service) return applyBusinessCategoryJoinFilter(pros);

    try {
      const services = await getAllServicesUnpaginated();

      // Determine allowed categories from group or specific service selection
      let allowedCategories: string[] = [];
      if (service) {
        allowedCategories = [service];
      } else if (group && CATEGORY_GROUPS[group]) {
        allowedCategories = CATEGORY_GROUPS[group] as string[];
      }

      const allowedLower = allowedCategories.map(c => String(c).trim().toLowerCase());
      const serviceLower = service.toLowerCase();
      
      const matchingProUids = new Set(
        services
          .filter(svc => {
            const categoryMatch = allowedLower.includes(String(svc.category || "").trim().toLowerCase());
            const titleMatch = service && String(svc.title || "").trim().toLowerCase().includes(serviceLower);
            return categoryMatch || titleMatch;
          })
          .map((svc) => {
            const uidRaw = svc.userId ?? svc.user_id ?? "";
            return typeof uidRaw === "string" ? uidRaw.trim() : String(uidRaw || "").trim();
          })
          .filter((uid): uid is string => Boolean(uid))
      );

      return pros.filter((p) => matchingProUids.has(String(p.uid).trim()));
    } catch (error: unknown) {
      captureError(error, { operation: "browse.applyServiceJoinFilter" });
      return pros;
    }
  };

  const loadPage = async (reset = false) => {
    const loadSequence = ++loadSequenceRef.current;
    if (reset) { setLoading(true); cursorRef.current = null; }
    else setLoadingMore(true);

    try {
      const filters = buildServerFilters();
      const { data, nextCursor } = await listProfessionals(reset ? null : cursorRef.current, filters);
      if (loadSequence !== loadSequenceRef.current) return;

      cursorRef.current = nextCursor;

      // Server-side pro filter applied - only exclude self
      let visiblePros = data.filter(u => u.uid !== user?.uid) as unknown as BrowsePro[];

      // NEW: if service filters are selected, join against `services.category` to get accurate results.
      visiblePros = await applyServiceJoinFilter(visiblePros);

      if (nextCursor !== null) {
        // If Business-category join filters out everything from the current page,
        // the raw cursor may still be non-null, but UX "Load more" should reflect join results.
        // We keep `hasMore` optimistic for non-reset loads; for reset loads with zero results,
        // we rely on fallback logic below.
        setHasMore(visiblePros.length > 0 ? nextCursor !== null : reset ? false : nextCursor !== null);
      } else {
        setHasMore(false);
      }

      if (reset && visiblePros.length === 0 && (filters.society || filters.tower)) {
        const fallback = await listProfessionals(null, {});
        visiblePros = fallback.data.filter(u => u.uid !== user?.uid) as unknown as BrowsePro[];
        cursorRef.current = fallback.nextCursor;

        const fallbackVisiblePros = await applyBusinessCategoryJoinFilter(visiblePros);
        visiblePros = fallbackVisiblePros;

        setHasMore(fallbackVisiblePros.length > 0 ? fallback.nextCursor !== null : false);

        const selectedSociety = String(filters.society || "").trim();
        if (selectedSociety) {
          setFallbackNotice(getBrowseFallbackNotice(selectedSociety));
        } else {
          setFallbackNotice("");
        }
      } else if (reset) {
        setFallbackNotice("");
      }

      setAllPros(prev => reset ? visiblePros : [...prev, ...visiblePros]);
    } catch (error: unknown) {
      if (loadSequence === loadSequenceRef.current) {
        captureError(error, { operation: "browse.load_page", reset, localityFilter, towerFilter });
      }
    }

    if (loadSequence === loadSequenceRef.current) {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => { loadPage(true); }, []);
  useEffect(() => { loadPage(true); }, [localityFilter, towerFilter, categoryParam, svcCategoryGroup, svcCategory]);
  useEffect(() => () => {
    loadSequenceRef.current += 1;
  }, []);

  const businessLeafCategories = useMemo(() => {
    const business = CATEGORY_GROUPS["Business"];
    return Array.isArray(business) ? business : [];
  }, []);

  useEffect(() => {
    let alive = true;
    getPlatformSettings()
      .then((settings) => {
        if (alive) setServiceCategories(normalizeServiceCategories(settings.serviceCategories));
      })
      .catch((error: unknown) => {
        captureError(error, { operation: "browse.get_platform_settings" });
        if (alive) setServiceCategories(DEFAULT_SERVICE_CATEGORIES);
      });

    getAllSocieties(100)
      .then((res) => {
        const list = res.data
          .map(s => ({
            id: s.id as string,
            name: s.name as string
          }))
          .sort((a, b) => a.name.localeCompare(b.name));
        if (alive) setSocieties(list);
      })
      .catch((error: unknown) => {
        captureError(error, { operation: "browse.get_all_societies" });
      });

    return () => {
      alive = false;
    };
  }, [businessLeafCategories]);

  useEffect(() => {
    setCategory(categoryParam.trim());
  }, [categoryParam]);

  useEffect(() => {
    let result = allPros;

    // NEW: when category is Business group/leaf, we already filtered by services.category in loadPage().
    // So we skip the old skills-based category filtering to avoid re-breaking results.
    if (category !== "All") {
      const normalizedCategory = category.trim();
      const isBusinessCategorySelection =
        normalizedCategory === "Business" ||
        businessLeafCategories.some(c => c.trim().toLowerCase() === normalizedCategory.toLowerCase());

      if (!isBusinessCategorySelection) {
        result = result.filter(p =>
          (Array.isArray(p.skills) && p.skills.some(s => typeof s === "string" && s.toLowerCase().includes(category.toLowerCase())))
          || ((p.category || "").toLowerCase().includes(category.toLowerCase()))
        );
      }
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

    setFiltered(
      [...result].sort((left, right) => {
        const ratingDelta = (Number(right.rating) || 0) - (Number(left.rating) || 0);
        if (ratingDelta !== 0) return ratingDelta;
        const reviewDelta = (Number(right.reviewCount) || 0) - (Number(left.reviewCount) || 0);
        if (reviewDelta !== 0) return reviewDelta;
        return String(left.displayName || "").localeCompare(String(right.displayName || ""));
      })
    );
  }, [category, search, allPros, localityFilter, towerFilter, businessLeafCategories]);

  const syncSearchParams = (
    nextSearch: string,
    nextCategory: string,
    nextSvcGroup?: string,
    nextSvc?: string
  ) => {
    const nextParams = new URLSearchParams(searchParams);
    if (nextSearch) nextParams.set("q", nextSearch);
    else nextParams.delete("q");

    if (nextCategory !== "All") nextParams.set("category", nextCategory);
    else nextParams.delete("category");

    const groupToSet = typeof nextSvcGroup !== "undefined" ? nextSvcGroup : svcCategoryGroup;
    const svcToSet = typeof nextSvc !== "undefined" ? nextSvc : svcCategory;

    if (groupToSet) nextParams.set("serviceGroup", groupToSet);
    else nextParams.delete("serviceGroup");

    if (svcToSet) nextParams.set("service", svcToSet);
    else nextParams.delete("service");

    setSearchParams(nextParams);
  };

  const handleSearch = (val: string) => {
    syncSearchParams(val, category);
  };

  const handleCategoryChange = (nextCategory: string) => {
    setCategory(nextCategory);
    syncSearchParams(search, nextCategory);
  };

  const handleSvcGroupChange = (nextGroup: string) => {
    setSvcCategoryGroup(nextGroup);
    setSvcCategory("");
    syncSearchParams(search, category, nextGroup, "");
    loadPage(true);
  };

  const handleSvcCategoryChange = (nextSvc: string) => {
    setSvcCategory(nextSvc);
    syncSearchParams(search, category, svcCategoryGroup, nextSvc);
    loadPage(true);
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

        {/* Category, Service Group & Name, Locality Selects */}
        <div style={{ padding: "0 16px", marginTop: "12px", display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <select 
            className="form-input" 
            value={category} 
            onChange={(e) => handleCategoryChange(e.target.value)}
            style={{ flex: 1, minWidth: 140, height: 48, borderRadius: 12, appearance: "none", background: "var(--surface)" }}
          >
            {categories.filter(c => c !== "All").map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select
            className="form-input"
            value={svcCategoryGroup}
            onChange={(e) => handleSvcGroupChange(e.target.value)}
            style={{ flex: 1, minWidth: 140, height: 48, borderRadius: 12, appearance: "none", background: "var(--surface)" }}
          >
            <option value="">All Service Groups</option>
            {Object.keys(CATEGORY_GROUPS).map(g => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
          <select
            className="form-input"
            value={svcCategory}
            onChange={(e) => handleSvcCategoryChange(e.target.value)}
            disabled={!svcCategoryGroup}
            style={{ flex: 1, minWidth: 140, height: 48, borderRadius: 12, appearance: "none", background: "var(--surface)" }}
          >
            <option value="">Select Service</option>
            {svcCategoryGroup && (CATEGORY_GROUPS[svcCategoryGroup] || []).map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <select
            className="form-input"
            value={localityFilter}
            onChange={(e) => setLocalityFilter(e.target.value)}
            style={{ flex: 1, minWidth: 140, height: 48, borderRadius: 12, appearance: "none", background: "var(--surface)" }}
          >
            <option value="">All Societies</option>
            {societies.map(s => (
                <option key={s.id} value={s.name}>{s.name}</option>
            ))}
          </select>
        </div>

        {/* Results count */}
        {!loading && (
          <div className="m-results-meta">
            {fallbackNotice && (
              <div style={{ width: "100%", color: "var(--muted)", marginBottom: 6 }}>{fallbackNotice}</div>
            )}
            {filtered.length} {filtered.length === 1 ? "professional" : "professionals"}
            {(search || category !== "All") && <button className="m-clear-filters" onClick={() => { setCategory("All"); syncSearchParams("", "All"); }}>Clear filters</button>}
          </div>
        )}

        {/* Pro list */}
        <div className="m-pro-list">
          {loading ? <SkeletonLoader mobile count={4} /> : filtered.length === 0 ? (
            <EmptyState
              title="No professionals found"
              description={getBrowseEmptyDescription({
                hasSearchOrCategory: Boolean(search || category !== "All"),
                hasLocalityOrTower: Boolean(localityFilter || towerFilter),
                isServiceProvider: Boolean(userProfile?.isServiceProvider),
              })}
            />
          ) : (
            <>
              {filtered.map((pro) => (
                <div key={pro.uid} style={{ position: "relative" }}>
                  <ActiveProPill
                    status={(pro.subscription as { status?: string } | undefined)?.status ?? null}
                    size="sm"
                  />
                  <ProCard
                    pro={pro}
                    mobile
                    onBook={handleBookNavigation}
                    onViewProfile={(uid) => navigate(`/pro/${uid}`)}
                  />
                </div>
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
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 14, opacity: 0.6, zIndex: 1 }}>📂</span>
              <select
                className="form-input"
                value={category}
                onChange={e => handleCategoryChange(e.target.value)}
                style={{ width: 180, height: 56, borderRadius: 14, fontSize: 14, paddingLeft: 34, appearance: "none", background: "var(--surface)" }}
              >
                {categories.filter(c => c !== "All").map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 14, opacity: 0.6, zIndex: 1 }}>🧩</span>
              <select
                className="form-input"
                value={svcCategoryGroup}
                onChange={e => handleSvcGroupChange(e.target.value)}
                style={{ width: 160, height: 56, borderRadius: 14, fontSize: 14, paddingLeft: 34, appearance: "none", background: "var(--surface)" }}
              >
                <option value="">All Service Groups</option>
                {Object.keys(CATEGORY_GROUPS).map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 14, opacity: 0.6, zIndex: 1 }}>🧾</span>
              <select
                className="form-input"
                value={svcCategory}
                onChange={e => handleSvcCategoryChange(e.target.value)}
                disabled={!svcCategoryGroup}
                style={{ width: 180, height: 56, borderRadius: 14, fontSize: 14, paddingLeft: 34, appearance: "none", background: "var(--surface)" }}
              >
                <option value="">Select Service</option>
                {svcCategoryGroup && (CATEGORY_GROUPS[svcCategoryGroup] || []).map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 14, opacity: 0.6, zIndex: 1 }}>📍</span>
              <select
                className="form-input"
                value={localityFilter}
                onChange={e => setLocalityFilter(e.target.value)}
                style={{ width: 160, height: 56, borderRadius: 14, fontSize: 14, paddingLeft: 34, appearance: "none", background: "var(--surface)" }}
              >
                <option value="">All Localities</option>
                {societies.map(s => (
                  <option key={s.id} value={s.name}>{s.name}</option>
                ))}
              </select>
            </div>
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
          description={getBrowseEmptyDescription({
            hasSearchOrCategory: Boolean(search || category !== "All"),
            hasLocalityOrTower: Boolean(localityFilter || towerFilter),
            isServiceProvider: Boolean(userProfile?.isServiceProvider),
          })}
        />
      ) : (
        <>
          {fallbackNotice && (
            <p className="text-muted" style={{ marginTop: 0, marginBottom: 12 }}>{fallbackNotice}</p>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
             <h2 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: "var(--muted)" }}>
               Showing {filtered.length} experts {category !== "All" ? `in ${category}` : ""}
             </h2>
          </div>
          <div className={viewMode === "grid" ? "grid grid-3" : "pro-list-layout"}>
            {filtered.map((pro) => (
              <div key={pro.uid} style={{ position: "relative" }}>
                <ActiveProPill
                  status={(pro.subscription as { status?: string } | undefined)?.status ?? null}
                  size="sm"
                />
                <ProCard
                  pro={pro}
                  grid={viewMode === "grid"}
                  onBook={handleBookNavigation}
                  onViewProfile={(uid) => navigate(`/pro/${uid}`)}
                />
              </div>
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

