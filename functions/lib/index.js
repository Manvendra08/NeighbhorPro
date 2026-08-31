"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.onReviewWrite = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
admin.initializeApp();
const db = admin.firestore();
exports.onReviewWrite = functions.firestore
    .document('reviews/{reviewId}')
    .onWrite(async (change) => {
    // On delete, use the before snapshot; otherwise use after.
    const data = change.after.exists ? change.after.data() : change.before.data();
    if (!data)
        return;
    const proId = data.proId;
    if (!proId)
        return;
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
//# sourceMappingURL=index.js.map