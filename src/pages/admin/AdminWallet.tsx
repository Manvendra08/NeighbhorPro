/**
 * AdminWallet.tsx
 * Full NC economy control panel for platform admins.
 *
 * Tabs:
 *   Overview      — economy KPIs + float summary
 *   Purchases     — all Razorpay top-ups, searchable
 *   Payouts       — approve / reject pro withdrawal requests
 *   User Ledger   — look up any user's NC history
 *   Adjustments   — manual credit / debit with audit trail
 */

import { useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import {
  getAllCoinPurchases,
  getAllPayouts,
  getCoinEconomySummary,
  updatePayoutStatus,
  adminAdjustCoins,
  getLedger,
  ledgerColor,
  ledgerSign,
  maskUpiId,
  type CoinPurchase,
  type CoinPayout,
  type LedgerEntry,
} from "../../services/coinService";
import { getAllUserRows, formatTimestamp } from "../../services/firestoreService";
import { logAudit } from "./AdminAuditLog";

type Tab = "overview" | "purchases" | "payouts" | "ledger" | "adjustments";

/* ── tiny reusable stat card ── */
function KPI({ icon, label, value, sub, color }: { icon: string; label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div className="stat-card">
      <div className="stat-icon" style={{ background: `${color}18`, color }}>{icon}</div>
      <div className="stat-value" style={{ fontSize: "1.4rem" }}>{value}</div>
      <div className="stat-label">{label}</div>
      {sub && <div style={{ fontSize: "0.72rem", color: "var(--muted)", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

/* ── toast ── */
function Toast({ msg, type }: { msg: string; type: "success" | "error" }) {
  return (
    <div style={{
      position: "fixed", top: 20, right: 24, zIndex: 9999,
      background: type === "success" ? "#16a34a" : "#dc2626",
      color: "#fff", padding: "10px 20px", borderRadius: 8,
      fontWeight: 600, fontSize: 13, boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
      animation: "dropIn 0.2s ease",
    }}>{msg}</div>
  );
}

export default function AdminWallet() {
  const { user, userProfile } = useAuth();
  const adminUid  = user?.uid ?? "";
  const adminName = userProfile?.displayName ?? "Admin";

  const [tab, setTab] = useState<Tab>("overview");
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3200);
  };

  /* ── Overview state ── */
  const [summary, setSummary] = useState({
    totalPurchasedNC: 0, totalPurchaseRevenue: 0,
    totalPayoutNC: 0, pendingPayoutNC: 0, pendingPayoutCount: 0, totalEarnedNC: 0,
  });
  const [summaryLoading, setSummaryLoading] = useState(false);

  /* ── Purchases state ── */
  const [purchases, setPurchases] = useState<CoinPurchase[]>([]);
  const [purchaseSearch, setPurchaseSearch] = useState("");
  const [purchasesLoading, setPurchasesLoading] = useState(false);

  /* ── Payouts state ── */
  const [payouts, setPayouts] = useState<CoinPayout[]>([]);
  const [payoutFilter, setPayoutFilter] = useState<"all" | "pending" | "processed" | "failed">("pending");
  const [payoutsLoading, setPayoutsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  /* ── User Ledger state ── */
  const [users, setUsers] = useState<Record<string, unknown>[]>([]);
  const [ledgerUid, setLedgerUid] = useState("");
  const [ledgerSearch, setLedgerSearch] = useState("");
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  /* ── Adjustments state ── */
  const [adjUid, setAdjUid] = useState("");
  const [adjAmount, setAdjAmount] = useState("");
  const [adjReason, setAdjReason] = useState("");
  const [adjType, setAdjType] = useState<"credit" | "debit">("credit");
  const [adjLoading, setAdjLoading] = useState(false);
  const [adjSearch, setAdjSearch] = useState("");

  /* ── Load on tab change ── */
  useEffect(() => {
    if (tab === "overview") loadSummary();
    if (tab === "purchases") loadPurchases();
    if (tab === "payouts") loadPayouts();
    if (tab === "ledger" || tab === "adjustments") loadUsers();
  }, [tab]);

  const loadSummary = async () => {
    setSummaryLoading(true);
    setSummary(await getCoinEconomySummary());
    setSummaryLoading(false);
  };

  const loadPurchases = async () => {
    setPurchasesLoading(true);
    const res = await getAllCoinPurchases(200);
    setPurchases(res.data);
    setPurchasesLoading(false);
  };

  const loadPayouts = async () => {
    setPayoutsLoading(true);
    const res = await getAllPayouts(200);
    setPayouts(res.data);
    setPayoutsLoading(false);
  };

  const loadUsers = async () => {
    if (users.length) return;
    const rows = await getAllUserRows();
    setUsers(rows);
  };

  const loadLedger = async (uid: string) => {
    if (!uid) return;
    setLedgerLoading(true);
    setLedger(await getLedger(uid, 50));
    setLedgerLoading(false);
  };

  /* ── Payout actions ── */
  const handlePayoutAction = async (payout: CoinPayout, status: "processed" | "failed") => {
    setActionLoading(payout.id!);
    await updatePayoutStatus(payout.id!, status, adminUid);
    const payoutUpi = payout.upiMasked || maskUpiId(payout.upiId || "");
    await logAudit(
      `payout.${status}`, adminUid, adminName,
      `${status === "processed" ? "Approved" : "Rejected"} payout of ${payout.coinsRedeemed} NC (₹${payout.amountRs}) for ${payout.displayName} -> ${payoutUpi}`,
      payout.uid
    );
    showToast(status === "processed" ? "Payout marked as processed" : "Payout rejected");
    await loadPayouts();
    await loadSummary();
    setActionLoading(null);
  };

  /* ── Manual adjustment ── */
  const handleAdjust = async () => {
    const amount = parseInt(adjAmount);
    if (!adjUid)                   { showToast("Select a user", "error"); return; }
    if (!amount || isNaN(amount))  { showToast("Enter a valid amount", "error"); return; }
    if (!adjReason.trim())         { showToast("Enter a reason", "error"); return; }

    const finalAmount = adjType === "debit" ? -Math.abs(amount) : Math.abs(amount);
    const targetUser = users.find(u => u.uid === adjUid);
    const targetName = (targetUser?.displayName as string) || adjUid;
    const confirmText = `${adjType === "credit" ? "Credit" : "Debit"} ${Math.abs(amount)} NC ${adjType === "credit" ? "to" : "from"} ${targetName}?\n\nReason: ${adjReason.trim()}\n\nThis action is irreversible.`;
    const ok = window.confirm(confirmText);
    if (!ok) return;

    setAdjLoading(true);

    const res = await adminAdjustCoins(adjUid, finalAmount, adjReason.trim(), adminUid);
    if (res.success) {
      await logAudit(
        `wallet.admin_${adjType}`, adminUid, adminName,
        `${adjType === "credit" ? "Credited" : "Debited"} ${Math.abs(amount)} NC ${adjType === "credit" ? "to" : "from"} ${targetName}. Reason: ${adjReason}`,
        adjUid
      );
      showToast(`${Math.abs(amount)} NC ${adjType === "credit" ? "credited" : "debited"} successfully`);
      setAdjAmount(""); setAdjReason(""); setAdjUid("");
    } else {
      showToast(res.reason ?? "Adjustment failed", "error");
    }
    setAdjLoading(false);
  };

  /* ── Filtered data ── */
  const filteredPurchases = purchases.filter(p => {
    const q = purchaseSearch.toLowerCase();
    return !q || p.uid.toLowerCase().includes(q) || p.packLabel.toLowerCase().includes(q) || (p.paymentId ?? "").toLowerCase().includes(q);
  });

  const filteredPayouts = payouts.filter(p =>
    payoutFilter === "all" ? true : p.status === payoutFilter
  );

  const userOptions = users.filter(u => {
    const q = adjSearch.toLowerCase();
    return !q ||
      ((u.displayName as string) ?? "").toLowerCase().includes(q) ||
      ((u.email as string) ?? "").toLowerCase().includes(q);
  }).slice(0, 20);

  const ledgerUserOptions = users.filter(u => {
    const q = ledgerSearch.toLowerCase();
    return !q ||
      ((u.displayName as string) ?? "").toLowerCase().includes(q) ||
      ((u.email as string) ?? "").toLowerCase().includes(q);
  }).slice(0, 20);

  const TABS: { key: Tab; label: string; badge?: number }[] = [
    { key: "overview",    label: "📊 Overview" },
    { key: "purchases",   label: "💳 Purchases" },
    { key: "payouts",     label: "💸 Payouts", badge: summary.pendingPayoutCount || undefined },
    { key: "ledger",      label: "📋 User Ledger" },
    { key: "adjustments", label: "⚙️ Adjustments" },
  ];

  /* ── float metric: coins sold - coins paid out = platform's NC liability ── */
  const float = summary.totalPurchasedNC - summary.totalPayoutNC;

  return (
    <div>
      {toast && <Toast msg={toast.msg} type={toast.type} />}

      <div className="page-header">
        <div>
          <h1 className="page-title">🪙 Wallet Administration</h1>
          <p className="page-subtitle">NeighbourCoins economy · Full control & monitoring</p>
        </div>
        {summary.pendingPayoutCount > 0 && (
          <div style={{ background: "rgba(245,105,44,0.1)", border: "1.5px solid rgba(245,105,44,0.35)", borderRadius: 12, padding: "12px 20px", display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: "1.3rem" }}>⚠️</span>
            <div>
              <div style={{ fontWeight: 700, color: "#F5692C", fontSize: "0.9rem" }}>{summary.pendingPayoutCount} pending payout{summary.pendingPayoutCount > 1 ? "s" : ""}</div>
              <div style={{ fontSize: "0.78rem", color: "var(--muted)" }}>₹{summary.pendingPayoutNC.toLocaleString("en-IN")} awaiting action</div>
            </div>
            <button className="btn btn-sm" style={{ background: "#F5692C", color: "#fff", border: "none" }} onClick={() => setTab("payouts")}>Review →</button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ marginBottom: 28 }}>
        {TABS.map(({ key, label, badge }) => (
          <button key={key} className={`tab${tab === key ? " active" : ""}`} onClick={() => setTab(key)} style={{ position: "relative" }}>
            {label}
            {badge ? (
              <span style={{ marginLeft: 6, background: "#F5692C", color: "#fff", fontSize: "0.65rem", fontWeight: 700, padding: "1px 6px", borderRadius: 50 }}>{badge}</span>
            ) : null}
          </button>
        ))}
      </div>

      {/* ══════════════ OVERVIEW ══════════════ */}
      {tab === "overview" && (
        <div>
          {summaryLoading ? (
            <div style={{ textAlign: "center", padding: 60 }}><div className="loader" style={{ margin: "0 auto" }} /></div>
          ) : (
            <>
              <div className="grid grid-4" style={{ marginBottom: 28 }}>
                <KPI icon="💰" label="Total NC Sold"      value={summary.totalPurchasedNC.toLocaleString("en-IN")} sub={`= ₹${summary.totalPurchaseRevenue.toLocaleString("en-IN")} real revenue`} color="#1B6B8A" />
                <KPI icon="💸" label="NC Paid Out"        value={summary.totalPayoutNC.toLocaleString("en-IN")}   sub={`= ₹${summary.totalPayoutNC.toLocaleString("en-IN")} settled`}          color="#16a34a" />
                <KPI icon="🏦" label="NC Float (Liability)" value={float.toLocaleString("en-IN")}                sub="Coins in circulation"                                                      color="#F5692C" />
                <KPI icon="⏳" label="Pending Payouts"    value={`₹${summary.pendingPayoutNC.toLocaleString("en-IN")}`} sub={`${summary.pendingPayoutCount} requests`}                          color="#dc2626" />
              </div>

              {/* Economy health card */}
              <div className="card" style={{ marginBottom: 20 }}>
                <h3 className="card-title" style={{ marginBottom: 16 }}>Economy Health</h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
                  {[
                    {
                      label: "Revenue from Top-Ups",
                      value: `₹${summary.totalPurchaseRevenue.toLocaleString("en-IN")}`,
                      desc: "Real money collected via Razorpay",
                      color: "#1B6B8A",
                    },
                    {
                      label: "Platform Float",
                      value: `${float.toLocaleString("en-IN")} NC`,
                      desc: "NC sold but not yet cashed out — your liability",
                      color: "#F5692C",
                    },
                    {
                      label: "Settled to Pros",
                      value: `₹${summary.totalPayoutNC.toLocaleString("en-IN")}`,
                      desc: "Real money transferred to pros via UPI",
                      color: "#16a34a",
                    },
                  ].map(({ label, value, desc, color }) => (
                    <div key={label} style={{ background: "var(--surface-2)", borderRadius: 12, padding: 20 }}>
                      <div style={{ fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>{label}</div>
                      <div style={{ fontWeight: 800, fontSize: "1.3rem", color, marginBottom: 4 }}>{value}</div>
                      <div style={{ fontSize: "0.78rem", color: "var(--muted)" }}>{desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick nav */}
              <div className="grid grid-3">
                {[
                  { icon: "💳", label: "View All Purchases", tab: "purchases" as Tab },
                  { icon: "💸", label: "Process Payouts",    tab: "payouts"   as Tab },
                  { icon: "⚙️", label: "Manual Adjustments", tab: "adjustments" as Tab },
                ].map(({ icon, label, tab: t }) => (
                  <button key={t} className="card" onClick={() => setTab(t)} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 14, border: "1.5px solid var(--border)" }}>
                    <span style={{ fontSize: "1.6rem" }}>{icon}</span>
                    <span style={{ fontWeight: 600, fontSize: "0.93rem" }}>{label} →</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ══════════════ PURCHASES ══════════════ */}
      {tab === "purchases" && (
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
            <div>
              <h2 style={{ fontFamily: "var(--font-heading)", fontSize: "1.1rem", fontWeight: 700 }}>All Coin Purchases</h2>
              <p className="text-muted text-sm">{purchases.length} total top-ups · ₹{purchases.filter(p=>p.status==="completed").reduce((s,p)=>s+p.amountPaid,0).toLocaleString("en-IN")} collected</p>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <input className="form-input" placeholder="Search UID / payment ID / pack…" value={purchaseSearch}
                onChange={e => setPurchaseSearch(e.target.value)} style={{ width: 280 }} />
              <button className="btn btn-secondary btn-sm" onClick={() => {
                const csv = ["Date,UID,Pack,Amount(₹),NC Granted,Payment ID,Status"]
                  .concat(purchases.map(p => `"${formatTimestamp(p.createdAt)}","${p.uid}","${p.packLabel}","${p.amountPaid}","${p.coinsGranted}","${p.paymentId ?? ""}","${p.status}"`))
                  .join("\n");
                const a = document.createElement("a"); a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
                a.download = "coin_purchases.csv"; a.click();
              }}>⬇ CSV</button>
            </div>
          </div>

          {purchasesLoading ? (
            <div style={{ textAlign: "center", padding: 60 }}><div className="loader" style={{ margin: "0 auto" }} /></div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Date</th><th>User UID</th><th>Pack</th><th>Paid (₹)</th><th>NC Granted</th><th>Payment ID</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {filteredPurchases.map(p => (
                    <tr key={p.id}>
                      <td className="text-muted" style={{ fontSize: 13, whiteSpace: "nowrap" }}>{formatTimestamp(p.createdAt)}</td>
                      <td style={{ fontFamily: "monospace", fontSize: 12 }}>{p.uid.slice(0, 12)}…</td>
                      <td><span className="badge badge-muted">{p.packLabel}</span></td>
                      <td style={{ fontWeight: 700 }}>₹{p.amountPaid.toLocaleString("en-IN")}</td>
                      <td style={{ color: "#1B6B8A", fontWeight: 600 }}>+{p.coinsGranted.toLocaleString("en-IN")} NC</td>
                      <td style={{ fontFamily: "monospace", fontSize: 11, color: "var(--muted)" }}>{p.paymentId ? p.paymentId.slice(0, 16) + "…" : "—"}</td>
                      <td>
                        <span className={`badge ${p.status === "completed" ? "badge-success" : p.status === "failed" ? "badge-error" : "badge-warning"}`}>
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {filteredPurchases.length === 0 && (
                    <tr><td colSpan={7} style={{ textAlign: "center", color: "var(--muted)", padding: 32 }}>No purchases found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══════════════ PAYOUTS ══════════════ */}
      {tab === "payouts" && (
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
            <div>
              <h2 style={{ fontFamily: "var(--font-heading)", fontSize: "1.1rem", fontWeight: 700 }}>Pro Payout Requests</h2>
              <p className="text-muted text-sm">
                {payouts.filter(p=>p.status==="pending").length} pending · ₹{payouts.filter(p=>p.status==="pending").reduce((s,p)=>s+p.amountRs,0).toLocaleString("en-IN")} to settle
              </p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {(["pending","processed","failed","all"] as const).map(f => (
                <button key={f} className={`chip${payoutFilter === f ? " active" : ""}`} onClick={() => setPayoutFilter(f)}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                  {f !== "all" && <span style={{ marginLeft: 5, opacity: 0.65 }}>({payouts.filter(p => p.status === f).length})</span>}
                </button>
              ))}
            </div>
          </div>

          {payoutsLoading ? (
            <div style={{ textAlign: "center", padding: 60 }}><div className="loader" style={{ margin: "0 auto" }} /></div>
          ) : filteredPayouts.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">✅</div>
              <div className="empty-state-title">No {payoutFilter !== "all" ? payoutFilter : ""} payouts</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {filteredPayouts.map(p => (
                <div key={p.id} className="card" style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12,
                  borderLeft: `4px solid ${p.status === "pending" ? "#F5692C" : p.status === "processed" ? "#16a34a" : "#dc2626"}`,
                }}>
                  <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flex: 1 }}>
                    <div style={{ width: 44, height: 44, borderRadius: "50%", background: "linear-gradient(135deg,#1B6B8A,#F5692C)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: "0.9rem", flexShrink: 0 }}>
                      {(p.displayName ?? "?").slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>{p.displayName}</div>
                      <div style={{ fontSize: "0.78rem", color: "var(--muted)", marginTop: 2 }}>UPI: <span style={{ fontFamily: "monospace" }}>{p.upiMasked || maskUpiId(p.upiId || "")}</span></div>
                      <div style={{ fontSize: "0.76rem", color: "var(--muted)", marginTop: 2 }}>Requested: {formatTimestamp(p.createdAt)}</div>
                    </div>
                  </div>

                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontWeight: 800, fontSize: "1.2rem", color: "#1B6B8A" }}>₹{p.amountRs.toLocaleString("en-IN")}</div>
                    <div style={{ fontSize: "0.74rem", color: "var(--muted)" }}>{p.coinsRedeemed.toLocaleString("en-IN")} NC redeemed</div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span className={`badge ${p.status === "pending" ? "badge-warning" : p.status === "processed" ? "badge-success" : "badge-error"}`}>
                      {p.status}
                    </span>
                    {p.status === "pending" && (
                      <>
                        <button className="btn btn-sm btn-success" disabled={actionLoading === p.id}
                          onClick={() => handlePayoutAction(p, "processed")}>
                          {actionLoading === p.id ? "…" : "✓ Mark Paid"}
                        </button>
                        <button className="btn btn-sm btn-danger" disabled={actionLoading === p.id}
                          onClick={() => handlePayoutAction(p, "failed")}>
                          {actionLoading === p.id ? "…" : "✕ Reject"}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════ USER LEDGER ══════════════ */}
      {tab === "ledger" && (
        <div>
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ fontFamily: "var(--font-heading)", fontSize: "1.1rem", fontWeight: 700, marginBottom: 4 }}>User NC Ledger Lookup</h2>
            <p className="text-muted text-sm">View complete transaction history for any user</p>
          </div>

          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
              <div style={{ flex: 1, minWidth: 240 }}>
                <label className="form-label">Search User</label>
                <input className="form-input" placeholder="Name or email…" value={ledgerSearch}
                  onChange={e => setLedgerSearch(e.target.value)} />
              </div>
              <div style={{ flex: 1, minWidth: 240 }}>
                <label className="form-label">Select User</label>
                <select className="form-input" value={ledgerUid} onChange={e => { setLedgerUid(e.target.value); setLedger([]); }}>
                  <option value="">— choose a user —</option>
                  {ledgerUserOptions.map(u => (
                    <option key={u.uid as string} value={u.uid as string}>
                      {(u.displayName as string) || (u.email as string)} — {(u.coinBalance as number ?? 0)} NC
                    </option>
                  ))}
                </select>
              </div>
              <button className="btn btn-primary" onClick={() => loadLedger(ledgerUid)} disabled={!ledgerUid || ledgerLoading}>
                {ledgerLoading ? "Loading…" : "Load Ledger"}
              </button>
            </div>
          </div>

          {ledgerLoading ? (
            <div style={{ textAlign: "center", padding: 60 }}><div className="loader" style={{ margin: "0 auto" }} /></div>
          ) : ledger.length > 0 ? (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Date</th><th>Type</th><th>Description</th><th style={{ textAlign: "right" }}>Amount</th><th style={{ textAlign: "right" }}>Balance After</th></tr>
                </thead>
                <tbody>
                  {ledger.map(e => (
                    <tr key={e.id}>
                      <td className="text-muted" style={{ fontSize: 12, whiteSpace: "nowrap" }}>{formatTimestamp(e.createdAt)}</td>
                      <td><span className="badge badge-muted" style={{ fontSize: "0.68rem" }}>{e.type.replace(/_/g, " ")}</span></td>
                      <td style={{ fontSize: 13 }}>{e.description}</td>
                      <td style={{ textAlign: "right", fontWeight: 700, color: ledgerColor(e.type) }}>{ledgerSign(e.amount)} NC</td>
                      <td style={{ textAlign: "right", color: "var(--muted)", fontSize: 12 }}>{e.balanceAfter.toLocaleString("en-IN")} NC</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : ledgerUid && !ledgerLoading ? (
            <div className="empty-state">
              <div className="empty-state-icon">📋</div>
              <div className="empty-state-title">No transactions yet</div>
            </div>
          ) : null}
        </div>
      )}

      {/* ══════════════ ADJUSTMENTS ══════════════ */}
      {tab === "adjustments" && (
        <div style={{ maxWidth: 600 }}>
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ fontFamily: "var(--font-heading)", fontSize: "1.1rem", fontWeight: 700, marginBottom: 4 }}>Manual NC Adjustment</h2>
            <p className="text-muted text-sm">Directly credit or debit a user's wallet. Every action is logged to the audit trail.</p>
          </div>

          <div className="card">
            {/* Credit / Debit toggle */}
            <div style={{ display: "flex", background: "var(--surface-2)", borderRadius: 10, padding: 4, marginBottom: 24, width: "fit-content" }}>
              {(["credit", "debit"] as const).map(t => (
                <button key={t} onClick={() => setAdjType(t)} style={{
                  padding: "8px 24px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 700, fontSize: "0.88rem", transition: "all 0.15s",
                  background: adjType === t ? (t === "credit" ? "#16a34a" : "#dc2626") : "transparent",
                  color: adjType === t ? "#fff" : "var(--muted)",
                }}>
                  {t === "credit" ? "+ Credit NC" : "− Debit NC"}
                </button>
              ))}
            </div>

            {/* User search + select */}
            <div className="form-group">
              <label className="form-label">Search User</label>
              <input className="form-input" placeholder="Name or email…" value={adjSearch}
                onChange={e => setAdjSearch(e.target.value)} style={{ marginBottom: 8 }} />
            </div>
            <div className="form-group">
              <label className="form-label">Select User *</label>
              <select className="form-input" value={adjUid} onChange={e => setAdjUid(e.target.value)}>
                <option value="">— choose user —</option>
                {userOptions.map(u => {
                  const bal = (u.coinBalance as number) ?? 0;
                  return (
                    <option key={u.uid as string} value={u.uid as string}>
                      {(u.displayName as string) || (u.email as string)} · {bal.toLocaleString("en-IN")} NC
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Amount (NC) *</label>
              <input className="form-input" type="number" min={1} placeholder="e.g. 100"
                value={adjAmount} onChange={e => setAdjAmount(e.target.value)} />
              {adjUid && adjAmount && !isNaN(parseInt(adjAmount)) && (() => {
                const u = users.find(u => u.uid === adjUid);
                const bal = (u?.coinBalance as number) ?? 0;
                const result = adjType === "credit" ? bal + parseInt(adjAmount) : bal - parseInt(adjAmount);
                return (
                  <div className="form-hint" style={{ color: result < 0 ? "#dc2626" : "var(--muted)" }}>
                    Balance after: {result.toLocaleString("en-IN")} NC
                  </div>
                );
              })()}
            </div>

            <div className="form-group">
              <label className="form-label">Reason / Note * <span style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 400 }}>(recorded in audit log)</span></label>
              <textarea className="form-input" placeholder="e.g. Compensation for payment failure · Promotional reward · Data correction" rows={3}
                value={adjReason} onChange={e => setAdjReason(e.target.value)} />
            </div>

            {/* Confirmation box */}
            {adjUid && adjAmount && adjReason && !isNaN(parseInt(adjAmount)) && (() => {
              const u = users.find(u => u.uid === adjUid);
              return (
                <div style={{
                  background: adjType === "credit" ? "rgba(22,163,74,0.08)" : "rgba(220,38,38,0.08)",
                  border: `1px solid ${adjType === "credit" ? "rgba(22,163,74,0.25)" : "rgba(220,38,38,0.25)"}`,
                  borderRadius: 10, padding: "12px 16px", marginBottom: 16, fontSize: "0.85rem",
                }}>
                  <strong>{adjType === "credit" ? "✅ Will credit" : "⚠️ Will debit"}</strong>{" "}
                  <strong>{Math.abs(parseInt(adjAmount)).toLocaleString("en-IN")} NC</strong>{" "}
                  {adjType === "credit" ? "to" : "from"}{" "}
                  <strong>{(u?.displayName as string) || adjUid}</strong>.
                </div>
              );
            })()}

            <button className="btn btn-primary btn-lg" style={{
              width: "100%", justifyContent: "center",
              background: adjType === "credit" ? "linear-gradient(135deg,#16a34a,#15803d)" : "linear-gradient(135deg,#dc2626,#b91c1c)",
            }}
              onClick={handleAdjust} disabled={adjLoading}>
              {adjLoading ? "Processing…" : `${adjType === "credit" ? "Credit" : "Debit"} NC`}
            </button>

            <p style={{ fontSize: "0.74rem", color: "var(--muted)", marginTop: 10, textAlign: "center" }}>
              🔒 This action is irreversible and logged to the admin audit trail with your UID.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

