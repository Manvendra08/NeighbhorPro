import {
  collection,
  doc,
  getDocs,
  updateDoc,
  addDoc,
  deleteDoc,
  query,
  QueryConstraint,
  orderBy,
  limit,
  startAfter,
  QueryDocumentSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";

export async function createSociety(data: Record<string, unknown>) {
  const ref = await addDoc(collection(db, "societies"), {
    ...data,
    memberCount: 0,
    subscription: "free",
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function getAllSocieties(
  limit_ = 50,
  cursor?: QueryDocumentSnapshot | null
): Promise<{ data: Record<string, unknown>[]; nextCursor: QueryDocumentSnapshot | null }> {
  const constraints: QueryConstraint[] = [orderBy("name"), limit(limit_)];
  if (cursor) constraints.push(startAfter(cursor));
  const snap = await getDocs(query(collection(db, "societies"), ...constraints));
  const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Record<string, unknown>));
  const nextCursor = snap.docs.length === limit_ ? snap.docs[snap.docs.length - 1] : null;
  return { data, nextCursor };
}

export async function updateSociety(id: string, data: Record<string, unknown>) {
  await updateDoc(doc(db, "societies", id), data);
}

export async function deleteSociety(id: string) {
  await deleteDoc(doc(db, "societies", id));
}
