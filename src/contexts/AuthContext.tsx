import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
import {
  User, onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signInWithPopup, signOut,
  updateProfile, sendPasswordResetEmail, sendEmailVerification,
  signInWithPhoneNumber, RecaptchaVerifier,
  reauthenticateWithCredential, EmailAuthProvider, deleteUser,
} from "firebase/auth";
import { doc, setDoc, getDoc, updateDoc, serverTimestamp, onSnapshot } from "firebase/firestore";
import { auth, db, googleProvider } from "../firebase";
import { earnCoins, generateReferralCode, isValidReferralCode, normalizeReferralCode } from "../services/coinService";
import { logActivity } from "../services/activityService";
import { mirrorPublicProfile, normalizeProfileData } from "../services/firestoreService";
import type { FirestoreTimestamp } from "../types/firestore";

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  phoneNumber?: string;
  photoURL: string;
  bio: string;
  skills: string[];
  hourlyRate: number;
  isFreeConsultation: boolean;
  society: string;
  locality: string;
  tower: string;
  flatNumber: string;
  residencyProofUrl?: string;
  residencyProofPreviewUrl?: string;
  residentVerificationStatus: "none" | "pending" | "verified";
  verificationReviewNote?: string | null;
  verificationMethod: "manual" | "auto" | null;
  isServiceProvider?: boolean;
  priceAfterQuote?: boolean;
  role: "user" | "admin";
  rating: number;
  reviewCount: number;
  coinBalance: number;
  referralCode?: string;
  emailVerified?: boolean;
  phoneVisible?: boolean;
  flatVisible?: boolean;
  deleted?: boolean;
  fcmToken?: string;
  createdAt: FirestoreTimestamp;
}

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  logout: () => Promise<void>;
  sendPhoneOTP: (phone: string, containerId: string) => Promise<string>;
  verifyPhoneOTP: (verificationId: string, otp: string) => Promise<void>;
  deleteAccount: (password?: string) => Promise<{ success: boolean; reason?: string }>;
}

const AuthContext = createContext<AuthContextType | null>(null);

