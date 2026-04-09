/**
 * ProNeighbour — Test User Seed Script
 *
 * Creates 3 test accounts in Firebase Auth + Firestore with correct schema.
 * Schema matches UserProfile in src/contexts/AuthContext.tsx exactly.
 *
 * Prerequisites:
 *   1. Download service account key from Firebase Console →
 *      Project Settings → Service Accounts → Generate new private key
 *      Save as: scripts/serviceAccountKey.json  (gitignored)
 *   2. npm install firebase-admin  (run from project root)
 *
 * Usage:
 *   node scripts/seedTestUsers.js
 */

const admin = require("firebase-admin");
const path  = require("path");

const KEY_PATH = path.join(__dirname, "serviceAccountKey.json");

let serviceAccount;
try {
  serviceAccount = require(KEY_PATH);
} catch {
  console.error("❌  serviceAccountKey.json not found at:", KEY_PATH);
  console.error("   Download it from Firebase Console → Project Settings → Service Accounts");
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const auth = admin.auth();
const db   = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

// ── Test accounts — schema matches UserProfile exactly ──────────────────────
const TEST_USERS = [
  {
    // Regular resident — 500 NC starting balance
    email:             "testuser@proneighbour.in",
    password:          "Test@1234",
    displayName:       "Test User",
    photoURL:          "",
    bio:               "Test resident account for QA.",
    skills:            [],
    hourlyRate:        0,
    isFreeConsultation: true,
    society:           "Prestige Bella Vista",
    isServiceProvider: false,
    priceAfterQuote:   false,
    role:              "user",
    rating:            0,
    reviewCount:       0,
    coinBalance:       500,
  },
  {
    // Service professional — 1200 NC, has skills + rate set
    email:             "testpro@proneighbour.in",
    password:          "Test@1234",
    displayName:       "Test Pro",
    photoURL:          "",
    bio:               "Certified CA with 10 years of experience. ITR, GST, investments.",
    skills:            ["Tax & CA", "Investment & Wealth"],
    hourlyRate:        300,
    isFreeConsultation: false,
    society:           "Prestige Bella Vista",
    isServiceProvider: true,
    priceAfterQuote:   false,
    role:              "user",
    rating:            4.8,
    reviewCount:       12,
    coinBalance:       1200,
  },
  {
    // Platform admin — full access
    email:             "admin@proneighbour.in",
    password:          "Admin@1234",
    displayName:       "Admin User",
    photoURL:          "",
    bio:               "Platform administrator.",
    skills:            [],
    hourlyRate:        0,
    isFreeConsultation: true,
    society:           "",
    isServiceProvider: false,
    priceAfterQuote:   false,
    role:              "admin",
    rating:            0,
    reviewCount:       0,
    coinBalance:       9999,
  },
];

async function seed() {
  console.log("🌱  Seeding test users for ProNeighbour…\n");

  for (const u of TEST_USERS) {
    const { email, password, ...profileFields } = u;

    // ── 1. Create Firebase Auth account ──────────────────────────────────────
    let uid;
    try {
      const record = await auth.createUser({
        email,
        password,
        displayName: profileFields.displayName,
        photoURL:    profileFields.photoURL || undefined,
      });
      uid = record.uid;
      console.log(`✅  Auth created:  ${email}  (${uid})`);
    } catch (err) {
      if (err.code === "auth/email-already-exists") {
        // Fetch existing UID so Firestore doc is still written/updated
        const existing = await auth.getUserByEmail(email);
        uid = existing.uid;
        console.log(`⚠️   Auth exists:   ${email}  (${uid}) — skipping auth creation`);
      } else {
        console.error(`❌  Auth failed:   ${email} —`, err.message);
        continue;
      }
    }

    // ── 2. Write Firestore user doc (upsert) ─────────────────────────────────
    const referralCode = "PN" + uid.slice(0, 6).toUpperCase();

    const firestoreDoc = {
      uid,
      email,
      ...profileFields,
      referralCode,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    try {
      // merge: true so re-runs don't wipe existing bookings/ledger refs
      await db.collection("users").doc(uid).set(firestoreDoc, { merge: true });
      console.log(`   Firestore doc:  /users/${uid}  (coinBalance: ${profileFields.coinBalance} NC, role: ${profileFields.role})\n`);
    } catch (err) {
      console.error(`❌  Firestore failed for ${email}:`, err.message);
    }
  }

  console.log("✅  Seeding complete.\n");
  console.log("Accounts:");
  console.log("  testuser@proneighbour.in  / Test@1234    → regular user, 500 NC");
  console.log("  testpro@proneighbour.in   / Test@1234    → service pro,  1200 NC, Cash Out tab visible");
  console.log("  admin@proneighbour.in     / Admin@1234   → admin,        /admin access\n");

  process.exit(0);
}

seed().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
