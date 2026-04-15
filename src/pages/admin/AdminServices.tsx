import { useEffect, useMemo, useState } from "react";
import { Timestamp, serverTimestamp } from "firebase/firestore";
import {
  deleteService,
  formatTimestamp,
  getAllServicesUnpaginated,
  getAllUserRows,
  getPlatformSettings,
  updatePlatformCategories,
  updateService,
} from "../../services/firestoreService";
import { useAuth } from "../../contexts/AuthContext";
import { logAudit } from "./AdminAuditLog";
import { DEFAULT_SERVICE_CATEGORIES, SERVICE_CATEGORY_ICONS, normalizeServiceCategories } from "../../constants/serviceCatalog";
import { AdminServiceUpdateSchema } from "../../lib/validation";
import type { Service } from "../../types";

type ServiceStatus = "pending" | "approved" | "featured" | "rejected";
type StatusFilter = "all" | ServiceStatus;
type SortKey = "newest" | "oldest" | "price_high" | "price_low" | "category";
type TabKey = "moderation" | "categories";
type BulkAction = "approved" | "featured" | "rejected" | "delete";

type ServiceRow = Service & Record<string, unknown>;

type UserRow = {
  uid: string;
  displayName?: string;
  email?: string;
  society?: string;
  tower?: string;
  residentVerificationStatus?: string;
  photoURL?: string;
};

type EditFormState = {
  title: string;
  description: string;
  category: string;
  price: string;
  isFree: boolean;
  duration: string;
  adminNotes: string;
};

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return 0;
}

function asDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Timestamp) return value.toDate();
  if (typeof value === "object" && value !== null) {
    const maybeTs = value as { toDate?: () => Date; seconds?: number };
    if (typeof maybeTs.toDate === "function") return maybeTs.toDate();
    if (typeof maybeTs.seconds === "number") return new Date(maybeTs.seconds * 1000);
  }
  return null;
}

function normalizeStatus(value: unknown): ServiceStatus {
  if (value === "approved" || value === "featured" || value === "rejected") return value;
  return "pending";
}

function toEditForm(service: ServiceRow): EditFormState {
  return {
    title: asString(service.title),
    description: asString(service.description),
    category: asString(service.category),
    price: String(asNumber(service.price)),
    isFree: Boolean(service.isFree),
    duration: asString(service.duration),
    adminNotes: asString(service.adminNotes),
  };
}

