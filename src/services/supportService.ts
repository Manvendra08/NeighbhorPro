import {
  collection, doc, getDocs, addDoc, updateDoc,
  query, where, orderBy, limit, onSnapshot, serverTimestamp, Unsubscribe,
} from "firebase/firestore";
import { db } from "../firebase";
import type { FirestoreTimestamp } from "../types/firestore";

export type TicketStatus = "open" | "in_progress" | "resolved" | "closed";
export type DisputeStatus = "raised" | "under_review" | "resolved_client" | "resolved_pro" | "dismissed";

export interface SupportTicket {
  id?: string;
  ticketNumber?: string;
  uid: string;
  displayName: string;
  email: string;
  subject: string;
  category: "general" | "booking" | "payment" | "account" | "dispute" | "other";
  bookingId?: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  assignedAdminId?: string;
  assignedAdminName?: string;
  assignedAt?: FirestoreTimestamp;
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
  resolvedAt?: FirestoreTimestamp;
}

export interface TicketMessage {
  id?: string;
  text: string;
  senderRole: "user" | "admin";
  senderName: string;
  timestamp: FirestoreTimestamp;
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
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
}

export interface FAQ {
  id?: string;
  question: string;
  answer: string;
  category: string;
  order: number;
  active: boolean;
}

// ── Ticket Generation ──────────────────────────────────────────────────────
/** Generates a ticket number in the format NP<ddmmyyyy><3-digit-sequence> */
export async function generateTicketNumber(): Promise<string> {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yyyy = String(now.getFullYear());
  const dateStr = `${dd}${mm}${yyyy}`;

  // Count tickets created today to get sequence number
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(startOfDay.getTime() + 86_400_000);
  try {
    const { Timestamp } = await import("firebase/firestore");
    const snap = await getDocs(query(
      collection(db, "tickets"),
      where("createdAt", ">=", Timestamp.fromDate(startOfDay)),
      where("createdAt", "<", Timestamp.fromDate(endOfDay))
    ));
    const seq = String(snap.size + 1).padStart(3, "0");
    return `NP${dateStr}${seq}`;
  } catch {
    const seq = String(Math.floor(Math.random() * 900) + 100);
    return `NP${dateStr}${seq}`;
  }
}

// ── Tickets ──────────────────────────────────────────────────────────────
export async function createTicket(data: Omit<SupportTicket, "id" | "ticketNumber" | "status" | "createdAt" | "updatedAt">): Promise<{ id: string; ticketNumber: string }> {
  const ticketNumber = await generateTicketNumber();
  const ref = await addDoc(collection(db, "tickets"), {
    ...data, ticketNumber, status: "open", createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  return { id: ref.id, ticketNumber };
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

export function subscribeUserTickets(uid: string, cb: (tickets: SupportTicket[]) => void): Unsubscribe {
  return onSnapshot(query(collection(db, "tickets"), where("uid", "==", uid), orderBy("createdAt", "desc")), snap => {
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() } as SupportTicket)));
  });
}

export async function getAllTickets(pageLimit = 100): Promise<SupportTicket[]> {
  const snap = await getDocs(query(collection(db, "tickets"), orderBy("createdAt", "desc"), limit(pageLimit)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as SupportTicket));
}

export async function updateTicketStatus(ticketId: string, status: TicketStatus, adminUid?: string): Promise<void> {
  const resolutionFields =
    status === "resolved" || status === "closed"
      ? {
        resolvedAt: serverTimestamp(),
        ...(adminUid ? { resolvedBy: adminUid } : {}),
      }
      : {};

  await updateDoc(doc(db, "tickets", ticketId), {
    status, updatedAt: serverTimestamp(),
    ...resolutionFields,
  });
}

export async function assignTicketToAdmin(ticketId: string, adminUid: string, adminName: string): Promise<void> {
  await updateDoc(doc(db, "tickets", ticketId), {
    assignedAdminId: adminUid,
    assignedAdminName: adminName,
    assignedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function clearTicketAssignment(ticketId: string): Promise<void> {
  await updateDoc(doc(db, "tickets", ticketId), {
    assignedAdminId: null,
    assignedAdminName: null,
    assignedAt: null,
    updatedAt: serverTimestamp(),
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

export async function getAllDisputes(pageLimit = 200): Promise<Dispute[]> {
  const snap = await getDocs(query(collection(db, "disputes"), orderBy("createdAt", "desc"), limit(pageLimit)));
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
  { question: "How do Referral Codes work?", answer: "Share your referral code from your Wallet page! When a friend registers and completes their first booking, both of you earn 100 NC.", category: "account", order: 9, active: true },
  { question: "My NeighbourCoins top-up failed but money was deducted. What should I do?", answer: "Don't panic! Open a 'Payment' support ticket and provide the transaction reference. We'll manually resolve this within 24 hours.", category: "payment", order: 10, active: true },
  { question: "How are disputes resolved?", answer: "If you have an issue with a completed session, open a 'Dispute' support ticket within 48 hours. Our team will mediate between you and the Pro.", category: "dispute", order: 11, active: true },
  { question: "Can I edit my Professional Profile?", answer: "Yes! Navigate to your 'Profile' section. You can update your skills, hourly rate, and profile picture anytime.", category: "account", order: 12, active: true },
  { question: "Why is the Pro I want unavailable?", answer: "Pros set their own availability calendar. If their slots are empty, they are either fully booked or have taken time off. Try messaging them!", category: "booking", order: 13, active: true },
  { question: "What if the professional is late?", answer: "We recommend messaging them first. If they are more than 20 minutes late without notice, you can cancel for a full refund and report it via a support ticket.", category: "booking", order: 14, active: true },
  { question: "Can I book a service for someone else?", answer: "Yes, but ensure you provide their details and exact location in the booking notes so the Pro knows who to expect.", category: "general", order: 15, active: true },
  { question: "How do I update my registered society?", answer: "Go to Profile → Edit Profile. Note that changing your society may affect your verified status until re-confirmed by the new society admin.", category: "account", order: 16, active: true },
  { question: "Is my personal data secure?", answer: "Absolutely. We use industry-standard encryption and never share your contact details with Pros until a booking is confirmed.", category: "general", order: 17, active: true },
  { question: "How do I report inappropriate behavior?", answer: "Safety is our priority. Use the 'Dispute' category in Support or email safety@proneighbor.com immediately. Block the user in the chat settings.", category: "dispute", order: 18, active: true },
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

