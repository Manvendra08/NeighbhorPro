import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { getBookingsForPro, getUserProfile, getBookingsForUser, getReviewDistribution } from "../services/firestoreService";
import { getLoyaltyPreview, type LoyaltyPreview } from "../services/loyaltyService";
import DesktopDashboard from "../components/dashboard/DesktopDashboard";
import MobileDashboard from "../components/dashboard/MobileDashboard";

export default function Dashboard() {
  const { user } = useAuth();
  const [userProfile, setUserProfile] = useState<Record<string, unknown> | null>(null);
  const [upcomingBookings, setUpcomingBookings] = useState<Record<string, unknown>[]>([]);
  const [proBookings, setProBookings] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [lastBookedPro, setLastBookedPro] = useState<Record<string, unknown> | null>(null);
  const [lastCompletedBooking, setLastCompletedBooking] = useState<Record<string, unknown> | null>(null);
  const [loyaltyPreview, setLoyaltyPreview] = useState<LoyaltyPreview | null>(null);
  const [reviewDistribution, setReviewDistribution] = useState<Record<number, number>>({ 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 });
  const [computedRating, setComputedRating] = useState<number | null>(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const profile = await getUserProfile(user.uid);
        if (!profile) throw new Error("User profile not found");
        setUserProfile(profile);

        if ((profile.isServiceProvider as boolean) === true) {
          const reviewData = await getReviewDistribution(user.uid);
          setReviewDistribution(reviewData);
          const total = Object.values(reviewData).reduce((sum, count) => sum + count, 0);
          if (total > 0) {
            const weighted = (5 * reviewData[5]) + (4 * reviewData[4]) + (3 * reviewData[3]) + (2 * reviewData[2]) + (1 * reviewData[1]);
            setComputedRating(Math.round((weighted / total) * 10) / 10);
          } else {
            setComputedRating(((profile.rating as number) ?? null));
          }
        } else {
          setReviewDistribution({ 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 });
          setComputedRating(((profile.rating as number) ?? null));
        }

        const [upcoming, proReqs, lastCompleted] = await Promise.all([
          getBookingsForUser(user.uid),
          (profile.isServiceProvider as boolean) ? getBookingsForPro(user.uid) : Promise.resolve([]),
          getBookingsForUser(user.uid)
        ]);
        
        setUpcomingBookings(upcoming);
        setProBookings(proReqs);
        
        if (lastCompleted && lastCompleted.length > 0) {
          const latest = lastCompleted[0];
          setLastCompletedBooking(latest);
          const proObj = await getUserProfile(latest.proId as string);
          setLastBookedPro(proObj);
          // @ts-ignore - getLoyaltyPreview might have different signature or missing in some branches
          const loyalty = await getLoyaltyPreview(user.uid, latest.proId as string);
          setLoyaltyPreview(loyalty);
        }
      } catch (error) {
        console.error("Dashboard fetch error:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  if (!user) return null;

  return (
    <div className="page-container" style={{ padding: isMobile ? "0 0 80px" : "0 0 40px" }}>
      {isMobile ? (
        <MobileDashboard
          user={user}
          userProfile={userProfile}
          upcomingBookings={upcomingBookings}
          proBookings={proBookings}
          loading={loading}
          computedRating={computedRating}
          reviewDistribution={reviewDistribution}
          lastBookedPro={lastBookedPro}
          lastCompletedBooking={lastCompletedBooking}
          loyaltyPreview={loyaltyPreview}
        />
      ) : (
        <DesktopDashboard
          user={user}
          userProfile={userProfile}
          upcomingBookings={upcomingBookings}
          proBookings={proBookings}
          loading={loading}
          computedRating={computedRating}
          reviewDistribution={reviewDistribution}
          lastBookedPro={lastBookedPro}
          lastCompletedBooking={lastCompletedBooking}
          loyaltyPreview={loyaltyPreview}
        />
      )}
    </div>
  );
}
