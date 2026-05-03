import { QueryClient, useQuery } from "@tanstack/react-query";
import { getCoinBalance } from "../services/coinService";
import { getAllServices, getPublicProfile, getServicesByUser } from "../services/firestoreService";

export const PROFILE_STALE_TIME = 5 * 60 * 1000;
export const SERVICES_STALE_TIME = 2 * 60 * 1000;
export const BALANCE_STALE_TIME = 30 * 1000;
export const DASHBOARD_LEDGER_STALE_TIME = 60 * 1000;
export const DASHBOARD_BOOKINGS_STALE_TIME = 30 * 1000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export const queryKeys = {
  publicProfile: (uid: string) => ["profiles", "public", uid] as const,
  servicesByUser: (uid: string) => ["services", "user", uid] as const,
  allServices: (limit: number) => ["services", "all", limit] as const,
  coinBalance: (uid: string) => ["wallet", "balance", uid] as const,
  dashboardLedger: (uid: string) => ["dashboard", "ledger", uid] as const,
  dashboardUserBookings: (uid: string) => ["dashboard", "bookings", "user", uid] as const,
};

export function fetchCachedPublicProfile(uid: string) {
  return queryClient.fetchQuery({
    queryKey: queryKeys.publicProfile(uid),
    queryFn: () => getPublicProfile(uid),
    staleTime: PROFILE_STALE_TIME,
  });
}

export function usePublicProfileQuery(uid?: string | null) {
  return useQuery({
    queryKey: uid ? queryKeys.publicProfile(uid) : ["profiles", "public", "unknown"],
    queryFn: () => {
      if (!uid) throw new Error("uid is required");
      return getPublicProfile(uid);
    },
    enabled: Boolean(uid),
    staleTime: PROFILE_STALE_TIME,
  });
}

export function useServicesByUserQuery(uid?: string | null) {
  return useQuery({
    queryKey: uid ? queryKeys.servicesByUser(uid) : ["services", "user", "unknown"],
    queryFn: () => {
      if (!uid) throw new Error("uid is required");
      return getServicesByUser(uid);
    },
    enabled: Boolean(uid),
    staleTime: SERVICES_STALE_TIME,
  });
}

export function useAllServicesQuery(limit = 50) {
  return useQuery({
    queryKey: queryKeys.allServices(limit),
    queryFn: () => getAllServices(limit),
    staleTime: SERVICES_STALE_TIME,
  });
}

export function useCoinBalanceQuery(uid?: string | null, initialBalance?: number) {
  return useQuery({
    queryKey: uid ? queryKeys.coinBalance(uid) : ["wallet", "balance", "unknown"],
    queryFn: () => {
      if (!uid) throw new Error("uid is required");
      return getCoinBalance(uid);
    },
    enabled: Boolean(uid),
    staleTime: BALANCE_STALE_TIME,
    initialData: initialBalance,
  });
}
