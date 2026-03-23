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

  /** Tracks whether the one-time profile-complete bonus has been claimed this session.
   * Prevents earnCoins from firing on every Firestore snapshot update. */
  const profileBonusClaimedRef = useRef(false);

  // OTP confirmation stored in a ref to avoid polluting window global
  type ConfirmationResult = Awaited<ReturnType<typeof signInWithPhoneNumber>>;
  const confirmationRef = useRef<ConfirmationResult | null>(null);

  useEffect(() => {
    if (!user) {
      profileBonusClaimedRef.current = false; // Reset on logout
      return;
    }
    const unsub = onSnapshot(doc(db, "users", user.uid), snap => {
      if (snap.exists()) {
        const data = snap.data() as UserProfile;
        setUserProfile(data);
        // Only attempt to credit the profile-complete bonus once per session
        if (!profileBonusClaimedRef.current && isProfileComplete(data)) {
          profileBonusClaimedRef.current = true;
          earnCoins(user.uid, "earn_profile", user.uid).catch(() => {
            // Reset so it can retry on next load if it failed transiently
            profileBonusClaimedRef.current = false;
          });
        }
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
    // Stored in a React ref — safe across re-renders, no global pollution
    confirmationRef.current = result;
    return result.verificationId;
  };

  const verifyPhoneOTP = async (_verificationId: string, otp: string): Promise<void> => {
    const confirmation = confirmationRef.current;
    if (!confirmation) throw new Error("No pending OTP. Please request a new code.");
    await confirmation.confirm(otp);
    // Update Firestore with phone number
    if (auth.currentUser?.phoneNumber) {
      await updateDoc(doc(db, "users", auth.currentUser.uid), {
        phoneNumber: auth.currentUser.phoneNumber, updatedAt: serverTimestamp(),
      });
    }
    confirmationRef.current = null; // Clear after successful verification
  };

  // ── Delete account (soft-delete then hard-delete, with rollback on failure) ─
  const deleteAccount = async (password?: string): Promise<{ success: boolean; reason?: string }> => {
    if (!auth.currentUser) return { success: false, reason: "Not logged in" };
    const userRef = doc(db, "users", auth.currentUser.uid);
    try {
      // Re-authenticate for email/password users
      const isEmailProvider = auth.currentUser.providerData.some(p => p.providerId === "password");
      if (isEmailProvider && password) {
        const credential = EmailAuthProvider.credential(auth.currentUser.email!, password);
        await reauthenticateWithCredential(auth.currentUser, credential);
      }
      // Snapshot original profile for rollback in case auth deletion fails
      const originalSnap = await getDoc(userRef);
      const originalData = originalSnap.data();

      // Step 1: Soft-delete — anonymize personal data
      await updateDoc(userRef, {
        displayName: "Deleted User",
        email: `deleted_${auth.currentUser.uid}@ProNeighbor.in`,
        bio: "", photoURL: "", skills: [], society: "", flatNumber: "",
        phoneNumber: null, fcmToken: null,
        deleted: true, deletedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Step 2: Hard-delete Firebase Auth — if this fails, roll back the Firestore anonymization
      try {
        await deleteUser(auth.currentUser);
      } catch (authErr: unknown) {
        // Rollback: restore original profile so user account is not corrupted
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


