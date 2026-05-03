import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  setDoc,
  addDoc,
  deleteDoc,
  query,
  Query,
  QueryConstraint,
  where,
  orderBy,
  limit,
  startAfter,
  QueryDocumentSnapshot,
  DocumentData,
  deleteField,
  serverTimestamp,
  onSnapshot,
  Unsubscribe,
  Timestamp,
  runTransaction,
  getCountFromServer,
} from "firebase/firestore";
import { updateProfile } from "firebase/auth";
import { db, auth } from "../firebase";
import { generateUniqueReferralCode, isValidReferralCode, normalizeReferralCode } from "./coinService";
import { validateUpload } from "../utils/cloudinary";
import { captureError } from "../lib/sentry";

/* ═══════════════════════════════════════════
   USERS
═══════════════════════════════════════════ */

// Fields safe to expose to any signed-in user.
const PUBLIC_PROFILE_FIELDS = [
  'uid', 'displayName', 'photoURL', 'bio', 'skills', 'isServiceProvider',
  'rating', 'reviewCount', 'society', 'locality', 'tower',
  'hourlyRate', 'isFreeConsultation',
  'priceAfterQuote', 'role', 'disabled', 'createdAt',
  'emailVisible', 'phoneVisible', 'flatVisible',
  'residencyProofUrl', 'residentVerificationStatus',
] as const;

const AVAILABILITY_DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

export function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return Array.from(
      new Set(
        value
          .filter((item): item is string => typeof item === "string")
          .map(item => item.trim())
          .filter(Boolean)
      )
    );
  }

  if (typeof value === "string") {
    return Array.from(
      new Set(
        value
          .split(",")
          .map(item => item.trim())
          .filter(Boolean)
      )
    );
  }

  return [];
}

export function normalizeProfileData(data: Record<string, unknown>): Record<string, unknown> {
  return {
    ...data,
    skills: normalizeStringArray(data.skills),
  };
}

function derivePublicProfile(uid: string, source: Record<string, unknown>): Record<string, unknown> {
  const safe: Record<string, unknown> = { uid };
  for (const field of PUBLIC_PROFILE_FIELDS) {
    if (field in source) safe[field] = source[field as string];
  }

  const emailVisible = source.emailVisible === true;
  const phoneVisible = source.phoneVisible === true;
  const flatVisible = source.flatVisible === true;

  const email = typeof source.email === "string" ? source.email.trim() : "";
  const phoneNumber = typeof source.phoneNumber === "string" ? source.phoneNumber.trim() : "";
  const flatNumber = typeof source.flatNumber === "string" ? source.flatNumber.trim() : "";

  if (emailVisible && email) safe.email = email;
  if (phoneVisible && phoneNumber) safe.phoneNumber = phoneNumber;
  if (flatVisible && flatNumber) safe.flatNumber = flatNumber;

  return normalizeProfileData(safe);
}

function normalizeAvailabilityDay(value: unknown): Record<string, unknown> {
  const day = value && typeof value === "object" ? value as Record<string, unknown> : {};

  return {
    ...day,
    active: Boolean(day.active),
    slots: normalizeStringArray(day.slots),
  };
}

export function normalizeAvailabilityData(data: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!data) return null;

  const normalized: Record<string, unknown> = { ...data };
  for (const day of AVAILABILITY_DAYS) {
    normalized[day] = normalizeAvailabilityDay(data[day]);
  }

  return normalized;
}

/**
 * Mirror safe fields to /publicProfiles on every profile mutation.
 * Readable by any signed-in user; never contains sensitive data.
 */
