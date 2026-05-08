import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  doc,
  updateDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../contexts/AuthContext";
import { logAudit } from "./AdminAuditLog";
import { captureError } from "../../lib/sentry";

type SubRow = Record<string, unknown>;
type FilterTab = "all" | "active" | "trial" | "expired" | "comped";
type CompDuration = "3m" | "6m" | "12m";

const ACTIVE_STATES = new Set([
  "trial",
  "trial_ending",
  "active",
  "renewing",
  "past_due",
  "grace",
  "comped",
]);

const COMP_DURATION_DAYS: Record<CompDuration, number> = {
  "3m": 90,
  "6m": 180,
  "12m": 365,
};

const COMP_PLAN_ID: Record<CompDuration, string> = {
  "3m": "business_3m_v1",
  "6m": "business_6m_v1",
  "12m": "business_12m_v1",
};

function statusChipStyle(status: string): { background: string; color: string } {
  if (status === "active" || status === "trial" || status === "trial_ending") {
    return { background: "#dcfce7", color: "#16a34a" };
  }
  if (status === "renewing") {
    return { background: "#dbeafe", color: "#1d4ed8" };
  }
  if (status === "past_due" || status === "grace") {
    return { background: "#fef3c7", color: "#b45309" };
  }
  if (status === "expired") {
    return { background: "#fee2e2", color: "#dc2626" };
  }
  if (status === "comped") {
    return { background: "#f3e8ff", color: "#7c3aed" };
  }
  if (status === "cancelled") {
    return { background: "#f3f4f6", color: "#6b7280" };
  }
  return { background: "var(--surface-2)", color: "var(--muted)" };
}

function daysLeft(sub: SubRow): number {
  const end = sub.currentPeriodEnd as { seconds?: number } | undefined;
  if (!end?.seconds) return 0;
  return Math.max(0, Math.ceil((end.seconds * 1000 - Date.now()) / 86_400_000));
}

