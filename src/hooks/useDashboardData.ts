import { useEffect, useMemo, useState } from "react";
import { queryClient, queryKeys } from "../lib/queryClient";
import { getPendingPayoutForUser, getLedger, type CoinPayout, type LedgerEntry } from "../services/coinService";
import {
  getBookingsForPro,
  getBookingsForUser,
  getLastCompletedBookingForUser,
  getProAvailability,
  getPublicProfile,
  getReviewDistribution,
  getUserProfile,
} from "../services/firestoreService";
import { useEarningsSummary } from "./useEarningsSummary";
import { useProfileCompletion } from "./useProfileCompletion";

type ProfileRow = Record<string, unknown> | null;
type BookingRow = Record<string, unknown>;

const EMPTY_REVIEW_DISTRIBUTION: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };

export type DashboardDataResult = {
  loading: boolean;
  userProfile: ProfileRow;
  userBookings: BookingRow[];
  upcomingBookings: BookingRow[];
  proBookings: BookingRow[];
  reviewDistribution: Record<number, number>;
  computedRating: number | null;
  lastBookedPro: ProfileRow;
  lastCompletedBooking: BookingRow | null;
  availability: Record<string, unknown> | null;
  ledger: LedgerEntry[];
  pendingPayout: CoinPayout | null;
  isPro: boolean;
  profileCompletion: ReturnType<typeof useProfileCompletion>;
  earningsSummary: ReturnType<typeof useEarningsSummary>;
};

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

