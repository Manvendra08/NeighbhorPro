/**
 * Shared time utilities for ProNeighbor.
 * Centralizes relativeTime / greeting logic — previously duplicated
 * across Messages.tsx, Dashboard.tsx, etc.
 */
import { Timestamp } from "firebase/firestore";

const INDIAN_DATE_TIME = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
  timeZone: "Asia/Kolkata",
});

function extractTimeFromSlot(slot: string): { hour: number; minute: number } | null {
  const firstPart = slot.split("-")[0]?.trim();
  if (!firstPart) return null;
  const match = firstPart.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) {
    const h24 = firstPart.match(/^(\d{1,2}):(\d{2})$/);
    if (!h24) return null;
    const hour = Number(h24[1]);
    const minute = Number(h24[2]);
    if (Number.isNaN(hour) || Number.isNaN(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      return null;
    }
    return { hour, minute };
  }

  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = match[3].toUpperCase();
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;

  if (meridiem === "PM" && hour < 12) hour += 12;
  if (meridiem === "AM" && hour === 12) hour = 0;

  return { hour, minute };
}

function buildIstDate(dateStr: string, timeSlot?: string): Date | null {
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const time = timeSlot ? extractTimeFromSlot(timeSlot) : null;
  const hour = time?.hour ?? 12;
  const minute = time?.minute ?? 0;

  const utcMillis = Date.UTC(year, monthIndex, day, hour - 5, minute - 30, 0, 0);
  const date = new Date(utcMillis);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatIndianDateTime(value: unknown): string {
  const normalize = (input: Date): string =>
    INDIAN_DATE_TIME.format(input).replace(/\b(am|pm)\b/i, (match) => match.toUpperCase());

  if (!value) return "";
  if (value instanceof Timestamp) return normalize(value.toDate());
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? "" : normalize(value);
  if (typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : normalize(date);
  }
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? "" : normalize(parsed);
  }
  return "";
}

export function formatBookingDateTime(dateValue?: unknown, timeSlot?: unknown, fallbackTimestamp?: unknown): string {
  const dateText = typeof dateValue === "string" ? dateValue.trim() : "";
  const slotText = typeof timeSlot === "string" ? timeSlot.trim() : "";

  if (dateText) {
    const istDate = buildIstDate(dateText, slotText);
    if (istDate) return formatIndianDateTime(istDate);
  }

  return formatIndianDateTime(fallbackTimestamp);
}

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
