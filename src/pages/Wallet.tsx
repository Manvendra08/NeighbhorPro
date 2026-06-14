import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  COIN_PACKS, EARN_RULES, MIN_PAYOUT_COINS, getLedger, requestPayout,
  getPendingPayoutForUser, cancelPayoutRequest,
  formatNC, ledgerColor, ledgerSign, getNCTerms,
  maskUpiId, generateReferralCode, isValidReferralCode, normalizeReferralCode,
  type LedgerEntry, type NCTerms, type CoinPayout,
} from "../services/coinService";
import { logActivity } from "../services/activityService";
import { initiateTopUp, isRazorpayTopupEnabled, type PaymentStatus } from "../services/razorpayService";
import { formatTimestamp, updateUserProfile } from "../services/firestoreService";
import { queryClient, queryKeys, useCoinBalanceQuery } from "../lib/queryClient";
import { captureError } from "../lib/sentry";

type Tab = "overview" | "buy" | "earn" | "payout" | "history" | "subscription" | "terms";

const STATUS_UI: Partial<Record<PaymentStatus, { text: string; color: string }>> = {
  awaiting_payment: { text: "⏳ Complete payment in the Razorpay popup…", color: "#1B6B8A" },
  crediting:        { text: "⏳ Crediting coins…",                         color: "#1B6B8A" },
  success:          { text: "✅ Payment successful! Coins added.",          color: "#16a34a" },
  failed:           { text: "❌ Payment failed. Try again.",                color: "#dc2626" },
  dismissed:        { text: "Payment cancelled.",                           color: "var(--muted)" },
};

