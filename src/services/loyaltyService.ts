import {
    Timestamp,
    doc,
    getDoc,
    runTransaction,
    serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import type { Booking, LoyaltyStreak, LoyaltyTier } from "../types";
import { queueLoyaltyCashbackCredit, queueProLoyaltyBonusCredit } from "./coinService";

export interface LoyaltyTierRule {
    tier: LoyaltyTier;
    label: string;
    threshold: number;
    cashbackPct: number;
    proBonusPct: number;
}

export interface LoyaltyRewardCalculation {
    streakCount: number;
    tier: LoyaltyTier;
    cashbackPct: number;
    proBonusPct: number;
    cashbackCoins: number;
    proBonusCoins: number;
    rewardBudgetCoins: number;
    totalRewardCoins: number;
    nextTier: LoyaltyTier | null;
    bookingsToNextTier: number;
}

export interface LoyaltyPreview extends LoyaltyRewardCalculation {
    currentStreak: number;
    currentTier: LoyaltyTier;
}

export const LOYALTY_TIER_RULES: LoyaltyTierRule[] = [
    { tier: "bronze", label: "Bronze", threshold: 10, cashbackPct: 0.02, proBonusPct: 0.01 },
    { tier: "silver", label: "Silver", threshold: 15, cashbackPct: 0.05, proBonusPct: 0.02 },
    { tier: "gold", label: "Gold", threshold: 30, cashbackPct: 0.08, proBonusPct: 0.03 },
    { tier: "diamond", label: "Diamond", threshold: 50, cashbackPct: 0.1, proBonusPct: 0.05 },
];

const LOYALTY_TIER_ORDER: LoyaltyTier[] = ["none", "bronze", "silver", "gold", "diamond"];

function toDate(value: unknown): Date | null {
    if (!value) return null;
    if (value instanceof Timestamp) return value.toDate();
    if (value instanceof Date) return value;
    if (typeof value === "string") {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    return null;
}

function daysBetween(previous: Date, current: Date): number {
    const ms = current.getTime() - previous.getTime();
    return Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)));
}

function scaleRewards(targetCashback: number, targetProBonus: number, budget: number) {
    const requested = targetCashback + targetProBonus;
    if (budget <= 0 || requested <= 0) return { cashbackCoins: 0, proBonusCoins: 0 };
    if (requested <= budget) return { cashbackCoins: targetCashback, proBonusCoins: targetProBonus };

    const cashbackExact = (budget * targetCashback) / requested;
    let cashbackCoins = Math.min(targetCashback, Math.floor(cashbackExact));
    let proBonusCoins = Math.min(targetProBonus, budget - cashbackCoins);
    let remaining = budget - cashbackCoins - proBonusCoins;

    const cashbackRemainder = cashbackExact - cashbackCoins;
    const proBonusRemainder = requested === 0 ? 0 : (budget * targetProBonus) / requested - proBonusCoins;

    while (remaining > 0) {
        if (cashbackCoins < targetCashback && cashbackRemainder >= proBonusRemainder) {
            cashbackCoins += 1;
        } else if (proBonusCoins < targetProBonus) {
            proBonusCoins += 1;
        } else if (cashbackCoins < targetCashback) {
            cashbackCoins += 1;
        } else {
            break;
        }
        remaining -= 1;
    }

    return { cashbackCoins, proBonusCoins };
}

export function getLoyaltyTierWeight(tier: LoyaltyTier | undefined | null): number {
    return LOYALTY_TIER_ORDER.indexOf(tier ?? "none");
}

export function getLoyaltyTierLabel(tier: LoyaltyTier | undefined | null): string {
    if (!tier || tier === "none") return "New";
    return LOYALTY_TIER_RULES.find(rule => rule.tier === tier)?.label ?? "New";
}

export function getLoyaltyTierForCount(streakCount: number): LoyaltyTier {
    let tier: LoyaltyTier = "none";
    for (const rule of LOYALTY_TIER_RULES) {
        if (streakCount >= rule.threshold) tier = rule.tier;
    }
    return tier;
}

export function getNextLoyaltyTier(tier: LoyaltyTier): LoyaltyTier | null {
    const index = LOYALTY_TIER_ORDER.indexOf(tier);
    return index >= 0 && index < LOYALTY_TIER_ORDER.length - 1 ? LOYALTY_TIER_ORDER[index + 1] : null;
}

