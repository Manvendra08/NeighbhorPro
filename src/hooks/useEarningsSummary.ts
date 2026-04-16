import { useMemo } from "react";
import type { CoinPayout, LedgerEntry, LedgerType } from "../services/coinService";

export type EarningsSummary = {
  thisMonth: number;
  lastMonth: number;
  changePct: number | null;
  isPositive: boolean;
  dailySeries: number[];
  balanceSeries: number[];
  pendingPayoutNC: number;
  pendingPayoutRs: number;
};

const EARNING_TYPES = new Set<LedgerType>([
  "booking_escrow_release",
  "earn_review",
  "earn_referral",
  "earn_free_consult",
  "earn_profile",
  "earn_milestone",
  "earn_groupsession",
  "earn_ondemand",
  "earn_signup_bonus",
]);

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "object" && value !== null && "toDate" in (value as Record<string, unknown>)) {
    const date = (value as { toDate?: () => Date }).toDate?.();
    return date ?? null;
  }
  const parsed = new Date(value as string | number);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function useEarningsSummary(
  ledger: LedgerEntry[],
  pendingPayout: CoinPayout | null,
): EarningsSummary {
  return useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const sortedLedger = [...ledger].sort((left, right) => {
      return (toDate(right.createdAt)?.getTime() || 0) - (toDate(left.createdAt)?.getTime() || 0);
    });

    const balanceSeries = [...sortedLedger]
      .reverse()
      .slice(-7)
      .map(entry => Number(entry.balanceAfter) || 0);

    const dailySeries = Array.from({ length: 14 }, (_, index) => {
      const dayStart = new Date(today);
      dayStart.setDate(today.getDate() - (13 - index));
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      return sortedLedger.reduce((sum, entry) => {
        const entryDate = toDate(entry.createdAt)?.getTime() || 0;
        const isEarn = EARNING_TYPES.has(entry.type);
        if (!isEarn) return sum;
        if (entryDate >= dayStart.getTime() && entryDate < dayEnd.getTime()) {
          return sum + Math.max(0, Number(entry.amount) || 0);
        }
        return sum;
      }, 0);
    });

    let thisMonth = 0;
    let lastMonth = 0;
    for (const entry of sortedLedger) {
      const entryTime = toDate(entry.createdAt)?.getTime() || 0;
      if (!EARNING_TYPES.has(entry.type)) continue;
      const amount = Math.max(0, Number(entry.amount) || 0);
      if (entryTime >= monthStart && entryTime < nextMonthStart) thisMonth += amount;
      if (entryTime >= lastMonthStart && entryTime < monthStart) lastMonth += amount;
    }

    const changePct = lastMonth > 0
      ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100)
      : (thisMonth > 0 ? 100 : null);

    return {
      thisMonth,
      lastMonth,
      changePct,
      isPositive: thisMonth >= lastMonth,
      dailySeries,
      balanceSeries,
      pendingPayoutNC: pendingPayout?.coinsRedeemed || 0,
      pendingPayoutRs: pendingPayout?.amountRs || 0,
    };
  }, [ledger, pendingPayout]);
}
