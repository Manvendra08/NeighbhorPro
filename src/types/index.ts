/**
 * Centralized domain types for ProNeighbor.
 * Using shared types eliminates `Record<string, unknown>` throughout the codebase
 * and enables auto-complete + compile-time safety.
 */
import { Timestamp } from "firebase/firestore";

export type LoyaltyTier = "none" | "bronze" | "silver" | "gold" | "diamond";

// ── Booking ──────────────────────────────────────────────────────────────────
export interface Booking {
  id: string;
  clientId: string;
  clientName: string;
  proId: string;
  proName?: string;
  serviceId?: string;
  serviceName?: string;
  serviceCategory?: string;
  date?: string;
  timeSlot?: string;
  notes?: string;
  amount?: number;
  isPaid?: boolean;
  status: "pending" | "confirmed" | "completed" | "cancelled" | "reviewed";
  escrowCoins?: number;
  coinsPaid?: boolean;
  escrowStatus?: "none" | "held" | "released" | "refunded";
  platformFee?: number;
  proEarning?: number;
  paidInCoins?: number;
  attachmentUrl?: string;
  attachmentName?: string;
  attachmentType?: string;
  streakCount?: number;
  loyaltyTier?: LoyaltyTier;
  loyaltyCashback?: number;
  proBonus?: number;
  loyaltyProcessedAt?: unknown;
  createdAt: unknown;
  updatedAt?: unknown;
}

export interface LoyaltyStreak {
  id: string;
  clientId: string;
  proId: string;
  currentStreak: number;
  longestStreak: number;
  tier: LoyaltyTier;
  highestTier?: LoyaltyTier;
  cadence?: "weekly" | "monthly";
  lastBookingDate?: Timestamp | string | null;
  streakStartDate?: Timestamp | string | null;
  lastCompletedBookingId?: string;
  totalCashbackEarned: number;
  totalProBonusEarned: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

// ── Feed ─────────────────────────────────────────────────────────────────────
export interface FeedPost {
  id: string;
  authorId: string;
  authorName: string;
  content: string;
  locality?: string;
  tower?: string;
  likes: number;
  createdAt: Timestamp;
}

// ── Conversation / Messaging ──────────────────────────────────────────────────
export interface ConversationSummary {
  id: string;
  participants: string[];
  lastMessage: string;
  lastMessageAt?: Timestamp;
  lastReadAt?: Record<string, Timestamp>;
  lastSenderId?: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  text: string;
  timestamp: Timestamp;
  read?: boolean;
  attachmentUrl?: string;
  attachmentType?: string;
  attachmentName?: string;
}

// ── User / Profile ────────────────────────────────────────────────────────────
export interface UserSummary {
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
  residencyProofPreviewUrl?: string;
  residentVerificationStatus: "none" | "pending" | "verified";
  verificationReviewNote?: string | null;
  isServiceProvider?: boolean;
  priceAfterQuote?: boolean;
  role: "user" | "admin";
  rating: number;
  reviewCount: number;
  coinBalance: number;
  highestLoyaltyTier?: LoyaltyTier;
  referralCode?: string;
  recentlyViewedPros?: string[];
  createdAt: unknown;
}

// ── Service ───────────────────────────────────────────────────────────────────
export interface Service {
  id: string;
  userId: string;
  title: string;
  description: string;
  price: number;
  isFree: boolean;
  duration: string;
  category: string;
  status?: "pending" | "approved" | "featured" | "rejected";
  moderationReason?: string;
  moderatedBy?: string;
  moderatedAt?: unknown;
  adminNotes?: string;
  createdAt: unknown;
  updatedAt?: unknown;
}

// ── Transaction ───────────────────────────────────────────────────────────────
export interface Transaction {
  id: string;
  proId: string;
  clientName?: string;
  serviceName?: string;
  amount: number;
  proEarning: number;
  createdAt: unknown;
}