export function getLoyaltyTierRule(tier: LoyaltyTier): LoyaltyTierRule | null {
    return LOYALTY_TIER_RULES.find(rule => rule.tier === tier) ?? null;
}

export function calculateLoyaltyRewards(
    streakCount: number,
    amount: number,
    platformFeePct = 0.1,
): LoyaltyRewardCalculation {
    const tier = getLoyaltyTierForCount(streakCount);
    const rule = getLoyaltyTierRule(tier);
    const cashbackPct = rule?.cashbackPct ?? 0;
    const proBonusPct = rule?.proBonusPct ?? 0;
    const rewardBudgetCoins = Math.max(0, Math.round(Math.max(0, amount) * platformFeePct));
    const targetCashback = Math.round(Math.max(0, amount) * cashbackPct);
    const targetProBonus = Math.round(Math.max(0, amount) * proBonusPct);
    const scaled = scaleRewards(targetCashback, targetProBonus, rewardBudgetCoins);
    const nextTier = getNextLoyaltyTier(tier);
    const nextTierThreshold = nextTier ? getLoyaltyTierRule(nextTier)?.threshold ?? streakCount : streakCount;

    return {
        streakCount,
        tier,
        cashbackPct,
        proBonusPct,
        cashbackCoins: scaled.cashbackCoins,
        proBonusCoins: scaled.proBonusCoins,
        rewardBudgetCoins,
        totalRewardCoins: scaled.cashbackCoins + scaled.proBonusCoins,
        nextTier,
        bookingsToNextTier: nextTier ? Math.max(0, nextTierThreshold - streakCount) : 0,
    };
}

export async function getLoyaltyStreak(clientId: string, proId: string): Promise<LoyaltyStreak | null> {
    const streakRef = doc(db, "loyaltyStreaks", `${clientId}_${proId}`);
    const snap = await getDoc(streakRef);
    return snap.exists() ? ({ id: snap.id, ...snap.data() } as LoyaltyStreak) : null;
}

export async function getLoyaltyPreview(
    clientId: string,
    proId: string,
    amount: number,
    platformFeePct = 0.1,
): Promise<LoyaltyPreview> {
    const streak = await getLoyaltyStreak(clientId, proId);
    const currentStreak = streak?.currentStreak ?? 0;
    const calculation = calculateLoyaltyRewards(currentStreak + 1, amount, platformFeePct);

    return {
        ...calculation,
        currentStreak,
        currentTier: streak?.tier ?? getLoyaltyTierForCount(currentStreak),
    };
}

export function sortProfessionalsByLoyalty(pros: Record<string, unknown>[]): Record<string, unknown>[] {
    return [...pros].sort((left, right) => {
        const tierDelta =
            getLoyaltyTierWeight(right.highestLoyaltyTier as LoyaltyTier | undefined) -
            getLoyaltyTierWeight(left.highestLoyaltyTier as LoyaltyTier | undefined);
        if (tierDelta !== 0) return tierDelta;

        const ratingDelta = ((right.rating as number) || 0) - ((left.rating as number) || 0);
        if (ratingDelta !== 0) return ratingDelta;

        const reviewDelta = ((right.reviewCount as number) || 0) - ((left.reviewCount as number) || 0);
        if (reviewDelta !== 0) return reviewDelta;

        return ((left.displayName as string) || "").localeCompare((right.displayName as string) || "");
    });
}

export function getNextRecurringDate(dateValue?: string): string {
    const base = toDate(dateValue) ?? new Date();
    const next = new Date(base);
    next.setDate(next.getDate() + 7);
    return next.toISOString().split("T")[0];
}

export function buildRecurringRebookQuery(booking: Record<string, unknown> | Booking): string {
    const params = new URLSearchParams();
    if (booking.serviceId) params.set("serviceId", String(booking.serviceId));
    if (booking.timeSlot) params.set("timeSlot", String(booking.timeSlot));
    params.set("date", getNextRecurringDate(booking.date as string | undefined));
    params.set("rebook", "1");
    if (booking.id) params.set("bookingId", String(booking.id));
    const queryString = params.toString();
    return queryString ? `?${queryString}` : "";
}

