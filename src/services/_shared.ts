/**
 * _shared.ts — Internal utilities shared across domain service files.
 * NOT exported from firestoreService.ts barrel. Import directly when needed.
 */
import {
  getDocs,
  Query,
  QueryDocumentSnapshot,
  DocumentData,
  Timestamp,
} from "firebase/firestore";

export function toEpochMillis(value: unknown): number {
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

export async function safeGetDocs(
  inputQuery: Query<DocumentData>
): Promise<QueryDocumentSnapshot<DocumentData>[]> {
  try {
    const snapshot = await getDocs(inputQuery);
    return snapshot.docs;
  } catch {
    return [];
  }
}

export function mergeAndSortByCreatedAt(
  docs: QueryDocumentSnapshot<DocumentData>[]
): Record<string, unknown>[] {
  const merged = new Map<string, Record<string, unknown>>();
  for (const item of docs) {
    if (!merged.has(item.id)) {
      merged.set(item.id, { id: item.id, ...item.data() } as Record<string, unknown>);
    }
  }
  return Array.from(merged.values()).sort(
    (a, b) => toEpochMillis(b.createdAt) - toEpochMillis(a.createdAt)
  );
}

/**
 * Standardized Cloudinary upload with retry + exponential backoff.
 */
export async function uploadToCloudinary(
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
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
        { method: "POST", body: formData }
      );
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error?.message || "Upload failed");
      }
      return await response.json();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < retries) {
        await new Promise(res => setTimeout(res, 1000 * Math.pow(2, attempt)));
      }
    }
  }
  throw lastError;
}