function formatEndDate(sub: SubRow): string {
  const end = sub.currentPeriodEnd as { seconds?: number } | undefined;
  if (!end?.seconds) return "—";
  return new Date(end.seconds * 1000).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function AdminSubscriptions() {
  const { userProfile, user } = useAuth();
  const navigate = useNavigate();
  const adminId = userProfile?.uid || user?.uid || "unknown";
  const adminName = (userProfile?.displayName as string) || "Admin";

  const [subs, setSubs] = useState<SubRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  // Grant comp modal state
  const [compTarget, setCompTarget] = useState<SubRow | null>(null);
  const [compDuration, setCompDuration] = useState<CompDuration>("3m");
  const [compReason, setCompReason] = useState("");
  const [compLoading, setCompLoading] = useState(false);

  // Force cancel state
  const [cancelTarget, setCancelTarget] = useState<SubRow | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const load = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, "subscriptions"),
        orderBy("createdAt", "desc"),
        limit(200)
      );
      const snap = await getDocs(q);
      setSubs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (error: unknown) {
      captureError(error, { operation: "admin.subscriptions.load" });
      showToast("Failed to load subscriptions", "error");
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const thirtyDaysAgo = Date.now() - 30 * 86_400_000;

  const kpi = {
    active: subs.filter(
      (s) =>
        ["trial", "trial_ending", "active", "renewing"].includes(s.status as string)
    ).length,
    pastDueGrace: subs.filter((s) =>
      ["past_due", "grace"].includes(s.status as string)
    ).length,
    expiredRecent: subs.filter((s) => {
      if (s.status !== "expired" && s.status !== "cancelled") return false;
      const end = (s.currentPeriodEnd as { seconds?: number } | undefined)?.seconds;
      return end ? end * 1000 >= thirtyDaysAgo : false;
    }).length,
    comped: subs.filter((s) => s.status === "comped").length,
  };

  // ── Filtered rows ──────────────────────────────────────────────────────────
  const filtered = subs.filter((s) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      ((s.uid as string) || "").toLowerCase().includes(q) ||
      ((s.plan as string) || "").toLowerCase().includes(q) ||
      ((s.source as string) || "").toLowerCase().includes(q);
    const matchTab =
      tab === "all"
        ? true
        : tab === "active"
        ? ACTIVE_STATES.has(s.status as string) && s.status !== "comped"
        : tab === "trial"
        ? s.status === "trial" || s.status === "trial_ending"
        : tab === "expired"
        ? s.status === "expired" || s.status === "cancelled"
        : tab === "comped"
        ? s.status === "comped"
        : true;
    return matchSearch && matchTab;
  });

  // ── Grant comp ─────────────────────────────────────────────────────────────
  const handleGrantComp = async () => {
    if (!compTarget || !compReason.trim()) return;
    const uid = compTarget.uid as string;
    setCompLoading(true);
    try {
      const now = new Date();
      const days = COMP_DURATION_DAYS[compDuration];
      const periodEnd = new Date(now.getTime() + days * 86_400_000);
      const plan = COMP_PLAN_ID[compDuration];
      const subId = `sub_${uid}_comp_${Date.now()}`;

      await setDoc(doc(db, "subscriptions", subId), {
        uid,
        plan,
        status: "comped",
        source: "comp",
        amount: 0,
        currency: "free",
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
        grantedBy: adminId,
        grantedReason: compReason.trim(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await setDoc(
        doc(db, "users", uid),
        {
          subscription: {
            status: "comped",
            currentPeriodEnd: periodEnd,
            plan,
            cancelAtPeriodEnd: false,
          },
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      await logAudit(
        "subscription_comp_granted",
        adminId,
        adminName,
        `Granted ${compDuration} comp to uid ${uid.slice(0, 8)}… | Reason: ${compReason.trim()}`,
        uid
      );

      showToast("Comp subscription granted");
      setCompTarget(null);
      setCompReason("");
      await load();
    } catch (error: unknown) {
      captureError(error, { operation: "admin.subscriptions.grant_comp", uid });
      showToast("Failed to grant comp", "error");
    }
    setCompLoading(false);
  };

  // ── Force cancel ───────────────────────────────────────────────────────────
  const handleForceCancel = async () => {
    if (!cancelTarget) return;
    const uid = cancelTarget.uid as string;
    const subId = cancelTarget.id as string;
    setCancelLoading(true);
    try {
      await updateDoc(doc(db, "subscriptions", subId), {
        status: "cancelled",
        updatedAt: serverTimestamp(),
      });

      await setDoc(
        doc(db, "users", uid),
        {
          subscription: { status: "expired" },
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      await logAudit(
        "subscription_force_cancelled",
        adminId,
        adminName,
        `Admin force-cancelled subscription ${subId} for uid ${uid.slice(0, 8)}…`,
        uid
      );

      showToast("Subscription cancelled");
      setCancelTarget(null);
      await load();
    } catch (error: unknown) {
      captureError(error, { operation: "admin.subscriptions.force_cancel", uid });
      showToast("Failed to cancel subscription", "error");
    }
    setCancelLoading(false);
  };

  const tabs: { key: FilterTab; label: string }[] = [
    { key: "all", label: "All" },
    { key: "active", label: "Active" },
    { key: "trial", label: "Trial" },
    { key: "expired", label: "Expired" },
    { key: "comped", label: "Comped" },
  ];

  return (
    <div>
      {toast && (
        <div
          style={{
            position: "fixed",
            top: 20,
            right: 24,
            zIndex: 9999,
            background: toast.type === "success" ? "var(--success)" : "var(--error)",
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

      {/* Grant Comp Modal */}
      {compTarget && (
        <div className="modal-overlay" onClick={() => !compLoading && setCompTarget(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h3 className="modal-title">Grant Comp Subscription</h3>
              <button className="modal-close" onClick={() => !compLoading && setCompTarget(null)} aria-label="Close">
                ✕
              </button>
            </div>
            <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16 }}>
              Grant a complimentary subscription to{" "}
              <strong>{((compTarget.uid as string) || "").slice(0, 12)}…</strong>
            </p>
            <div className="form-group">
              <label className="form-label">Duration</label>
              <select
                className="form-input"
                value={compDuration}
                onChange={(e) => setCompDuration(e.target.value as CompDuration)}
              >
                <option value="3m">3 Months</option>
                <option value="6m">6 Months</option>
                <option value="12m">12 Months</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Reason *</label>
              <input
                className="form-input"
                placeholder="e.g. Early adopter reward"
                value={compReason}
                onChange={(e) => setCompReason(e.target.value)}
              />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary btn-sm" onClick={() => setCompTarget(null)} disabled={compLoading}>
                Cancel
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleGrantComp}
                disabled={compLoading || !compReason.trim()}
              >
                {compLoading ? "Granting…" : "Grant Comp"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Force Cancel Modal */}
      {cancelTarget && (
        <div className="modal-overlay" onClick={() => !cancelLoading && setCancelTarget(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h3 className="modal-title">Force Cancel Subscription</h3>
              <button className="modal-close" onClick={() => !cancelLoading && setCancelTarget(null)} aria-label="Close">
                ✕
              </button>
            </div>
            <p style={{ fontSize: 14, marginBottom: 8 }}>
              Cancel subscription{" "}
              <strong>{(cancelTarget.id as string)?.slice(0, 20)}…</strong>?
            </p>
            <p style={{ fontSize: 13, color: "var(--error)", marginBottom: 16 }}>
              This will immediately set the subscription status to cancelled and mark the user's listing as expired.
              This cannot be undone.
            </p>
            <div className="modal-actions">
              <button className="btn btn-secondary btn-sm" onClick={() => setCancelTarget(null)} disabled={cancelLoading}>
                Cancel
              </button>
              <button className="btn btn-danger btn-sm" onClick={handleForceCancel} disabled={cancelLoading}>
                {cancelLoading ? "Cancelling…" : "Confirm Force Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Subscription Management</h1>
          <p className="page-subtitle">Manage Business listing subscriptions</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => void load()} disabled={loading}>
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {/* KPI strip */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Active / Trial", value: kpi.active, color: "#16a34a", bg: "#dcfce7", border: "#86efac" },
          { label: "Past Due / Grace", value: kpi.pastDueGrace, color: "#b45309", bg: "#fef3c7", border: "#fcd34d" },
          { label: "Expired (30d)", value: kpi.expiredRecent, color: "#dc2626", bg: "#fee2e2", border: "#fca5a5" },
          { label: "Comped", value: kpi.comped, color: "#7c3aed", bg: "#f3e8ff", border: "#c4b5fd" },
        ].map((card) => (
          <div
            key={card.label}
            style={{
              flex: "1 1 130px",
              minWidth: 120,
              padding: "16px 20px",
              background: card.bg,
              border: `1px solid ${card.border}`,
              borderRadius: 12,
              boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
            }}
          >
            <div style={{ fontSize: 32, fontWeight: 800, color: card.color, lineHeight: 1 }}>{card.value}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: card.color, marginTop: 6 }}>{card.label}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs + search */}
      <div className="au-toolbar" style={{ marginBottom: 0 }}>
        <div className="au-toolbar__tabs" role="tablist">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              className={`tab${tab === t.key ? " active" : ""}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="au-toolbar__actions">
          <input
            className="form-input"
            placeholder="Search by UID, plan, source…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 240, height: 36 }}
          />
        </div>
      </div>
      <div className="au-toolbar__divider" />

      {loading ? (
        <div className="au-loading">
          <div className="loader" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📋</div>
          <div className="empty-state-title">No subscriptions found</div>
        </div>
      ) : (
        <div className="au-table-container">
          <table className="au-table au-table--striped">
            <thead>
              <tr>
                <th>UID</th>
                <th>Plan</th>
                <th>Status</th>
                <th>Period End</th>
                <th>Source</th>
                <th>Days Left</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => {
                const subId = s.id as string;
                const uid = s.uid as string;
                const status = (s.status as string) || "unknown";
                const chipStyle = statusChipStyle(status);

                return (
                  <tr key={subId}>
                    <td>
                      <span
                        style={{
                          fontFamily: "monospace",
                          fontSize: 12,
                          color: "var(--muted)",
                        }}
                        title={uid}
                      >
                        {uid?.slice(0, 10)}…
                      </span>
                    </td>
                    <td style={{ fontSize: 12 }}>{(s.plan as string) || "—"}</td>
                    <td>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "2px 10px",
                          borderRadius: 999,
                          fontSize: 11,
                          fontWeight: 700,
                          ...chipStyle,
                        }}
                      >
                        {status}
                      </span>
                    </td>
                    <td style={{ fontSize: 12 }}>{formatEndDate(s)}</td>
                    <td style={{ fontSize: 12, color: "var(--muted)" }}>{(s.source as string) || "—"}</td>
                    <td style={{ fontSize: 12, fontWeight: 600 }}>{daysLeft(s)}d</td>
                    <td>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: 11 }}
                          onClick={() => {
                            setCompDuration("3m");
                            setCompReason("");
                            setCompTarget(s);
                          }}
                        >
                          Grant Comp
                        </button>
                        {ACTIVE_STATES.has(status) && (
                          <button
                            className="btn btn-danger btn-sm"
                            style={{ fontSize: 11 }}
                            onClick={() => setCancelTarget(s)}
                          >
                            Force Cancel
                          </button>
                        )}
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ fontSize: 11 }}
                          onClick={() => navigate(`/admin/wallet?uid=${uid}`)}
                        >
                          Ledger
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