export default function AdminServices() {
  const { userProfile } = useAuth();
  const adminId = userProfile?.uid || "unknown";
  const adminName = userProfile?.displayName || "Admin";

  const [activeTab, setActiveTab] = useState<TabKey>("moderation");
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [usersById, setUsersById] = useState<Record<string, UserRow>>({});
  const [categories, setCategories] = useState<string[]>([...DEFAULT_SERVICE_CATEGORIES]);

  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("newest");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pendingBulkAction, setPendingBulkAction] = useState<BulkAction | null>(null);
  const [bulkReason, setBulkReason] = useState("");
  const [bulkConfirm, setBulkConfirm] = useState(false);

  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState<EditFormState | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectConfirm, setRejectConfirm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [savingDetails, setSavingDetails] = useState(false);

  const [newCategory, setNewCategory] = useState("");
  const [removeCategoryTarget, setRemoveCategoryTarget] = useState<string | null>(null);
  const [removeCategoryConfirm, setRemoveCategoryConfirm] = useState(false);
  const [renameFrom, setRenameFrom] = useState("");
  const [renameTo, setRenameTo] = useState("");
  const [renameMigrateServices, setRenameMigrateServices] = useState(true);
  const [resetCategoriesConfirm, setResetCategoriesConfirm] = useState(false);

  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok = true): void => {
    setToast({ msg, ok });
    window.setTimeout(() => setToast(null), 3000);
  };

  const load = async (): Promise<void> => {
    setLoading(true);
    try {
      const [serviceRows, userRows, settings] = await Promise.all([
        getAllServicesUnpaginated(),
        getAllUserRows(500),
        getPlatformSettings(),
      ]);

      setServices(serviceRows as ServiceRow[]);

      const map: Record<string, UserRow> = {};
      userRows.forEach((row) => {
        const uid = asString(row.uid);
        if (!uid) return;
        map[uid] = {
          uid,
          displayName: asString(row.displayName),
          email: asString(row.email),
          society: asString(row.society),
          tower: asString(row.tower),
          residentVerificationStatus: asString(row.residentVerificationStatus),
          photoURL: asString(row.photoURL),
        };
      });
      setUsersById(map);
      setCategories(normalizeServiceCategories(settings.serviceCategories));
    } catch {
      showToast("Failed to load services", false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const stats = useMemo(() => {
    const pending = services.filter((svc) => normalizeStatus(svc.status) === "pending").length;
    const approved = services.filter((svc) => normalizeStatus(svc.status) === "approved").length;
    const featured = services.filter((svc) => normalizeStatus(svc.status) === "featured").length;
    const rejected = services.filter((svc) => normalizeStatus(svc.status) === "rejected").length;
    return { pending, approved, featured, rejected };
  }, [services]);

  const serviceCountsByCategory = useMemo(() => {
    const counts: Record<string, number> = {};
    services.forEach((svc) => {
      const key = asString(svc.category).trim() || "Uncategorized";
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, [services]);

  const selectedService = useMemo(
    () => services.find((svc) => svc.id === selectedServiceId) ?? null,
    [services, selectedServiceId]
  );

  useEffect(() => {
    if (!selectedService) {
      setEditForm(null);
      return;
    }
    setEditForm(toEditForm(selectedService));
    setEditMode(false);
    setRejectReason("");
    setRejectConfirm(false);
    setDeleteConfirm(false);
  }, [selectedService]);

  const visibleServices = useMemo(() => {
    const q = search.trim().toLowerCase();

    const filtered = services.filter((svc) => {
      const status = normalizeStatus(svc.status);
      const category = asString(svc.category);
      const title = asString(svc.title);
      const desc = asString(svc.description);
      const provider = usersById[asString(svc.userId)];

      if (statusFilter !== "all" && status !== statusFilter) return false;
      if (categoryFilter !== "all" && category !== categoryFilter) return false;

      if (fromDate || toDate) {
        const createdAt = asDate(svc.createdAt);
        if (!createdAt) return false;
        if (fromDate) {
          const from = new Date(`${fromDate}T00:00:00`);
          if (createdAt < from) return false;
        }
        if (toDate) {
          const to = new Date(`${toDate}T23:59:59.999`);
          if (createdAt > to) return false;
        }
      }

      if (!q) return true;
      const providerText = provider ? `${provider.displayName || ""} ${provider.email || ""}`.toLowerCase() : "";
      return (
        title.toLowerCase().includes(q) ||
        desc.toLowerCase().includes(q) ||
        category.toLowerCase().includes(q) ||
        providerText.includes(q)
      );
    });

    filtered.sort((a, b) => {
      const aDate = asDate(a.createdAt)?.getTime() ?? 0;
      const bDate = asDate(b.createdAt)?.getTime() ?? 0;
      const aPrice = a.isFree ? 0 : asNumber(a.price);
      const bPrice = b.isFree ? 0 : asNumber(b.price);

      if (sortBy === "oldest") return aDate - bDate;
      if (sortBy === "price_high") return bPrice - aPrice;
      if (sortBy === "price_low") return aPrice - bPrice;
      if (sortBy === "category") return asString(a.category).localeCompare(asString(b.category));
      return bDate - aDate;
    });

    return filtered;
  }, [services, usersById, search, statusFilter, categoryFilter, sortBy, fromDate, toDate]);

  const categoryOptions = useMemo(() => {
    const all = new Set<string>(categories);
    services.forEach((svc) => {
      const c = asString(svc.category).trim();
      if (c) all.add(c);
    });
    return Array.from(all).sort((a, b) => a.localeCompare(b));
  }, [categories, services]);

  const visibleServiceIds = useMemo(() => visibleServices.map((svc) => svc.id), [visibleServices]);

  const statusBadge = (status: ServiceStatus): string => {
    if (status === "approved") return "badge-success";
    if (status === "rejected") return "badge-error";
    if (status === "featured") return "badge-warning";
    return "badge-accent";
  };

  const daysPending = (svc: ServiceRow): string => {
    if (normalizeStatus(svc.status) !== "pending") return "-";
    const created = asDate(svc.createdAt);
    if (!created) return "-";
    const ms = Date.now() - created.getTime();
    return `${Math.max(0, Math.floor(ms / 86400000))}d`;
  };

  const applyStatus = async (
    svc: ServiceRow,
    nextStatus: ServiceStatus,
    reason?: string
  ): Promise<void> => {
    const details = {
      status: nextStatus,
      moderationReason: nextStatus === "rejected" ? (reason || "") : "",
      moderatedBy: adminId,
      moderatedAt: serverTimestamp(),
    };

    await updateService(svc.id, details);
    await logAudit(
      `service.${nextStatus}`,
      adminId,
      adminName,
      `Changed service "${asString(svc.title) || svc.id}" from ${normalizeStatus(svc.status)} to ${nextStatus}${
        nextStatus === "rejected" && reason ? ` | Reason: ${reason}` : ""
      }`,
      svc.id
    );
  };

  const runBulkAction = async (): Promise<void> => {
    if (!pendingBulkAction || selectedIds.length === 0 || !bulkConfirm) return;
    if (pendingBulkAction === "rejected" && !bulkReason.trim()) {
      showToast("Bulk rejection requires a reason", false);
      return;
    }

    setSavingDetails(true);
    try {
      const selected = services.filter((svc) => selectedIds.includes(svc.id));
      if (pendingBulkAction === "delete") {
        await Promise.all(selected.map((svc) => deleteService(svc.id)));
        await logAudit(
          "service.bulk_delete",
          adminId,
          adminName,
          `Deleted ${selected.length} services in bulk`,
          selectedIds.join(",")
        );
      } else {
        const status: ServiceStatus = pendingBulkAction;
        await Promise.all(
          selected.map((svc) => applyStatus(svc, status, pendingBulkAction === "rejected" ? bulkReason.trim() : undefined))
        );
        await logAudit(
          pendingBulkAction === "featured" ? "service.bulk_featured" : `service.bulk_${pendingBulkAction}`,
          adminId,
          adminName,
          `Bulk set ${selected.length} services to ${pendingBulkAction}${
            pendingBulkAction === "rejected" ? ` | Reason: ${bulkReason.trim()}` : ""
          }`,
          selectedIds.join(",")
        );
      }

      showToast("Bulk action applied");
      setSelectedIds([]);
      setPendingBulkAction(null);
      setBulkConfirm(false);
      setBulkReason("");
      await load();
    } catch {
      showToast("Bulk action failed", false);
    } finally {
      setSavingDetails(false);
    }
  };

  const exportCsv = (): void => {
    const rows = [
      "Title,Category,Status,Price,Provider,CreatedAt,ModerationReason",
      ...visibleServices.map((svc) => {
        const provider = usersById[asString(svc.userId)];
        const fields = [
          asString(svc.title),
          asString(svc.category),
          normalizeStatus(svc.status),
          svc.isFree ? "0" : String(asNumber(svc.price)),
          provider?.displayName || provider?.email || asString(svc.userId),
          formatTimestamp(svc.createdAt),
          asString(svc.moderationReason),
        ];
        return fields.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",");
      }),
    ].join("\n");

    const a = document.createElement("a");
    a.href = `data:text/csv;charset=utf-8,${encodeURIComponent(rows)}`;
    a.download = "services-moderation.csv";
    a.click();
  };

  const saveDetailsEdit = async (): Promise<void> => {
    if (!selectedService || !editForm) return;

    const priceNum = editForm.isFree ? 0 : Number(editForm.price);
    const payload = {
      title: editForm.title.trim(),
      description: editForm.description.trim(),
      category: editForm.category.trim(),
      price: Number.isFinite(priceNum) ? priceNum : 0,
      isFree: editForm.isFree,
      duration: editForm.duration.trim(),
      adminNotes: editForm.adminNotes.trim(),
    };

    const parsed = AdminServiceUpdateSchema.safeParse(payload);
    if (!parsed.success) {
      showToast(parsed.error.issues[0]?.message || "Invalid service update", false);
      return;
    }

    setSavingDetails(true);
    try {
      await updateService(selectedService.id, parsed.data as Record<string, unknown>);
      await logAudit(
        "service.edit",
        adminId,
        adminName,
        `Edited service "${asString(selectedService.title) || selectedService.id}"`,
        selectedService.id,
        parsed.data as Record<string, unknown>
      );
      showToast("Service updated");
      setEditMode(false);
      await load();
    } catch {
      showToast("Failed to save service", false);
    } finally {
      setSavingDetails(false);
    }
  };

  const saveAdminNotesOnly = async (): Promise<void> => {
    if (!selectedService || !editForm) return;
    const notes = editForm.adminNotes.trim();
    const parsed = AdminServiceUpdateSchema.safeParse({ adminNotes: notes });
    if (!parsed.success) {
      showToast(parsed.error.issues[0]?.message || "Invalid admin notes", false);
      return;
    }

    setSavingDetails(true);
    try {
      await updateService(selectedService.id, { adminNotes: notes });
      await logAudit(
        "service.edit",
        adminId,
        adminName,
        `Updated admin notes for service "${asString(selectedService.title) || selectedService.id}"`,
        selectedService.id
      );
      showToast("Admin notes saved");
      await load();
    } catch {
      showToast("Failed to save admin notes", false);
    } finally {
      setSavingDetails(false);
    }
  };

  const rejectSelectedService = async (): Promise<void> => {
    if (!selectedService || !rejectConfirm || !rejectReason.trim()) return;
    setSavingDetails(true);
    try {
      await applyStatus(selectedService, "rejected", rejectReason.trim());
      showToast("Service rejected");
      await load();
      setSelectedServiceId(selectedService.id);
      setRejectConfirm(false);
      setRejectReason("");
    } catch {
      showToast("Failed to reject service", false);
    } finally {
      setSavingDetails(false);
    }
  };

  const deleteSelectedService = async (): Promise<void> => {
    if (!selectedService || !deleteConfirm) return;
    setSavingDetails(true);
    try {
      await deleteService(selectedService.id);
      await logAudit(
        "service.delete",
        adminId,
        adminName,
        `Deleted service "${asString(selectedService.title) || selectedService.id}"`,
        selectedService.id
      );
      showToast("Service deleted");
      setSelectedServiceId(null);
      await load();
    } catch {
      showToast("Failed to delete service", false);
    } finally {
      setSavingDetails(false);
    }
  };

  const persistCategories = async (next: string[], action: string, details: string): Promise<void> => {
    const normalized = normalizeServiceCategories(next);
    await updatePlatformCategories(normalized);
    await logAudit(action, adminId, adminName, details, "platformSettings", {
      categories: normalized,
    });
    setCategories(normalized);
  };

  const addCategory = async (): Promise<void> => {
    const next = newCategory.trim();
    if (!next) return;
    if (categories.some((cat) => cat.toLowerCase() === next.toLowerCase())) {
      showToast("Category already exists", false);
      return;
    }
    try {
      await persistCategories([...categories, next], "category.add", `Added category "${next}"`);
      setNewCategory("");
      showToast("Category added");
    } catch {
      showToast("Failed to add category", false);
    }
  };

  const removeCategory = async (): Promise<void> => {
    if (!removeCategoryTarget || !removeCategoryConfirm) return;
    const next = categories.filter((cat) => cat !== removeCategoryTarget);
    try {
      await persistCategories(next, "category.remove", `Removed category "${removeCategoryTarget}"`);
      setRemoveCategoryTarget(null);
      setRemoveCategoryConfirm(false);
      showToast("Category removed");
    } catch {
      showToast("Failed to remove category", false);
    }
  };

  const renameCategory = async (): Promise<void> => {
    const from = renameFrom.trim();
    const to = renameTo.trim();
    if (!from || !to) return;
    if (from === to) {
      showToast("Select a different target name", false);
      return;
    }

    const base = categories.map((cat) => (cat === from ? to : cat));
    const unique = Array.from(new Set(base));

    setSavingDetails(true);
    try {
      let migrated = 0;
      if (renameMigrateServices) {
        const affected = services.filter((svc) => asString(svc.category) === from);
        migrated = affected.length;
        await Promise.all(
          affected.map((svc) => updateService(svc.id, { category: to }))
        );
      }

      await persistCategories(unique, "category.rename", `Renamed category "${from}" to "${to}"${renameMigrateServices ? ` and migrated ${migrated} services` : ""}`);
      setRenameFrom("");
      setRenameTo("");
      setRenameMigrateServices(true);
      showToast("Category renamed");
      await load();
    } catch {
      showToast("Failed to rename category", false);
    } finally {
      setSavingDetails(false);
    }
  };

  const resetCategories = async (): Promise<void> => {
    if (!resetCategoriesConfirm) return;
    try {
      await persistCategories([...DEFAULT_SERVICE_CATEGORIES], "category.reset", "Reset service categories to default catalog");
      setResetCategoriesConfirm(false);
      showToast("Categories reset to defaults");
    } catch {
      showToast("Failed to reset categories", false);
    }
  };

  const openDetails = (serviceId: string): void => {
    setSelectedServiceId(serviceId);
  };

  return (
    <div>
      {toast && (
        <div
          style={{
            position: "fixed",
            top: 20,
            right: 24,
            zIndex: 9999,
            background: toast.ok ? "var(--success)" : "var(--error)",
            color: "#fff",
            padding: "10px 20px",
            borderRadius: "var(--radius-sm)",
            fontWeight: 600,
            fontSize: 13,
            boxShadow: "var(--shadow-lg)",
          }}
        >
          {toast.msg}
        </div>
      )}

      <div className="page-header">
        <div>
          <h1 className="page-title">Service Management</h1>
          <p className="page-subtitle">Moderate listings and manage service categories from one place</p>
        </div>
      </div>

      <div className="tabs" style={{ marginBottom: 20 }}>
        <button className={`tab${activeTab === "moderation" ? " active" : ""}`} onClick={() => setActiveTab("moderation")}>
          Moderation
        </button>
        <button className={`tab${activeTab === "categories" ? " active" : ""}`} onClick={() => setActiveTab("categories")}>
          Categories
        </button>
      </div>

      {activeTab === "moderation" && (
        <>
          <div className="grid grid-4" style={{ marginBottom: 20 }}>
            {[
              { key: "pending", label: "Pending", value: stats.pending, icon: "⏳", color: "var(--accent)" },
              { key: "approved", label: "Approved", value: stats.approved, icon: "✅", color: "var(--success)" },
              { key: "featured", label: "Featured", value: stats.featured, icon: "⭐", color: "var(--warning)" },
              { key: "rejected", label: "Rejected", value: stats.rejected, icon: "❌", color: "var(--error)" },
            ].map((item) => (
              <div
                key={item.key}
                className="stat-card"
                style={{ cursor: "pointer", borderColor: statusFilter === item.key ? "var(--accent)" : undefined }}
                onClick={() => setStatusFilter(item.key as StatusFilter)}
              >
                <div className="stat-icon" style={{ color: item.color }}>{item.icon}</div>
                <div className="stat-value">{item.value}</div>
                <div className="stat-label">{item.label}</div>
              </div>
            ))}
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 10 }}>
              <select className="form-input" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}>
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="featured">Featured</option>
                <option value="rejected">Rejected</option>
              </select>

              <select className="form-input" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                <option value="all">All Categories</option>
                {categoryOptions.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>

              <select className="form-input" value={sortBy} onChange={(event) => setSortBy(event.target.value as SortKey)}>
                <option value="newest">Sort: Newest first</option>
                <option value="oldest">Sort: Oldest first</option>
                <option value="price_high">Sort: Price high to low</option>
                <option value="price_low">Sort: Price low to high</option>
                <option value="category">Sort: Category (A-Z)</option>
              </select>

              <input className="form-input" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} aria-label="From date" />
              <input className="form-input" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} aria-label="To date" />
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
              <input
                className="form-input"
                style={{ maxWidth: 320 }}
                placeholder="Search by service, category, provider"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <button className="btn btn-secondary btn-sm" onClick={exportCsv}>Export CSV</button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  const pendingIds = visibleServices
                    .filter((svc) => normalizeStatus(svc.status) === "pending")
                    .map((svc) => svc.id);
                  setSelectedIds(pendingIds);
                }}
              >
                Select all pending
              </button>
              <span style={{ marginLeft: "auto", color: "var(--muted)", fontSize: 13 }}>
                Showing {visibleServices.length} of {services.length}
              </span>
            </div>
          </div>

          {selectedIds.length > 0 && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                <strong>{selectedIds.length} selected</strong>
                <button className="btn btn-success btn-sm" onClick={() => setPendingBulkAction("approved")}>Approve</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setPendingBulkAction("featured")}>Feature</button>
                <button className="btn btn-danger btn-sm" onClick={() => setPendingBulkAction("rejected")}>Reject</button>
                <button className="btn btn-danger btn-sm" onClick={() => setPendingBulkAction("delete")}>Delete</button>
                <button className="btn btn-secondary btn-sm" onClick={() => setSelectedIds([])}>Clear</button>
              </div>

              {pendingBulkAction && (
                <div style={{ marginTop: 12, borderTop: "1px solid var(--border)", paddingTop: 12, display: "grid", gap: 10 }}>
                  <div style={{ fontSize: 13, color: "var(--muted)" }}>
                    Pending bulk action: <strong>{pendingBulkAction}</strong>
                  </div>
                  {pendingBulkAction === "rejected" && (
                    <textarea
                      className="form-input"
                      rows={3}
                      placeholder="Rejection reason for selected services"
                      value={bulkReason}
                      onChange={(event) => setBulkReason(event.target.value)}
                    />
                  )}
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                    <input type="checkbox" checked={bulkConfirm} onChange={(event) => setBulkConfirm(event.target.checked)} />
                    I confirm this bulk action.
                  </label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn btn-primary btn-sm" disabled={!bulkConfirm || savingDetails} onClick={runBulkAction}>Apply bulk action</button>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setPendingBulkAction(null);
                        setBulkReason("");
                        setBulkConfirm(false);
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: "center", padding: 60 }}><div className="loader" style={{ margin: "0 auto" }} /></div>
          ) : visibleServices.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🛠</div>
              <div className="empty-state-title">No services found</div>
              <div className="empty-state-desc">Try changing filters or search text.</div>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: 36 }}>
                      <input
                        type="checkbox"
                        checked={visibleServiceIds.length > 0 && visibleServiceIds.every((id) => selectedIds.includes(id))}
                        onChange={(event) => {
                          if (event.target.checked) setSelectedIds(Array.from(new Set([...selectedIds, ...visibleServiceIds])));
                          else setSelectedIds(selectedIds.filter((id) => !visibleServiceIds.includes(id)));
                        }}
                      />
                    </th>
                    <th>Service</th>
                    <th>Category</th>
                    <th>Provider</th>
                    <th>Pricing</th>
                    <th>Days Pending</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleServices.map((svc) => {
                    const provider = usersById[asString(svc.userId)];
                    const status = normalizeStatus(svc.status);
                    const isVerified = provider?.residentVerificationStatus === "verified";
                    return (
                      <tr key={svc.id} style={{ cursor: "pointer" }} onClick={() => openDetails(svc.id)}>
                        <td onClick={(event) => event.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(svc.id)}
                            onChange={(event) => {
                              if (event.target.checked) setSelectedIds([...selectedIds, svc.id]);
                              else setSelectedIds(selectedIds.filter((id) => id !== svc.id));
                            }}
                          />
                        </td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{asString(svc.title) || "Untitled"}</div>
                          <div style={{ fontSize: 12, color: "var(--muted)", maxWidth: 280, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {asString(svc.description) || "No description"}
                          </div>
                        </td>
                        <td><span className="badge badge-muted">{asString(svc.category) || "-"}</span></td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{provider?.displayName || provider?.email || asString(svc.userId)}</div>
                          <div style={{ fontSize: 12, color: "var(--muted)" }}>
                            {provider?.society || "-"}{provider?.tower ? ` · ${provider.tower}` : ""}{isVerified ? " · Verified" : ""}
                          </div>
                        </td>
                        <td>{svc.isFree ? "Free" : `INR ${asNumber(svc.price).toLocaleString("en-IN")}`}</td>
                        <td>{daysPending(svc)}</td>
                        <td><span className={`badge ${statusBadge(status)}`}>{status}</span></td>
                        <td onClick={(event) => event.stopPropagation()}>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {status !== "approved" && (
                              <button
                                className="btn btn-success btn-sm"
                                onClick={async () => {
                                  try {
                                    await applyStatus(svc, "approved");
                                    showToast("Service approved");
                                    await load();
                                  } catch {
                                    showToast("Failed to approve service", false);
                                  }
                                }}
                              >
                                Approve
                              </button>
                            )}
                            {status !== "featured" && (
                              <button
                                className="btn btn-ghost btn-sm"
                                onClick={async () => {
                                  try {
                                    await applyStatus(svc, "featured");
                                    showToast("Service featured");
                                    await load();
                                  } catch {
                                    showToast("Failed to feature service", false);
                                  }
                                }}
                              >
                                Feature
                              </button>
                            )}
                            <button className="btn btn-secondary btn-sm" onClick={() => openDetails(svc.id)}>Details</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {activeTab === "categories" && (
        <div className="grid grid-2" style={{ gap: 18 }}>
          <div className="card">
            <h3 className="card-title" style={{ marginBottom: 12 }}>Add Category</h3>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                className="form-input"
                placeholder="New category name"
                value={newCategory}
                onChange={(event) => setNewCategory(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void addCategory();
                  }
                }}
              />
              <button className="btn btn-primary btn-sm" onClick={() => void addCategory()}>Add</button>
            </div>

            <h3 className="card-title" style={{ marginTop: 24, marginBottom: 12 }}>Rename Category</h3>
            <div className="form-group" style={{ marginBottom: 10 }}>
              <label className="form-label">From</label>
              <select className="form-input" value={renameFrom} onChange={(event) => setRenameFrom(event.target.value)}>
                <option value="">Select category</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 10 }}>
              <label className="form-label">To</label>
              <input className="form-input" value={renameTo} onChange={(event) => setRenameTo(event.target.value)} placeholder="New category name" />
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <input type="checkbox" checked={renameMigrateServices} onChange={(event) => setRenameMigrateServices(event.target.checked)} />
              Update existing services using the old category
            </label>
            <button className="btn btn-secondary btn-sm" onClick={() => void renameCategory()} disabled={savingDetails}>Rename category</button>

            <h3 className="card-title" style={{ marginTop: 24, marginBottom: 12 }}>Reset Catalog</h3>
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <input
                type="checkbox"
                checked={resetCategoriesConfirm}
                onChange={(event) => setResetCategoriesConfirm(event.target.checked)}
              />
              I confirm reset to default categories
            </label>
            <button className="btn btn-danger btn-sm" disabled={!resetCategoriesConfirm} onClick={() => void resetCategories()}>
              Reset to defaults
            </button>
          </div>

          <div className="card">
            <h3 className="card-title" style={{ marginBottom: 12 }}>Current Categories ({categories.length})</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
              {categories.map((cat) => {
                const usage = serviceCountsByCategory[cat] || 0;
                return (
                  <div key={cat} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 6, alignItems: "center" }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>
                        {SERVICE_CATEGORY_ICONS[cat] || "✨"} {cat}
                      </div>
                      <button className="btn btn-ghost btn-sm" onClick={() => setRemoveCategoryTarget(cat)}>Remove</button>
                    </div>
                    <div style={{ marginTop: 6, fontSize: 12, color: "var(--muted)" }}>{usage} service{usage !== 1 ? "s" : ""}</div>
                  </div>
                );
              })}
            </div>

            {removeCategoryTarget && (
              <div style={{ marginTop: 14, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                <div style={{ fontSize: 13, marginBottom: 8 }}>
                  Remove <strong>{removeCategoryTarget}</strong>? This category currently has {serviceCountsByCategory[removeCategoryTarget] || 0} service entries.
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <input
                    type="checkbox"
                    checked={removeCategoryConfirm}
                    onChange={(event) => setRemoveCategoryConfirm(event.target.checked)}
                  />
                  I understand this only removes category availability from forms.
                </label>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-danger btn-sm" disabled={!removeCategoryConfirm} onClick={() => void removeCategory()}>Confirm remove</button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setRemoveCategoryTarget(null);
                      setRemoveCategoryConfirm(false);
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {selectedService && editForm && (
        <div className="modal-overlay" onClick={() => setSelectedServiceId(null)}>
          <div className="modal" style={{ maxWidth: 860 }} onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Service Details</h3>
              <button className="modal-close" onClick={() => setSelectedServiceId(null)}>✕</button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 16 }}>
              <div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
                  <span className={`badge ${statusBadge(normalizeStatus(selectedService.status))}`}>
                    {normalizeStatus(selectedService.status)}
                  </span>
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>Created: {formatTimestamp(selectedService.createdAt) || "-"}</span>
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>Updated: {formatTimestamp(selectedService.updatedAt) || "-"}</span>
                </div>

                {!editMode ? (
                  <>
                    <h2 style={{ marginBottom: 6 }}>{asString(selectedService.title) || "Untitled"}</h2>
                    <div className="text-muted" style={{ marginBottom: 12 }}>{asString(selectedService.category)}</div>
                    <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12, marginBottom: 12 }}>
                      {asString(selectedService.description) || "No description"}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                      <div>
                        <div className="text-muted text-xs">Price</div>
                        <div style={{ fontWeight: 700 }}>{selectedService.isFree ? "Free" : `INR ${asNumber(selectedService.price).toLocaleString("en-IN")}`}</div>
                      </div>
                      <div>
                        <div className="text-muted text-xs">Duration</div>
                        <div style={{ fontWeight: 700 }}>{asString(selectedService.duration) || "-"}</div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div style={{ display: "grid", gap: 10 }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Title</label>
                      <input
                        className="form-input"
                        value={editForm.title}
                        onChange={(event) => setEditForm({ ...editForm, title: event.target.value })}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Description</label>
                      <textarea
                        className="form-input"
                        rows={4}
                        value={editForm.description}
                        onChange={(event) => setEditForm({ ...editForm, description: event.target.value })}
                      />
                    </div>
                    <div className="grid grid-2" style={{ gap: 10 }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Category</label>
                        <select
                          className="form-input"
                          value={editForm.category}
                          onChange={(event) => setEditForm({ ...editForm, category: event.target.value })}
                        >
                          {categoryOptions.map((cat) => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Duration</label>
                        <input
                          className="form-input"
                          value={editForm.duration}
                          onChange={(event) => setEditForm({ ...editForm, duration: event.target.value })}
                        />
                      </div>
                    </div>
                    <div className="grid grid-2" style={{ gap: 10 }}>
                      <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <input
                          type="checkbox"
                          checked={editForm.isFree}
                          onChange={(event) => setEditForm({ ...editForm, isFree: event.target.checked })}
                        />
                        Free service
                      </label>
                      {!editForm.isFree && (
                        <input
                          className="form-input"
                          value={editForm.price}
                          onChange={(event) => setEditForm({ ...editForm, price: event.target.value })}
                          placeholder="Price"
                        />
                      )}
                    </div>
                  </div>
                )}

                <div className="form-group" style={{ marginBottom: 10 }}>
                  <label className="form-label">Admin Notes</label>
                  <textarea
                    className="form-input"
                    rows={3}
                    value={editForm.adminNotes}
                    onChange={(event) => setEditForm({ ...editForm, adminNotes: event.target.value })}
                    placeholder="Internal moderation notes"
                  />
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {!editMode ? (
                    <button className="btn btn-secondary btn-sm" onClick={() => setEditMode(true)}>Edit service</button>
                  ) : (
                    <>
                      <button className="btn btn-primary btn-sm" disabled={savingDetails} onClick={() => void saveDetailsEdit()}>Save edits</button>
                      <button className="btn btn-secondary btn-sm" onClick={() => setEditMode(false)}>Cancel edit</button>
                    </>
                  )}
                  <button className="btn btn-ghost btn-sm" disabled={savingDetails} onClick={() => void saveAdminNotesOnly()}>Save notes</button>
                  <button
                    className="btn btn-success btn-sm"
                    disabled={savingDetails || normalizeStatus(selectedService.status) === "approved"}
                    onClick={async () => {
                      try {
                        await applyStatus(selectedService, "approved");
                        showToast("Service approved");
                        await load();
                      } catch {
                        showToast("Failed to approve service", false);
                      }
                    }}
                  >
                    Approve
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    disabled={savingDetails || normalizeStatus(selectedService.status) === "featured"}
                    onClick={async () => {
                      try {
                        await applyStatus(selectedService, "featured");
                        showToast("Service featured");
                        await load();
                      } catch {
                        showToast("Failed to feature service", false);
                      }
                    }}
                  >
                    Feature
                  </button>
                </div>
              </div>

              <div>
                <div className="card" style={{ marginBottom: 10 }}>
                  <h4 className="card-title" style={{ marginBottom: 8 }}>Provider Info</h4>
                  {(() => {
                    const provider = usersById[asString(selectedService.userId)];
                    return (
                      <div style={{ fontSize: 13 }}>
                        <div style={{ fontWeight: 600 }}>{provider?.displayName || provider?.email || asString(selectedService.userId)}</div>
                        <div className="text-muted" style={{ marginTop: 4 }}>{provider?.email || "No email"}</div>
                        <div className="text-muted">{provider?.society || "-"}{provider?.tower ? ` · ${provider.tower}` : ""}</div>
                        <div className="text-muted">Verification: {provider?.residentVerificationStatus || "unknown"}</div>
                        <a href="/admin/users" style={{ color: "var(--accent)", marginTop: 6, display: "inline-block" }}>
                          Open admin users page
                        </a>
                      </div>
                    );
                  })()}
                </div>

                <div className="card" style={{ marginBottom: 10 }}>
                  <h4 className="card-title" style={{ marginBottom: 8 }}>Moderation History</h4>
                  <div style={{ fontSize: 13 }}>
                    <div><strong>Moderated by:</strong> {asString(selectedService.moderatedBy) || "-"}</div>
                    <div><strong>Moderated at:</strong> {formatTimestamp(selectedService.moderatedAt) || "-"}</div>
                    <div style={{ marginTop: 8 }}><strong>Reason:</strong> {asString(selectedService.moderationReason) || "-"}</div>
                  </div>
                </div>

                <div className="card" style={{ marginBottom: 10 }}>
                  <h4 className="card-title" style={{ marginBottom: 8 }}>Reject Service</h4>
                  <textarea
                    className="form-input"
                    rows={3}
                    placeholder="Rejection reason"
                    value={rejectReason}
                    onChange={(event) => setRejectReason(event.target.value)}
                  />
                  <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                    <input type="checkbox" checked={rejectConfirm} onChange={(event) => setRejectConfirm(event.target.checked)} />
                    Confirm rejection
                  </label>
                  <button
                    className="btn btn-danger btn-sm"
                    style={{ marginTop: 8 }}
                    disabled={!rejectConfirm || !rejectReason.trim() || savingDetails}
                    onClick={() => void rejectSelectedService()}
                  >
                    Reject with reason
                  </button>
                </div>

                <div className="card">
                  <h4 className="card-title" style={{ marginBottom: 8, color: "var(--error)" }}>Delete Service</h4>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <input type="checkbox" checked={deleteConfirm} onChange={(event) => setDeleteConfirm(event.target.checked)} />
                    I understand this permanently deletes the service.
                  </label>
                  <button className="btn btn-danger btn-sm" disabled={!deleteConfirm || savingDetails} onClick={() => void deleteSelectedService()}>
                    Delete service
                  </button>
                </div>
              </div>
            </div>

            <div className="modal-actions" style={{ marginTop: 16 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setSelectedServiceId(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