export async function processCompletedBookingLoyalty(params: {
    bookingId: string;
    clientId: string;
    proId: string;
    amount: number;
    serviceName?: string;
    bookingDate?: string;
    platformFeePct?: number;
}) {
    const {
        bookingId,
        clientId,
        proId,
        amount,
        serviceName,
        bookingDate,
        platformFeePct = 0.1,
    } = params;

    const streakRef = doc(db, "loyaltyStreaks", `${clientId}_${proId}`);
    const bookingRef = doc(db, "bookings", bookingId);
    const proRef = doc(db, "users", proId);

    await runTransaction(db, async tx => {
        const bookingSnap = await tx.get(bookingRef);
        const streakSnap = await tx.get(streakRef);
        const proSnap = await tx.get(proRef);

        if (!bookingSnap.exists()) throw new Error("BOOKING_NOT_FOUND");
        if (bookingSnap.data()?.loyaltyProcessedAt) return;

        const existing = streakSnap.exists() ? (streakSnap.data() as Partial<LoyaltyStreak>) : null;
        const completedAt = toDate(bookingDate) ?? toDate(bookingSnap.data()?.date) ?? new Date();
        const previousDate = toDate(existing?.lastBookingDate);
        const previousCadence = existing?.cadence === "weekly" ? "weekly" : "monthly";
        const gapDays = previousDate ? daysBetween(previousDate, completedAt) : null;
        const cadence = gapDays == null ? previousCadence : gapDays <= 21 ? "weekly" : "monthly";
        const idleWindowDays = previousDate ? (previousCadence === "weekly" ? 14 : 45) : Number.POSITIVE_INFINITY;
        const streakBroken = previousDate ? (gapDays ?? 0) > idleWindowDays : false;
        const currentStreak = streakBroken ? 1 : ((existing?.currentStreak as number) ?? 0) + 1;
        const longestStreak = Math.max((existing?.longestStreak as number) ?? 0, currentStreak);
        const calculation = calculateLoyaltyRewards(currentStreak, amount, platformFeePct);
        const previousHighestTier = (existing?.highestTier as LoyaltyTier | undefined) ?? (existing?.tier as LoyaltyTier | undefined) ?? "none";
        const highestTier = getLoyaltyTierWeight(calculation.tier) > getLoyaltyTierWeight(previousHighestTier)
            ? calculation.tier
            : previousHighestTier;

        tx.set(streakRef, {
            clientId,
            proId,
            currentStreak,
            longestStreak,
            tier: calculation.tier,
            highestTier,
            cadence,
            lastBookingDate: bookingDate ?? bookingSnap.data()?.date ?? completedAt.toISOString().split("T")[0],
            streakStartDate: streakBroken || !existing?.streakStartDate
                ? bookingDate ?? bookingSnap.data()?.date ?? completedAt.toISOString().split("T")[0]
                : existing.streakStartDate,
            lastCompletedBookingId: bookingId,
            totalCashbackEarned: ((existing?.totalCashbackEarned as number) ?? 0) + calculation.cashbackCoins,
            totalProBonusEarned: ((existing?.totalProBonusEarned as number) ?? 0) + calculation.proBonusCoins,
            createdAt: existing?.createdAt ?? serverTimestamp(),
            updatedAt: serverTimestamp(),
        }, { merge: true });

        tx.update(bookingRef, {
            streakCount: currentStreak,
            loyaltyTier: calculation.tier,
            loyaltyCashback: calculation.cashbackCoins,
            proBonus: calculation.proBonusCoins,
            loyaltyProcessedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });

        if (calculation.cashbackCoins > 0) {
            await queueLoyaltyCashbackCredit(tx, clientId, bookingId, calculation.cashbackCoins, serviceName);
        }
        if (calculation.proBonusCoins > 0) {
            await queueProLoyaltyBonusCredit(tx, proId, bookingId, calculation.proBonusCoins, serviceName);
        }

        const currentHighestTier = proSnap.exists()
            ? ((proSnap.data()?.highestLoyaltyTier as LoyaltyTier | undefined) ?? "none")
            : "none";
        if (getLoyaltyTierWeight(highestTier) > getLoyaltyTierWeight(currentHighestTier)) {
            tx.update(proRef, { highestLoyaltyTier: highestTier, updatedAt: serverTimestamp() });
        }
    });
}
