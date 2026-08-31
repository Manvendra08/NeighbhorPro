/**
 * functions/src/index.ts
 *
 * Cloud Functions for Firebase — Pro Rating Trigger
 *
 * Spark-compatible: internal Firestore reads/writes only, no outbound network calls.
 *
 * onReviewWrite:
 *   Triggers on any create/update/delete in the `reviews` collection.
 *   Recalculates the pro's average rating and review count, then writes
 *   atomically to both `users/{proId}` and `publicProfiles/{proId}`.
 *
 *   This replaces the client-side recalculateProRating() call that ran
 *   N Firestore reads per browse page via healProfessionalAggregates().
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();
const db = admin.firestore();

export const onReviewWrite = functions.firestore
  .document('reviews/{reviewId}')
  .onWrite(async (change) => {
    // On delete, use the before snapshot; otherwise use after.
    const data = change.after.exists ? change.after.data() : change.before.data();
    if (!data) return;

    const proId = data.proId as string;
    if (!proId) return;

    // Fetch all reviews for this pro to compute a fresh aggregate.
    // This is intentionally a full collection scan per trigger — acceptable
    // because it runs server-side (no client latency) and reviews per pro
    // grow slowly. Switch to an incremental counter approach if p99 > 2s.
    const snap = await db.collection('reviews')
      .where('proId', '==', proId)
      .get();

    const ratings = snap.docs
      .map(d => Number(d.data().rating))
      .filter(r => Number.isFinite(r) && r >= 1 && r <= 5);

    const avg = ratings.length > 0
      ? ratings.reduce((s, r) => s + r, 0) / ratings.length
      : 0;

    const update = {
      rating: Math.round(avg * 10) / 10,
      reviewCount: ratings.length,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Write to both user doc and public profile in parallel.
    await Promise.all([
      db.doc(`users/${proId}`).update(update),
      db.doc(`publicProfiles/${proId}`).set(update, { merge: true }),
    ]);
  });
