import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  onSnapshot,
  Unsubscribe,
  runTransaction,
} from "firebase/firestore";
import { db } from "../firebase";

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
  const dedupId = `${postId}_${reporterId}`;
  const dedupRef = doc(db, "feedReports", dedupId);
  const postRef = doc(db, "localFeed", postId);
  let alreadyReported = false;

  await runTransaction(db, async tx => {
    const [existingSnap, postSnap] = await Promise.all([tx.get(dedupRef), tx.get(postRef)]);
    if (existingSnap.exists()) {
      alreadyReported = true;
      return;
    }
    tx.set(dedupRef, {
      postId,
      reporterId,
      reason,
      details: details ?? "",
      status: "pending",
      createdAt: serverTimestamp(),
    });
    if (postSnap.exists()) {
      const currentCount = ((postSnap.data()?.reportCount as number) ?? 0) + 1;
      tx.update(postRef, {
        reportCount: currentCount,
        ...(currentCount >= 3 ? { hidden: true } : {}),
        updatedAt: serverTimestamp(),
      });
    }
  });

  if (alreadyReported) return { success: false, alreadyReported: true };
  return { success: true };
}

export async function toggleReactionToFeedPost(
  postId: string, uid: string, type: "clap" | "thumb"
) {
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
      updatedAt: serverTimestamp(),
    });
  });
}
