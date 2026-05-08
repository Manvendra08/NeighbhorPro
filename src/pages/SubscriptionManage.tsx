import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Timestamp } from "firebase/firestore";
import { useAuth } from "../contexts/AuthContext";
import {
  getSubscription,
  getAllSubscriptionInvoices,
  cancelSubscription,
  resumeSubscription,
  computeSubState,
  daysRemaining,
  SUB_PLANS,
  type Subscription,
  type SubInvoice,
  type SubscriptionStatus,
} from "../services/subscriptionService";
import SubscribeSheet from "../components/SubscribeSheet";

function formatTs(ts: unknown): string {
  if (!ts) return "--";
  let date: Date | null = null;
  if (ts instanceof Timestamp) {
    date = ts.toDate();
  } else if (
    typeof ts === "object" &&
    ts !== null &&
    "seconds" in (ts as object) &&
    typeof (ts as { seconds: number }).seconds === "number"
  ) {
    date = new Date((ts as { seconds: number }).seconds * 1000);
  }
  if (!date) return "--";
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function planDisplayLabel(planId: string): string {
  const found = SUB_PLANS.find(p => p.id === planId);
  if (found) return found.label;
  if (planId === "business_trial_v1") return "Free Trial";
  return planId;
}

interface StatusPillProps {
  status: SubscriptionStatus | null;
}

function StatusPill({ status }: StatusPillProps) {
  type PillConfig = { bg: string; color: string; label: string };
  const cfg: Record<string, PillConfig> = {
    trial:         { bg: "#dcfce7", color: "#16a34a", label: "Trial" },
    trial_ending:  { bg: "#fef9c3", color: "#a16207", label: "Trial Ending" },
    active:        { bg: "#dcfce7", color: "#16a34a", label: "Active" },
    renewing:      { bg: "#fef9c3", color: "#a16207", label: "Renewing Soon" },
    past_due:      { bg: "#fef9c3", color: "#a16207", label: "Past Due" },
    grace:         { bg: "#fee2e2", color: "#dc2626", label: "Grace Period" },
    expired:       { bg: "#fee2e2", color: "#dc2626", label: "Expired" },
    cancelled:     { bg: "#f3f4f6", color: "#6b7280", label: "Cancelling" },
    comped:        { bg: "#ede9fe", color: "#7c3aed", label: "Sponsored" },
    paused:        { bg: "#fee2e2", color: "#dc2626", label: "Paused" },
  };

  const style: PillConfig = cfg[status ?? ""] ?? { bg: "#f3f4f6", color: "#6b7280", label: status ?? "Unknown" };

  return (
    <span style={{
      background: style.bg,
      color: style.color,
      fontSize: "0.78rem",
      fontWeight: 700,
      padding: "3px 10px",
      borderRadius: 12,
      letterSpacing: "0.02em",
    }}>
      {style.label}
    </span>
  );
}

interface SkeletonProps {
  height?: number;
  width?: string;
  style?: React.CSSProperties;
}

function Skeleton({ height = 20, width = "100%", style }: SkeletonProps) {
  return (
    <div style={{
      background: "linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)",
      backgroundSize: "200% 100%",
      animation: "shimmer 1.4s infinite",
      height,
      width,
      borderRadius: 6,
      ...style,
    }} />
  );
}

export default function SubscriptionManage() {
  const { user, userProfile } = useAuth();
  const navigate = useNavigate();

  const [sub, setSub] = useState<Subscription | null>(null);
  const [invoices, setInvoices] = useState<SubInvoice[]>([]);
  const [loadingSub, setLoadingSub] = useState(true);
  const [loadingInvoices, setLoadingInvoices] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showConfirmCancel, setShowConfirmCancel] = useState(false);
  const [showSheet, setShowSheet] = useState(false);

  const cashableBalance: number =
    (userProfile as unknown as { cashableBalance?: number })?.cashableBalance ?? 0;
  const trialUsed: boolean =
    (userProfile as unknown as { trialUsed?: boolean })?.trialUsed ?? false;

  const fetchSub = useCallback(async () => {
    if (!user?.uid) return;
    setLoadingSub(true);
    try {
      const result = await getSubscription(user.uid);
      setSub(result);
    } finally {
      setLoadingSub(false);
    }
  }, [user?.uid]);

  const fetchInvoices = useCallback(async () => {
    if (!user?.uid) return;
    setLoadingInvoices(true);
    try {
      const result = await getAllSubscriptionInvoices(user.uid);
      setInvoices(result);
    } finally {
      setLoadingInvoices(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    fetchSub();
    fetchInvoices();
  }, [fetchSub, fetchInvoices]);

  const handleCancel = async () => {
    if (!user?.uid) return;
    setActionLoading(true);
    setActionError(null);
    try {
      await cancelSubscription(user.uid);
      await fetchSub();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Failed to cancel. Try again.");
    } finally {
      setActionLoading(false);
      setShowConfirmCancel(false);
    }
  };

  const handleResume = async () => {
    if (!user?.uid) return;
    setActionLoading(true);
    setActionError(null);
    try {
      await resumeSubscription(user.uid);
      await fetchSub();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Failed to resume. Try again.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSheetSuccess = async () => {
    setShowSheet(false);
    await fetchSub();
    await fetchInvoices();
  };

  const status: SubscriptionStatus | null = sub ? computeSubState(sub) : null;
  const days = daysRemaining(sub);
  const uid = user?.uid ?? "";

  function sourceLabel(s: Subscription): string {
    if (s.source === "trial") return "Free Trial";
    if (s.source === "comp" || s.source === "admin_grant") return "Comp / Sponsored";
    return "Paid with NC";
  }

  const btnStyle: React.CSSProperties = {
    padding: "10px 18px",
    borderRadius: 10,
    fontSize: "0.9rem",
    fontWeight: 600,
  };

  function renderActions() {
    if (!status) {
      return (
        <button className="btn btn-primary" style={btnStyle} onClick={() => setShowSheet(true)}>
          Activate Subscription
        </button>
      );
    }
    if (status === "expired") {
      return (
        <button className="btn btn-primary" style={btnStyle} onClick={() => setShowSheet(true)}>
          Reactivate
        </button>
      );
    }
    if (status === "trial" || status === "trial_ending") {
      return (
        <button className="btn btn-primary" style={btnStyle} onClick={() => setShowSheet(true)}>
          Choose a Plan
        </button>
      );
    }
    if (status === "active" || status === "renewing") {
      return (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="btn btn-secondary" style={btnStyle} onClick={() => setShowSheet(true)}>
            Extend Subscription
          </button>
          {sub && !sub.cancelAtPeriodEnd && (
            <button
              className="btn"
              style={{
                ...btnStyle,
                background: "none",
                border: "1px solid var(--error, #dc2626)",
                color: "var(--error, #dc2626)",
              }}
              onClick={() => setShowConfirmCancel(true)}
              disabled={actionLoading}
            >
              Cancel
            </button>
          )}
        </div>
      );
    }
    if (status === "past_due" || status === "grace") {
      return (
        <button className="btn btn-primary" style={btnStyle} onClick={() => setShowSheet(true)}>
          Renew Now
        </button>
      );
    }
    if (status === "cancelled" && sub?.cancelAtPeriodEnd) {
      return (
        <button
          className="btn btn-secondary"
          style={btnStyle}
          onClick={handleResume}
          disabled={actionLoading}
        >
          {actionLoading ? "Resuming..." : "Resume Subscription"}
        </button>
      );
    }
    return null;
  }

  function invoiceStatusLabel(inv: SubInvoice): string {
    if (inv.status === "paid") return "Paid";
    if (inv.status === "trial") return "Free";
    if (inv.status === "comp") return "Comp";
    return inv.status;
  }

  function invoiceStatusColor(inv: SubInvoice): string {
    if (inv.status === "paid") return "var(--success, #16a34a)";
    if (inv.status === "trial" || inv.status === "comp") return "var(--muted, #6b7280)";
    return "var(--error, #dc2626)";
  }

  function invoiceAmountLabel(inv: SubInvoice): string {
    if (inv.status === "trial") return "Free";
    if (inv.status === "comp") return "Comp";
    return `${inv.amount.toLocaleString("en-IN")} NC`;
  }

  return (
    <div className="page-container" style={{ maxWidth: 680, margin: "0 auto", padding: "24px 16px 48px" }}>
      <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>

      <button
        onClick={() => navigate("/profile")}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "var(--accent, #7c3aed)",
          fontWeight: 600,
          padding: 0,
          marginBottom: 20,
          fontSize: "0.9rem",
        }}
      >
        Back to Profile
      </button>

      <h2 style={{ fontSize: "1.35rem", fontWeight: 800, marginBottom: 24 }}>Manage Subscription</h2>

      {actionError && (
        <div style={{
          background: "#fef2f2",
          border: "1px solid #fca5a5",
          borderRadius: 10,
          padding: "10px 14px",
          color: "var(--error, #dc2626)",
          marginBottom: 16,
          fontSize: "0.9rem",
        }}>
          {actionError}
        </div>
      )}

      <div className="liquid-glass card" style={{ padding: 20, marginBottom: 20, borderRadius: 16 }}>
        {loadingSub ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Skeleton height={18} width="40%" />
            <Skeleton height={28} width="60%" />
            <Skeleton height={16} width="80%" />
            <Skeleton height={16} width="70%" />
          </div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
              <StatusPill status={status} />
              {sub?.cancelAtPeriodEnd && (
                <span style={{ fontSize: "0.78rem", color: "var(--warning, #d97706)", fontWeight: 600 }}>
                  Cancels at period end
                </span>
              )}
            </div>

            <h3 style={{ fontSize: "1.15rem", fontWeight: 700, marginBottom: 14 }}>
              {sub ? planDisplayLabel(sub.plan) : "No Subscription"}
            </h3>

            {sub ? (
              <div style={{
                display: "grid",
                gridTemplateColumns: "auto 1fr",
                gap: "8px 16px",
                fontSize: "0.88rem",
                marginBottom: 18,
              }}>
                <span style={{ color: "var(--muted, #6b7280)" }}>Period</span>
                <span>{formatTs(sub.currentPeriodStart)} to {formatTs(sub.currentPeriodEnd)}</span>

                <span style={{ color: "var(--muted, #6b7280)" }}>Days remaining</span>
                <span style={{ fontWeight: 600 }}>{days} day{days !== 1 ? "s" : ""}</span>

                <span style={{ color: "var(--muted, #6b7280)" }}>Source</span>
                <span>{sourceLabel(sub)}</span>
              </div>
            ) : (
              <p style={{ color: "var(--muted, #6b7280)", fontSize: "0.9rem", marginBottom: 16 }}>
                No active subscription found. Activate a plan to list your services.
              </p>
            )}

            {(status === "comped" || status === "paused") ? (
              <div style={{
                background: status === "comped" ? "#faf5ff" : "#fef2f2",
                borderRadius: 10,
                padding: "10px 14px",
                fontSize: "0.85rem",
                color: status === "comped" ? "#7c3aed" : "#dc2626",
              }}>
                {status === "comped" && "Your subscription is sponsored by ProNeighbor. No action needed."}
                {status === "paused" && "Your subscription has been paused by an admin. Contact support for assistance."}
              </div>
            ) : (
              renderActions()
            )}

            {showConfirmCancel && (
              <div style={{
                marginTop: 14,
                background: "#fef2f2",
                border: "1px solid #fca5a5",
                borderRadius: 10,
                padding: "14px 16px",
              }}>
                <p style={{ margin: "0 0 10px", fontWeight: 600, color: "#dc2626", fontSize: "0.9rem" }}>
                  Cancel subscription?
                </p>
                <p style={{ margin: "0 0 12px", fontSize: "0.83rem", color: "#6b7280" }}>
                  Your listing stays active until the current period ends. You can resume anytime before then.
                </p>
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    className="btn"
                    style={{ ...btnStyle, background: "var(--error, #dc2626)", color: "#fff", border: "none" }}
                    onClick={handleCancel}
                    disabled={actionLoading}
                  >
                    {actionLoading ? "Cancelling..." : "Yes, cancel"}
                  </button>
                  <button
                    className="btn btn-secondary"
                    style={btnStyle}
                    onClick={() => setShowConfirmCancel(false)}
                    disabled={actionLoading}
                  >
                    Keep subscription
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="card" style={{ padding: 20, borderRadius: 16, border: "1px solid var(--border, #e5e7eb)" }}>
        <h3 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: 14 }}>Payment History</h3>

        {loadingInvoices ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Skeleton height={36} />
            <Skeleton height={36} />
          </div>
        ) : invoices.length === 0 ? (
          <p style={{ color: "var(--muted, #6b7280)", fontSize: "0.9rem" }}>No invoices yet.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border, #e5e7eb)" }}>
                  {["Date", "Plan", "Amount", "Status"].map(col => (
                    <th key={col} style={{
                      textAlign: "left",
                      padding: "8px 10px",
                      fontWeight: 600,
                      color: "var(--muted, #6b7280)",
                      whiteSpace: "nowrap",
                    }}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv, i) => (
                  <tr key={inv.id ?? i} style={{ borderBottom: "1px solid var(--border, #e5e7eb)" }}>
                    <td style={{ padding: "10px 10px", whiteSpace: "nowrap" }}>
                      {formatTs(inv.paidAt)}
                    </td>
                    <td style={{ padding: "10px 10px" }}>
                      {planDisplayLabel(inv.plan)}
                    </td>
                    <td style={{ padding: "10px 10px", whiteSpace: "nowrap", fontWeight: 600 }}>
                      {invoiceAmountLabel(inv)}
                    </td>
                    <td style={{ padding: "10px 10px" }}>
                      <span style={{
                        background: inv.status === "paid" ? "#dcfce7" : "#f3f4f6",
                        color: invoiceStatusColor(inv),
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: 8,
                        whiteSpace: "nowrap",
                      }}>
                        {invoiceStatusLabel(inv)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showSheet && uid && (
        <SubscribeSheet
          uid={uid}
          cashableBalance={cashableBalance}
          trialUsed={trialUsed}
          onClose={() => setShowSheet(false)}
          onSuccess={handleSheetSuccess}
        />
      )}
    </div>
  );
}