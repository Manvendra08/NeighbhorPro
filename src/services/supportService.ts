import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc,
  query, where, orderBy, limit, onSnapshot, serverTimestamp, Unsubscribe,
} from "firebase/firestore";
import { db } from "../firebase";

export type TicketStatus = "open" | "in_progress" | "resolved" | "closed";
export type TicketPriority = "low" | "normal" | "high" | "urgent";
export type DisputeStatus = "raised" | "under_review" | "resolved_client" | "resolved_pro" | "dismissed";

export interface SupportTicket {
  id?: string;
  uid: string;
  displayName: string;
  email: string;
  subject: string;
  category: "general" | "booking" | "payment" | "account" | "dispute" | "other";
  bookingId?: string;
  status: TicketStatus;
  priority: TicketPriority;
  slaHours: number;
  createdAt: unknown;
  updatedAt: unknown;
  resolvedAt?: unknown;
}

export interface TicketMessage {
  id?: string;
  text: string;
  senderRole: "user" | "admin";
  senderName: string;
  timestamp: unknown;
}

export interface Dispute {
  id?: string;
  bookingId: string;
  raisedByUid: string;
  raisedByName: string;
  againstUid: string;
  reason: string;
  description: string;
  status: DisputeStatus;
  adminNote?: string;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface FAQ {
  id?: string;
  question: string;
  answer: string;
  category: string;
  order: number;
  active: boolean;
}

// SLA from appSettings (fallback)
const DEFAULT_SLA: Record<TicketPriority, number> = { low: 72, normal: 24, high: 8, urgent: 2 };

export async function getSLAHours(priority: TicketPriority): Promise<number> {
  try {
    const snap = await getDoc(doc(db, "appSettings", "support"));
    if (snap.exists()) return snap.data()?.[`sla_${priority}`] ?? DEFAULT_SLA[priority];
  } catch { /* fallback */ }
  return DEFAULT_SLA[priority];
}

// ── Tickets ──────────────────────────────────────────────────────────────
export async function createTicket(data: Omit<SupportTicket, "id" | "status" | "slaHours" | "createdAt" | "updatedAt">): Promise<string> {
  const slaHours = await getSLAHours(data.priority);
  const ref = await addDoc(collection(db, "tickets"), {
    ...data, status: "open", slaHours, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function sendTicketMessage(ticketId: string, msg: Omit<TicketMessage, "id" | "timestamp">): Promise<void> {
  await addDoc(collection(db, `tickets/${ticketId}/messages`), { ...msg, timestamp: serverTimestamp() });
  await updateDoc(doc(db, "tickets", ticketId), { updatedAt: serverTimestamp() });
}

export function subscribeTicketMessages(ticketId: string, cb: (msgs: TicketMessage[]) => void): Unsubscribe {
  return onSnapshot(
    query(collection(db, `tickets/${ticketId}/messages`), orderBy("timestamp", "asc")),
    snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() } as TicketMessage)))
  );
}

export async function getUserTickets(uid: string): Promise<SupportTicket[]> {
  const snap = await getDocs(query(collection(db, "tickets"), where("uid", "==", uid), orderBy("createdAt", "desc")));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as SupportTicket));
}

export async function getAllTickets(pageLimit = 100): Promise<SupportTicket[]> {
  const snap = await getDocs(query(collection(db, "tickets"), orderBy("createdAt", "desc"), limit(pageLimit)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as SupportTicket));
}

export async function updateTicketStatus(ticketId: string, status: TicketStatus, adminUid?: string): Promise<void> {
  await updateDoc(doc(db, "tickets", ticketId), {
    status, updatedAt: serverTimestamp(),
    ...(status === "resolved" || status === "closed" ? { resolvedAt: serverTimestamp(), resolvedBy: adminUid } : {}),
  });
}

// ── Disputes ─────────────────────────────────────────────────────────────
export async function raiseDispute(data: Omit<Dispute, "id" | "status" | "createdAt" | "updatedAt">): Promise<string> {
  const ref = await addDoc(collection(db, "disputes"), {
    ...data, status: "raised", createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function getDisputeByBooking(bookingId: string): Promise<Dispute | null> {
  const snap = await getDocs(query(collection(db, "disputes"), where("bookingId", "==", bookingId), limit(1)));
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as Dispute;
}

export async function updateDisputeStatus(disputeId: string, status: DisputeStatus, adminNote?: string): Promise<void> {
  await updateDoc(doc(db, "disputes", disputeId), {
    status, adminNote: adminNote ?? null, updatedAt: serverTimestamp(),
  });
}

export async function getAllDisputes(): Promise<Dispute[]> {
  const snap = await getDocs(query(collection(db, "disputes"), orderBy("createdAt", "desc")));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Dispute));
}

// ── FAQs (dynamic from Firestore) ────────────────────────────────────────
const STATIC_FAQS: FAQ[] = [
  { question: "How do I find a professional?", answer: "Go to 'Browse Pros'. Filter by category, society, or rating.", category: "general", order: 1, active: true },
  { question: "Is the platform free?", answer: "Browsing and messaging are free. Bookings are paid via NeighbourCoins.", category: "general", order: 2, active: true },
  { question: "How are professionals verified?", answer: "All pros go through society verification. ID and residence are confirmed.", category: "general", order: 3, active: true },
  { question: "How do I become a service provider?", answer: "Go to Profile → toggle 'I offer professional services' → add skills and pricing.", category: "account", order: 4, active: true },
  { question: "What are NeighbourCoins?", answer: "NC is our in-app currency. 1 NC = ₹1. Buy packs, earn through referrals and activity, spend on bookings.", category: "payment", order: 5, active: true },
  { question: "How do I cash out my earnings?", answer: "Go to Wallet → Cash Out tab. Minimum 200 NC. Processed via UPI within 48 hours.", category: "payment", order: 6, active: true },
  { question: "Can I cancel a booking?", answer: "Yes — pending or confirmed bookings can be cancelled. NC is refunded fully if cancelled 2+ hours before the session.", category: "booking", order: 7, active: true },
  { question: "How do reviews work?", answer: "You can review a pro after a completed booking. All reviews are tied to verified bookings.", category: "booking", order: 8, active: true },
];

export async function getFAQs(): Promise<FAQ[]> {
  try {
    const snap = await getDocs(query(collection(db, "faqs"), where("active", "==", true), orderBy("order", "asc")));
    if (!snap.empty) return snap.docs.map(d => ({ id: d.id, ...d.data() } as FAQ));
  } catch { /* fallback to static */ }
  return STATIC_FAQS;
}

// ── Notifications (FCM token storage) ─────────────────────────────────────
export async function saveFCMToken(uid: string, token: string): Promise<void> {
  await updateDoc(doc(db, "users", uid), { fcmToken: token, updatedAt: serverTimestamp() });
}

