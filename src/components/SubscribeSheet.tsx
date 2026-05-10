import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { SUB_PLANS, getSubPlansFromConfig, subscribeWithNC, activateTrial, type PlanId, type SubPlan } from "../services/subscriptionService";

interface SubscribeSheetProps {
  uid: string;
  cashableBalance: number;
  trialUsed: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function calculatePerMonth(plans: SubPlan[]): Record<string, { label: string; savings?: string }> {
  const basePlan = plans.find(p => p.id === "business_3m_v1");
  const basePricePerMonth = basePlan ? Math.round(basePlan.priceNC / (basePlan.durationDays / 30)) : 333;

  return plans.reduce((acc, plan) => {
    const pricePerMonth = Math.round(plan.priceNC / (plan.durationDays / 30));
    const savingsAmount = basePricePerMonth * (plan.durationDays / 30) - plan.priceNC;
    acc[plan.id] = {
      label: `${pricePerMonth} NC/mo`,
      ...(savingsAmount > 0 ? { savings: `save ${Math.round(savingsAmount)} NC` } : {}),
    };
    return acc;
  }, {} as Record<string, { label: string; savings?: string }>);
}

function getErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) return "Subscription failed. Please try again.";
  if (error.message === "INSUFFICIENT_CASHABLE_BALANCE") return "Insufficient cashable balance. Please top up your wallet.";
  if (error.message === "USER_NOT_FOUND") return "Your account could not be found. Please refresh and try again.";
  if (error.message === "INVALID_PLAN") return "Invalid plan selected. Please try again.";
  if (error.message === "ACTIVE_SUB_EXISTS") return "You already have an active subscription.";
  if (error.message === "TRIAL_ALREADY_USED") return "You've already used your free trial. Choose a paid plan to continue.";
  return error.message || "Subscription failed. Please try again.";
}

