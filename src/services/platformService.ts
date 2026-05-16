import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  query,
  QueryConstraint,
  where,
  orderBy,
  limit,
  startAfter,
  QueryDocumentSnapshot,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { normalizeAvailabilityData } from "./userService";

export async function getPlatformSettings(): Promise<Record<string, unknown>> {
  const snap = await getDoc(doc(db, "config", "platformSettings"));
  return snap.exists() ? (snap.data() as Record<string, unknown>) : {};
}

export async function updatePlatformCategories(categories: string[]): Promise<void> {
  await setDoc(
    doc(db, "config", "platformSettings"),
    { serviceCategories: categories, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

export async function recordTransaction(data: Record<string, unknown>) {
  const ref = await addDoc(collection(db, "transactions"), { ...data, createdAt: serverTimestamp() });
  return ref.id;
}

export async function getTransactions(
  limit_ = 50,
  cursor?: QueryDocumentSnapshot | null
): Promise<{ data: Record<string, unknown>[]; nextCursor: QueryDocumentSnapshot | null }> {
  const constraints: QueryConstraint[] = [orderBy("createdAt", "desc"), limit(limit_)];
  if (cursor) constraints.push(startAfter(cursor));
  const snap = await getDocs(query(collection(db, "transactions"), ...constraints));
  const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Record<string, unknown>));
  const nextCursor = snap.docs.length === limit_ ? snap.docs[snap.docs.length - 1] : null;
  return { data, nextCursor };
}

export async function getTransactionsForPro(proId: string) {
  const q = query(
    collection(db, "transactions"),
    where("proId", "==", proId),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Record<string, unknown>));
}

export async function getProAvailability(proId: string) {
  const snap = await getDoc(doc(db, "proAvailability", proId));
  if (snap.exists()) return normalizeAvailabilityData(snap.data() as Record<string, unknown>);
  return null;
}

export async function updateProAvailability(
  proId: string, availabilityData: Record<string, unknown>
) {
  await setDoc(
    doc(db, "proAvailability", proId),
    { ...availabilityData, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

export function formatTimestamp(ts: unknown): string {
  if (!ts) return "";
  if (ts instanceof Timestamp)
    return ts.toDate().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  return "";
}

export function formatTimestampTime(ts: unknown): string {
  if (!ts) return "";
  if (ts instanceof Timestamp)
    return ts.toDate().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  return "";
}