function parseBookingDate(booking: BookingRow): Date | null {
  const date = typeof booking.date === "string" ? booking.date.trim() : "";
  if (!date) return toDate(booking.createdAt);

  const dateMatch = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const year = dateMatch ? Number(dateMatch[1]) : NaN;
  const monthIndex = dateMatch ? Number(dateMatch[2]) - 1 : NaN;
  const day = dateMatch ? Number(dateMatch[3]) : NaN;

  const [startTimeRaw] = String(booking.timeSlot || "").split("-");
  const startTime = startTimeRaw?.trim() || "";
  const meridiemMatch = startTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  const h24Match = startTime.match(/^(\d{1,2}):(\d{2})$/);

  if (dateMatch && meridiemMatch) {
    let hour = Number(meridiemMatch[1]);
    const minute = Number(meridiemMatch[2]);
    const meridiem = meridiemMatch[3].toUpperCase();
    if (meridiem === "PM" && hour < 12) hour += 12;
    if (meridiem === "AM" && hour === 12) hour = 0;
    const parsed = new Date(year, monthIndex, day, hour, minute, 0, 0);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  if (dateMatch && h24Match) {
    const hour = Number(h24Match[1]);
    const minute = Number(h24Match[2]);
    const parsed = new Date(year, monthIndex, day, hour, minute, 0, 0);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  if (dateMatch) {
    // If slot parse fails, treat booking as open through end-of-day to avoid false "no upcoming" states.
    const endOfDay = new Date(year, monthIndex, day, 23, 59, 59, 999);
    if (!Number.isNaN(endOfDay.getTime())) return endOfDay;
  }

  const fallback = new Date(date);
  return Number.isNaN(fallback.getTime()) ? toDate(booking.createdAt) : fallback;
}

function isUpcomingBooking(booking: BookingRow): boolean {
  const status = String(booking.status || "");
  if (!["pending", "confirmed"].includes(status)) return false;
  const bookingDate = parseBookingDate(booking);
  if (!bookingDate) return true;
  return bookingDate.getTime() >= Date.now() - (60 * 60 * 1000);
}

function computeRating(
  profile: ProfileRow,
  reviewDistribution: Record<number, number>,
  isPro: boolean,
): number | null {
  if (!isPro) return (profile?.rating as number) ?? null;
  const total = Object.values(reviewDistribution).reduce((sum, count) => sum + count, 0);
  if (total <= 0) return (profile?.rating as number) ?? null;

  const weighted =
    (5 * (Number(reviewDistribution[5]) || 0)) +
    (4 * (Number(reviewDistribution[4]) || 0)) +
    (3 * (Number(reviewDistribution[3]) || 0)) +
    (2 * (Number(reviewDistribution[2]) || 0)) +
    (1 * (Number(reviewDistribution[1]) || 0));

  return Math.round((weighted / total) * 10) / 10;
}

export function useDashboardData(uid?: string | null): DashboardDataResult {
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<ProfileRow>(null);
  const [userBookings, setUserBookings] = useState<BookingRow[]>([]);
  const [proBookings, setProBookings] = useState<BookingRow[]>([]);
  const [reviewDistribution, setReviewDistribution] = useState<Record<number, number>>(EMPTY_REVIEW_DISTRIBUTION);
  const [computedRating, setComputedRating] = useState<number | null>(null);
  const [lastBookedPro, setLastBookedPro] = useState<ProfileRow>(null);
  const [lastCompletedBooking, setLastCompletedBooking] = useState<BookingRow | null>(null);
  const [availability, setAvailability] = useState<Record<string, unknown> | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [pendingPayout, setPendingPayout] = useState<CoinPayout | null>(null);

  useEffect(() => {
    if (!uid) return;

    let alive = true;
    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        const profile = await getUserProfile(uid);
        if (!alive) return;

        setUserProfile(profile);

        if (!profile) {
          setLoading(false);
          return;
        }

        const isProUser = profile.isServiceProvider === true;
        const [
          bookingsResult,
          proRowsResult,
          completedBookingResult,
          reviewDataResult,
          availabilityDataResult,
          ledgerRowsResult,
          payoutRowResult,
        ] = await Promise.allSettled([
          queryClient.fetchQuery({
            queryKey: queryKeys.dashboardUserBookings(uid),
            queryFn: () => getBookingsForUser(uid),
            staleTime: 30 * 1000,
          }),
          isProUser ? getBookingsForPro(uid) : Promise.resolve([] as BookingRow[]),
          getLastCompletedBookingForUser(uid),
          isProUser ? getReviewDistribution(uid) : Promise.resolve(EMPTY_REVIEW_DISTRIBUTION),
          isProUser ? getProAvailability(uid) : Promise.resolve(null),
          queryClient.fetchQuery({
            queryKey: queryKeys.dashboardLedger(uid),
            queryFn: () => getLedger(uid, 80),
            staleTime: 60 * 1000,
          }),
          getPendingPayoutForUser(uid),
        ]);

        const bookings = bookingsResult.status === "fulfilled" && Array.isArray(bookingsResult.value)
          ? bookingsResult.value
          : [];
        const proRows = proRowsResult.status === "fulfilled" && Array.isArray(proRowsResult.value)
          ? proRowsResult.value
          : [];
        const completedBooking = completedBookingResult.status === "fulfilled"
          ? (completedBookingResult.value as BookingRow | null)
          : null;
        const reviewData = reviewDataResult.status === "fulfilled"
          ? reviewDataResult.value
          : EMPTY_REVIEW_DISTRIBUTION;
        const availabilityData = availabilityDataResult.status === "fulfilled"
          ? availabilityDataResult.value
          : null;
        const ledgerRows = ledgerRowsResult.status === "fulfilled"
          ? ledgerRowsResult.value
          : [];
        const payoutRow = payoutRowResult.status === "fulfilled"
          ? payoutRowResult.value
          : null;

        if (!alive) return;

        setUserBookings(Array.isArray(bookings) ? bookings : []);
        setProBookings(Array.isArray(proRows) ? proRows : []);
        setLastCompletedBooking(completedBooking as BookingRow | null);
        setReviewDistribution(reviewData);
        setAvailability(availabilityData);
        setLedger(ledgerRows);
        setPendingPayout(payoutRow);
        setComputedRating(computeRating(profile, reviewData, isProUser));

        const latestProId = typeof completedBooking?.proId === "string"
          ? completedBooking.proId
          : typeof completedBooking?.proUid === "string"
            ? completedBooking.proUid
            : "";

        if (latestProId) {
          const latestPro = await getPublicProfile(latestProId);
          if (alive) setLastBookedPro(latestPro);
        } else {
          setLastBookedPro(null);
        }
      } catch (error) {
        console.error("Dashboard fetch error:", error);
      } finally {
        if (alive) setLoading(false);
      }
    };

    void fetchDashboardData();
    return () => {
      alive = false;
    };
  }, [uid]);

  const isPro = userProfile?.isServiceProvider === true;
  const upcomingBookings = useMemo(
    () => userBookings.filter(isUpcomingBooking),
    [userBookings],
  );
  const profileCompletion = useProfileCompletion(userProfile, availability, isPro);
  const earningsSummary = useEarningsSummary(isPro ? ledger : [], pendingPayout);

  return {
    loading,
    userProfile,
    userBookings,
    upcomingBookings,
    proBookings,
    reviewDistribution,
    computedRating,
    lastBookedPro,
    lastCompletedBooking,
    availability,
    ledger,
    pendingPayout,
    isPro,
    profileCompletion,
    earningsSummary,
  };
}
