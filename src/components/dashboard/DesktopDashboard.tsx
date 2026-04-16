import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { deleteFeedPost, subscribeToFeed } from "../../services/firestoreService";
import type { DashboardDataResult } from "../../hooks/useDashboardData";
import SmartGreeting from "./SmartGreeting";
import QuickActions from "./QuickActions";
import DashboardSection from "./DashboardSection";
import WeekStrip from "./WeekStrip";
import EnhancedStatsCards, { type DashboardStatCard } from "./EnhancedStatsCards";
import EarningsHeroCard from "./EarningsHeroCard";
import BookingPipeline from "./BookingPipeline";
import PerformanceMetrics from "./PerformanceMetrics";
import ProfileCompletionNudge from "./ProfileCompletionNudge";
import CategoryBrowseChips from "./CategoryBrowseChips";
import FeedComposer from "./FeedComposer";
import FeedPostCard from "./FeedPostCard";
import RecommendedPros from "./RecommendedPros";

type DashboardUser = {
  uid: string;
  displayName?: string | null;
};

type DesktopDashboardProps = DashboardDataResult & {
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

function buildSeries(bookings: BookingRow[], mode: "all" | "upcoming" | "pending" = "all"): number[] {
  const today = new Date();
  return Array.from({ length: 7 }, (_, index) => {
    const start = new Date(today);
    start.setHours(0, 0, 0, 0);
    start.setDate(today.getDate() - (6 - index));
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    return bookings.filter((booking) => {
      const date = bookingDate(booking);
      if (!date) return false;
      if (mode === "upcoming" && !isUpcoming(booking)) return false;
      if (mode === "pending" && booking.status !== "pending") return false;
      return date.getTime() >= start.getTime() && date.getTime() < end.getTime();
    }).length;
  });
}

export default function DesktopDashboard({
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
}: DesktopDashboardProps) {
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

  const proPending = proBookings.filter(booking => booking.status === "pending").length;
  const proUpcoming = proBookings.filter(isUpcoming);
  const nextBooking = isPro ? findNextBooking(proBookings) : findNextBooking(upcomingBookings);

  const statsCards: DashboardStatCard[] = isPro
    ? [
        {
          label: "NC Balance",
          value: `${coins.toLocaleString("en-IN")} NC`,
          helper: "Live wallet balance",
          icon: "🪙",
          tone: "warning",
          to: "/wallet",
          sparkline: earningsSummary.balanceSeries,
        },
        {
          label: "Upcoming",
          value: String(proUpcoming.length),
          helper: "Pending + confirmed sessions",
          icon: "📅",
          tone: "accent",
          to: "/bookings",
          sparkline: buildSeries(proBookings, "upcoming"),
        },
        {
          label: "Requests",
          value: String(proPending),
          helper: "Need response",
          icon: "🗂",
          tone: "danger",
          to: "/bookings",
          sparkline: buildSeries(proBookings, "pending"),
        },
        {
          label: "Earnings / Month",
          value: `${earningsSummary.thisMonth.toLocaleString("en-IN")} NC`,
          helper: `${earningsSummary.pendingPayoutNC.toLocaleString("en-IN")} NC pending payout`,
          icon: "📈",
          tone: "success",
          to: "/wallet",
          sparkline: earningsSummary.dailySeries,
        },
      ]
    : [
        {
          label: "NC Balance",
          value: `${coins.toLocaleString("en-IN")} NC`,
          helper: "Wallet rewards + credits",
          icon: "🪙",
          tone: "warning",
          to: "/wallet",
          sparkline: earningsSummary.balanceSeries,
        },
        {
          label: "Upcoming",
          value: String(upcomingBookings.length),
          helper: "Pending + confirmed sessions",
          icon: "📅",
          tone: "accent",
          to: "/bookings",
          sparkline: buildSeries(upcomingBookings, "upcoming"),
        },
        {
          label: "Rating",
          value: rating ? `${rating.toFixed(1)}★` : "—",
          helper: `${totalReviews} review${totalReviews === 1 ? "" : "s"} tracked`,
          icon: "⭐",
          tone: "success",
          to: "/profile",
          sparkline: [1, 2, 3, 4, 5].map(star => Number(reviewDistribution[star]) || 0),
        },
        {
          label: "Total Bookings",
          value: String(userBookings.length),
          helper: "Sessions booked so far",
          icon: "📦",
          tone: "accent",
          to: "/bookings",
          sparkline: buildSeries(userBookings),
        },
      ];

  if (loading && !userProfile) {
    return <div className="db-loading"><div className="loader" /></div>;
  }

  return (
    <div className="db-page db-page--desktop">
      <SmartGreeting
        firstName={firstName}
        isPro={isPro}
        proBookings={proBookings}
        nextBooking={nextBooking}
        profileIncomplete={!profileCompletion.complete}
        missingFields={profileCompletion.missingTop}
      />

      <QuickActions isPro={isPro} />

      {isPro ? (
        <>
          <EarningsHeroCard
            thisMonth={earningsSummary.thisMonth}
            lastMonth={earningsSummary.lastMonth}
            changePct={earningsSummary.changePct}
            pendingPayoutNC={earningsSummary.pendingPayoutNC}
            dailySeries={earningsSummary.dailySeries}
            isPositive={earningsSummary.isPositive}
          />

          <div className="db-duo-grid">
            <DashboardSection
              title="Booking Pipeline"
              subtitle="Pending, confirmed, and completed this week."
              actionLabel="View all"
              actionTo="/bookings"
            >
              <BookingPipeline bookings={proBookings} />
            </DashboardSection>

            <DashboardSection
              title="Performance Metrics"
              subtitle="Ratings and completion health."
              actionLabel="Profile"
              actionTo="/profile"
            >
              <PerformanceMetrics
                rating={rating}
                reviewDistribution={reviewDistribution}
                bookings={proBookings}
              />
            </DashboardSection>
          </div>
        </>
      ) : (
        <div className="db-duo-grid">
          <DashboardSection
            title="This Week"
            subtitle="See what is coming up over next 7 days."
            actionLabel="Bookings"
            actionTo="/bookings"
          >
            <WeekStrip bookings={upcomingBookings} />
          </DashboardSection>

          <DashboardSection
            title="Recommended Pros"
            subtitle="Trust signals from your neighborhood."
            actionLabel="Browse"
            actionTo="/browse"
          >
            <RecommendedPros uid={uid} userTower={tower} />
          </DashboardSection>
        </div>
      )}

      <DashboardSection
        title={isPro ? "Business Snapshot" : "Your Snapshot"}
        subtitle={isPro ? "Balance, pipeline, and earnings at a glance." : "Wallet, bookings, and trust signals."}
      >
        <EnhancedStatsCards cards={statsCards} />
      </DashboardSection>

      {!isPro && lastBookedPro && lastCompletedBooking && (
        <div className="db-rebook-banner">
          <div className="db-rebook-banner__copy">
            <span className="db-rebook-banner__eyebrow">Rebook faster</span>
            <strong>Book {(lastBookedPro.displayName as string) || "your last pro"} again</strong>
            <span>
              {(lastCompletedBooking.serviceName as string) || "Last service"}
              {tower ? ` • ${tower}` : ""}
            </span>
          </div>
          <Link className="btn btn-primary" to={`/book/${lastBookedPro.uid as string}?rebook=true`}>
            Re-book
          </Link>
        </div>
      )}

      {!isPro && (
        <DashboardSection
          title="Browse by Category"
          subtitle="Jump straight into popular neighborhood needs."
          actionLabel="Browse all"
          actionTo="/browse"
        >
          <CategoryBrowseChips />
        </DashboardSection>
      )}

      <ProfileCompletionNudge completion={profileCompletion} />

      <DashboardSection
        title={isPro ? "Community Feed" : "Neighborhood Feed"}
        subtitle={locality ? `Posts from ${locality}` : "What your neighbors are sharing."}
        collapsible
      >
        <div className="db-feed-shell">
          <FeedComposer
            uid={uid}
            displayName={displayName}
            locality={locality}
            tower={tower}
            society={society}
            authorPhotoURL={authorPhotoURL}
          />

          <div className="db-feed-shell__meta">
            <span>{visiblePosts.length} live post{visiblePosts.length === 1 ? "" : "s"}</span>
            <span>Composer and moderation flow unchanged</span>
          </div>

          <div className="db-feed-shell__list">
            {visiblePosts.length === 0 ? (
              <div className="db-feed-empty">
                <strong>No posts yet</strong>
                <span>Be first to share something with your neighbors.</span>
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
