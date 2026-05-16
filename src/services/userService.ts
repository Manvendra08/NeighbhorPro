import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  setDoc,
  query,
  QueryConstraint,
  where,
  orderBy,
  limit,
  startAfter,
  QueryDocumentSnapshot,
  DocumentData,
  deleteField,
  serverTimestamp,
  runTransaction,
  getCountFromServer,
} from "firebase/firestore";
import { updateProfile } from "firebase/auth";
import { db, auth } from "../firebase";
import { generateUniqueReferralCode, isValidReferralCode, normalizeReferralCode } from "./coinService";
import { validateUpload } from "../utils/cloudinary";
import { captureError } from "../lib/sentry";
import { safeGetDocs, toEpochMillis, uploadToCloudinary } from "./_shared";
import { recalculateProRating } from "./reviewService";

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
  "monday", "tuesday", "wednesday", "thursday",
  "friday", "saturday", "sunday",
] as const;

export const BROWSE_PAGE_SIZE = 20;
const PROFESSIONAL_FALLBACK_MULTIPLIER = 5;

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
        value.split(",").map(item => item.trim()).filter(Boolean)
      )
    );
  }
  return [];
}

export function normalizeProfileData(data: Record<string, unknown>): Record<string, unknown> {
  return { ...data, skills: normalizeStringArray(data.skills) };
}

export function derivePublicProfile(
  uid: string,
  source: Record<string, unknown>
): Record<string, unknown> {
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
  const day = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
  return { active: Boolean(day?.active), slots: normalizeStringArray(day?.slots) };
}

export function normalizeAvailabilityData(
  data: Record<string, unknown> | null
): Record<string, unknown> | null {
  if (!data) return null;
  const normalized: Record<string, unknown> = { ...data };
  for (const day of AVAILABILITY_DAYS) {
    normalized[day] = normalizeAvailabilityDay(data[day]);
  }
  return normalized;
}

/**
 * Mirror safe fields to /publicProfiles on every profile mutation.
 */
