import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { deleteFeedPost, subscribeToFeed } from "../../services/firestoreService";
import type { DashboardDataResult } from "../../hooks/useDashboardData";
import SmartGreeting from "./SmartGreeting";
import DashboardSection from "./DashboardSection";
import WeekStrip from "./WeekStrip";
import EnhancedStatsCards, { type DashboardStatCard } from "./EnhancedStatsCards";
import BookingPipeline from "./BookingPipeline";
import PerformanceMetrics from "./PerformanceMetrics";
import CategoryBrowseChips from "./CategoryBrowseChips";
import FeedComposer from "./FeedComposer";
import FeedPostCard from "./FeedPostCard";
import RecommendedPros from "./RecommendedPros";

type DashboardUser = {
  uid: string;
  displayName?: string | null;
};

type MobileDashboardProps = DashboardDataResult & {
  user: DashboardUser;
};

type FeedPost = Record<string, unknown>;
type BookingRow = Record<string, unknown>;

function parseDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "object" && value !== null && "toDate" in (value as Record<string, unknown>)) {
    const date = (value as { toDate?: () => Date }).toDate?.();
    return date ?? null;
  }
  const parsed = new Date(value as string | number);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function bookingDate(booking: BookingRow): Date | null {
  const rawDate = typeof booking.date === "string" ? booking.date.trim() : "";
  const [timeRaw] = String(booking.timeSlot || "").split("-");
  if (rawDate) {
    const combined = new Date(timeRaw ? `${rawDate} ${timeRaw.trim()}` : rawDate);
    if (!Number.isNaN(combined.getTime())) return combined;
  }
  return parseDate(booking.createdAt);
}

function isUpcoming(booking: BookingRow): boolean {
  const status = String(booking.status || "");
  if (!["pending", "confirmed"].includes(status)) return false;
  const date = bookingDate(booking);
  return date ? date.getTime() >= Date.now() - (60 * 60 * 1000) : true;
}

function findNextBooking(bookings: BookingRow[]): BookingRow | null {
  return [...bookings]
    .filter(isUpcoming)
    .sort((left, right) => (bookingDate(left)?.getTime() || 0) - (bookingDate(right)?.getTime() || 0))[0] ?? null;
}