function isProfileComplete(profile: Partial<UserProfile>): boolean {
  return !!(
    profile.displayName?.trim() &&
    profile.society?.trim() &&
    profile.phoneNumber?.trim() &&
    (profile.skills?.length ?? 0) > 0
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => {
      // Keep protected routes in loading state while auth transitions settle.
      setLoading(true);
      setUser(u);
      if (!u) {
        setUserProfile(null);
        setLoading(false);
      }
    });
    return unsub;
  }, []);

  /** Session guard: prevents earn_profile firing on every snapshot update. */
  const profileBonusClaimedRef = useRef(false);

  type ConfirmationResult = Awaited<ReturnType<typeof signInWithPhoneNumber>>;
  const confirmationRef = useRef<ConfirmationResult | null>(null);
  // FIX 3: Store the RecaptchaVerifier in a ref so it can be cleared before
  // re-instantiation, preventing verifier accumulation on the same DOM element.
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);

  useEffect(() => {
    if (!user) {
      profileBonusClaimedRef.current = false;
      return;
    }
    setLoading(true);
    const unsub = onSnapshot(doc(db, "users", user.uid), snap => {
      if (snap.exists()) {
        const data = normalizeProfileData({ uid: snap.id, ...snap.data() }) as unknown as UserProfile;
        setUserProfile(data);
        if (!profileBonusClaimedRef.current && isProfileComplete(data)) {
          profileBonusClaimedRef.current = true;
          earnCoins(user.uid, "earn_profile", user.uid).catch(() => {
            profileBonusClaimedRef.current = false;
          });
        }
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [user]);

  const createUserProfile = async (u: User) => {
    const ref = doc(db, "users", u.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      const profile: UserProfile = {
        uid: u.uid, displayName: u.displayName ?? "", email: u.email ?? "",
        photoURL: u.photoURL ?? "", bio: "", skills: [], hourlyRate: 0,
        isFreeConsultation: true, society: "", locality: "", tower: "", flatNumber: "",
        residentVerificationStatus: "none", verificationReviewNote: null, verificationMethod: null,
        isServiceProvider: false, priceAfterQuote: false,
        role: "user", rating: 0, reviewCount: 0, coinBalance: 0,
        referralCode: generateReferralCode({
          displayName: u.displayName ?? "",
          phoneNumber: u.phoneNumber ?? "",
          uid: u.uid,
        }),
        emailVerified: u.emailVerified,
        phoneVisible: false, flatVisible: false,
        createdAt: serverTimestamp(),
      };
      await setDoc(ref, profile);
      await mirrorPublicProfile(u.uid, profile);
      await earnCoins(u.uid, "earn_signup_bonus", u.uid);
    }
  };

  const signIn = async (email: string, password: string) => {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    logActivity(cred.user.uid, "user.login", `Signed in via email`);
  };
  const signUp = async (email: string, password: string, displayName: string) => {
    const { user: u } = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(u, { displayName });
    await createUserProfile({ ...u, displayName });
    await sendEmailVerification(u);
    logActivity(u.uid, "user.signup", `New account created: ${displayName} (${email})`);
  };
  const signInWithGoogle = async () => {
    const { user: u } = await signInWithPopup(auth, googleProvider);
    await createUserProfile(u);
    logActivity(u.uid, "user.login", `Signed in via Google`);
  };
  const resetPassword = async (email: string) => { await sendPasswordResetEmail(auth, email); };
  const resendVerificationEmail = async () => { if (auth.currentUser && !auth.currentUser.emailVerified) await sendEmailVerification(auth.currentUser); };
  const logout = async () => {
    if (auth.currentUser?.uid) {
      await logActivity(auth.currentUser.uid, "user.logout", `Signed out`);
    }
    await signOut(auth);
  };

  // ── Phone OTP ─────────────────────────────────────────────────────────
  const sendPhoneOTP = async (phone: string, containerId: string): Promise<string> => {
    try {
      // Ensure E.164 format. If no '+', assume +91 (India) if 10 digits.
      let formattedPhone = phone.replace(/[\s-]+/g, "");
      if (!formattedPhone.startsWith("+")) {
        if (formattedPhone.length === 10) {
          formattedPhone = "+91" + formattedPhone;
        } else {
          throw new Error("Phone number must include country code (e.g., +91).");
        }
      }

      // Strict India mobile validation: +91 followed by 10 digits starting with 6-9.
      if (!/^\+91[6-9]\d{9}$/.test(formattedPhone)) {
        throw new Error("Enter a valid Indian mobile number in +91XXXXXXXXXX format.");
      }

      // FIX 3: Destroy any existing verifier before creating a new one.
      recaptchaRef.current?.clear();
      recaptchaRef.current = new RecaptchaVerifier(auth, containerId, { size: "invisible" });

      const result = await signInWithPhoneNumber(auth, formattedPhone, recaptchaRef.current);
      confirmationRef.current = result;
      return result.verificationId;
    } catch (error: any) {
      const code = error.code;
      if (code === "auth/invalid-phone-number") throw new Error("The phone number provided is invalid.");
      if (code === "auth/too-many-requests") throw new Error("Too many attempts. Please try again later.");
      if (code === "auth/operation-not-allowed") throw new Error("Phone authentication is not enabled in Firebase.");
      throw error;
    }
  };

  const verifyPhoneOTP = async (_verificationId: string, otp: string): Promise<void> => {
    const confirmation = confirmationRef.current;
    if (!confirmation) throw new Error("No pending OTP. Please request a new code.");
    await confirmation.confirm(otp);
    if (auth.currentUser?.phoneNumber) {
      const userRef = doc(db, "users", auth.currentUser.uid);
      const userSnap = await getDoc(userRef);
      const existingDisplayName = (userSnap.data()?.displayName as string | undefined) ?? auth.currentUser.displayName ?? "";
      const existingReferralCode = normalizeReferralCode(userSnap.data()?.referralCode as string | undefined);
      const referralCode = isValidReferralCode(existingReferralCode)
        ? existingReferralCode
        : generateReferralCode({
            displayName: existingDisplayName,
            phoneNumber: auth.currentUser.phoneNumber,
            uid: auth.currentUser.uid,
          });

      const update = {
        phoneNumber: auth.currentUser.phoneNumber,
        referralCode,
        updatedAt: serverTimestamp(),
      };
      await updateDoc(userRef, update);
      await mirrorPublicProfile(auth.currentUser.uid, update);
    }
    confirmationRef.current = null;
    recaptchaRef.current?.clear();
    recaptchaRef.current = null;
  };

  // ── Delete account (soft-delete → hard-delete, with rollback) ────────
  const deleteAccount = async (password?: string): Promise<{ success: boolean; reason?: string }> => {
    if (!auth.currentUser) return { success: false, reason: "Not logged in" };
    const userRef = doc(db, "users", auth.currentUser.uid);
    try {
      const isEmailProvider = auth.currentUser.providerData.some(p => p.providerId === "password");
      if (isEmailProvider && password) {
        const credential = EmailAuthProvider.credential(auth.currentUser.email!, password);
        await reauthenticateWithCredential(auth.currentUser, credential);
      }
      const originalSnap = await getDoc(userRef);
      const originalData = originalSnap.data();

      const deletionUpdate = {
        displayName: "Deleted User",
        email: `deleted_${auth.currentUser.uid}@ProNeighbor.in`,
        bio: "", photoURL: "", skills: [], society: "", flatNumber: "",
        phoneNumber: null, fcmToken: null,
        deleted: true, deletedAt: serverTimestamp(), updatedAt: serverTimestamp(),
      };
      await updateDoc(userRef, deletionUpdate);
      await mirrorPublicProfile(auth.currentUser.uid, deletionUpdate);

      try {
        await deleteUser(auth.currentUser);
      } catch (authErr: unknown) {
        if (originalData) {
          await updateDoc(userRef, { ...originalData, deleted: false, deletedAt: null });
        }
        const code = (authErr as { code?: string }).code;
        if (code === "auth/requires-recent-login") return { success: false, reason: "Please sign out and sign in again before deleting." };
        throw authErr;
      }
      return { success: true };
    } catch (e: unknown) {
      const code = (e as { code?: string }).code;
      if (code === "auth/wrong-password") return { success: false, reason: "Incorrect password." };
      if (code === "auth/requires-recent-login") return { success: false, reason: "Please sign out and sign in again before deleting." };
      return { success: false, reason: "Deletion failed. Try again." };
    }
  };

  return (
    <AuthContext.Provider value={{
      user, userProfile, loading,
      signIn, signUp, signInWithGoogle, resetPassword, resendVerificationEmail, logout,
      sendPhoneOTP, verifyPhoneOTP, deleteAccount,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
