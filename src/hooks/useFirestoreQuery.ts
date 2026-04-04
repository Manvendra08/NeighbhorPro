/**
 * Firestore Query Hook - Replaces direct onSnapshot with polling to reduce listener count
 * Automatically cleans up listeners on unmount, pauses on tab visibility change
 */
import { useEffect, useRef, useState } from "react";
import type { Query, DocumentData, Unsubscribe } from "firebase/firestore";

/**
 * Replace onSnapshot with polling-based query.
 * Reduces active listeners and improves performance on Spark plans.
 * 
 * @param query - Firestore query to poll
 * @param pollIntervalMs - Polling interval in milliseconds (default: 30000ms for wallet, 60000ms for admin)
 * @param pauseOnHidden - Pause polling when tab is hidden (default: true)
 */
export function useFirestoreQuery<T extends DocumentData>(
  query: Query<T> | null,
  pollIntervalMs: number = 30000,
  pauseOnHidden: boolean = true
): { data: T[]; loading: boolean; error: Error | null; unsubscribe: Unsubscribe } {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isHiddenRef = useRef(false);

  // Handle tab visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      isHiddenRef.current = document.hidden;
      if (!isHiddenRef.current && pollTimerRef.current === null && query) {
        // Resume polling when tab becomes visible
        executePoll();
      }
    };

    if (pauseOnHidden) {
      document.addEventListener("visibilitychange", handleVisibilityChange);
      return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
    }
  }, [pauseOnHidden, query]);

  const executePoll = async () => {
    if (!query) return;
    
    try {
      const { getDocs } = await import("firebase/firestore");
      const snapshot = await getDocs(query);
      setData(snapshot.docs.map(doc => doc.data() as T));
      setError(null);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!query) {
      setData([]);
      setLoading(false);
      return;
    }

    // Initial load
    executePoll();

    // Set up polling
    pollTimerRef.current = setInterval(() => {
      if (!isHiddenRef.current || !pauseOnHidden) {
        executePoll();
      }
    }, pollIntervalMs);

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [query, pollIntervalMs, pauseOnHidden]);

  return {
    data,
    loading,
    error,
    unsubscribe: () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    },
  };
}
