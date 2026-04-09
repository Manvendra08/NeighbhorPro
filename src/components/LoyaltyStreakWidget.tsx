import type { LoyaltyTier } from "../types";
import { getLoyaltyTierLabel } from "../services/loyaltyService";

const tierColors: Record<LoyaltyTier, { bg: string; text: string; border: string }> = {
    none: { bg: "rgba(148,163,184,0.12)", text: "#64748b", border: "rgba(148,163,184,0.24)" },
    bronze: { bg: "rgba(180,83,9,0.10)", text: "#b45309", border: "rgba(180,83,9,0.24)" },
    silver: { bg: "rgba(100,116,139,0.10)", text: "#475569", border: "rgba(100,116,139,0.24)" },
    gold: { bg: "rgba(202,138,4,0.12)", text: "#a16207", border: "rgba(202,138,4,0.24)" },
    diamond: { bg: "rgba(37,99,235,0.10)", text: "#2563eb", border: "rgba(37,99,235,0.24)" },
};

export default function LoyaltyStreakWidget(props: {
    streakCount: number;
    tier: LoyaltyTier;
    cashbackPct?: number;
    cashbackCoins?: number;
    nextTier?: LoyaltyTier | null;
    bookingsToNextTier?: number;
    title?: string;
    subtitle?: string;
    compact?: boolean;
    projected?: boolean;
}) {
    const {
        streakCount,
        tier,
        cashbackPct = 0,
        cashbackCoins,
        nextTier = null,
        bookingsToNextTier = 0,
        title = props.projected ? "Projected loyalty reward" : "Loyalty streak",
        subtitle,
        compact = false,
        projected = false,
    } = props;

    const colors = tierColors[tier];
    const tierLabel = getLoyaltyTierLabel(tier);

    return (
        <div
            style={{
                border: `1px solid ${colors.border}`,
                background: compact ? colors.bg : `linear-gradient(135deg, ${colors.bg}, rgba(255,255,255,0.4))`,
                borderRadius: 14,
                padding: compact ? "12px 14px" : "16px 18px",
                display: "flex",
                flexDirection: "column",
                gap: compact ? 8 : 10,
            }}
        >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.6 }}>{title}</div>
                    <div style={{ fontSize: compact ? 15 : 17, fontWeight: 700, marginTop: 3 }}>
                        {projected ? `${streakCount} consecutive bookings` : `${streakCount} booking streak`}
                    </div>
                    {subtitle ? <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>{subtitle}</div> : null}
                </div>
                <span
                    style={{
                        alignSelf: "flex-start",
                        padding: "6px 10px",
                        borderRadius: 999,
                        fontSize: 12,
                        fontWeight: 700,
                        background: colors.bg,
                        color: colors.text,
                        border: `1px solid ${colors.border}`,
                    }}
                >
                    {tierLabel}
                </span>
            </div>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <div style={{ minWidth: 120 }}>
                    <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>Client cashback</div>
                    <div style={{ fontWeight: 700, marginTop: 4 }}>
                        {cashbackPct > 0 ? `${Math.round(cashbackPct * 100)}%` : "No tier reward yet"}
                        {cashbackCoins != null && cashbackCoins > 0 ? ` · ${cashbackCoins} NC` : ""}
                    </div>
                </div>
                {nextTier ? (
                    <div style={{ minWidth: 140 }}>
                        <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>Next milestone</div>
                        <div style={{ fontWeight: 700, marginTop: 4 }}>
                            {bookingsToNextTier > 0 ? `${bookingsToNextTier} more to ${getLoyaltyTierLabel(nextTier)}` : `${getLoyaltyTierLabel(nextTier)} unlocked`}
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    );
}
