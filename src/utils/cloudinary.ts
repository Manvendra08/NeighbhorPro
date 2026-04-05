/**
 * Cloudinary upload validation utilities.
 * All uploads must be validated here before being sent to Cloudinary.
 * Centralizes file size + type checks that were previously absent or scattered.
 */

export const MAX_SIZES: Record<string, number> = {
  profilePhoto:      5 * 1024 * 1024,   // 5 MB
  residencyProof:   10 * 1024 * 1024,   // 10 MB
  chatAttachment:   10 * 1024 * 1024,   // 10 MB
  bookingAttachment:10 * 1024 * 1024,   // 10 MB
};

export const ALLOWED_TYPES: Record<string, string[]> = {
  profilePhoto:  ["image/jpeg", "image/png", "image/webp"],
  residencyProof:["image/jpeg", "image/png", "application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  chatAttachment:["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf", "text/plain",
                  "application/msword",
                  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  bookingAttachment: ["image/jpeg", "image/png", "image/webp", "application/pdf", "text/plain",
                      "application/msword",
                      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
};

/**
 * Validates a file before upload. Throws with a user-friendly message on failure.
 * @param file - The File object to validate
 * @param context - The upload context key (e.g., "profilePhoto", "chatAttachment")
 */
export function validateUpload(file: File, context: keyof typeof MAX_SIZES): void {
  const maxBytes = MAX_SIZES[context] ?? 5 * 1024 * 1024;
  if (file.size > maxBytes) {
    const mb = Math.round(maxBytes / (1024 * 1024));
    throw new Error(`File too large. Maximum size is ${mb}MB.`);
  }

  const allowed = ALLOWED_TYPES[context];
  if (allowed && !allowed.includes(file.type)) {
    const ext = allowed
      .map((t) => t.split("/")[1].replace("vnd.openxmlformats-officedocument.wordprocessingml.document", "docx"))
      .join(", ");
    throw new Error(`File type not allowed. Accepted formats: ${ext}`);
  }
}

