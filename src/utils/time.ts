/**
 * Shared time utilities for ProNeighbor.
 * Centralizes relativeTime / greeting logic — previously duplicated
 * across Messages.tsx, Dashboard.tsx, etc.
 */
import { Timestamp } from "firebase/firestore";

export function relativeTime(ts: unknown): string {
  if (!ts || !(ts instanceof Timestamp)) return "";
  const diff = (Date.now() - ts.toDate().getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return ts.toDate().toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function greetingByTime(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

