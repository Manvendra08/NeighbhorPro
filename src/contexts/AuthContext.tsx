import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import {
  User, onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signInWithPopup, signOut,
  updateProfile, sendPasswordResetEmail, sendEmailVerification,
  PhoneAuthProvider, signInWithPhoneNumber, RecaptchaVerifier,
  reauthenticateWithCredential, EmailAuthProvider, deleteUser,
} from "firebase/auth";
import { doc, setDoc, getDoc, updateDoc, deleteDoc, serverTimestamp, onSnapshot } from "firebase/firestore";
import { auth, db, googleProvider } from "../firebase";
import { earnCoins } from "../services/coinService";

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
  residentVerificationStatus: "none" | "pending" | "verified";
  verificationMethod: "manual" | "auto" | null;
  isServiceProvider?: boolean;
  priceAfterQuote?: boolean;
  role: "user" | "admin";
  rating: number;
  reviewCount: number;
  coinBalance: number;
  referralCode?: string;
  emailVerified?: boolean;
  // Privacy controls
  phoneVisible?: boolean;
  flatVisible?: boolean;
  // Account state
  deleted?: boolean;
  fcmToken?: string;
  createdAt: unknown;
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
  sendPhoneOTP: (phone: string, containerId: string) => Promise<string>; // returns verificationId
  verifyPhoneOTP: (verificationId: string, otp: string) => Promise<void>;
  deleteAccount: (password?: string) => Promise<{ success: boolean; reason?: string }>;
}

const AuthContext = createContext<AuthContextType | null>(null);

function generateReferralCode(uid: string): string {
  return "PN" + uid.slice(0, 6).toUpperCase();
}

function isProfileComplete(profile: Partial<UserProfile>): boolean {
  return !!(profile.displayName?.trim() && profile.bio?.trim() && profile.society?.trim() && (profile.skills?.length ?? 0) > 0);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]               = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => {
      setUser(u);
      if (!u) { setUserProfile(null); setLoading(false); }
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, "users", user.uid), snap => {
      if (snap.exists()) {
        const data = snap.data() as UserProfile;
        setUserProfile(data);
        if (isProfileComplete(data)) earnCoins(user.uid, "earn_profile", user.uid).catch(() => {});
      }
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [user]);

  const createUserProfile = async (u: User) => {
    const ref  = doc(db, "users", u.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      const profile: UserProfile = {
        uid: u.uid, displayName: u.displayName ?? "", email: u.email ?? "",
        photoURL: u.photoURL ?? "", bio: "", skills: [], hourlyRate: 0,
        isFreeConsultation: true, society: "", locality: "", tower: "", flatNumber: "",
        residentVerificationStatus: "none", verificationMethod: null,
        isServiceProvider: false, priceAfterQuote: false,
        role: "user", rating: 0, reviewCount: 0, coinBalance: 0,
        referralCode: generateReferralCode(u.uid),
        emailVerified: u.emailVerified,
        phoneVisible: false, flatVisible: false,
        createdAt: serverTimestamp(),
      };
      await setDoc(ref, profile);
      await earnCoins(u.uid, "earn_signup_bonus", u.uid);
    }
  };

  const signIn    = async (email: string, password: string) => { await signInWithEmailAndPassword(auth, email, password); };
  const signUp    = async (email: string, password: string, displayName: string) => {
    const { user: u } = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(u, { displayName });
    await createUserProfile({ ...u, displayName });
    await sendEmailVerification(u);
  };
  const signInWithGoogle     = async () => { const { user: u } = await signInWithPopup(auth, googleProvider); await createUserProfile(u); };
  const resetPassword        = async (email: string) => { await sendPasswordResetEmail(auth, email); };
  const resendVerificationEmail = async () => { if (auth.currentUser && !auth.currentUser.emailVerified) await sendEmailVerification(auth.currentUser); };
  const logout               = async () => { await signOut(auth); };

  // ── Phone OTP ────────────────────────────────────────────────────────
  const sendPhoneOTP = async (phone: string, containerId: string): Promise<string> => {
    const recaptcha = new RecaptchaVerifier(auth, containerId, { size: "invisible" });
    const result    = await signInWithPhoneNumber(auth, phone, recaptcha);
    // Store confirmationResult on window for verifyPhoneOTP
    (window as unknown as Record<string, unknown>)["_phoneConfirmation"] = result;
    return result.verificationId;
  };

  const verifyPhoneOTP = async (_verificationId: string, otp: string): Promise<void> => {
    const confirmation = (window as unknown as Record<string, unknown>)["_phoneConfirmation"] as { confirm: (otp: string) => Promise<unknown> };
    if (!confirmation) throw new Error("No pending OTP");
    await confirmation.confirm(otp);
    // Update Firestore with phone number
    if (auth.currentUser?.phoneNumber) {
      await updateDoc(doc(db, "users", auth.currentUser.uid), {
        phoneNumber: auth.currentUser.phoneNumber, updatedAt: serverTimestamp(),
      });
    }
  };

  // ── Delete account (soft-delete, DPDP compliant) ─────────────────────
  const deleteAccount = async (password?: string): Promise<{ success: boolean; reason?: string }> => {
    if (!auth.currentUser) return { success: false, reason: "Not logged in" };
    try {
      // Re-authenticate for email/password users
      const isEmailProvider = auth.currentUser.providerData.some(p => p.providerId === "password");
      if (isEmailProvider && password) {
        const credential = EmailAuthProvider.credential(auth.currentUser.email!, password);
        await reauthenticateWithCredential(auth.currentUser, credential);
      }
      // Soft-delete: anonymize profile, mark deleted, keep for 30 days
      await updateDoc(doc(db, "users", auth.currentUser.uid), {
        displayName: "Deleted User",
        email: `deleted_${auth.currentUser.uid}@proneighbour.in`,
        bio: "", photoURL: "", skills: [], society: "", flatNumber: "",
        phoneNumber: null, fcmToken: null,
        deleted: true, deletedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await deleteUser(auth.currentUser);
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
