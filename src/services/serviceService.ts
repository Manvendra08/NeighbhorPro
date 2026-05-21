/**
 * serviceService.ts — CRUD for /services collection.
 * Kept separate from firestoreService barrel for clean domain isolation.
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  addDoc,
  deleteDoc,
  query,
  QueryConstraint,
  where,
  orderBy,
  limit,
  startAfter,
  QueryDocumentSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { auth } from "../firebase";
import { db } from "../firebase";
import { isBusinessCategory } from "../constants/serviceCatalog";
import { safeGetDocs } from "./_shared";

export async function createService(data: Record<string, unknown>) {
  if (isBusinessCategory(data.category as string)) {
    const userDoc = await getDoc(doc(db, "users", data.userId as string));
    const sub = userDoc.data()?.subscription;
    if (
      !sub ||
      !["trial", "trial_ending", "active", "renewing", "past_due", "grace", "comped"].includes(sub.status) ||
      (sub.currentPeriodEnd?.toMillis() ?? 0) <= Date.now()
    ) {
      throw new Error("Business category requires an active subscription");
    }
  }
  const ref = await addDoc(collection(db, "services"), { ...data, createdAt: serverTimestamp() });
  return ref.id;
}

export async function getServicesByUser(userId: string) {
  const isOwnerView = auth.currentUser?.uid === userId;
  const ownerFields = ["userId", "ownerId", "user_id"] as const;
  const docsByOwnerField = await Promise.all(
    ownerFields.map(field => safeGetDocs(query(collection(db, "services"), where(field, "==", userId))))
  );
  const merged = new Map<string, Record<string, unknown>>();
  for (const docs of docsByOwnerField) {
    for (const docSnap of docs) {
      merged.set(docSnap.id, { id: docSnap.id, ...docSnap.data() } as Record<string, unknown>);
    }
  }
  const services = Array.from(merged.values());
  if (isOwnerView) return services;
  // Issue #1 fix: Replace any with Record<string, unknown>
  return services.filter((service: Record<string, unknown>) => {
    const status = String(service.status || "").trim().toLowerCase();
    const isPublicStatus = !status || status === "pending" || status === "approved" || status === "featured";
    return isPublicStatus && service.subStatus !== "paused_subscription";
  });
}

export async function getAllServices(
  limit_ = 50,
  cursor?: QueryDocumentSnapshot | null
): Promise<{ data: Record<string, unknown>[]; nextCursor: QueryDocumentSnapshot | null }> {
  const constraints: QueryConstraint[] = [orderBy("createdAt", "desc"), limit(limit_)];
  if (cursor) constraints.push(startAfter(cursor));
  const snap = await getDocs(query(collection(db, "services"), ...constraints));
  const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Record<string, unknown>));
  const nextCursor = snap.docs.length === limit_ ? snap.docs[snap.docs.length - 1] : null;
  return { data, nextCursor };
}

/**
 * @admin-only — Hard-capped at 600 docs (3 × 200). [Task 2]
 * @throws Error if cap is reached.
 */
export async function getAllServicesUnpaginated(): Promise<Record<string, unknown>[]> {
  const MAX_ITERATIONS = 3;
  const PAGE_SIZE = 200;
  const all: Record<string, unknown>[] = [];
  let cursor: QueryDocumentSnapshot | null = null;
  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const { data, nextCursor } = await getAllServices(PAGE_SIZE, cursor);
    all.push(...data);
    if (!nextCursor) break;
    cursor = nextCursor;
    if (i === MAX_ITERATIONS - 1 && nextCursor) {
      throw new Error(
        `getAllServicesUnpaginated() hard cap reached (${MAX_ITERATIONS * PAGE_SIZE} docs). ` +
        "Use getAllServices() with cursor-based pagination for larger datasets."
      );
    }
  }
  return all;
}

export async function updateService(id: string, data: Record<string, unknown>) {
  await updateDoc(doc(db, "services", id), { ...data, updatedAt: serverTimestamp() });
}

export async function deleteService(id: string) {
  await deleteDoc(doc(db, "services", id));
}