export async function mirrorPublicProfile(uid: string, data: object): Promise<void> {
  const source = data as Record<string, unknown>;
  const safe = derivePublicProfile(uid, source);

  if ("emailVisible" in source && source.emailVisible !== true) {
    safe.email = deleteField();
  }
  if ("phoneVisible" in source && source.phoneVisible !== true) {
    safe.phoneNumber = deleteField();
  }
  if ("flatVisible" in source && source.flatVisible !== true) {
    safe.flatNumber = deleteField();
  }

  if (Object.keys(safe).length <= 1) return; // only uid, nothing to write
  await setDoc(
    doc(db, 'publicProfiles', uid),
    { ...safe, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

/**
 * Read a user's FULL document — owner/admin only.
 * For Browse, ProDetail, Messages sidebar, BookingFlow: use getPublicProfile.
 */
export async function getUserProfile(uid: string): Promise<Record<string, unknown> | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? normalizeProfileData({ uid: snap.id, ...snap.data() }) : null;
}

/**
 * Read public-safe profile — accessible to any signed-in user.
 * Falls back to /users with field-stripping for legacy accounts not yet mirrored.
 */
export async function getPublicProfile(uid: string): Promise<Record<string, unknown> | null> {
  const snap = await getDoc(doc(db, 'publicProfiles', uid));
  if (snap.exists()) return derivePublicProfile(snap.id, snap.data() as Record<string, unknown>);
  // Legacy fallback: strip sensitive fields from /users document.
  // This can be denied by rules for non-owner/non-admin callers.
  try {
    const userSnap = await getDoc(doc(db, 'users', uid));
    if (!userSnap.exists()) return null;
    const full = userSnap.data() as Record<string, unknown>;
    return derivePublicProfile(uid, full);
  } catch {
    return null;
  }
}



export async function updateUserProfile(uid: string, data: Record<string, unknown>) {
  const userRef = doc(db, "users", uid);
  const current = await getDoc(userRef);
  const currentData = current.data() ?? {};

  const nextRole = typeof data.role === "string" ? data.role : currentData.role;
  const nextDisabled = typeof data.disabled === "boolean" ? data.disabled : currentData.disabled;
  const mutatesAdminControls = currentData.role === "admin" && (typeof data.role === "string" || typeof data.disabled === "boolean");

  if (mutatesAdminControls && (nextRole !== "admin" || nextDisabled === true)) {
    const rows = await getAllUserRows(500);
    const activeAdmins = rows.filter(user => user.role === "admin" && !user.disabled).length;
    if (activeAdmins <= 1) {
      throw new Error("At least one active admin must remain");
    }
  }

  const nextData: Record<string, unknown> = { ...data };
  const nextDisplayName = (typeof data.displayName === "string" ? data.displayName : (currentData.displayName as string | undefined)) ?? "";
  const nextPhone = (typeof data.phoneNumber === "string" ? data.phoneNumber : (currentData.phoneNumber as string | undefined)) ?? "";

  const currentReferralCode = normalizeReferralCode(currentData.referralCode as string | undefined);
  const shouldGenerateReferralCode = !isValidReferralCode(currentReferralCode);

  if (shouldGenerateReferralCode && (typeof data.displayName === "string" || typeof data.phoneNumber === "string")) {
    try {
      nextData.referralCode = await generateUniqueReferralCode({
        displayName: nextDisplayName,
        phoneNumber: nextPhone,
        uid,
      });
    } catch {
      // Do not block profile updates if referral-code generation query is denied.
    }
  }

  const mergedData = { ...currentData, ...nextData };
  const safe = derivePublicProfile(uid, mergedData);
  if ("emailVisible" in mergedData && mergedData.emailVisible !== true) safe.email = deleteField();
  if ("phoneVisible" in mergedData && mergedData.phoneVisible !== true) safe.phoneNumber = deleteField();
  if ("flatVisible" in mergedData && mergedData.flatVisible !== true) safe.flatNumber = deleteField();

  await runTransaction(db, async tx => {
    tx.update(userRef, { ...nextData, updatedAt: serverTimestamp() });
    if (Object.keys(safe).length > 1) {
      tx.set(doc(db, "publicProfiles", uid), { ...safe, updatedAt: serverTimestamp() }, { merge: true });
    }
  });
  if (auth.currentUser?.uid === uid && typeof nextDisplayName === "string" && nextDisplayName.trim()) {
    await updateProfile(auth.currentUser, { displayName: nextDisplayName.trim() }).catch((error: unknown) => {
      captureError(error, { operation: "sync_auth_display_name", uid });
    });
  }
}

/**
 * Standardized Cloudinary upload with retry logic and consistent error handling.
 */
async function uploadToCloudinary(
  file: File,
  folder: string,
  preset: string,
  cloudName: string,
  resourceType: "image" | "raw" | "auto" = "auto",
  retries = 2
): Promise<{ secure_url: string; resource_type: string; format: string; original_filename: string }> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", preset);
  formData.append("folder", folder);

  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`, {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error?.message || "Upload failed");
      }
      return await response.json();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < retries) {
        // Exponential backoff: 1s, 2s
        await new Promise(res => setTimeout(res, 1000 * Math.pow(2, attempt)));
      }
    }
  }
  throw lastError;
}

export async function uploadProfilePhoto(uid: string, file: File) {
  validateUpload(file, "profilePhoto"); // throws if invalid
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
  if (!cloudName || !uploadPreset) throw new Error("Cloudinary configuration is missing.");

  const data = await uploadToCloudinary(file, "ProNeighbor/profiles", uploadPreset, cloudName, "image");
  const photoURL = data.secure_url;

  if (auth.currentUser) await updateProfile(auth.currentUser, { photoURL });
  await updateDoc(doc(db, "users", uid), { photoURL, updatedAt: serverTimestamp() });
  await mirrorPublicProfile(uid, { photoURL });
  return photoURL;
}

export async function uploadResidencyProof(uid: string, file: File) {
  validateUpload(file, "residencyProof"); // throws if invalid

  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_RESIDENCY_UPLOAD_PRESET || import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
  if (!cloudName) {
    throw new Error("Cloudinary configuration is missing. Please contact support.");
  }
  if (!uploadPreset) {
    throw new Error("Cloudinary upload preset is missing. Set VITE_CLOUDINARY_UPLOAD_PRESET or VITE_CLOUDINARY_RESIDENCY_UPLOAD_PRESET.");
  }

  // Keep Cloudinary default document handling; forcing raw URLs can trigger 401 on delivery.
  const data = await uploadToCloudinary(file, "ProNeighbor/residency-proofs", uploadPreset, cloudName, "auto");
  let residencyProofUrl = data.secure_url;
  const resourceType = data.resource_type || "image";

  // Backward compatibility for previously rewritten PDF URLs.
  if (/\.pdf($|[?#])/i.test(residencyProofUrl) && residencyProofUrl.includes("/raw/upload/")) {
    residencyProofUrl = residencyProofUrl.replace("/raw/upload/", "/image/upload/");
  }

  const update = {
    residencyProofUrl,
    residencyProofPreviewUrl: null,
    residencyProofResourceType: resourceType,
    residentVerificationStatus: "pending",
    verificationMethod: null,
    verificationReviewNote: null,
    verificationReviewedBy: null,
    verificationReviewedAt: null,
    verificationSubmittedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  try {
    await updateDoc(doc(db, "users", uid), update);
  } catch (error) {
    console.error("Residency proof upload failed:", { uid, error, fields: Object.keys(update) });
    throw new Error(`Failed to upload residency proof: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
  // CRITICAL FIX: Mirror to public profile so other users see verification status
  await mirrorPublicProfile(uid, {
    residencyProofUrl,
    residentVerificationStatus: "pending",
  });
  return residencyProofUrl;
}

/**
 * Updates resident verification status with mandatory reviewer metadata.
 * Ensures verification reviews are always auditable by requiring reviewer ID and notes.
 *
 * @param uid - User ID being verified
 * @param status - Verification status ("verified", "none", or "pending")
 * @param method - Verification method ("manual", "auto", or null)
 * @param reviewerUid - REQUIRED: UID of the admin performing the review
 * @param reviewNote - REQUIRED for rejection (status="none"), captures rejection reason
 * @throws Error if required metadata is missing or write assertion fails
 */
export async function deleteResidencyProof(uid: string) {
  const userRef = doc(db, "users", uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) {
    throw new Error("Profile not found");
  }

  const currentData = snap.data() as Record<string, unknown>;
  const preserveReviewNote = currentData.residentVerificationStatus !== "pending"
    ? (typeof currentData.verificationReviewNote === "string" ? currentData.verificationReviewNote : null)
    : null;

  const update = {
    residencyProofUrl: null,
    residencyProofPreviewUrl: null,
    residencyProofResourceType: null,
    residentVerificationStatus: "none",
    verificationMethod: null,
    verificationReviewNote: preserveReviewNote,
    verificationSubmittedAt: null,
    updatedAt: serverTimestamp(),
  };

  await updateDoc(userRef, update);
  await mirrorPublicProfile(uid, update);
}

export async function updateResidentVerification(
  uid: string,
  status: "none" | "pending" | "verified",
  method: "manual" | "auto" | null,
  reviewerUid: string,
  reviewNote?: string
) {
  // Validate required reviewer metadata
  if (!reviewerUid || reviewerUid.trim() === "") {
    throw new Error("Reviewer UID is required for verification review");
  }

  // Rejection must include reason
  if (status === "none" && (!reviewNote || reviewNote.trim() === "")) {
    throw new Error("Review note is required for rejections");
  }

  const update = {
    residentVerificationStatus: status,
    verificationMethod: method,
    verificationReviewedBy: reviewerUid,
    verificationReviewNote: status === "none" ? (reviewNote || "") : null,
    verificationReviewedAt: status === "pending" ? null : serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  // Write update
  await updateDoc(doc(db, "users", uid), update);
  await setDoc(
    doc(db, "publicProfiles", uid),
    {
      residentVerificationStatus: status,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
  await mirrorPublicProfile(uid, update);

  // Assert write succeeded by reading back
  const readBack = await getDoc(doc(db, "users", uid));
  const data = readBack.data();
  if (!data || data.verificationReviewedBy !== reviewerUid) {
    throw new Error(
      "Audit metadata write assertion failed: reviewer ID not persisted"
    );
  }
}

/**
 * Fetches users with 'pending' residentVerificationStatus.
 * Used for admin approval workflow.
 */
export async function getPendingVerifications(): Promise<Record<string, unknown>[]> {
  const q = query(
    collection(db, "users"),
    where("residentVerificationStatus", "==", "pending"),
    orderBy("updatedAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ ...d.data(), uid: d.id }));
}

export const BROWSE_PAGE_SIZE = 20;
const PROFESSIONAL_FALLBACK_MULTIPLIER = 5;

function toEpochMillis(value: unknown): number {
  if (!value) return 0;
  if (value instanceof Timestamp) return value.toDate().getTime();
  if (typeof value === "object" && value !== null && "seconds" in (value as Record<string, unknown>)) {
    const seconds = Number((value as { seconds?: number }).seconds);
    return Number.isFinite(seconds) ? seconds * 1000 : 0;
  }
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

async function safeGetDocs(inputQuery: Query<DocumentData>): Promise<QueryDocumentSnapshot<DocumentData>[]> {
  try {
    const snapshot = await getDocs(inputQuery);
    return snapshot.docs;
  } catch {
    return [];
  }
}

function mergeAndSortByCreatedAt(
  docs: QueryDocumentSnapshot<DocumentData>[]
): Record<string, unknown>[] {
  const merged = new Map<string, Record<string, unknown>>();
  for (const item of docs) {
    if (!merged.has(item.id)) {
      merged.set(item.id, { id: item.id, ...item.data() } as Record<string, unknown>);
    }
  }
  return Array.from(merged.values()).sort((a, b) => toEpochMillis(b.createdAt) - toEpochMillis(a.createdAt));
}

function isProfessionalProfile(data: Record<string, unknown>): boolean {
  if (data.isServiceProvider === true) return true;

  const role = typeof data.role === "string" ? data.role.toLowerCase() : "";
  return role === "professional" || role === "both";
}

function mergeAndSortProfessionals(
  docs: QueryDocumentSnapshot<DocumentData>[]
): Record<string, unknown>[] {
  const merged = new Map<string, Record<string, unknown>>();
  for (const item of docs) {
    if (!merged.has(item.id)) {
      const normalized = derivePublicProfile(item.id, item.data() as Record<string, unknown>);
      if (isProfessionalProfile(normalized)) {
        merged.set(item.id, normalized);
      }
    }
  }
  return Array.from(merged.values()).sort((a, b) => toEpochMillis(b.createdAt) - toEpochMillis(a.createdAt));
}

function shouldBackfillRatingAggregate(profile: Record<string, unknown>): boolean {
  const rating = Number(profile.rating) || 0;
  const reviewCount = Math.max(0, Number(profile.reviewCount) || 0);
  if (rating > 0 && reviewCount > 0) return false;
  if ((rating > 0 && reviewCount === 0) || (rating <= 0 && reviewCount > 0)) return true;

  // For very new profiles, empty aggregates are expected; avoid expensive recalc on every browse.
  const createdAtMs = toEpochMillis(profile.createdAt);
  if (createdAtMs === 0) return true;
  const twoWeeksMs = 14 * 24 * 60 * 60 * 1000;
  return Date.now() - createdAtMs >= twoWeeksMs;
}

async function healProfessionalAggregates(profiles: Record<string, unknown>[]): Promise<Record<string, unknown>[]> {
  return Promise.all(
    profiles.map(async (profile) => {
      if (!shouldBackfillRatingAggregate(profile)) return profile;

      const uid = String(profile.uid || profile.id || "").trim();
      if (!uid) return profile;

      try {
        const aggregate = await recalculateProRating(uid);
        return { ...profile, ...aggregate };
      } catch {
        return profile;
      }
    })
  );
}

/**
 * Paginated professional listing ordered by createdAt desc.
 * Server-side locality/tower filtering uses Firestore where() clauses
 * to prevent the empty-page problem of client-side post-pagination filtering.
 * Composite indexes required: locality+createdAt and tower+createdAt.
 */
export async function listProfessionals(
  cursor?: QueryDocumentSnapshot<DocumentData> | null,
  filters?: { locality?: string; society?: string; tower?: string }
): Promise<{ data: Record<string, unknown>[]; nextCursor: QueryDocumentSnapshot<DocumentData> | null }> {
  const primaryConstraints: QueryConstraint[] = [where("isServiceProvider", "==", true)];
  if (filters?.society) primaryConstraints.push(where("society", "==", filters.society));
  if (filters?.locality) primaryConstraints.push(where("locality", "==", filters.locality));
  if (filters?.tower) primaryConstraints.push(where("tower", "==", filters.tower));
  primaryConstraints.push(orderBy("createdAt", "desc"));
  primaryConstraints.push(limit(BROWSE_PAGE_SIZE));
  if (cursor) primaryConstraints.push(startAfter(cursor));
  const primaryDocs = await safeGetDocs(query(collection(db, "publicProfiles"), ...primaryConstraints));
  const primaryData = mergeAndSortProfessionals(primaryDocs);
  const healedPrimaryData = await healProfessionalAggregates(primaryData);
  // Keep fast indexed pagination whenever mirror query succeeds.
  if (healedPrimaryData.length > 0 || cursor) {
    const nextCursor = primaryDocs.length === BROWSE_PAGE_SIZE ? primaryDocs[primaryDocs.length - 1] : null;
    return { data: healedPrimaryData.slice(0, BROWSE_PAGE_SIZE), nextCursor };
  }
  // Legacy resilience:
  // 1) role=professional|both docs from older schema
  // 2) docs missing createdAt (excluded by orderBy query)
  // 3) mirror lag between /users and /publicProfiles
  const broadLimit = BROWSE_PAGE_SIZE * PROFESSIONAL_FALLBACK_MULTIPLIER;
  const broadPublicConstraints: QueryConstraint[] = [limit(broadLimit)];
  const broadUserConstraints: QueryConstraint[] = [limit(broadLimit)];
  if (filters?.society) {
    broadPublicConstraints.unshift(where("society", "==", filters.society));
    broadUserConstraints.unshift(where("society", "==", filters.society));
  }
  if (filters?.locality) {
    broadPublicConstraints.unshift(where("locality", "==", filters.locality));
    broadUserConstraints.unshift(where("locality", "==", filters.locality));
  }
  if (filters?.tower) {
    broadPublicConstraints.unshift(where("tower", "==", filters.tower));
    broadUserConstraints.unshift(where("tower", "==", filters.tower));
  }
  const [broadPublicDocs, broadUserDocs] = await Promise.all([
    safeGetDocs(query(collection(db, "publicProfiles"), ...broadPublicConstraints)),
    safeGetDocs(query(collection(db, "users"), ...broadUserConstraints)),
  ]);
  const data = mergeAndSortProfessionals([...broadPublicDocs, ...broadUserDocs]).slice(0, BROWSE_PAGE_SIZE);
  return { data: await healProfessionalAggregates(data), nextCursor: null };
}
export async function getAllUsers(
  limit_ = 50,
  cursor?: QueryDocumentSnapshot | null
): Promise<{ data: Record<string, unknown>[]; nextCursor: QueryDocumentSnapshot | null }> {
  const constraints: QueryConstraint[] = [orderBy("createdAt", "desc"), limit(limit_)];
  if (cursor) constraints.push(startAfter(cursor));
  const snap = await getDocs(query(collection(db, "users"), ...constraints));
  const data = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
  const nextCursor = snap.docs.length === limit_ ? snap.docs[snap.docs.length - 1] : null;
  return { data, nextCursor };
}

// Use this in UI components that only need rows and not pagination metadata.
export async function getAllUserRows(limit_ = 50): Promise<Record<string, unknown>[]> {
  const res = await getAllUsers(limit_);
  return Array.isArray(res.data) ? res.data : [];
}

/* ═══════════════════════════════════════════
   SERVICES
═══════════════════════════════════════════ */
export async function createService(data: Record<string, unknown>) {
  const ref = await addDoc(collection(db, "services"), { ...data, createdAt: serverTimestamp() });
  return ref.id;
}
export async function getServicesByUser(userId: string) {
  const constraints: QueryConstraint[] = [where("userId", "==", userId)];
  const isOwnerView = auth.currentUser?.uid === userId;
  if (!isOwnerView) {
    constraints.push(where("status", "in", ["approved", "featured"]));
  }
  const q = query(collection(db, "services"), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Record<string, unknown>));
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
export async function getAllServicesUnpaginated(): Promise<Record<string, unknown>[]> {
  const all: Record<string, unknown>[] = [];
  let cursor: QueryDocumentSnapshot | null = null;
  while (true) {
    const { data, nextCursor } = await getAllServices(200, cursor);
    all.push(...data);
    if (!nextCursor) break;
    cursor = nextCursor;
  }
  return all;
}
export async function updateService(id: string, data: Record<string, unknown>) {
  await updateDoc(doc(db, "services", id), { ...data, updatedAt: serverTimestamp() });
}
export async function deleteService(id: string) { await deleteDoc(doc(db, "services", id)); }

/* ═══════════════════════════════════════════
   BOOKINGS
═══════════════════════════════════════════ */
export async function createBooking(data: Record<string, unknown>) {
  const bookingPayload = { ...data };
  const clientId = (bookingPayload.clientId as string) || (bookingPayload.clientUid as string) || "";
  const proId = (bookingPayload.proId as string) || (bookingPayload.proUid as string) || "";
  const amount = Math.max(0, Math.trunc(Number(bookingPayload.amount ?? 0) || 0));
  const notesValue = typeof bookingPayload.notes === "string" ? bookingPayload.notes : "";
  if (notesValue.length > 500) {
    throw new Error("NOTES_TOO_LONG");
  }
  const explicitEscrowCoins = Math.max(0, Math.trunc(Number(bookingPayload.escrowCoins ?? 0) || 0));
  const escrowCoins = explicitEscrowCoins > 0 ? explicitEscrowCoins : amount;

  if (!clientId || !proId) {
    throw new Error("BOOKING_PARTICIPANTS_REQUIRED");
  }
  if (clientId === proId) {
    throw new Error("SELF_BOOKING_NOT_ALLOWED");
  }

  bookingPayload.clientId = clientId;
  bookingPayload.clientUid = clientId;
  bookingPayload.proId = proId;
  bookingPayload.proUid = proId;

  const bookingRef = doc(collection(db, "bookings"));
  const now = serverTimestamp();
  const isPaid = escrowCoins > 0;
  const bookingDoc = {
    ...bookingPayload,
    amount,
    isPaid,
    coinsPaid: isPaid,
    escrowCoins,
    escrowStatus: isPaid ? "held" : "none",
    status: "pending",
    createdAt: now,
    updatedAt: now,
  };

  await runTransaction(db, async tx => {
    if (escrowCoins > 0) {
      const userRef = doc(db, "users", clientId);
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists()) throw new Error("USER_NOT_FOUND");

      const balance = Math.max(0, Math.trunc(Number(userSnap.data()?.coinBalance ?? 0) || 0));
      if (balance < escrowCoins) throw new Error("INSUFFICIENT_BALANCE");

      const newBal = balance - escrowCoins;
      const ledgerEntryId = `${bookingRef.id}_hold_${clientId}`;
      tx.update(userRef, { coinBalance: newBal, updatedAt: serverTimestamp(), lastLedgerEntryId: ledgerEntryId });
      tx.set(bookingRef, bookingDoc);
      tx.set(doc(collection(db, "coinLedger", clientId, "entries"), ledgerEntryId), {
        uid: clientId,
        type: "booking_escrow",
        amount: -escrowCoins,
        balanceAfter: newBal,
        description: `Payment held: ${(bookingPayload.serviceName as string) || "Booking"}`,
        refId: bookingRef.id,
        createdAt: serverTimestamp(),
      });
      return;
    }

    tx.set(bookingRef, bookingDoc);
  });

  return bookingRef.id;
}
export async function updateBookingStatus(bookingId: string, status: string) {
  if (!/^(confirmed|reviewed)$/.test(status)) {
    throw new Error("INVALID_BOOKING_STATUS");
  }

  await runTransaction(db, async tx => {
    const ref = doc(db, "bookings", bookingId);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("BOOKING_NOT_FOUND");

    const currentStatus = String(snap.data()?.status ?? "");
    const update: Record<string, unknown> = { status, updatedAt: serverTimestamp() };

    if (status === "confirmed") {
      if (currentStatus !== "pending") throw new Error("INVALID_BOOKING_TRANSITION");
      update.confirmedAt = serverTimestamp();
      update.confirmedBy = auth.currentUser?.uid ?? null;
    }

    if (status === "reviewed") {
      if (currentStatus !== "completed") throw new Error("INVALID_BOOKING_TRANSITION");
      update.reviewedAt = serverTimestamp();
      update.reviewedBy = auth.currentUser?.uid ?? null;
    }

    tx.update(ref, update);
  });
}
export async function getBookingsForUser(uid: string) {
  const primaryQuery = query(collection(db, "bookings"), where("clientUid", "==", uid), orderBy("createdAt", "desc"));
  const [primaryDocs, legacyDocs] = await Promise.all([
    safeGetDocs(primaryQuery),
    safeGetDocs(query(collection(db, "bookings"), where("clientId", "==", uid), orderBy("createdAt", "desc"))),
  ]);

  return mergeAndSortByCreatedAt([...primaryDocs, ...legacyDocs]);
}
export async function getBookingsForPro(uid: string) {
  const primaryQuery = query(collection(db, "bookings"), where("proUid", "==", uid), orderBy("createdAt", "desc"));
  const [primaryDocs, legacyDocs] = await Promise.all([
    safeGetDocs(primaryQuery),
    safeGetDocs(query(collection(db, "bookings"), where("proId", "==", uid), orderBy("createdAt", "desc"))),
  ]);

  return mergeAndSortByCreatedAt([...primaryDocs, ...legacyDocs]);
}
export async function getAllBookings(
  limit_ = 50,
  cursor?: QueryDocumentSnapshot | null
): Promise<{ data: Record<string, unknown>[]; nextCursor: QueryDocumentSnapshot | null }> {
  const constraints: QueryConstraint[] = [orderBy("createdAt", "desc"), limit(limit_)];
  if (cursor) constraints.push(startAfter(cursor));
  const snap = await getDocs(query(collection(db, "bookings"), ...constraints));
  const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Record<string, unknown>));
  const nextCursor = snap.docs.length === limit_ ? snap.docs[snap.docs.length - 1] : null;
  return { data, nextCursor };
}
export async function getBookingById(bookingId: string) {
  const snap = await getDoc(doc(db, "bookings", bookingId));
  return snap.exists() ? { id: snap.id, ...snap.data() } as Record<string, unknown> : null;
}
export async function getLatestBookingBetweenUsers(uid1: string, uid2: string): Promise<Record<string, unknown> | null> {
  const buildPairQueries = (clientUid: string, proUid: string): Query<DocumentData>[] => [
    query(collection(db, "bookings"), where("clientUid", "==", clientUid), where("proUid", "==", proUid), orderBy("createdAt", "desc"), limit(1)),
    query(collection(db, "bookings"), where("clientId", "==", clientUid), where("proId", "==", proUid), orderBy("createdAt", "desc"), limit(1)),
    query(collection(db, "bookings"), where("clientUid", "==", clientUid), where("proId", "==", proUid), orderBy("createdAt", "desc"), limit(1)),
    query(collection(db, "bookings"), where("clientId", "==", clientUid), where("proUid", "==", proUid), orderBy("createdAt", "desc"), limit(1)),
  ];

  const allQueries = [...buildPairQueries(uid1, uid2), ...buildPairQueries(uid2, uid1)];
  const docsByQuery = await Promise.all(allQueries.map((q) => safeGetDocs(q)));
  const candidates = docsByQuery.flat();

  if (!candidates.length) return null;

  const latest = candidates.sort((a, b) => {
    const aSec = (a.data()?.createdAt as Timestamp | undefined)?.seconds ?? 0;
    const bSec = (b.data()?.createdAt as Timestamp | undefined)?.seconds ?? 0;
    return bSec - aSec;
  })[0];

  return { id: latest.id, ...latest.data() } as Record<string, unknown>;
}
export async function getLastCompletedBookingForUser(uid: string) {
  const [currentDocs, legacyDocs] = await Promise.all([
    safeGetDocs(query(
      collection(db, "bookings"),
      where("clientUid", "==", uid),
      where("status", "in", ["completed", "reviewed"]),
      orderBy("createdAt", "desc"),
      limit(1)
    )),
    safeGetDocs(query(
      collection(db, "bookings"),
      where("clientId", "==", uid),
      where("status", "in", ["completed", "reviewed"]),
      orderBy("createdAt", "desc"),
      limit(1)
    )),
  ]);

  const sorted = mergeAndSortByCreatedAt([...currentDocs, ...legacyDocs]);
  return sorted[0] ?? null;
}
export async function updateBookingFields(bookingId: string, data: Record<string, unknown>) {
  await updateDoc(doc(db, "bookings", bookingId), { ...data, updatedAt: serverTimestamp() });
}
export async function getBookingsForProOnDate(proId: string, date: string) {
  const [currentDocs, legacyDocs] = await Promise.all([
    safeGetDocs(query(collection(db, "bookings"), where("proUid", "==", proId), where("date", "==", date))),
    safeGetDocs(query(collection(db, "bookings"), where("proId", "==", proId), where("date", "==", date))),
  ]);

  return mergeAndSortByCreatedAt([...currentDocs, ...legacyDocs]);
}

// upload booking attachment
export async function uploadBookingAttachment(bookingId: string | null, file: File) {
  validateUpload(file, "bookingAttachment"); // throws if invalid
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
  if (!cloudName || !uploadPreset) throw new Error("Cloudinary missing");

  const data = await uploadToCloudinary(file, "ProNeighbor/bookings", uploadPreset, cloudName, "auto");
  const fileUrl = data.secure_url;

  if (bookingId) {
    await updateDoc(doc(db, "bookings", bookingId), { attachmentUrl: fileUrl, attachmentName: file.name, attachmentType: file.type });
  }

  return { url: fileUrl, name: file.name, type: file.type };
}

/* ═══════════════════════════════════════════
   AVAILABILITY
═══════════════════════════════════════════ */
export async function getProAvailability(proId: string) {
  const snap = await getDoc(doc(db, "proAvailability", proId));
  if (snap.exists()) return normalizeAvailabilityData(snap.data() as Record<string, unknown>);
  return null;
}


export async function getPlatformSettings(): Promise<Record<string, unknown>> {
  const snap = await getDoc(doc(db, "config", "platformSettings"));
  return snap.exists() ? (snap.data() as Record<string, unknown>) : {};
}
export async function updatePlatformCategories(categories: string[]): Promise<void> {
  await setDoc(
    doc(db, "config", "platformSettings"),
    {
      serviceCategories: categories,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}
export async function updateProAvailability(proId: string, availabilityData: Record<string, unknown>) {
  await setDoc(doc(db, "proAvailability", proId), { ...availabilityData, updatedAt: serverTimestamp() }, { merge: true });
}

/* ═══════════════════════════════════════════
   REVIEWS
═══════════════════════════════════════════ */
export async function addReview(bookingId: string, proId: string, rating: number, comment: string) {
  if (!auth.currentUser) throw new Error("Must be logged in to review");
  const clientId = auth.currentUser.uid;
  const normalizedRating = Math.trunc(Number(rating));
  const normalizedComment = comment.trim();

  if (!Number.isInteger(normalizedRating) || normalizedRating < 1 || normalizedRating > 5) {
    throw new Error("Rating must be an integer between 1 and 5.");
  }
  if (!normalizedComment || normalizedComment.length > 1000) {
    throw new Error("Comment must be between 1 and 1000 characters.");
  }

  const reviewId = `${bookingId}_${clientId}`;
  const reviewRef = doc(db, "reviews", reviewId);
  const bookingRef = doc(db, "bookings", bookingId);

  await runTransaction(db, async tx => {
    const existing = await tx.get(reviewRef);
    if (existing.exists()) {
      throw new Error("You have already submitted a review for this booking.");
    }

    const bookingSnap = await tx.get(bookingRef);
    if (!bookingSnap.exists()) {
      throw new Error("Booking not found.");
    }

    const booking = bookingSnap.data() as Record<string, unknown>;
    const bookingClientId = String(booking.clientId || booking.clientUid || "");
    const bookingProId = String(booking.proId || booking.proUid || "");
    const bookingStatus = String(booking.status || "");

    if (bookingClientId !== clientId) {
      throw new Error("Only the booking client can submit a review.");
    }
    if (bookingProId !== proId) {
      throw new Error("Review professional does not match booking.");
    }
    if (!['completed', 'reviewed'].includes(bookingStatus)) {
      throw new Error("Review can only be submitted after booking completion.");
    }

    tx.set(reviewRef, {
      bookingId,
      proId,
      clientId,
      clientName: auth.currentUser?.displayName || "User",
      clientPhoto: auth.currentUser?.photoURL || "",
      rating: normalizedRating,
      comment: normalizedComment,
      createdAt: serverTimestamp(),
    });
  });

  // Spam flagging is handled server-side by a Cloud Function trigger.
  await recalculateProRating(proId);
}

export async function addResidentReview(bookingId: string, clientId: string, rating: number, comment: string) {
  if (!auth.currentUser) throw new Error("Must be logged in to review");
  const proId = auth.currentUser.uid;
  const reviewId = `${bookingId}_${proId}`;
  const reviewRef = doc(db, "residentReviews", reviewId);
  const bookingRef = doc(db, "bookings", bookingId);

  await runTransaction(db, async tx => {
    const existing = await tx.get(reviewRef);
    if (existing.exists()) {
      throw new Error("You have already rated this resident for this booking.");
    }

    const bookingSnap = await tx.get(bookingRef);
    if (!bookingSnap.exists()) {
      throw new Error("Booking not found.");
    }

    const booking = bookingSnap.data() as Record<string, unknown>;
    const status = String(booking.status || "");
    const bookingClientId = String(booking.clientId || booking.clientUid || "");
    const bookingProId = String(booking.proId || booking.proUid || "");

    if (bookingProId !== proId) {
      throw new Error("Only booking professional can rate resident.");
    }
    if (bookingClientId !== clientId) {
      throw new Error("Resident mismatch for this booking.");
    }
    if (!['completed', 'reviewed'].includes(status)) {
      throw new Error("Resident can be rated only after completion.");
    }

    tx.set(reviewRef, {
      bookingId,
      clientId,
      proId,
      reviewerRole: "pro",
      rating,
      comment,
      createdAt: serverTimestamp(),
    });
  });
}

export async function hasResidentReview(bookingId: string, proId: string): Promise<boolean> {
  if (!bookingId || !proId) return false;
  const reviewId = `${bookingId}_${proId}`;
  const snap = await getDoc(doc(db, "residentReviews", reviewId));
  return snap.exists();
}

export async function getReviewsForUser(proId: string) {
  const q = query(collection(db, "reviews"), where("proId", "==", proId), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Record<string, unknown>));
}
export async function getReviewDistribution(proId: string): Promise<Record<number, number>> {
  const reviews = await getReviewsForUser(proId);
  const distribution: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  for (const review of reviews) {
    const rating = Number(review.rating);
    if (Number.isFinite(rating) && rating >= 1 && rating <= 5) {
      distribution[Math.round(rating)] += 1;
    }
  }
  return distribution;
}

export async function recalculateProRating(proId: string): Promise<{ rating: number; reviewCount: number }> {
  const allReviews = await getReviewsForUser(proId);
  const validRatings = allReviews
    .map(review => Number(review.rating))
    .filter(rating => Number.isFinite(rating) && rating >= 1 && rating <= 5) as number[];
  const avg = validRatings.length > 0
    ? validRatings.reduce((sum, rating) => sum + rating, 0) / validRatings.length
    : 0;
  const update = { rating: Math.round(avg * 10) / 10, reviewCount: allReviews.length };
  await updateDoc(doc(db, "users", proId), update);
  await mirrorPublicProfile(proId, update);
  return update;
}
export async function checkSpamReviews(proId: string) {
  // Deprecated: automated spam checks run in Cloud Functions.
  // Kept as a no-op for backward compatibility with older imports.
  void proId;
}
export async function hasUserReportedProfessional(proId: string, reporterId: string): Promise<boolean> {
  const pairId = `${proId}_${reporterId}`;
  const reportDoc = await getDoc(doc(db, "reports", pairId));
  return reportDoc.exists();
}

export async function reportProfessional(proId: string, reason: string, comment: string): Promise<{ success: boolean; alreadyReported?: boolean }> {
  if (!auth.currentUser) throw new Error("Must be logged in to report");
  const reporterId = auth.currentUser.uid;
  const pairId = `${proId}_${reporterId}`;
  const reportRef = doc(db, "reports", pairId);
  const existing = await getDoc(reportRef);
  if (existing.exists()) {
    return { success: false, alreadyReported: true };
  }

  await setDoc(reportRef, {
    id: pairId,
    proId,
    reporterId,
    reason,
    comment,
    status: "pending",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return { success: true };
}

/* ═══════════════════════════════════════════
   SOCIETIES
═══════════════════════════════════════════ */
export async function createSociety(data: Record<string, unknown>) {
  const ref = await addDoc(collection(db, "societies"), { ...data, memberCount: 0, subscription: "free", createdAt: serverTimestamp() });
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
export async function updateSociety(id: string, data: Record<string, unknown>) { await updateDoc(doc(db, "societies", id), data); }
export async function deleteSociety(id: string) { await deleteDoc(doc(db, "societies", id)); }

/* ═══════════════════════════════════════════
   TRANSACTIONS
═══════════════════════════════════════════ */
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
  const q = query(collection(db, "transactions"), where("proId", "==", proId), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Record<string, unknown>));
}

/* ═══════════════════════════════════════════
   MESSAGES
═══════════════════════════════════════════ */
/**
 * Returns a deterministic conversation ID for a pair of users (sorted UIDs joined by '_').
 * This is idempotent and eliminates duplicate conversation documents.
 */
export function getConversationId(uid1: string, uid2: string, bookingId?: string): string {
  const baseId = [uid1, uid2].sort().join("_");
  return bookingId ? `${baseId}__booking__${bookingId}` : baseId;
}

export function getConversationBookingId(conversationId: string): string | null {
  const marker = "__booking__";
  const markerIndex = conversationId.indexOf(marker);
  if (markerIndex < 0) return null;
  const bookingId = conversationId.slice(markerIndex + marker.length).trim();
  return bookingId || null;
}

type ConversationOptions = {
  bookingId?: string;
  allowUnlinked?: boolean;
};

function bookingHasUsers(booking: Record<string, unknown>, uid1: string, uid2: string): boolean {
  const participants = new Set<string>([
    booking.clientId as string,
    booking.clientUid as string,
    booking.proId as string,
    booking.proUid as string,
  ].filter(Boolean));
  return participants.has(uid1) && participants.has(uid2);
}

export async function getOrCreateConversation(uid1: string, uid2: string, options?: ConversationOptions) {
  const bookingId = options?.bookingId;
  const convId = getConversationId(uid1, uid2, bookingId);
  const convRef = doc(db, "messages", convId);
  const allowUnlinked = options?.allowUnlinked === true;

  if (!allowUnlinked) {
    if (!bookingId) {
      throw new Error("BOOKING_REQUIRED");
    }
    const booking = await getBookingById(bookingId);
    if (!booking || !bookingHasUsers(booking, uid1, uid2)) {
      throw new Error("INVALID_BOOKING_PARTICIPANTS");
    }
    if ((booking.status as string) === "cancelled") {
      throw new Error("BOOKING_CANCELLED");
    }
  }

  const [p1, p2] = await Promise.all([getPublicProfile(uid1), getPublicProfile(uid2)]);

  const participantNames: Record<string, string> = {
    [uid1]: (p1?.displayName as string) || "User",
    [uid2]: (p2?.displayName as string) || "User",
  };
  const participantPhotos: Record<string, string> = {
    [uid1]: (p1?.photoURL as string) || "",
    [uid2]: (p2?.photoURL as string) || "",
  };

  await runTransaction(db, async tx => {
    const snap = await tx.get(convRef);
    if (!snap.exists()) {
      tx.set(convRef, {
        participants: [uid1, uid2].sort(),
        participantNames,
        participantPhotos,
        bookingId: bookingId || null,
        lastMessage: "",
        lastMessageAt: serverTimestamp(),
      });
    } else if (bookingId && !(snap.data().bookingId as string | undefined)) {
      tx.update(convRef, {
        bookingId,
        participantNames,
        participantPhotos,
      });
    }
  });
  return convId;
}
export async function sendMessage(conversationId: string, senderId: string, text: string, attachment?: { url: string; type: string; name: string }) {
  const payload: Record<string, unknown> = { senderId, text, timestamp: serverTimestamp(), read: false };
  if (attachment) {
    payload.attachmentUrl = attachment.url;
    payload.attachmentType = attachment.type;
    payload.attachmentName = attachment.name;
  }
  const lastMsg = attachment ? (text ? `📎 ${text}` : `📎 Attachment`) : text;
  const senderDisplayName = auth.currentUser?.displayName || "User";
  const senderPhotoURL = auth.currentUser?.photoURL || "";

  await runTransaction(db, async tx => {
    const chatRef = doc(collection(db, `messages/${conversationId}/chats`));
    const convRef = doc(db, "messages", conversationId);

    tx.set(chatRef, payload);
    // Merge keeps this safe even if conversation metadata is partially missing.
    tx.set(convRef, {
      lastMessage: lastMsg,
      lastMessageAt: serverTimestamp(),
      lastSenderId: senderId,
      [`participantNames.${senderId}`]: senderDisplayName,
      [`participantPhotos.${senderId}`]: senderPhotoURL,
    }, { merge: true });
  });
}

export async function uploadAttachment(conversationId: string, file: File) {
  validateUpload(file, "chatAttachment"); // throws if invalid
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
  if (!cloudName || !uploadPreset) throw new Error("Cloudinary configuration is missing.");

  const data = await uploadToCloudinary(file, `ProNeighbor/messages/${conversationId}`, uploadPreset, cloudName, "auto");
  return { url: data.secure_url as string, resourceType: data.resource_type as string, format: data.format as string, originalFilename: data.original_filename as string };
}
export function subscribeToMessages(conversationId: string, callback: (messages: Record<string, unknown>[]) => void): Unsubscribe {
  const q = query(collection(db, `messages/${conversationId}/chats`), orderBy("timestamp", "asc"));
  return onSnapshot(q, snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
}
export function subscribeToConversations(uid: string, callback: (convos: Record<string, unknown>[]) => void): Unsubscribe {
  const q = query(collection(db, "messages"), where("participants", "array-contains", uid), orderBy("lastMessageAt", "desc"));
  return onSnapshot(q, snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
}

/* ═══════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════ */
export function formatTimestamp(ts: unknown): string {
  if (!ts) return "";
  if (ts instanceof Timestamp) return ts.toDate().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  return "";
}
export function formatTimestampTime(ts: unknown): string {
  if (!ts) return "";
  if (ts instanceof Timestamp) return ts.toDate().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  return "";
}

/* ═══════════════════════════════════════════
   LOCAL FEED
═══════════════════════════════════════════ */
export async function createFeedPost(data: {
  authorId: string;
  authorName: string;
  authorPhotoURL?: string;
  content: string;
  locality?: string;
  society?: string;
  tower?: string;
}) {
  const ref = await addDoc(collection(db, "localFeed"), {
    ...data,
    createdAt: serverTimestamp(),
    reactions: {},
    likes: [],
    likeCount: 0,
    commentCount: 0,
  });
  return ref.id;
}

export function subscribeToFeed(
  locality: string | undefined,
  callback: (posts: Record<string, unknown>[]) => void
): Unsubscribe {
  const q = locality
    ? query(collection(db, "localFeed"), where("locality", "==", locality), orderBy("createdAt", "desc"), limit(30))
    : query(collection(db, "localFeed"), orderBy("createdAt", "desc"), limit(30));
  return onSnapshot(q, snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
}

export async function deleteFeedPost(postId: string) {
  await deleteDoc(doc(db, "localFeed", postId));
}

export type FeedReportReason = "offensive" | "scam" | "spam" | "policy_violation" | "other";

export async function reportFeedPost(
  postId: string,
  reporterId: string,
  reason: FeedReportReason,
  details?: string,
): Promise<{ success: boolean; alreadyReported?: boolean }> {
  // Dedup: one report per user per post
  const dedupId = `${postId}_${reporterId}`;
  const dedupRef = doc(db, "feedReports", dedupId);
  const existing = await getDoc(dedupRef);
  if (existing.exists()) return { success: false, alreadyReported: true };

  await setDoc(dedupRef, {
    postId,
    reporterId,
    reason,
    details: details ?? "",
    status: "pending",
    createdAt: serverTimestamp(),
  });

  // Increment report count on the post; auto-hide after 3 reports
  const postRef = doc(db, "localFeed", postId);
  const postSnap = await getDoc(postRef);
  if (postSnap.exists()) {
    const currentCount = ((postSnap.data()?.reportCount as number) ?? 0) + 1;
    await updateDoc(postRef, {
      reportCount: currentCount,
      ...(currentCount >= 3 ? { hidden: true } : {}),
    });
  }
  return { success: true };
}

/** Toggle a reaction (👏 or 👍) on a feed post. */
export async function toggleReactionToFeedPost(postId: string, uid: string, type: "clap" | "thumb") {
  const postRef = doc(db, "localFeed", postId);

  await runTransaction(db, async tx => {
    const postSnap = await tx.get(postRef);
    if (!postSnap.exists()) return;

    const data = postSnap.data();
    const currentReactions = (data.reactions as Record<string, string>) || {};
    const currentLikes = Array.isArray(data.likes) ? (data.likes as string[]) : [];

    const existing = currentReactions[uid];
    const nextReactions = existing === type
      ? Object.fromEntries(Object.entries(currentReactions).filter(([userId]) => userId !== uid))
      : { ...currentReactions, [uid]: type };
    const nextLikes = existing === type
      ? currentLikes.filter(userId => userId !== uid)
      : (currentLikes.includes(uid) ? currentLikes : [...currentLikes, uid]);

    tx.update(postRef, {
      reactions: nextReactions,
      likes: nextLikes,
      likeCount: nextLikes.length,
      updatedAt: serverTimestamp()
    });
  });
}

/* ═══════════════════════════════════════════
   RECENTLY VIEWED / RECOMMENDATIONS
═══════════════════════════════════════════ */
export async function trackProView(uid: string, proId: string) {
  const userRef = doc(db, "users", uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) return;
  const existing: string[] = (snap.data().recentlyViewedPros as string[]) || [];
  const updated = [proId, ...existing.filter(id => id !== proId)].slice(0, 10);
  await updateDoc(userRef, { recentlyViewedPros: updated, updatedAt: serverTimestamp() });
}

export async function getRecommendedPros(
  uid: string, limit_: number = 4
): Promise<Record<string, unknown>[]> {
  // Reads from /publicProfiles — safe, no sensitive data exposure.
  const q = query(
    collection(db, "publicProfiles"),
    where("isServiceProvider", "==", true),
    orderBy("reviewCount", "desc"),
    limit(limit_ * 5)
  );
  const snap = await getDocs(q);
  const ranked = snap.docs
    .map(d => ({ uid: d.id, ...d.data() }))
    .filter(p => (p.uid as string) !== uid)
    .slice(0, limit_);
  return healProfessionalAggregates(ranked);
}

export async function getLastBookedPro(uid: string): Promise<string | null> {
  const lastBooking = await getLastCompletedBookingForUser(uid);
  return (lastBooking?.proId as string) || null;
}

/* ═══════════════════════════════════════════
   MESSAGING — READ RECEIPTS & UNREAD COUNT
═══════════════════════════════════════════ */
/** Mark a conversation as read for a given user by updating lastReadAt. */
export async function markConversationRead(convId: string, uid: string) {
  await updateDoc(doc(db, "messages", convId), {
    [`lastReadAt.${uid}`]: serverTimestamp(),
  });
}

/** Return count of unread messages in a conversation for a given user since lastReadAt. */
export async function getUnreadCount(convId: string, uid: string): Promise<number> {
  const convSnap = await getDoc(doc(db, "messages", convId));
  if (!convSnap.exists()) return 0;
  const lastRead = convSnap.data()?.lastReadAt?.[uid] as Timestamp | undefined;
  if (!lastRead) {
    // Never read — count all messages not sent by self
    const q = query(
      collection(db, `messages/${convId}/chats`),
      where("senderId", "!=", uid)
    );
    const snap = await getDocs(q);
    return snap.size;
  }
  const q = query(
    collection(db, `messages/${convId}/chats`),
    where("senderId", "!=", uid),
    where("timestamp", ">", lastRead)
  );
  const snap = await getDocs(q);
  return snap.size;
}
/* ═══════════════════════════════════════════
   PLATFORM STATS (Public)
   ═══════════════════════════════════════════ */
/**
 * Fetches aggregate platform stats for the social proof ticker.
 * This is safe to call from any component as it doesn't return raw documents.
 */
export async function getPublicStats() {
  try {
    const [usersAgg, prosAgg, societiesSnap] = await Promise.all([
      getCountFromServer(collection(db, "publicProfiles")),
      getCountFromServer(query(collection(db, "publicProfiles"), where("isServiceProvider", "==", true))),
      getDocs(query(collection(db, "societies"), limit(500))),
    ]);

    const localityCount = new Set(
      societiesSnap.docs
        .map(d => ((d.data()?.city as string) || "").trim().toLowerCase())
        .filter(Boolean)
    ).size;

    return {
      totalUsers: usersAgg.data().count || 0,
      totalPros: prosAgg.data().count || 0,
      activeBookings: 0,
      localityCount,
    };
  } catch {
    return {
      totalUsers: 0,
      totalPros: 0,
      activeBookings: 0,
      localityCount: 0,
    };
  }
}