export default function MobileDashboard({
  userProfile,
  user,
  userBookings,
  upcomingBookings,
  proBookings,
  loading,
  computedRating,
  reviewDistribution,
  lastBookedPro,
  lastCompletedBooking,
  profileCompletion,
  earningsSummary,
  isPro,
}: MobileDashboardProps) {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const firstName = ((userProfile?.displayName as string) || user.displayName || "there").split(" ")[0];
  const uid = user.uid;
  const displayName = (userProfile?.displayName as string) || user.displayName || "User";
  const locality = (userProfile?.locality as string) || undefined;
  const tower = (userProfile?.tower as string) || undefined;
  const society = (userProfile?.society as string) || undefined;
  const authorPhotoURL = (userProfile?.photoURL as string) || undefined;
  const coins = Number(userProfile?.coinBalance) || 0;
  const rating = computedRating ?? ((userProfile?.rating as number) || null);
  const totalReviews = Object.values(reviewDistribution).reduce((sum, count) => sum + (Number(count) || 0), 0);
  const ratingBreakdown = [5, 4, 3, 2, 1]
    .map(star => `${star}★${Number(reviewDistribution[star]) || 0}`)
    .join(" ");
  const proPending = proBookings.filter(booking => booking.status === "pending").length;
  const nextBooking = isPro ? findNextBooking(proBookings) : findNextBooking(upcomingBookings);

  useEffect(() => {
    const unsub = subscribeToFeed(locality, setPosts);
    return unsub;
  }, [locality]);

  const handleDelete = async (postId: string) => {
    if (!confirm("Delete this post?")) return;
    await deleteFeedPost(postId);
  };

  const visiblePosts = useMemo(
    () => posts.filter(post => post.hidden !== true || (post.authorId as string) === uid),
    [posts, uid],
  );

  const statsCards: DashboardStatCard[] = isPro
    ? [
        { label: "Balance", value: `${coins.toLocaleString("en-IN")} NC`, helper: "Wallet", icon: "🪙", tone: "warning", to: "/wallet", sparkline: earningsSummary.balanceSeries },
        { label: "Upcoming", value: String(proBookings.filter(isUpcoming).length), helper: "Service sessions", icon: "📅", tone: "accent", to: "/bookings", sparkline: earningsSummary.dailySeries },
        { label: "Requests", value: String(proPending), helper: "Need reply", icon: "🗂", tone: "danger", to: "/bookings", sparkline: earningsSummary.dailySeries },
        { label: "Earned", value: `${earningsSummary.thisMonth.toLocaleString("en-IN")} NC`, helper: "This month", icon: "📈", tone: "success", to: "/wallet", sparkline: earningsSummary.dailySeries },
      ]
    : [
        { label: "Balance", value: `${coins.toLocaleString("en-IN")} NC`, helper: "Wallet", icon: "🪙", tone: "warning", to: "/wallet", sparkline: earningsSummary.balanceSeries },
        { label: "Upcoming", value: String(upcomingBookings.length), helper: "Next sessions", icon: "📅", tone: "accent", to: "/bookings", sparkline: earningsSummary.balanceSeries },
        { label: "Average Rating", value: rating ? `${rating.toFixed(1)}★` : "—", helper: `Reviews: ${totalReviews} · ${ratingBreakdown}`, icon: "⭐", tone: "success", to: "/profile", sparkline: [1, 2, 3, 4, 5].map(star => Number(reviewDistribution[star]) || 0) },
        { label: "Bookings", value: String(userBookings.length), helper: "Total", icon: "📦", tone: "accent", to: "/bookings", sparkline: earningsSummary.balanceSeries },
      ];

  if (loading && !userProfile) {
    return <div className="db-loading"><div className="loader" /></div>;
  }

  return (
    <div className="db-page db-page--mobile">
      {isPro ? (
        <div className="db-user-top-stack">
          <h1 className="db-greeting__title db-user-top-stack__title">Welcome back, {firstName} 👋</h1>
        </div>
      ) : (
        <div className="db-user-top-stack">
          <SmartGreeting
            firstName={firstName}
            isPro={isPro}
            proBookings={proBookings}
            nextBooking={nextBooking}
            profileIncomplete={!profileCompletion.complete}
            missingFields={profileCompletion.missingTop}
            profileCompletion={profileCompletion}
          />
        </div>
      )}


      {isPro ? (
        <>
          <DashboardSection title="Pipeline" subtitle="Mobile kanban for requests." actionLabel="Bookings" actionTo="/bookings">
            <BookingPipeline bookings={proBookings} />
          </DashboardSection>
          <DashboardSection title="Performance" subtitle="Ratings and completion." actionLabel="Profile" actionTo="/profile">
            <PerformanceMetrics rating={rating} reviewDistribution={reviewDistribution} bookings={proBookings} />
          </DashboardSection>
        </>
      ) : (
        <>
          <DashboardSection title="This Week" subtitle="Bookings over next 7 days.">
            <WeekStrip bookings={upcomingBookings} />
          </DashboardSection>
          <DashboardSection title="Browse Categories" subtitle="One-tap shortcuts into discovery." actionLabel="Browse" actionTo="/browse">
            <CategoryBrowseChips />
          </DashboardSection>
          <DashboardSection title="Recommended Pros" subtitle="Same tower and top-rated signals." actionLabel="Browse" actionTo="/browse">
            <RecommendedPros uid={uid} userTower={tower} compact />
          </DashboardSection>
        </>
      )}

      <DashboardSection title="Snapshot" subtitle="Fast mobile summary cards.">
        <EnhancedStatsCards cards={statsCards} />
      </DashboardSection>

      {!isPro && lastBookedPro && lastCompletedBooking && (
        <div className="db-rebook-banner db-rebook-banner--mobile">
          <div className="db-rebook-banner__copy">
            <span className="db-rebook-banner__eyebrow">Rebook</span>
            <strong>{(lastBookedPro.displayName as string) || "Your last pro"}</strong>
            <span>{(lastCompletedBooking.serviceName as string) || "Previous session"}</span>
          </div>
          <Link className="btn btn-primary btn-sm" to={`/book/${lastBookedPro.uid as string}?rebook=true`}>Book again</Link>
        </div>
      )}

      <DashboardSection title="Neighborhood Feed" subtitle={locality ? `Posts from ${locality}` : "Community updates."} collapsible>
        <div className="db-feed-shell">
          <FeedComposer
            uid={uid}
            displayName={displayName}
            locality={locality}
            tower={tower}
            society={society}
            authorPhotoURL={authorPhotoURL}
          />

          <div className="db-feed-shell__list">
            {visiblePosts.length === 0 ? (
              <div className="db-feed-empty">
                <strong>No posts yet</strong>
                <span>Start conversation with your community.</span>
              </div>
            ) : (
              visiblePosts.map(post => (
                <FeedPostCard key={post.id as string} post={post} uid={uid} onDelete={handleDelete} />
              ))
            )}
          </div>
        </div>
      </DashboardSection>
    </div>
  );
}
