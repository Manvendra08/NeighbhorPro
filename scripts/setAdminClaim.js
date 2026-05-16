#!/usr/bin/env node
/**
 * scripts/setAdminClaim.js
 *
 * Sets the custom JWT claim { admin: true } on a Firebase Auth user.
 * Works on Spark plan — no Cloud Function required at runtime.
 * The claim is evaluated inside Firestore rules via:
 *   request.auth.token.admin == true
 *
 * Prerequisites:
 *   npm install firebase-admin   (or: already in devDependencies)
 *   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccountKey.json
 *   — OR —
 *   Run inside Google Cloud Shell / Cloud Run (uses Application Default Credentials)
 *
 * Usage:
 *   node scripts/setAdminClaim.js <uid>
 *
 * Revoke admin:
 *   node scripts/setAdminClaim.js <uid> --revoke
 *
 * Examples:
 *   node scripts/setAdminClaim.js abc123xyz
 *   node scripts/setAdminClaim.js abc123xyz --revoke
 */

'use strict';

const admin = require('firebase-admin');

const uid = process.argv[2];
const revoke = process.argv.includes('--revoke');

if (!uid || uid.startsWith('--')) {
  console.error('Usage: node scripts/setAdminClaim.js <uid> [--revoke]');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
});

const claims = revoke ? {} : { admin: true };
const action = revoke ? 'revoked from' : 'set for';

admin
  .auth()
  .setCustomUserClaims(uid, claims)
  .then(() => {
    console.log(`\u2713 Admin claim ${action} uid: ${uid}`);
    console.log(
      'NOTE: The user must sign out and sign back in (or token-refresh)\n' +
      '      before the claim takes effect in Firestore rules.'
    );
    process.exit(0);
  })
  .catch((err) => {
    console.error('Failed to set custom claim:', err.message);
    process.exit(1);
  });