export async function mirrorPublicProfile(uid: string, data: object): Promise<void> {
  const source = data as Record<string, unknown>;
  const safe = derivePublicProfile(uid, source);
  if ("emailVisible" in source && source.emailVisible !== true) safe.email = deleteField();
  if ("phoneVisible" in source && source.phoneVisible !== true) safe.phoneNumber = deleteField();
  if ("flatVisible" in source && source.flatVisible !== true) safe.flatNumber = deleteField();
  if (Object.keys(safe).length <= 1) return;
  await setDoc(
    doc(db, 'publicProfiles', uid),
    { ...safe, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

/** Read a user's FULL document — owner/admin only. */
export async function getUserProfile(uid: string): Promise<Record<string, unknown> | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? normalizeProfileData({ uid: snap.id, ...snap.data() }) : null;
}

/** Read public-safe profile — accessible to any signed-in user. */
export async function getPublicProfile(uid: string): Promise<Record<string, unknown> | null> {
  const snap = await getDoc(doc(db, 'publicProfiles', uid));
  if (snap.exists()) return derivePublicProfile(snap.id, snap.data() as Record<string, unknown>);
  try {
    const userSnap = await getDoc(doc(db, 'users', uid));
    if (!userSnap.exists()) return null;
    return derivePublicProfile(uid, userSnap.data() as Record<string, unknown>);
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
  const mutatesAdminControls = currentData.role === "admin" &&
    (typeof data.role === "string" || typeof data.disabled === "boolean");

  const nextData: Record<string, unknown> = { ...data };
  const nextDisplayName =
    (typeof data.displayName === "string" ? data.displayName : (currentData.displayName as string | undefined)) ?? "";
  const nextPhone =
    (typeof data.phoneNumber === "string" ? data.phoneNumber : (currentData.phoneNumber as string | undefined)) ?? "";

  const currentReferralCode = normalizeReferralCode(currentData.referralCode as string | undefined);
  if (!isValidReferralCode(currentReferralCode) &&
    (typeof data.displayName === "string" || typeof data.phoneNumber === "string")) {
    try {
      nextData.referralCode = await generateUniqueReferralCode({
        displayName: nextDisplayName, phoneNumber: nextPhone, uid,
      });
    } catch { /* do not block profile update */ }
  }

  const mergedData = { ...currentData, ...nextData };
  const safe = derivePublicProfile(uid, mergedData);
  if ("emailVisible" in mergedData && mergedData.emailVisible !== true) safe.email = deleteField();
  if ("phoneVisible" in mergedData && mergedData.phoneVisible !== true) safe.phoneNumber = deleteField();
  if ("flatVisible" in mergedData && mergedData.flatVisible !== true) safe.flatNumber = deleteField();

  await runTransaction(db, async tx => {
    if (mutatesAdminControls && (nextRole !== "admin" || nextDisabled === true)) {
      const usersSnap = await getDocs(
        query(collection(db, "users"), where("role", "==", "admin"), where("disabled", "==", false), limit(2))
      );
      if (usersSnap.size <= 1) throw new Error("At least one active admin must remain");
    }
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

function normalizeCloudinaryResidencyUrl(url: string): string {
  return url.includes("/raw/upload/") ? url.replace("/raw/upload/", "/image/upload/") : url;
}

function getPdfPreviewUrl(url: string): string {
  const normalized = normalizeCloudinaryResidencyUrl(url);
  if (!/\.pdf($|[?#])/i.test(normalized)) return normalized;
  const withPage = normalized.includes("/image/upload/pg_")
    ? normalized
    : normalized.replace("/image/upload/", "/image/upload/pg_1/");
  return withPage.replace(/\.pdf(?=($|[?#]))/i, ".jpg");
}

export async function uploadProfilePhoto(uid: string, file: File) {
  validateUpload(file, "profilePhoto");
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
  validateUpload(file, "residencyProof");
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const uploadPreset =
    import.meta.env.VITE_CLOUDINARY_RESIDENCY_UPLOAD_PRESET ||
    import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
  if (!cloudName) throw new Error("Cloudinary configuration is missing. Please contact support.");
  if (!uploadPreset) throw new Error("Cloudinary upload preset is missing.");

  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  const resourceTypeToUse: "image" | "raw" | "auto" = isPdf ? "image" : "auto";
  const data = await uploadToCloudinary(file, "ProNeighbor/residency-proofs", uploadPreset, cloudName, resourceTypeToUse);
  const residencyProofUrl = normalizeCloudinaryResidencyUrl(data.secure_url);
  const residencyProofPreviewUrl = isPdf ? getPdfPreviewUrl(residencyProofUrl) : null;
  const resourceType = data.resource_type || "image";

  const update = {
    residencyProofUrl,
    residencyProofPreviewUrl,
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
  await mirrorPublicProfile(uid, { residencyProofUrl, residencyProofPreviewUrl, residentVerificationStatus: "pending" });
  return residencyProofUrl;
}

export async function deleteResidencyProof(uid: string) {
  const userRef = doc(db, "users", uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) throw new Error("Profile not found");

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

/**
 * Updates resident verification status with mandatory reviewer metadata.
 *
 * @param reviewerUid - REQUIRED: UID of the admin performing the review
 * @param reviewNote  - REQUIRED for rejection (status="none")
 */
export async function updateResidentVerification(
  uid: string,
  status: "none" | "pending" | "verified",
  method: "manual" | "auto" | null,
  reviewerUid: string,
  reviewNote?: string
) {
  if (!reviewerUid || reviewerUid.trim() === "") {
    throw new Error("Reviewer UID is required for verification review");
  }
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
  await updateDoc(doc(db, "users", uid), update);
  await setDoc(doc(db, "publicProfiles", uid), { residentVerificationStatus: status, updatedAt: serverTimestamp() }, { merge: true });
  await mirrorPublicProfile(uid, update);
  const readBack = await getDoc(doc(db, "users", uid));
  const d = readBack.data();
  if (!d || d.verificationReviewedBy !== reviewerUid) {
    throw new Error("Audit metadata write assertion failed: reviewer ID not persisted");
  }
}

export async function getPendingVerifications(): Promise<Record<string, unknown>[]> {
  const q = query(
    collection(db, "users"),
    where("residentVerificationStatus", "==", "pending"),
    orderBy("updatedAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ ...d.data(), uid: d.id }));
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
      if (isProfessionalProfile(normalized)) merged.set(item.id, normalized);
    }
  }
  return Array.from(merged.values()).sort(
    (a, b) => toEpochMillis(b.createdAt) - toEpochMillis(a.createdAt)
  );
}

function shouldBackfillRatingAggregate(profile: Record<string, unknown>): boolean {
  const rating = Number(profile.rating) || 0;
  const reviewCount = Math.max(0, Number(profile.reviewCount) || 0);
  if (rating > 0 && reviewCount > 0) return false;
  if ((rating > 0 && reviewCount === 0) || (rating <= 0 && reviewCount > 0)) return true;
  const createdAtMs = toEpochMillis(profile.createdAt);
  if (createdAtMs === 0) return true;
  return Date.now() - createdAtMs >= 14 * 24 * 60 * 60 * 1000;
}

async function healProfessionalAggregates(
  profiles: Record<string, unknown>[]
): Promise<Record<string, unknown>[]> {
  const needHeal = profiles.filter(p => shouldBackfillRatingAggregate(p));
  if (needHeal.length === 0) return profiles;
  const healed = await Promise.all(
    needHeal.map(async profile => {
      const uid = String(profile.uid || profile.id || "").trim();
      if (!uid) return profile;
      try {
        const aggregate = await recalculateProRating(uid);
        return { ...profile, ...aggregate };
      } catch { return profile; }
    })
  );
  const healedMap = new Map<string, Record<string, unknown>>();
  for (const h of healed) {
    const uid = String(h.uid || h.id || "").trim();
    if (uid) healedMap.set(uid, h);
  }
  return profiles.map(p => {
    const uid = String(p.uid || p.id || "").trim();
    return healedMap.get(uid) || p;
  });
}

/**
 * Paginated professional listing ordered by createdAt desc.
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
  primaryConstraints.push(orderBy("createdAt", "desc"), limit(BROWSE_PAGE_SIZE));
  if (cursor) primaryConstraints.push(startAfter(cursor));

  const primaryDocs = await safeGetDocs(query(collection(db, "publicProfiles"), ...primaryConstraints));
  const primaryData = mergeAndSortProfessionals(primaryDocs);
  const healedPrimaryData = await healProfessionalAggregates(primaryData);

  if (healedPrimaryData.length > 0 || cursor) {
    const nextCursor = primaryDocs.length === BROWSE_PAGE_SIZE ? primaryDocs[primaryDocs.length - 1] : null;
    return { data: healedPrimaryData.slice(0, BROWSE_PAGE_SIZE), nextCursor };
  }

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

export async function getAllUserRows(limit_ = 50): Promise<Record<string, unknown>[]> {
  const res = await getAllUsers(limit_);
  return Array.isArray(res.data) ? res.data : [];
}

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
    return { totalUsers: 0, totalPros: 0, activeBookings: 0, localityCount: 0 };
  }
}
