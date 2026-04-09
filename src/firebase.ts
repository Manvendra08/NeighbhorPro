import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";
import { getMessaging, isSupported } from "firebase/messaging";

const readEnv = (key: string): string => String(import.meta.env[key] ?? "").trim();

const firebaseEnv = {
  apiKey: readEnv("VITE_FIREBASE_API_KEY"),
  authDomain: readEnv("VITE_FIREBASE_AUTH_DOMAIN"),
  projectId: readEnv("VITE_FIREBASE_PROJECT_ID"),
  storageBucket: readEnv("VITE_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: readEnv("VITE_FIREBASE_MESSAGING_SENDER_ID"),
  appId: readEnv("VITE_FIREBASE_APP_ID"),
  measurementId: readEnv("VITE_FIREBASE_MEASUREMENT_ID"),
};

const missingFirebaseEnv = Object.entries(firebaseEnv)
  .filter(
    ([key, value]) =>
      (key !== "measurementId" && !value) || value.startsWith("YOUR_") || value.includes("XXXXXXXX")
  )
  .map(([key]) => key);

const firebaseApiKeyLooksInvalid =
  !firebaseEnv.apiKey || !/^AIza[0-9A-Za-z_-]{35}$/.test(firebaseEnv.apiKey);

if (missingFirebaseEnv.length > 0 || firebaseApiKeyLooksInvalid) {
  const errors = [...missingFirebaseEnv];
  if (firebaseApiKeyLooksInvalid) errors.push("apiKey (invalid format)");

  throw new Error(
    `Invalid Firebase env configuration: ${errors.join(", ")}. Update .env.local with the exact values from Firebase Console > Project settings > General > Your apps (Web app), then restart the Vite dev server.`
  );
}

const firebaseConfig = {
  apiKey: firebaseEnv.apiKey,
  authDomain: firebaseEnv.authDomain,
  projectId: firebaseEnv.projectId,
  storageBucket: firebaseEnv.storageBucket,
  messagingSenderId: firebaseEnv.messagingSenderId,
  appId: firebaseEnv.appId,
  ...(firebaseEnv.measurementId ? { measurementId: firebaseEnv.measurementId } : {}),
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functionsClient = getFunctions(app, "asia-south1");
export const googleProvider = new GoogleAuthProvider();

// FCM — lazily resolved; returns null if browser doesn't support (e.g. Safari < 16)
export async function getMessagingInstance() {
  const supported = await isSupported();
  if (!supported) return null;
  return getMessaging(app);
}

