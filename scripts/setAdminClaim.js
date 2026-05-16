#!/usr/bin/env node

/**
 * Set admin custom claim on a Firebase user.
 * Usage: node scripts/setAdminClaim.js <adminUID>
 * 
 * Requires GOOGLE_APPLICATION_CREDENTIALS env var pointing to service account key.
 */

const admin = require('firebase-admin');

const uid = process.argv[2];

if (!uid) {
  console.error('Usage: node scripts/setAdminClaim.js <adminUID>');
  process.exit(1);
}

// Initialize Firebase Admin SDK
// Expects GOOGLE_APPLICATION_CREDENTIALS to point to service account key
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('Error: GOOGLE_APPLICATION_CREDENTIALS environment variable not set');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
});

admin.auth().setCustomUserClaims(uid, { admin: true })
  .then(() => {
    console.log(`✓ Admin claim set for user: ${uid}`);
    process.exit(0);
  })
  .catch((error) => {
    console.error(`✗ Failed to set admin claim: ${error.message}`);
    process.exit(1);
  });
