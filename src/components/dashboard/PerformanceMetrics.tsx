type BookingRow = Record<string, unknown>;

type PerformanceMetricsProps = {
  rating: number | null;
  reviewDistribution: Record<number, number>;
  bookings: BookingRow[];
};

export default function PerformanceMetrics({
  rating,
  reviewDistribution,
  bookings,
}: PerformanceMetricsProps) {
  const totalReviews = Object.values(reviewDistribution).reduce((sum, count) => sum + (Number(count) || 0), 0);
  const activeBookings = bookings.filter(booking => String(booking.status || "") !== "cancelled").length;
  const completedBookings = bookings.filter(booking => ["completed", "reviewed"].includes(String(booking.status || ""))).length;
  const completionRate = activeBookings > 0 ? Math.round((completedBookings / activeBookings) * 100) : 0;

  return (
    <div className="db-performance">
      <div className="db-performance__summary">
        <div>
          <span className="db-performance__eyebrow">Average rating</span>
          <div className="db-performance__rating">{rating ? rating.toFixed(1) : "—"}<span>★</span></div>
        </div>
        <div className="db-performance__meta">
          <strong>{completionRate}%</strong>
          <span>completion rate</span>
        </div>
        <div className="db-performance__meta">
          <strong>{totalReviews}</strong>
          <span>total reviews</span>
        </div>
      </div>

      <div className="db-performance__bars">
        {[5, 4, 3, 2, 1].map(star => {
          const count = Number(reviewDistribution[star]) || 0;
          const width = totalReviews > 0 ? (count / totalReviews) * 100 : 0;
          return (
            <div key={star} className="db-performance__bar-row">
              <span>{star}★</span>
              <div className="db-performance__bar">
                <div className="db-performance__bar-fill" style={{ width: `${width}%` }} />
              </div>
              <strong>{count}</strong>
            </div>
          );
        })}
      </div>
    </div>
  );
}
