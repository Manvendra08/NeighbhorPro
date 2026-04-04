/**
 * Reset passwords for all Firebase Auth users except app admins.
 *
 * Admin exclusion rules:
 * 1) Firestore users/{uid}.role === "admin"
 * 2) Firebase custom claims include admin === true
 *
 * Usage (PowerShell):
 *   $env:SA_KEY_PATH="C:\\path\\to\\serviceAccountKey.json";
 *   node scripts/resetPasswordsExceptAdmin.cjs
 */

const admin = require("firebase-admin");
const path = require("path");

const DEFAULT_KEY_PATH = "C:/Users/manve/Downloads/ProNeighbor/scripts/serviceAccountKey.json";
const KEY_PATH = process.env.SA_KEY_PATH || DEFAULT_KEY_PATH;
const NEW_PASSWORD = "Manav@1234";

let serviceAccount;
try {
  serviceAccount = require(path.resolve(KEY_PATH));
} catch (err) {
  console.error("Failed to load service account key:", KEY_PATH);
  console.error(err.message);
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const auth = admin.auth();
const db = admin.firestore();

async function listAllUsers() {
  const all = [];
  let nextPageToken;
  do {
    const batch = await auth.listUsers(1000, nextPageToken);
    all.push(...batch.users);
    nextPageToken = batch.pageToken;
  } while (nextPageToken);
  return all;
}

async function isAppAdmin(userRecord) {
  if (userRecord.customClaims && userRecord.customClaims.admin === true) {
    return true;
  }

  const userDoc = await db.collection("users").doc(userRecord.uid).get();
  if (!userDoc.exists) {
    return false;
  }

  const role = userDoc.data()?.role;
  return role === "admin";
}

async function run() {
  const users = await listAllUsers();

  let updated = 0;
  let skippedAdmins = 0;
  let failed = 0;

  const skippedAdminEmails = [];
  const failedUsers = [];

  for (const user of users) {
    try {
      const adminUser = await isAppAdmin(user);
      if (adminUser) {
        skippedAdmins += 1;
        skippedAdminEmails.push(user.email || user.uid);
        continue;
      }

      await auth.updateUser(user.uid, { password: NEW_PASSWORD });
      updated += 1;
    } catch (err) {
      failed += 1;
      failedUsers.push({ uid: user.uid, email: user.email || null, error: err.message });
    }
  }

  console.log("Password reset complete.");
  console.log(`Total users: ${users.length}`);
  console.log(`Updated: ${updated}`);
  console.log(`Skipped admins: ${skippedAdmins}`);
  console.log(`Failed: ${failed}`);

  if (skippedAdminEmails.length > 0) {
    console.log("Skipped admin accounts:");
    skippedAdminEmails.forEach((id) => console.log(`- ${id}`));
  }

  if (failedUsers.length > 0) {
    console.log("Failed accounts:");
    failedUsers.forEach((u) => console.log(`- ${u.email || u.uid}: ${u.error}`));
  }
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Fatal error:", err.message);
    process.exit(1);
  });