export default function Wallet() {
  const { user, userProfile } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab]             = useState<Tab>("overview");
  const [ledger, setLedger]       = useState<LedgerEntry[]>([]);
  const [ledgerLoading, setLL]    = useState(false);
  const [selectedPack, setSP]     = useState(2);
  const [payStatus, setPayStatus] = useState<PaymentStatus>("idle");
  const [payError, setPayError]   = useState("");
  const [payoutCoins, setPC]      = useState("");
  const [upiId, setUpi]           = useState("");
  const [saveUpi, setSaveUpi]     = useState(true);
  const [payoutLoading, setPL]    = useState(false);
  const [payoutMsg, setPayoutMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [pendingPayout, setPendingPayout] = useState<CoinPayout | null>(null);
  const [showPayoutConfirm, setShowPayoutConfirm] = useState(false);
  const [payoutRequest, setPayoutRequest] = useState<{ coins: number; upiId: string } | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [ncTerms, setNcTerms]     = useState<NCTerms | null>(null);
  const [copied, setCopied]       = useState(false);
  const [latestLedgerEntry, setLatestLedgerEntry] = useState<LedgerEntry | null>(null);

  // Handle URL tab parameter
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get("tab") as Tab;
    if (tabParam && ["overview", "buy", "earn", "payout", "history", "subscription", "terms"].includes(tabParam)) {
      setTab(tabParam);
    }
  }, []);

  const { data: balance = userProfile?.coinBalance ?? 0 } = useCoinBalanceQuery(user?.uid, userProfile?.coinBalance ?? 0);
  const cashableBalance = (userProfile as Record<string, unknown> | null)?.cashableBalance as number ?? 0;
  const promoBalance = (userProfile as Record<string, unknown> | null)?.promoBalance as number ?? 0;
  const isPro   = userProfile?.isServiceProvider;
  const isBusy  = payStatus === "awaiting_payment" || payStatus === "crediting";
  const topupsEnabled = isRazorpayTopupEnabled();
  const storedCode = normalizeReferralCode(userProfile?.referralCode);
  const myCode = isValidReferralCode(storedCode)
    ? storedCode
    : generateReferralCode({
        displayName: userProfile?.displayName,
        phoneNumber: userProfile?.phoneNumber,
        uid: userProfile?.uid,
      });
  const hasPhone = !!userProfile?.phoneNumber;
  const referralLink = hasPhone && myCode
    ? `${typeof window !== "undefined" ? window.location.origin : "https://proneighbor.web.app"}/register?ref=${encodeURIComponent(myCode)}`
    : "";

  useEffect(() => {
    if (payStatus !== "success") return;
    if (user) {
      const pack = COIN_PACKS[selectedPack];
      logActivity(user.uid, "payment.success", `Wallet top-up: ${pack.coins + pack.bonus} NC (₹${pack.priceRs} ${pack.label} pack)`, { pack: pack.label, coins: pack.coins + pack.bonus, priceRs: pack.priceRs });
    }
    const t = setTimeout(() => { setPayStatus("idle"); setTab("overview"); }, 3000);
    return () => clearTimeout(t);
  }, [payStatus, user, selectedPack]);

  useEffect(() => {
    if (tab !== "history" || !user) return;
    let alive = true;
    setLL(true);
    getLedger(user.uid)
      .then(r => {
        if (!alive) return;
        setLedger(r);
        setLL(false);
      })
      .catch((error: unknown) => {
        captureError(error, { operation: "wallet.get_ledger", uid: user.uid });
        if (alive) setLL(false);
      });
    return () => {
      alive = false;
    };
  }, [tab, user]);

  useEffect(() => {
    if (!user) {
      setLatestLedgerEntry(null);
      return;
    }
    let alive = true;
    getLedger(user.uid, 1)
      .then(entries => {
        if (!alive) return;
        setLatestLedgerEntry(entries[0] || null);
      })
      .catch((error: unknown) => {
        captureError(error, { operation: "wallet.get_latest_ledger", uid: user.uid });
        if (alive) setLatestLedgerEntry(null);
      });
    return () => {
      alive = false;
    };
  }, [user, payStatus, payoutMsg]);

  useEffect(() => {
    if (tab !== "terms") return;
    let alive = true;
    getNCTerms()
      .then((terms) => {
        if (alive) setNcTerms(terms);
      })
      .catch((error: unknown) => {
        captureError(error, { operation: "wallet.get_terms" });
      });
    return () => {
      alive = false;
    };
  }, [tab]);

  useEffect(() => {
    const profileRecord = userProfile as unknown as { preferredUpiId?: unknown } | null;
    const savedUpi = typeof profileRecord?.preferredUpiId === "string" ? profileRecord.preferredUpiId : "";
    if (savedUpi) {
      setUpi(savedUpi);
    }
  }, [userProfile]);

  useEffect(() => {
    if (!user || !isPro) {
      setPendingPayout(null);
      return;
    }
    let alive = true;
    getPendingPayoutForUser(user.uid)
      .then((payout) => {
        if (alive) setPendingPayout(payout);
      })
      .catch((error: unknown) => {
        captureError(error, { operation: "wallet.get_pending_payout", uid: user.uid });
        if (alive) setPendingPayout(null);
      });
    return () => {
      alive = false;
    };
  }, [user, isPro, tab, payoutMsg]);

  const handleBuy = async () => {
    if (!user || !userProfile || isBusy) return;
    if (!topupsEnabled) {
      setPayStatus("failed");
      setPayError("Coin top-ups are disabled on Spark plan. Blaze-backed Functions + webhook are required for secure payments.");
      return;
    }
    setPayError("");
    await initiateTopUp({
      uid: user.uid, packLabel: COIN_PACKS[selectedPack].label,
      userName: userProfile.displayName || user.displayName || "",
      userEmail: userProfile.email || user.email || "",
      onStatusChange: setPayStatus,
      onSuccess: () => {},
      onError: setPayError,
    });
  };

  const handlePayout = async () => {
    if (!user || !userProfile) return;
    if (pendingPayout) {
      setPayoutMsg({ type: "error", text: "You already have a pending payout request. Cancel it before creating a new one." });
      return;
    }
    const coins = parseInt(payoutCoins, 10);
    const normalizedUpiId = upiId.trim();
    if (!coins || isNaN(coins))  { setPayoutMsg({ type: "error", text: "Enter a valid amount." }); return; }
    if (coins < MIN_PAYOUT_COINS) {
      setPayoutMsg({ type: "error", text: `Minimum payout is ${MIN_PAYOUT_COINS} NC.` });
      return;
    }
    if (coins > cashableBalance) {
      setPayoutMsg({ type: "error", text: `Insufficient balance: you have ${cashableBalance} NC.` });
      return;
    }
    if (!normalizedUpiId.includes("@"))    { setPayoutMsg({ type: "error", text: "Enter a valid UPI ID." }); return; }
    setPayoutRequest({ coins, upiId: normalizedUpiId });
    setShowPayoutConfirm(true);
  };

  const submitPayoutRequest = async () => {
    if (!user || !userProfile || !payoutRequest) return;
    const { coins, upiId: requestUpiId } = payoutRequest;
    setPL(true);
    const res = await requestPayout(user.uid, userProfile.displayName, coins, requestUpiId);
    setPayoutMsg(res.success
      ? { type: "success", text: `Payout of ₹${coins} requested! Processed within 48 hrs.` }
      : { type: "error",   text: res.reason ?? "Failed. Try again." });
    if (res.success) {
      const maskedUpi = maskUpiId(requestUpiId);
      logActivity(user.uid, "wallet.withdrawal", `Payout requested: ${coins} NC (₹${coins}) to UPI ${maskedUpi}`, { coins, upiMasked: maskedUpi });
      if (saveUpi) {
        await updateUserProfile(user.uid, { preferredUpiId: requestUpiId });
      }
      queryClient.setQueryData<number>(queryKeys.coinBalance(user.uid), Math.max(0, balance - coins));
      queryClient.invalidateQueries({ queryKey: queryKeys.coinBalance(user.uid) }).catch((error: unknown) => {
        captureError(error, { operation: "wallet.invalidate_balance_after_payout", uid: user.uid });
      });
      setPC(""); setUpi("");
      setShowPayoutConfirm(false);
      setPayoutRequest(null);
    }
    setPL(false);
  };

  const handleCancelPayout = async () => {
    if (!user || !pendingPayout?.id || cancelLoading) return;
    const ok = window.confirm("Cancel this payout request and refund the coins back to your wallet?");
    if (!ok) return;

    setCancelLoading(true);
    const res = await cancelPayoutRequest(user.uid, pendingPayout.id);
    if (res.success) {
      setPayoutMsg({ type: "success", text: "Payout request cancelled and coins refunded to your balance." });
      queryClient.setQueryData<number>(queryKeys.coinBalance(user.uid), balance + (pendingPayout.coinsRedeemed || 0));
      queryClient.invalidateQueries({ queryKey: queryKeys.coinBalance(user.uid) }).catch((error: unknown) => {
        captureError(error, { operation: "wallet.invalidate_balance_after_cancel", uid: user.uid });
      });
      setPendingPayout(null);
    } else {
      setPayoutMsg({ type: "error", text: res.reason ?? "Failed to cancel payout request." });
    }
    setCancelLoading(false);
  };

  const copyCode = () => {
    if (!myCode) return;
    navigator.clipboard
      .writeText(myCode)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch((error: unknown) => {
        captureError(error, { operation: "wallet.copy_referral_code" });
      });
  };

  const TABS: { key: Tab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "buy",      label: "Buy" },
    { key: "earn",     label: "Earn" },
    ...(isPro ? [{ key: "payout" as Tab, label: "Cash Out" }] : []),
    ...(isPro ? [{ key: "subscription" as Tab, label: "Subscriptions" }] : []),
    { key: "history",  label: "History" },
    { key: "terms",    label: "NC Terms" },
  ];

  const Msg = ({ m }: { m: { type: "success" | "error"; text: string } | null }) =>
    m ? <div style={{ background: m.type === "success" ? "rgba(22,163,74,0.1)" : "rgba(220,38,38,0.1)", border: `1px solid ${m.type === "success" ? "rgba(22,163,74,0.3)" : "rgba(220,38,38,0.3)"}`, color: m.type === "success" ? "#16a34a" : "#dc2626", borderRadius: 10, padding: "12px 16px", marginBottom: 16, fontSize: "0.88rem" }}>{m.text}</div> : null;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">💰 NeighbourCoins Wallet</h1>
          <p className="page-subtitle">1 NC = ₹1 · Spend within platform · Pros cash out anytime</p>
        </div>
        <div style={{ background: "linear-gradient(135deg,#1B6B8A,#0F4E68)", borderRadius: 16, padding: "16px 28px", textAlign: "center", color: "#fff" }}>
          <div style={{ fontSize: "0.75rem", opacity: 0.8, textTransform: "uppercase", letterSpacing: 1 }}>Balance</div>
          <div style={{ fontFamily: "'Syne',sans-serif", fontSize: "2rem", fontWeight: 800, lineHeight: 1.1, marginBottom: 8 }}>{balance.toLocaleString("en-IN")}</div>
          <div style={{ fontSize: "0.8rem", opacity: 0.75, marginBottom: 12 }}>NeighbourCoins</div>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", fontSize: "0.75rem", opacity: 0.85 }}>
            <div>💳 Cashable: {cashableBalance.toLocaleString("en-IN")} NC</div>
            <div>•</div>
            <div>🎁 Bonus: {promoBalance.toLocaleString("en-IN")} NC</div>
          </div>
        </div>
      </div>

      <div className="tabs" style={{ marginBottom: 28 }}>
        {TABS.map(({ key, label }) => (
          <button key={key} className={`tab${tab === key ? " active" : ""}`} onClick={() => setTab(key)}>{label}</button>
        ))}
      </div>

      {/* ── OVERVIEW ── */}
      {tab === "overview" && (
        <div>
          <div className="grid grid-3" style={{ marginBottom: 28 }}>
            {[
              {
                icon: "🪙",
                bg: "rgba(27,107,138,0.1)",
                color: "#1B6B8A",
                value: balance.toLocaleString("en-IN"),
                title: "Current Balance (NC)",
                detail: "",
              },
              {
                icon: "🧾",
                bg: "rgba(22,163,74,0.1)",
                color: "#16a34a",
                value: latestLedgerEntry
                  ? `${ledgerSign(latestLedgerEntry.amount)} NC`
                  : "No transactions",
                title: "Last NC transaction",
                detail: latestLedgerEntry
                  ? `${latestLedgerEntry.description} · ${formatTimestamp(latestLedgerEntry.createdAt)}`
                  : "No transaction yet",
              },
              {
                icon: "🎯",
                bg: "rgba(245,105,44,0.1)",
                color: "#F5692C",
                value: hasPhone ? (myCode || "—") : "Pending",
                title: "Your Referral Code",
                detail: "",
              },
            ].map(({ icon, bg, color, value, title, detail }) => (
              <div key={title} className="stat-card">
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div className="stat-icon" style={{ background: bg, color, marginBottom: 0 }}>{icon}</div>
                  <div className="stat-label" style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>{title}</div>
                </div>
                <div className="stat-value">{value}</div>
                <div className="stat-label">{detail}</div>
              </div>
            ))}
          </div>
          {/* NC Breakdown - now integrated into balance card above */}

          <div className="card" style={{ marginBottom: 20 }}>
            <h3 className="card-title" style={{ marginBottom: 16 }}>How NeighbourCoins Work</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
              {[["💳","Buy","Purchase NC packs via UPI or card. ₹500 gets 575 NC."],["⚡","Spend","All bookings paid in NC. Instant checkout."],["🏆","Earn","Reviews, referrals, profile completion & milestones."]].map(([icon, title, desc]) => (
                <div key={title} style={{ background: "var(--surface-2)", borderRadius: 12, padding: 18 }}>
                  <div style={{ fontSize: "1.6rem", marginBottom: 10 }}>{icon}</div>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>{title}</div>
                  <div style={{ fontSize: "0.84rem", color: "var(--muted)", lineHeight: 1.6 }}>{desc}</div>
                </div>
              ))}
            </div>
          </div>
          {isPro && (
            <div className="card" style={{ marginBottom: 20 }}>
              <h3 className="card-title" style={{ marginBottom: 16 }}>📋 Business Subscription</h3>
              {userProfile?.subscription?.status ? (() => {
                const sub = userProfile.subscription!;
                const periodEndSeconds = sub.currentPeriodEnd && typeof (sub.currentPeriodEnd as unknown as { seconds?: number }).seconds === "number"
                  ? (sub.currentPeriodEnd as unknown as { seconds: number }).seconds
                  : null;
                const isExpired = periodEndSeconds !== null && periodEndSeconds * 1000 <= Date.now();
                const statusLabel =
                  sub.status === "active"   ? "✅ Active" :
                  sub.status === "trial"    ? "🆓 Trial" :
                  sub.status === "trial_ending" ? "🆓 Trial Ending" :
                  sub.status === "renewing" ? "🔄 Renewing" :
                  sub.status === "past_due" ? "⚠️ Payment Due" :
                  sub.status === "grace"    ? "⏳ Grace Period" :
                  sub.status === "expired" || isExpired ? "❌ Expired" :
                  sub.status === "cancelled" ? "🚫 Cancelled" :
                  sub.status === "comped"   ? "🎁 Complimentary" :
                  sub.status === "paused"   ? "⏸ Paused" : "— Unknown";
                const renewalText = periodEndSeconds
                  ? (isExpired
                      ? `Expired ${new Date(periodEndSeconds * 1000).toLocaleDateString("en-IN")}`
                      : `Renews ${new Date(periodEndSeconds * 1000).toLocaleDateString("en-IN")}`)
                  : "No renewal date";
                return (
                  <>
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>{statusLabel}</div>
                      <div style={{ fontSize: "0.85rem", color: "var(--muted)" }}>{renewalText}</div>
                    </div>
                    <div style={{ fontSize: "0.82rem", color: "var(--muted)", lineHeight: 1.6 }}>
                      Business category listings require an active subscription. Manage your plan, payment method, and invoices.
                    </div>
                  </>
                );
              })() : (
                <>
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontWeight: 600, marginBottom: 4, color: "var(--muted)" }}>⬜ Not subscribed</div>
                    <div style={{ fontSize: "0.85rem", color: "var(--muted)" }}>Required to list Business category services</div>
                  </div>
                  <div style={{ fontSize: "0.82rem", color: "var(--muted)", lineHeight: 1.6 }}>
                    Activate a Business subscription to list services in categories like Tuition, Yoga, Music, Language Classes, and Nutrition.
                  </div>
                </>
              )}
            </div>
          )}
          <div className="grid grid-2">
            <button
              className="btn btn-primary btn-lg"
              onClick={() => topupsEnabled ? setTab("buy") : null}
              style={{ justifyContent: "center" }}
              disabled={!topupsEnabled}
              title={topupsEnabled ? "" : "Top-ups unavailable on Spark plan"}
            >
              + Buy Coins
            </button>
            <button className="btn btn-secondary btn-lg" onClick={() => setTab("earn")} style={{ justifyContent: "center" }}>🎯 Earn & Refer</button>
          </div>
        </div>
      )}

      {/* ── BUY ── */}
      {tab === "buy" && (
        <div style={{ maxWidth: 680 }}>
          <div className="card">
            <h3 className="card-title" style={{ marginBottom: 4 }}>Select a Coin Pack</h3>
            <p className="text-muted text-sm" style={{ marginBottom: 20 }}>Purchased coins never expire.</p>
            {!topupsEnabled && (
              <div className="error-box" style={{ marginBottom: 16 }}>
                Top-ups are disabled on Firebase Spark plan. Secure Razorpay payments require Blaze-backed Cloud Functions and webhook verification.
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
              {COIN_PACKS.map((pack, i) => (
                <div key={pack.label} onClick={() => !isBusy && topupsEnabled && setSP(i)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderRadius: 12, position: "relative", cursor: isBusy || !topupsEnabled ? "not-allowed" : "pointer", opacity: isBusy || !topupsEnabled ? 0.6 : 1, border: selectedPack === i ? "2px solid #1B6B8A" : "2px solid var(--border)", background: selectedPack === i ? "rgba(27,107,138,0.05)" : "var(--surface)", transition: "all 0.15s" }}>
                  {pack.popular && <span style={{ position: "absolute", top: -10, left: 16, background: "linear-gradient(135deg,#F5692C,#E8450A)", color: "#fff", fontSize: "0.7rem", fontWeight: 700, padding: "2px 10px", borderRadius: 50 }}>MOST POPULAR</span>}
                  <div>
                    <div style={{ fontWeight: 700 }}>{pack.label} Pack</div>
                    <div style={{ fontSize: "0.82rem", color: "var(--muted)" }}>{pack.coins.toLocaleString("en-IN")} NC{pack.bonus > 0 && <span style={{ color: "#16a34a", fontWeight: 600 }}> + {pack.bonus} bonus</span>}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 800, fontSize: "1.1rem" }}>₹{pack.priceRs}</div>
                    <div style={{ fontSize: "0.78rem", color: "var(--muted)" }}>= {(pack.coins + pack.bonus).toLocaleString("en-IN")} NC</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ background: "var(--surface-2)", borderRadius: 12, padding: "14px 18px", marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><span className="text-muted">You pay</span><span style={{ fontWeight: 700 }}>₹{COIN_PACKS[selectedPack].priceRs}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><span className="text-muted">Base coins</span><span>{COIN_PACKS[selectedPack].coins.toLocaleString("en-IN")} NC</span></div>
              {COIN_PACKS[selectedPack].bonus > 0 && <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><span style={{ color: "#16a34a" }}>Bonus 🎁</span><span style={{ color: "#16a34a", fontWeight: 600 }}>+{COIN_PACKS[selectedPack].bonus} NC</span></div>}
              <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 10, borderTop: "1px solid var(--border)", fontWeight: 700, fontSize: "1.05rem" }}><span>Total NC credited</span><span style={{ color: "#1B6B8A" }}>{(COIN_PACKS[selectedPack].coins + COIN_PACKS[selectedPack].bonus).toLocaleString("en-IN")} NC</span></div>
            </div>
            {payStatus !== "idle" && STATUS_UI[payStatus] && <div style={{ background: "var(--surface-2)", borderRadius: 10, padding: "12px 18px", marginBottom: 16, fontSize: "0.9rem", fontWeight: 500, textAlign: "center", color: STATUS_UI[payStatus]!.color }}>{STATUS_UI[payStatus]!.text}</div>}
            {payError && <div className="error-box" style={{ marginBottom: 16 }}>{payError}</div>}
            <button className="btn btn-primary btn-lg" style={{ width: "100%", justifyContent: "center", background: "linear-gradient(135deg,#F5692C,#E8450A)" }} onClick={handleBuy} disabled={!topupsEnabled || isBusy || payStatus === "success"}>
              {isBusy ? "Processing…" : payStatus === "success" ? "✅ Coins added!" : `Pay ₹${COIN_PACKS[selectedPack].priceRs} via UPI / Card`}
            </button>
            <p style={{ fontSize: "0.76rem", color: "var(--muted)", textAlign: "center", marginTop: 10 }}>🔒 Secured by Razorpay · No auto-renewal</p>
          </div>
        </div>
      )}

      {/* ── EARN ── */}
      {tab === "earn" && (
        <div style={{ maxWidth: 680 }}>
          {/* Your Referral Code Card - shown first */}
          <div className="card" style={{ marginBottom: 20 }}>
            <h3 className="card-title" style={{ marginBottom: 4 }}>Your Referral Code</h3>
            <p className="text-muted text-sm" style={{ marginBottom: 20 }}>Share with neighbours. They get {EARN_RULES.earn_referral.coins} NC when they sign up with your code or referral link.</p>
            <div style={{ display: "flex", gap: 10, alignItems: "center", background: "var(--surface-2)", borderRadius: 12, padding: "16px 20px", marginBottom: 16 }}>
              <div style={{ flex: 1, fontFamily: "monospace", fontSize: hasPhone ? "1.4rem" : "0.95rem", fontWeight: 800, letterSpacing: hasPhone ? 2 : 0, color: hasPhone ? "#1B6B8A" : "var(--muted)" }}>
                {hasPhone ? (myCode || "—") : "Update mobile number to enable referral program."}
              </div>
              {hasPhone && myCode && <button className="btn btn-secondary btn-sm" onClick={copyCode}>{copied ? "✓ Copied!" : "Copy"}</button>}
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {hasPhone && myCode ? (
                <>
                  <a 
                    href={`https://wa.me/?text=${encodeURIComponent(`Join ProNeighbor — your society's expert network! Use my referral code *${myCode}* and get ${EARN_RULES.earn_referral.coins} NeighbourCoins instantly 🎉 ${referralLink}`)}`}
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="btn btn-secondary btn-sm"
                    style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#25D366", color: "#fff", border: "none" }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.72.937 3.659 1.435 5.621 1.435h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
                    Share
                  </a>
                  <button className="btn btn-secondary btn-sm" onClick={() => { navigator.share?.({ title: "ProNeighbor Referral", text: `Join with my code ${myCode}`, url: referralLink }); }}>↗ Share</button>
                </>
              ) : (
                <button className="btn btn-primary btn-sm" onClick={() => navigate("/profile")}>Update Profile</button>
              )}
            </div>
          </div>

          {/* Ways to Earn Card */}
          <div className="card">
            <h3 className="card-title" style={{ marginBottom: 4 }}>Ways to Earn NeighbourCoins</h3>
            <p className="text-muted text-sm" style={{ marginBottom: 24 }}>Earned coins capped at 20% of monthly transaction value.</p>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {(Object.entries(EARN_RULES) as [string, { coins: number; label: string }][]).filter(([, r]) => r.coins > 0).map(([type, rule], i, arr) => {
                const isComingSoon = type === "earn_groupsession" || type === "earn_ondemand";
                return (
                <div key={type} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 4px", borderBottom: i < arr.length - 1 ? "1px solid var(--border)" : "none", opacity: isComingSoon ? 0.75 : 1 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "0.92rem", display: "flex", alignItems: "center", gap: 8 }}>
                      {rule.label}
                      {isComingSoon && <span className="badge badge-muted" style={{ fontSize: "0.65rem" }}>Coming Soon</span>}
                    </div>
                    <div style={{ fontSize: "0.78rem", color: "var(--muted)", marginTop: 2 }}>
                      {type === "earn_signup_bonus" && "Credited automatically on first login"}
                      {type === "earn_profile"      && "Complete all profile fields"}
                      {type === "earn_review"       && "Write a review after a completed booking"}
                      {type === "earn_referral"     && `Apply a valid referral code to get +${rule.coins} NC instantly`}
                      {type === "earn_free_consult" && "Pro who marks session as free"}
                      {type === "earn_groupsession" && "Per group session attended (Phase 2, not yet active)"}
                      {type === "earn_ondemand"     && "Pro who fulfils urgent request (Phase 2, not yet active)"}
                      {type === "earn_milestone"    && "Society reaches 50 active users — everyone rewarded"}
                    </div>
                  </div>
                  <div style={{ background: isComingSoon ? "var(--surface-2)" : "rgba(22,163,74,0.1)", color: isComingSoon ? "var(--muted)" : "#16a34a", border: isComingSoon ? "1px solid var(--border)" : "1px solid rgba(22,163,74,0.2)", borderRadius: 50, padding: "4px 14px", fontWeight: 700, fontSize: "0.88rem", whiteSpace: "nowrap", flexShrink: 0 }}>+{rule.coins} NC</div>
                </div>
              )})}
            </div>
          </div>
        </div>
      )}



      {/* ── PAYOUT ── */}
      {tab === "payout" && isPro && (
        <div style={{ maxWidth: 500 }}>
          <div className="card">
            <h3 className="card-title" style={{ marginBottom: 4 }}>Cash Out Your Earnings</h3>
            <p className="text-muted text-sm" style={{ marginBottom: 20 }}>Min {MIN_PAYOUT_COINS} NC · Processed within 48 hrs via UPI</p>
            {pendingPayout && (
              <div style={{
                background: "rgba(27,107,138,0.08)",
                border: "1px solid rgba(27,107,138,0.25)",
                borderRadius: 10,
                padding: "12px 14px",
                marginBottom: 16,
              }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>Pending payout request</div>
                <div style={{ fontSize: "0.85rem", color: "var(--muted)", marginBottom: 10 }}>
                  ₹{(pendingPayout.amountRs || 0).toLocaleString("en-IN")} ({pendingPayout.coinsRedeemed || 0} NC) to {pendingPayout.upiMasked || maskUpiId(pendingPayout.upiId || "")}
                </div>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={handleCancelPayout}
                  disabled={cancelLoading}
                >
                  {cancelLoading ? "Cancelling..." : "Cancel Payout Request"}
                </button>
              </div>
            )}
            <div style={{ background: "var(--surface-2)", borderRadius: 10, padding: "12px 16px", marginBottom: 12 }}>
              <div style={{ fontSize: "0.8rem", color: "var(--muted)", marginBottom: 4 }}>Available to withdraw (cashable NC only)</div>
              <div style={{ fontWeight: 800, fontSize: "1.4rem", color: "#16a34a" }}>{formatNC(cashableBalance)} = ₹{cashableBalance.toLocaleString("en-IN")}</div>
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 100px", background: "rgba(27,107,138,0.06)", borderRadius: 8, padding: "8px 12px", border: "1px solid rgba(27,107,138,0.15)" }}>
                <div style={{ fontSize: 10, color: "#1B6B8A", fontWeight: 600 }}>Total NC</div>
                <div style={{ fontWeight: 700, fontSize: 13, color: "#1B6B8A" }}>{balance.toLocaleString("en-IN")} NC</div>
              </div>
              <div style={{ flex: "1 1 100px", background: "rgba(22,163,74,0.06)", borderRadius: 8, padding: "8px 12px", border: "1px solid rgba(22,163,74,0.15)" }}>
                <div style={{ fontSize: 10, color: "#16a34a", fontWeight: 600 }}>💳 Cashable</div>
                <div style={{ fontWeight: 700, fontSize: 13, color: "#16a34a" }}>{cashableBalance.toLocaleString("en-IN")} NC</div>
              </div>
              <div style={{ flex: "1 1 100px", background: "rgba(245,158,11,0.06)", borderRadius: 8, padding: "8px 12px", border: "1px solid rgba(245,158,11,0.15)" }}>
                <div style={{ fontSize: 10, color: "#b45309", fontWeight: 600 }}>🎁 Bonus (non-withdrawable)</div>
                <div style={{ fontWeight: 700, fontSize: 13, color: "#b45309" }}>{promoBalance.toLocaleString("en-IN")} NC</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
              <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                <label className="form-label">Amount (NC)</label>
                <input className="form-input" type="number" placeholder={`Min ${MIN_PAYOUT_COINS}`} value={payoutCoins} onChange={e => setPC(e.target.value)} min={MIN_PAYOUT_COINS} max={cashableBalance} />
                {payoutCoins && !isNaN(parseInt(payoutCoins)) && <div className="form-hint">You'll receive ₹{parseInt(payoutCoins).toLocaleString("en-IN")} via UPI</div>}
              </div>
              <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                <label className="form-label">UPI ID</label>
                <input className="form-input" type="text" placeholder="yourname@upi" value={upiId} onChange={e => setUpi(e.target.value)} />
                <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, fontSize: "0.8rem", color: "var(--muted)" }}>
                  <input type="checkbox" checked={saveUpi} onChange={e => setSaveUpi(e.target.checked)} />
                  Save this UPI ID for future payouts
                </label>
              </div>
            </div>
            <Msg m={payoutMsg} />
            <button className="btn btn-primary btn-lg" style={{ width: "100%", justifyContent: "center" }} onClick={handlePayout} disabled={payoutLoading || !!pendingPayout || cashableBalance < MIN_PAYOUT_COINS}>
              {payoutLoading ? "Submitting…" : "Request Payout"}
            </button>
            {cashableBalance < MIN_PAYOUT_COINS && <p style={{ fontSize: "0.8rem", color: "var(--muted)", textAlign: "center", marginTop: 8 }}>Minimum {MIN_PAYOUT_COINS} cashable NC required. Bonus NC cannot be withdrawn.</p>}
          </div>
        </div>
      )}

      {showPayoutConfirm && payoutRequest && (
        <div className="modal-overlay" onClick={() => setShowPayoutConfirm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Confirm Payout Request</h3>
              <button className="modal-close" onClick={() => setShowPayoutConfirm(false)}>✕</button>
            </div>
            <div style={{ marginBottom: 14, color: "var(--muted)" }}>
              Please review and confirm these details before submitting:
            </div>
            <div style={{ background: "var(--surface-2)", borderRadius: 10, padding: "12px 14px", marginBottom: 16 }}>
              <div style={{ marginBottom: 6 }}><strong>Amount:</strong> {payoutRequest.coins} NC (₹{payoutRequest.coins.toLocaleString("en-IN")})</div>
              <div><strong>UPI ID:</strong> {payoutRequest.upiId}</div>
            </div>
            <div className="modal-actions" style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
              <button className="btn btn-secondary" onClick={() => setShowPayoutConfirm(false)} disabled={payoutLoading}>
                Edit Details
              </button>
              <button className="btn btn-primary" onClick={submitPayoutRequest} disabled={payoutLoading}>
                {payoutLoading ? "Submitting..." : "Confirm Request"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── HISTORY ── */}
      {tab === "history" && (
        <div className="card">
          {ledgerLoading ? (
            <div style={{ textAlign: "center", padding: 60 }}><div className="loader" style={{ margin: "0 auto" }} /></div>
          ) : ledger.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📋</div>
              <div className="empty-state-title">No transactions yet</div>
              <div className="empty-state-desc">Your coin activity will appear here once you make your first booking or purchase.</div>
              <button className="btn btn-primary btn-sm" onClick={() => topupsEnabled ? setTab("buy") : null} style={{ marginTop: 12 }} disabled={!topupsEnabled}>Buy Coins to Get Started</button>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Date</th><th>Description</th><th>Type</th><th style={{ textAlign: "right" }}>Amount</th><th style={{ textAlign: "right" }}>Balance After</th></tr></thead>
                <tbody>
                  {ledger.map(entry => (
                    <tr key={entry.id}>
                      <td style={{ color: "var(--muted)", fontSize: 13 }}>{formatTimestamp(entry.createdAt)}</td>
                      <td style={{ fontWeight: 500 }}>{entry.description}</td>
                      <td><span className="badge badge-muted" style={{ fontSize: "0.72rem" }}>{entry.type.replace(/_/g, " ")}</span></td>
                      <td style={{ textAlign: "right", fontWeight: 700, color: ledgerColor(entry.type) }}>{ledgerSign(entry.amount)} NC</td>
                      <td style={{ textAlign: "right", color: "var(--muted)", fontSize: 13 }}>{(entry.balanceAfter || 0).toLocaleString("en-IN")} NC</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "subscription" && (
        <div style={{ maxWidth: 640 }}>
          <div className="card" style={{ marginBottom: 20 }}>
            <h3 className="card-title" style={{ marginBottom: 16 }}>💳 Business Subscription</h3>
            {(() => {
              const subRaw = userProfile?.subscription as Record<string, unknown> | undefined;
              const status = subRaw?.status as string | undefined;
              const plan = subRaw?.plan as string | undefined;
              const endTs = subRaw?.currentPeriodEnd as { seconds?: number } | undefined;
              const endDate = endTs?.seconds ? new Date(endTs.seconds * 1000) : null;
              const daysLeft = endDate ? Math.ceil((endDate.getTime() - Date.now()) / 86_400_000) : 0;

              const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
                trial:         { bg: "#dcfce7", color: "#16a34a" },
                trial_ending:  { bg: "#fef9c3", color: "#b45309" },
                active:        { bg: "#dcfce7", color: "#16a34a" },
                renewing:      { bg: "#dbeafe", color: "#1d4ed8" },
                past_due:      { bg: "#fef3c7", color: "#d97706" },
                grace:         { bg: "#fee2e2", color: "#dc2626" },
                expired:       { bg: "#f1f5f9", color: "#64748b" },
                cancelled:     { bg: "#f1f5f9", color: "#64748b" },
                comped:        { bg: "#f3e8ff", color: "#7c3aed" },
                paused:        { bg: "#fee2e2", color: "#dc2626" },
              };
              const PLAN_LABELS: Record<string, string> = {
                business_trial_v1: "Free Trial",
                business_3m_v1:    "3-Month Plan",
                business_6m_v1:    "6-Month Plan",
                business_12m_v1:   "12-Month Plan",
              };
              const chip = STATUS_COLORS[status ?? ""] ?? { bg: "#f1f5f9", color: "#64748b" };

              if (!status || status === "expired" || status === "cancelled") {
                return (
                  <>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                      <div>
                        <div style={{ fontWeight: 600, color: "var(--muted)" }}>⬜ No active subscription</div>
                        <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>First 30 days free for all Business listings</div>
                      </div>
                      <button className="btn btn-primary btn-sm" onClick={() => navigate("/profile/subscription")}>Activate</button>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>Plans: 999 NC / 3mo · 1799 NC / 6mo · 2299 NC / 12mo</div>
                  </>
                );
              }
              return (
                <>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700, background: chip.bg, color: chip.color }}>
                          {status.replace("_", " ").replace(/\b\w/g, c => c.toUpperCase())}
                        </span>
                        {plan && PLAN_LABELS[plan] && (
                          <span style={{ fontSize: 13, color: "var(--muted)" }}>{PLAN_LABELS[plan]}</span>
                        )}
                      </div>
                      {endDate && (
                        <div style={{ fontSize: 13, color: "var(--muted)" }}>
                          {daysLeft > 0 ? `${daysLeft} days remaining` : "Expired"} · Ends {endDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        </div>
                      )}
                    </div>
                    <button className="btn btn-secondary btn-sm" onClick={() => navigate("/profile/subscription")}>Manage</button>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--muted)", borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                    Subscription payments are debited from your cashable NC balance. Top up wallet to renew.
                  </div>
                </>
              );
            })()}
          </div>

          <div className="card">
            <h3 className="card-title" style={{ marginBottom: 4 }}>📋 Subscription Plans</h3>
            <p className="text-muted text-sm" style={{ marginBottom: 16 }}>NC-only payment. First 30 days free for all new Business listing pros.</p>
            {[
              { label: "3 Months",  price: "999 NC",  perMonth: "333 NC/mo",  badge: null },
              { label: "6 Months",  price: "1799 NC", perMonth: "300 NC/mo",  badge: "✨ Best value" },
              { label: "12 Months", price: "2299 NC", perMonth: "192 NC/mo",  badge: null },
            ].map(p => (
              <div key={p.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid var(--border)" }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{p.label}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>{p.perMonth}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {p.badge && <span style={{ fontSize: 11, fontWeight: 600, color: "#b45309", background: "#fef9c3", padding: "2px 8px", borderRadius: 10 }}>{p.badge}</span>}
                  <span style={{ fontWeight: 700, color: "var(--text)" }}>{p.price}</span>
                </div>
              </div>
            ))}
            <button className="btn btn-primary" style={{ marginTop: 16, width: "100%" }} onClick={() => navigate("/subscription")}>
              Manage Subscription
            </button>
          </div>
        </div>
      )}

      {/* ── NC TERMS ── */}
      {tab === "terms" && (
        <div style={{ maxWidth: 640 }}>
          <div className="card">
            <h3 className="card-title" style={{ marginBottom: 4 }}>NeighbourCoins Terms & Policies</h3>
            <p className="text-muted text-sm" style={{ marginBottom: 24 }}>Last updated by admin. Subject to change with 7-day notice.</p>
            {ncTerms ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {[
                  ["⏳", "Expiry", ncTerms.expiryDays ? `Purchased NC expire ${ncTerms.expiryDays} days after purchase.` : "Purchased NC never expire. Earn NC expires after 12 months of account inactivity."],
                  ["💸", "Refund Policy", ncTerms.refundPolicy],
                  ["📈", "Earn Cap", ncTerms.earnCap],
                  ["💰", "Minimum Cash Out", `₹${ncTerms.minPayout} (${ncTerms.minPayout} NC) minimum payout per request.`],
                  ["🏦", "Platform Fee", `${ncTerms.platformFeePct}% deducted from pro earnings on booking completion.`],
                  ["🔄", "1:1 Parity", "1 NC is always equal to ₹1 for both purchase and payout. No conversion spread."],
                  ["🚫", "Non-transferable", "NC cannot be transferred between users. NC is non-redeemable for cash by residents (only pros can cash out earned NC)."],
                ].map(([icon, title, desc]) => (
                  <div key={title} style={{ display: "flex", gap: 16, padding: "16px 0", borderBottom: "1px solid var(--border)" }}>
                    <div style={{ fontSize: "1.4rem", flexShrink: 0, marginTop: 2 }}>{icon}</div>
                    <div>
                      <div style={{ fontWeight: 700, marginBottom: 4 }}>{title}</div>
                      <div style={{ fontSize: "0.88rem", color: "var(--muted)", lineHeight: 1.6 }}>{desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : <div style={{ textAlign: "center", padding: 40 }}><div className="loader" style={{ margin: "0 auto" }} /></div>}
          </div>
        </div>
      )}
    </div>
  );
}