export default function SubscribeSheet({ uid, cashableBalance, trialUsed, onClose, onSuccess }: SubscribeSheetProps) {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<SubPlan[]>(SUB_PLANS);
  const [selectedPlan, setSelectedPlan] = useState<SubPlan | "trial">(trialUsed ? SUB_PLANS[1] : "trial");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);

  // Load admin-configured prices on mount
  useEffect(() => {
    getSubPlansFromConfig().then(configPlans => {
      setPlans(configPlans);
      // Keep current selection index but with updated price
      if (selectedPlan !== "trial") {
        setSelectedPlan(prev => prev === "trial" ? prev : (configPlans.find(p => p.id === prev.id) ?? configPlans[1]));
      }
    }).catch(() => { /* keep defaults */ });
  }, []);

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const canAfford = selectedPlan === "trial" ? true : cashableBalance >= selectedPlan.priceNC;

  const handlePay = useCallback(async () => {
    if (!canAfford || loading) return;
    setLoading(true);
    setError(null);
    try {
      if (selectedPlan === "trial") {
        await activateTrial(uid);
      } else {
        await subscribeWithNC(uid, selectedPlan.id as PlanId);
      }
      onSuccess();
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [uid, selectedPlan, canAfford, loading, onSuccess]);

  const overlayStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    zIndex: 1000,
    background: "rgba(0,0,0,0.55)",
    display: "flex",
    alignItems: isMobile ? "flex-end" : "center",
    justifyContent: "center",
  };

  const sheetStyle: React.CSSProperties = {
    background: "var(--surface, #fff)",
    width: isMobile ? "100%" : "min(520px, 94vw)",
    maxHeight: isMobile ? "92vh" : "90vh",
    overflowY: "auto",
    borderRadius: isMobile ? "20px 20px 0 0" : "16px",
    padding: "24px 20px 32px",
    position: "relative",
    boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
  };

  return (
    <div style={overlayStyle} onClick={e => { if (e.target === e.currentTarget) onClose(); }} role="dialog" aria-modal="true" aria-label="Choose your business plan">
      <div style={sheetStyle}>
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            background: "none",
            border: "none",
            fontSize: "1.4rem",
            cursor: "pointer",
            color: "var(--muted, #6b7280)",
            lineHeight: 1,
            padding: "4px 8px",
          }}
        >
          &#x2715;
        </button>

        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <h2 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: 6 }}>
            Choose Your Business Plan
          </h2>
          <p style={{ color: "var(--muted, #6b7280)", fontSize: "0.9rem", margin: 0 }}>
            Keep your listing live and earn the Active Pro badge
          </p>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center", marginBottom: 20 }}>
          {!trialUsed && (
            <button
              onClick={() => { setSelectedPlan("trial"); setError(null); }}
              style={{
                position: "relative",
                flex: "1 1 140px",
                minWidth: 140,
                maxWidth: 200,
                background: selectedPlan === "trial" ? "var(--surface-2, #f3f4f6)" : "var(--surface, #fff)",
                border: selectedPlan === "trial" ? "2px solid var(--accent, #7c3aed)" : "2px solid var(--border, #e5e7eb)",
                borderRadius: 12,
                padding: "16px 12px 14px",
                cursor: "pointer",
                textAlign: "center",
                transform: selectedPlan === "trial" ? "scale(1.03)" : "scale(1)",
                transition: "all 0.15s ease",
                boxShadow: selectedPlan === "trial" ? "0 2px 12px rgba(124,58,237,0.15)" : "none",
              }}
              aria-pressed={selectedPlan === "trial"}
            >
              <span style={{
                position: "absolute",
                top: -10,
                right: 8,
                background: "#16a34a",
                color: "#fff",
                fontSize: "0.65rem",
                fontWeight: 700,
                padding: "2px 7px",
                borderRadius: 10,
                whiteSpace: "nowrap",
              }}>
                Free
              </span>
              <div style={{ fontWeight: 700, fontSize: "0.95rem", marginBottom: 4 }}>
                30 Days Trial
              </div>
              <div style={{ fontSize: "1.5rem", fontWeight: 800, color: selectedPlan === "trial" ? "var(--accent, #7c3aed)" : "inherit", marginBottom: 4 }}>
                FREE
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted, #6b7280)" }}>
                First time only
              </div>
            </button>
          )}
          {(() => {
            const perMonth = calculatePerMonth(plans);
            return plans.map(plan => {
              const isSelected = selectedPlan !== "trial" && plan.id === selectedPlan.id;
              const pm = perMonth[plan.id] ?? { label: "" };
            return (
              <button
                key={plan.id}
                onClick={() => { setSelectedPlan(plan); setError(null); }}
                style={{
                  position: "relative",
                  flex: "1 1 140px",
                  minWidth: 140,
                  maxWidth: 200,
                  background: isSelected ? "var(--surface-2, #f3f4f6)" : "var(--surface, #fff)",
                  border: isSelected ? "2px solid var(--accent, #7c3aed)" : "2px solid var(--border, #e5e7eb)",
                  borderRadius: 12,
                  padding: "16px 12px 14px",
                  cursor: "pointer",
                  textAlign: "center",
                  transform: isSelected ? "scale(1.03)" : "scale(1)",
                  transition: "all 0.15s ease",
                  boxShadow: isSelected ? "0 2px 12px rgba(124,58,237,0.15)" : "none",
                }}
                aria-pressed={isSelected}
              >
                {plan.badgeLabel && (
                  <span style={{
                    position: "absolute",
                    top: -10,
                    right: 8,
                    background: "#f59e0b",
                    color: "#fff",
                    fontSize: "0.65rem",
                    fontWeight: 700,
                    padding: "2px 7px",
                    borderRadius: 10,
                    whiteSpace: "nowrap",
                  }}>
                    {plan.badgeLabel}
                  </span>
                )}
                {!plan.badgeLabel && plan.id === "business_12m_v1" && (
                  <span style={{
                    position: "absolute",
                    top: -10,
                    right: 8,
                    background: "var(--success, #16a34a)",
                    color: "#fff",
                    fontSize: "0.65rem",
                    fontWeight: 700,
                    padding: "2px 7px",
                    borderRadius: 10,
                    whiteSpace: "nowrap",
                  }}>
                    Most savings
                  </span>
                )}

                <div style={{ fontWeight: 700, fontSize: "0.95rem", marginBottom: 4 }}>
                  {plan.label}
                </div>
                <div style={{ fontSize: "1.5rem", fontWeight: 800, color: isSelected ? "var(--accent, #7c3aed)" : "inherit", marginBottom: 4 }}>
                  {plan.priceNC.toLocaleString("en-IN")} NC
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--muted, #6b7280)" }}>
                  {pm.label}
                </div>
                {pm.savings && (
                  <div style={{ fontSize: "0.72rem", color: "var(--success, #16a34a)", marginTop: 2 }}>
                    {pm.savings}
                  </div>
                )}
              </button>
            );
            });
          })()}
        </div>

        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "var(--surface-2, #f3f4f6)",
          borderRadius: 10,
          padding: "10px 14px",
          marginBottom: 12,
          fontSize: "0.9rem",
        }}>
          <span style={{ color: "var(--muted, #6b7280)" }}>Your cashable NC:</span>
          <span style={{
            fontWeight: 700,
            color: canAfford ? "var(--success, #16a34a)" : "var(--error, #dc2626)",
          }}>
            {cashableBalance.toLocaleString("en-IN")} NC
          </span>
        </div>

        {selectedPlan !== "trial" && !canAfford && (
          <div style={{
            background: "#fffbeb",
            border: "1px solid #fcd34d",
            borderRadius: 10,
            padding: "10px 14px",
            marginBottom: 12,
            fontSize: "0.85rem",
            color: "#92400e",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}>
            <span>Top up your wallet to subscribe.</span>
            <button
              onClick={() => navigate("/wallet?tab=buy")}
              style={{
                background: "none",
                border: "none",
                color: "var(--accent, #7c3aed)",
                cursor: "pointer",
                padding: 0,
                fontWeight: 600,
                fontSize: "inherit",
                textDecoration: "underline",
              }}
            >
              Go to Wallet
            </button>
          </div>
        )}

        <button
          onClick={handlePay}
          disabled={!canAfford || loading}
          className="btn btn-primary"
          style={{
            width: "100%",
            padding: "14px 0",
            fontSize: "1rem",
            fontWeight: 700,
            borderRadius: 12,
            marginBottom: 8,
            opacity: (!canAfford || loading) ? 0.55 : 1,
            cursor: (!canAfford || loading) ? "not-allowed" : "pointer",
          }}
        >
          {loading
            ? "Processing..."
            : selectedPlan === "trial"
            ? "Start Free 30-Day Trial"
            : `Pay ${selectedPlan.priceNC.toLocaleString("en-IN")} NC -- Activate ${selectedPlan.label} Plan`}
        </button>

        <p style={{ textAlign: "center", fontSize: "0.78rem", color: "var(--muted, #6b7280)", margin: "0 0 8px" }}>
          {selectedPlan === "trial" ? "No payment required" : "Paid from your cashable NeighbourCoins balance"}
        </p>

        {error && (
          <div style={{
            background: "#fef2f2",
            border: "1px solid #fca5a5",
            borderRadius: 8,
            padding: "10px 14px",
            color: "var(--error, #dc2626)",
            fontSize: "0.85rem",
            marginTop: 4,
          }}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}