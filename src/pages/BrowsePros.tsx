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
import { CATEGORY_GROUPS } from "../constants/serviceCatalog";
import { getBrowseEmptyDescription, getBrowseFallbackNotice } from "../utils/browse";
import { captureError } from "../lib/sentry";
import ActiveProPill from "../components/ActiveProPill";

type BrowsePro = UserSummary & Record<string, unknown> & {
  category?: string;
};

type ServiceRow = {
  userId: string;
  category: string;
  title: string;
  status: string;
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
  const [svcCategoryGroup, setSvcCategoryGroup] = useState<string>(searchParams.get("serviceCategory") ?? searchParams.get("serviceGroup") ?? "");
  const [svcCategory, setSvcCategory] = useState<string>(searchParams.get("serviceName") ?? searchParams.get("service") ?? "");
  const [societies, setSocieties] = useState<{id: string, name: string, locality: string}[]>([]);
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

  const applyServiceJoinFilter = async (
    pros: BrowsePro[],
    categoryFilter: string,
    serviceNameFilter: string
  ): Promise<{ filteredPros: BrowsePro[]; serviceTagsByUid: Map<string, string[]> }> => {
    const categoryTrimmed = categoryFilter.trim();
    const serviceTrimmed = serviceNameFilter.trim();

    try {
      const services = await getAllServicesUnpaginated();
      const normalizedServices: ServiceRow[] = services.map((svc) => {
        const uidRaw = svc.userId ?? svc.user_id ?? "";
        const userId = typeof uidRaw === "string" ? uidRaw.trim() : String(uidRaw || "").trim();
        return {
          userId,
          category: String(svc.category || "").trim(),
          title: String(svc.title || "").trim(),
          status: String(svc.status || "").trim().toLowerCase(),
        };
      });

      const publicServices = normalizedServices.filter((svc) => {
        if (!svc.userId) return false;
        if (!svc.status) return true;
        return svc.status === "pending" || svc.status === "approved" || svc.status === "featured";
      });

      const tagsByUidSet = new Map<string, Set<string>>();
      for (const svc of publicServices) {
        if (!tagsByUidSet.has(svc.userId)) tagsByUidSet.set(svc.userId, new Set<string>());
        const tag = svc.title || svc.category;
        if (tag) tagsByUidSet.get(svc.userId)?.add(tag);
      }

      const serviceTagsByUid = new Map<string, string[]>();
      for (const [uid, tags] of tagsByUidSet.entries()) {
        serviceTagsByUid.set(uid, Array.from(tags).slice(0, 8));
      }

      const allowedCategories = serviceTrimmed
        ? [serviceTrimmed]
        : categoryTrimmed
          ? (CATEGORY_GROUPS[categoryTrimmed] || [])
          : [];
      const allowedCategorySet = new Set(
        allowedCategories.map((category) => String(category).trim().toLowerCase())
      );
      const matchingProUids = new Set<string>();

      for (const svc of publicServices) {
        const matchesSelectedCategory = !allowedCategorySet.size || allowedCategorySet.has(svc.category.toLowerCase());
        if (matchesSelectedCategory) matchingProUids.add(svc.userId);
      }

      const shouldApplyServiceFilter = Boolean(categoryTrimmed || serviceTrimmed);
      const filteredPros = shouldApplyServiceFilter
        ? pros.filter((p) => matchingProUids.has(String(p.uid).trim()))
        : pros;

      return { filteredPros, serviceTagsByUid };
    } catch (error: unknown) {
      captureError(error, { operation: "browse.applyServiceJoinFilter" });
      const shouldApplyServiceFilter = Boolean(categoryTrimmed || serviceTrimmed);
      return { filteredPros: shouldApplyServiceFilter ? [] : pros, serviceTagsByUid: new Map<string, string[]>() };
    }
  };

  const loadPage = async (reset = false, overrides?: { group?: string; service?: string }) => {
    const loadSequence = ++loadSequenceRef.current;
    if (reset) { setLoading(true); cursorRef.current = null; }
    else setLoadingMore(true);

    // Use overrides when provided (avoids stale closure values on filter change)
    const currentGroup = overrides?.group !== undefined ? overrides.group : svcCategoryGroup;
    const currentService = overrides?.service !== undefined ? overrides.service : svcCategory;
    try {
      const filters = buildServerFilters();
      const { data, nextCursor } = await listProfessionals(reset ? null : cursorRef.current, filters);
      if (loadSequence !== loadSequenceRef.current) return;

      cursorRef.current = nextCursor;

      let visiblePros = data.filter(u => u.uid !== user?.uid) as unknown as BrowsePro[];
      const joinedData = await applyServiceJoinFilter(visiblePros, currentGroup, currentService);
      visiblePros = joinedData.filteredPros.map((pro) => ({
        ...pro,
        skills: joinedData.serviceTagsByUid.get(String(pro.uid).trim()) || [],
      }));

      if (nextCursor !== null) {
        setHasMore(visiblePros.length > 0 ? nextCursor !== null : reset ? false : nextCursor !== null);
      } else {
        setHasMore(false);
      }

      if (reset && visiblePros.length === 0 && (filters.society || filters.tower)) {
        const fallback = await listProfessionals(null, {});
        visiblePros = fallback.data.filter(u => u.uid !== user?.uid) as unknown as BrowsePro[];
        cursorRef.current = fallback.nextCursor;

        const fallbackJoinedData = await applyServiceJoinFilter(visiblePros, currentGroup, currentService);
        visiblePros = fallbackJoinedData.filteredPros.map((pro) => ({
          ...pro,
          skills: fallbackJoinedData.serviceTagsByUid.get(String(pro.uid).trim()) || [],
        }));

        setHasMore(visiblePros.length > 0 ? fallback.nextCursor !== null : false);

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
  useEffect(() => {
    loadPage(true, { group: svcCategoryGroup, service: svcCategory });
  }, [localityFilter, towerFilter, svcCategoryGroup, svcCategory]);
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
      .then(() => {
        // Platform settings loaded (not used for category filtering anymore)
      })
      .catch((error: unknown) => {
        captureError(error, { operation: "browse.get_platform_settings" });
      });

    getAllSocieties(100)
      .then((res) => {
        const list = res.data
          .map(s => ({
            id: s.id as string,
            name: s.name as string,
            locality: String(s.locality || "").trim(),
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

  const societyOptions = useMemo(
    () => societies.map((society) => String(society.name || "").trim()).filter(Boolean),
    [societies]
  );

  const serviceCategoryOptions = useMemo(
    () => Object.keys(CATEGORY_GROUPS),
    []
  );

  const serviceNameOptions = useMemo(
    () => (svcCategoryGroup ? CATEGORY_GROUPS[svcCategoryGroup] || [] : []),
    [svcCategoryGroup]
  );

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

    if (groupToSet) nextParams.set("serviceCategory", groupToSet);
    else nextParams.delete("serviceCategory");
    nextParams.delete("serviceGroup");

    if (svcToSet) nextParams.set("serviceName", svcToSet);
    else nextParams.delete("serviceName");
    nextParams.delete("service");

    setSearchParams(nextParams);
  };

  const handleSearch = (val: string) => {
    syncSearchParams(val, category);
  };

  const handleSvcGroupChange = (nextGroup: string) => {
    setSvcCategoryGroup(nextGroup);
    setSvcCategory("");
    syncSearchParams(search, category, nextGroup, "");
  };

  const handleSvcCategoryChange = (nextSvc: string) => {
    setSvcCategory(nextSvc);
    syncSearchParams(search, category, svcCategoryGroup, nextSvc);
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
            placeholder="Search name, service, society..."
            value={search}
            onChange={e => handleSearch(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
          />
          {search && <button className="m-search-clear" onClick={() => handleSearch("")}>✕</button>}
        </div>

        {/* Service Category & Name, Society Selects */}
        <div style={{ padding: "0 16px", marginTop: "12px", display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <select
            className="form-input"
            value={svcCategoryGroup}
            onChange={(e) => handleSvcGroupChange(e.target.value)}
            style={{ flex: 1, minWidth: 140, height: 48, borderRadius: 12, appearance: "none", background: "var(--surface)" }}
          >
            <option value="">All Service Categories</option>
            {serviceCategoryOptions.map(g => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
          <select
            className="form-input"
            value={svcCategory}
            onChange={(e) => handleSvcCategoryChange(e.target.value)}
            disabled={serviceNameOptions.length === 0}
            style={{ flex: 1, minWidth: 140, height: 48, borderRadius: 12, appearance: "none", background: "var(--surface)" }}
          >
            <option value="">All Services</option>
            {serviceNameOptions.map((serviceName) => (
              <option key={serviceName} value={serviceName}>{serviceName}</option>
            ))}
          </select>
          <select
            className="form-input"
            value={localityFilter}
            onChange={(e) => setLocalityFilter(e.target.value)}
            style={{ flex: 1, minWidth: 140, height: 48, borderRadius: 12, appearance: "none", background: "var(--surface)" }}
          >
            <option value="">All Societies</option>
            {societyOptions.map((society) => (
                <option key={society} value={society}>{society}</option>
            ))}
          </select>
          <input
            className="form-input"
            type="text"
            placeholder="Tower"
            value={towerFilter}
            onChange={(e) => setTowerFilter(e.target.value)}
            style={{ flex: 1, minWidth: 120, height: 48, borderRadius: 12, background: "var(--surface)" }}
          />
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
            placeholder="Search by name, service, category, or society..."
            value={search}
            onChange={e => handleSearch(e.target.value)}
            style={{ paddingLeft: 48, height: 56, borderRadius: 14, fontSize: 16, background: "var(--surface)", border: "2px solid transparent", transition: "all 0.2s" }}
            onFocus={e => e.currentTarget.style.borderColor = "var(--accent)"}
            onBlur={e => e.currentTarget.style.borderColor = "transparent"}
          />
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 14, opacity: 0.6, zIndex: 1 }}>🧩</span>
              <select
                className="form-input"
                value={svcCategoryGroup}
                onChange={e => handleSvcGroupChange(e.target.value)}
                style={{ width: 160, height: 56, borderRadius: 14, fontSize: 14, paddingLeft: 34, appearance: "none", background: "var(--surface)" }}
              >
                <option value="">All Service Categories</option>
                {serviceCategoryOptions.map(g => (
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
                disabled={serviceNameOptions.length === 0}
                style={{ width: 180, height: 56, borderRadius: 14, fontSize: 14, paddingLeft: 34, appearance: "none", background: "var(--surface)" }}
              >
                <option value="">All Services</option>
                {serviceNameOptions.map((serviceName) => (
                  <option key={serviceName} value={serviceName}>{serviceName}</option>
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
                <option value="">All Societies</option>
                {societyOptions.map((society) => (
                  <option key={society} value={society}>{society}</option>
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

