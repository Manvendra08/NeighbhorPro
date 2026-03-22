import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  sendPasswordResetEmail,
  sendEmailVerification,
} from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp, onSnapshot } from "firebase/firestore";
import { auth, db, googleProvider } from "../firebase";
import { earnCoins } from "../services/coinService";

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
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
}

const AuthContext = createContext<AuthContextType | null>(null);

function generateReferralCode(uid: string): string {
  return "PN" + uid.slice(0, 6).toUpperCase();
}

// Important #8: check if profile is "complete" enough to earn the profile coin
function isProfileComplete(profile: Partial<UserProfile>): boolean {
  return !!(
    profile.displayName?.trim() &&
    profile.bio?.trim() &&
    profile.society?.trim() &&
    (profile.skills?.length ?? 0) > 0
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) { setUserProfile(null); setLoading(false); }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) return;
    const ref = doc(db, "users", user.uid);
    const unsubscribe = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const data = snap.data() as UserProfile;
        setUserProfile(data);

        // Important #8: award earn_profile coin when profile becomes complete
        if (isProfileComplete(data)) {
          earnCoins(user.uid, "earn_profile", user.uid).catch(() => {});
        }
      }
      setLoading(false);
    }, () => setLoading(false));
    return unsubscribe;
  }, [user]);

  const createUserProfile = async (u: User) => {
    const ref = doc(db, "users", u.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      const profile: UserProfile = {
        uid: u.uid,
        displayName: u.displayName ?? "",
        email: u.email ?? "",
        photoURL: u.photoURL ?? "",
        bio: "",
        skills: [],
        hourlyRate: 0,
        isFreeConsultation: true,
        society: "",
        locality: "",
        tower: "",
        flatNumber: "",
        residentVerificationStatus: "none",
        verificationMethod: null,
        isServiceProvider: false,
        priceAfterQuote: false,
        role: "user",
        rating: 0,
        reviewCount: 0,
        coinBalance: 0,
        referralCode: generateReferralCode(u.uid),
        emailVerified: u.emailVerified,
        createdAt: serverTimestamp(),
      };
      await setDoc(ref, profile);
      await earnCoins(u.uid, "earn_signup_bonus", u.uid);
    }
  };

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signUp = async (email: string, password: string, displayName: string) => {
    const { user: u } = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(u, { displayName });
    await createUserProfile({ ...u, displayName });
    // Blocker #2: send verification email on registration
    await sendEmailVerification(u);
  };

  const signInWithGoogle = async () => {
    const { user: u } = await signInWithPopup(auth, googleProvider);
    await createUserProfile(u);
    // Google accounts are pre-verified — no email verification needed
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  // Blocker #2: allow users to re-request verification email
  const resendVerificationEmail = async () => {
    if (auth.currentUser && !auth.currentUser.emailVerified) {
      await sendEmailVerification(auth.currentUser);
    }
  };

  const logout = async () => { await signOut(auth); };

  return (
    <AuthContext.Provider value={{
      user, userProfile, loading,
      signIn, signUp, signInWithGoogle,
      resetPassword, resendVerificationEmail, logout,
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
