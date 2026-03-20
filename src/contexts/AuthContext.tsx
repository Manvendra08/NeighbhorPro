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
  isServiceProvider?: boolean;
  priceAfterQuote?: boolean;
  role: "user" | "admin";
  rating: number;
  reviewCount: number;
  coinBalance: number;        // ← NeighbourCoins balance
  referralCode?: string;      // ← unique code for referral tracking
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
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

function generateReferralCode(uid: string): string {
  return "PN" + uid.slice(0, 6).toUpperCase();
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
      if (snap.exists()) setUserProfile(snap.data() as UserProfile);
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
        isServiceProvider: false,
        priceAfterQuote: false,
        role: "user",
        rating: 0,
        reviewCount: 0,
        coinBalance: 0,              // starts at 0; signup bonus credited below
        referralCode: generateReferralCode(u.uid),
        createdAt: serverTimestamp(),
      };
      await setDoc(ref, profile);
      // Grant 100 NC signup bonus
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
  };

  const signInWithGoogle = async () => {
    const { user: u } = await signInWithPopup(auth, googleProvider);
    await createUserProfile(u);
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, userProfile, loading, signIn, signUp, signInWithGoogle, resetPassword, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
