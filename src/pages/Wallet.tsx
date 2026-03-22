import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import {
  COIN_PACKS, EARN_RULES, MIN_PAYOUT_COINS, getLedger, requestPayout,
  formatNC, ledgerColor, ledgerSign, getNCTerms, applyReferralCode,
  type LedgerEntry, type NCTerms,
} from "../services/coinService";
import { initiateTopUp, type PaymentStatus } from "../services/razorpayService";
import { formatTimestamp } from "../services/firestoreService";

type Tab = "overview" | "buy" | "earn" | "referral" | "payout" | "history" | "terms";

const STATUS_UI: Partial<Record<PaymentStatus, { text: string; color: string }>> = {
  awaiting_payment: { text: "⏳ Complete payment in the Razorpay popup…", color: "#1B6B8A" },
  crediting:        { text: "⏳ Crediting coins…",                         color: "#1B6B8A" },
  success:          { text: "✅ Payment successful! Coins added.",          color: "#16a34a" },
  failed:           { text: "❌ Payment failed. Try again.",                color: "#dc2626" },
  dismissed:        { text: "Payment cancelled.",                           color: "var(--muted)" },
};

export default function Wallet() {
  const { user, userProfile } = useAuth();
  const [tab, setTab]             = useState<Tab>("overview");
  const [ledger, setLedger]       = useState<LedgerEntry[]>([]);
  const [ledgerLoading, setLL]    = useState(false);
  const [selectedPack, setSP]     = useState(2);
  const [payStatus, setPayStatus] = useState<PaymentStatus>("idle");
  const [payError, setPayError]   = useState("");
  const [payoutCoins, setPC]      = useState("");
  const [upiId, setUpi]           = useState("");
  const [payoutLoading, setPL]    = useState(false);
  const [payoutMsg, setPayoutMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [ncTerms, setNcTerms]     = useState<NCTerms | null>(null);
  const [refCode, setRefCode]     = useState("");
  const [refMsg, setRefMsg]       = useState<{ type: "success"|"error"; text: string }|null>(null);
  const [refLoading, setRefLoading] = useState(false);
  const [copied, setCopied]       = useState(false);

  const balance = userProfile?.coinBalance ?? 0;
  const isPro   = userProfile?.isServiceProvider;
  const isBusy  = payStatus === "awaiting_payment" || payStatus === "crediting";
  const myCode  = userProfile?.referralCode ?? "—";

  useEffect(() => {
    if (payStatus !== "success") return;
    const t = setTimeout(() => { setPayStatus("idle"); setTab("overview"); }, 3000);
    return () => clearTimeout(t);
  }, [payStatus]);

  useEffect(() => {
    if (tab !== "history" || !user) return;
    setLL(true);
    getLedger(user.uid).then(r => { setLedger(r); setLL(false); });
  }, [tab, user]);

  useEffect(() => {
    if (tab !== "terms") return;
    getNCTerms().then(setNcTerms);
  }, [tab]);

  const handleBuy = async () => {
    if (!user || !userProfile || isBusy) return;
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
    const coins = parseInt(payoutCoins);
    if (!coins || isNaN(coins))  { setPayoutMsg({ type: "error", text: "Enter a valid amount." }); return; }
    if (!upiId.includes("@"))    { setPayoutMsg({ type: "error", text: "Enter a valid UPI ID." }); return; }
    setPL(true);
    const res = await requestPayout(user.uid, userProfile.displayName, coins, upiId);
    setPayoutMsg(res.success
      ? { type: "success", text: `Payout of ₹${coins} requested! Processed within 48 hrs.` }
      : { type: "error",   text: res.reason ?? "Failed. Try again." });
    setPL(false);
    if (res.success) { setPC(""); setUpi(""); }
  };

  const handleApplyReferral = async () => {
    if (!user || !refCode.trim()) return;
    setRefLoading(true);
    const res = await applyReferralCode(user.uid, refCode.trim());
    setRefMsg(res.success
      ? { type: "success", text: "Referral applied! You'll both earn 100 NC on your first completed booking." }
      : { type: "error", text: res.reason ?? "Failed." });
    setRefLoading(false);
    if (res.success) setRefCode("");
  };

  const copyCode = () => {
    navigator.clipboard.writeText(myCode).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  const TABS: { key: Tab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "buy",      label: "Buy" },
    { key: "earn",     label: "Earn" },
    { key: "referral", label: "Refer & Earn" },
    ...(isPro ? [{ key: "payout" as Tab, label: "Cash Out" }] : []),
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
          <div style={{ fontFamily: "'Syne',sans-serif", fontSize: "2rem", fontWeight: 800, lineHeight: 1.1 }}>{balance.toLocaleString("en-IN")}</div>
          <div style={{ fontSize: "0.8rem", opacity: 0.75 }}>NeighbourCoins</div>
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
              { icon: "🪙", bg: "rgba(27,107,138,0.1)", color: "#1B6B8A", value: balance.toLocaleString("en-IN"), label: "Current Balance (NC)" },
              { icon: "📈", bg: "rgba(22,163,74,0.1)",  color: "#16a34a", value: `₹${balance.toLocaleString("en-IN")}`, label: "Equivalent Value" },
              { icon: "🎯", bg: "rgba(245,105,44,0.1)", color: "#F5692C", value: myCode, label: "Your Referral Code" },
            ].map(({ icon, bg, color, value, label }) => (
              <div key={label} className="stat-card">
                <div className="stat-icon" style={{ background: bg, color }}>{icon}</div>
                <div className="stat-value">{value}</div>
                <div className="stat-label">{label}</div>
              </div>
            ))}
          </div>
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
          <div className="grid grid-2">
            <button className="btn btn-primary btn-lg" onClick={() => setTab("buy")} style={{ justifyContent: "center" }}>+ Buy Coins</button>
            <button className="btn btn-secondary btn-lg" onClick={() => setTab("referral")} style={{ justifyContent: "center" }}>🎯 Refer & Earn</button>
          </div>
        </div>
      )}

      {/* ── BUY ── */}
      {tab === "buy" && (
        <div style={{ maxWidth: 680 }}>
          <div className="card">
            <h3 className="card-title" style={{ marginBottom: 4 }}>Select a Coin Pack</h3>
            <p className="text-muted text-sm" style={{ marginBottom: 20 }}>Purchased coins never expire.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
              {COIN_PACKS.map((pack, i) => (
                <div key={pack.label} onClick={() => !isBusy && setSP(i)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderRadius: 12, position: "relative", cursor: isBusy ? "not-allowed" : "pointer", opacity: isBusy ? 0.6 : 1, border: selectedPack === i ? "2px solid #1B6B8A" : "2px solid var(--border)", background: selectedPack === i ? "rgba(27,107,138,0.05)" : "var(--surface)", transition: "all 0.15s" }}>
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
            <button className="btn btn-primary btn-lg" style={{ width: "100%", justifyContent: "center", background: "linear-gradient(135deg,#F5692C,#E8450A)" }} onClick={handleBuy} disabled={isBusy || payStatus === "success"}>
              {isBusy ? "Processing…" : payStatus === "success" ? "✅ Coins added!" : `Pay ₹${COIN_PACKS[selectedPack].priceRs} via UPI / Card`}
            </button>
            <p style={{ fontSize: "0.76rem", color: "var(--muted)", textAlign: "center", marginTop: 10 }}>🔒 Secured by Razorpay · No auto-renewal</p>
          </div>
        </div>
      )}

      {/* ── EARN ── */}
      {tab === "earn" && (
        <div style={{ maxWidth: 680 }}>
          <div className="card">
            <h3 className="card-title" style={{ marginBottom: 4 }}>Ways to Earn NeighbourCoins</h3>
            <p className="text-muted text-sm" style={{ marginBottom: 24 }}>Earned coins capped at 20% of monthly transaction value.</p>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {(Object.entries(EARN_RULES) as [string, { coins: number; label: string }][]).filter(([, r]) => r.coins > 0).map(([type, rule], i, arr) => (
                <div key={type} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 4px", borderBottom: i < arr.length - 1 ? "1px solid var(--border)" : "none" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "0.92rem" }}>{rule.label}</div>
                    <div style={{ fontSize: "0.78rem", color: "var(--muted)", marginTop: 2 }}>
                      {type === "earn_signup_bonus" && "Credited automatically on first login"}
                      {type === "earn_profile"      && "Complete all profile fields"}
                      {type === "earn_review"       && "Write a review after a completed booking"}
                      {type === "earn_referral"     && "Both you and referral get 100 NC on first booking"}
                      {type === "earn_free_consult" && "Pro who marks session as free"}
                      {type === "earn_groupsession" && "Per group session attended (Phase 2)"}
                      {type === "earn_ondemand"     && "Pro who fulfils urgent request (Phase 2)"}
                      {type === "earn_milestone"    && "Society reaches 50 active users — everyone rewarded"}
                    </div>
                  </div>
                  <div style={{ background: "rgba(22,163,74,0.1)", color: "#16a34a", border: "1px solid rgba(22,163,74,0.2)", borderRadius: 50, padding: "4px 14px", fontWeight: 700, fontSize: "0.88rem", whiteSpace: "nowrap", flexShrink: 0 }}>+{rule.coins} NC</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── REFERRAL ── */}
      {tab === "referral" && (
        <div style={{ maxWidth: 560 }}>
          {/* Share your code */}
          <div className="card" style={{ marginBottom: 20 }}>
            <h3 className="card-title" style={{ marginBottom: 4 }}>Your Referral Code</h3>
            <p className="text-muted text-sm" style={{ marginBottom: 20 }}>Share with neighbours. You both earn 100 NC on their first completed booking.</p>
            <div style={{ display: "flex", gap: 10, alignItems: "center", background: "var(--surface-2)", borderRadius: 12, padding: "16px 20px", marginBottom: 16 }}>
              <div style={{ flex: 1, fontFamily: "monospace", fontSize: "1.4rem", fontWeight: 800, letterSpacing: 2, color: "#1B6B8A" }}>{myCode}</div>
              <button className="btn btn-secondary btn-sm" onClick={copyCode}>{copied ? "✓ Copied!" : "Copy"}</button>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <a href={`whatsapp://send?text=Join ProNeighbour — your society's expert network! Use my referral code *${myCode}* and we both earn 100 NeighbourCoins 🎉 https://neighbhorpro.web.app/register`} className="btn btn-secondary btn-sm">📱 Share on WhatsApp</a>
              <button className="btn btn-secondary btn-sm" onClick={() => { navigator.share?.({ title: "ProNeighbour Referral", text: `Join with my code ${myCode}`, url: "https://neighbhorpro.web.app/register" }); }}>↗ Share</button>
            </div>
          </div>
          {/* Apply a code */}
          <div className="card">
            <h3 className="card-title" style={{ marginBottom: 4 }}>Have a Referral Code?</h3>
            <p className="text-muted text-sm" style={{ marginBottom: 16 }}>Enter a friend's code — you'll both earn 100 NC on your first booking.</p>
            <Msg m={refMsg} />
            <div style={{ display: "flex", gap: 10 }}>
              <input className="form-input" placeholder="e.g. PNABC123" value={refCode} onChange={e => setRefCode(e.target.value.toUpperCase())} style={{ flex: 1, fontFamily: "monospace", letterSpacing: 1 }} />
              <button className="btn btn-primary" onClick={handleApplyReferral} disabled={refLoading || !refCode.trim()}>{refLoading ? "Applying…" : "Apply"}</button>
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
            <div style={{ background: "var(--surface-2)", borderRadius: 10, padding: "12px 16px", marginBottom: 20 }}>
              <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>Available to withdraw</div>
              <div style={{ fontWeight: 800, fontSize: "1.4rem", color: "#1B6B8A" }}>{formatNC(balance)} = ₹{balance.toLocaleString("en-IN")}</div>
            </div>
            <div className="form-group">
              <label className="form-label">Amount (NC)</label>
              <input className="form-input" type="number" placeholder={`Min ${MIN_PAYOUT_COINS}`} value={payoutCoins} onChange={e => setPC(e.target.value)} min={MIN_PAYOUT_COINS} max={balance} />
              {payoutCoins && !isNaN(parseInt(payoutCoins)) && <div className="form-hint">You'll receive ₹{parseInt(payoutCoins).toLocaleString("en-IN")} via UPI</div>}
            </div>
            <div className="form-group">
              <label className="form-label">UPI ID</label>
              <input className="form-input" type="text" placeholder="yourname@upi" value={upiId} onChange={e => setUpi(e.target.value)} />
            </div>
            <Msg m={payoutMsg} />
            <button className="btn btn-primary btn-lg" style={{ width: "100%", justifyContent: "center" }} onClick={handlePayout} disabled={payoutLoading || balance < MIN_PAYOUT_COINS}>
              {payoutLoading ? "Submitting…" : "Request Payout"}
            </button>
            {balance < MIN_PAYOUT_COINS && <p style={{ fontSize: "0.8rem", color: "var(--muted)", textAlign: "center", marginTop: 8 }}>Minimum {MIN_PAYOUT_COINS} NC required.</p>}
          </div>
        </div>
      )}

      {/* ── HISTORY ── */}
      {tab === "history" && (
        <div>
          {ledgerLoading ? (
            <div style={{ textAlign: "center", padding: 60 }}><div className="loader" style={{ margin: "0 auto" }} /></div>
          ) : ledger.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📋</div>
              <div className="empty-state-title">No transactions yet</div>
              <div className="empty-state-desc">Your coin activity will appear here once you make your first booking or purchase.</div>
              <button className="btn btn-primary btn-sm" onClick={() => setTab("buy")} style={{ marginTop: 12 }}>Buy Coins to Get Started</button>
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
                      <td style={{ textAlign: "right", color: "var(--muted)", fontSize: 13 }}>{entry.balanceAfter.toLocaleString("en-IN")} NC</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
