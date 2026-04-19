import { Link } from "react-router-dom";

type BookingRow = Record<string, unknown>;

type WeekStripProps = {
  bookings: BookingRow[];
};

function getDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseBookingDate(booking: BookingRow): Date | null {
  const date = typeof booking.date === "string" ? booking.date.trim() : "";
  if (!date) return null;
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export default function WeekStrip({ bookings }: WeekStripProps) {
  const today = new Date();
  const dayKeys = new Set(
    bookings
      .filter(booking => ["pending", "confirmed", "completed", "reviewed"].includes(String(booking.status || "")))
      .map(parseBookingDate)
      .filter((value): value is Date => Boolean(value))
      .map(getDateKey),
  );

  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setHours(0, 0, 0, 0);
    date.setDate(today.getDate() + index);
    return date;
  });

  const bookingCount = bookings.filter(booking => ["pending", "confirmed"].includes(String(booking.status || ""))).length;

  if (bookingCount === 0) {
    return (
      <div className="empty-state" style={{ marginTop: 6 }}>
        <div className="empty-state-title">
          Nothing booked this week. <Link to="/browse" style={{ color: "var(--accent)", textDecoration: "underline" }}>Browse Professionals →</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="db-week-strip">
      {days.map(day => {
        const key = getDateKey(day);
        const isToday = key === getDateKey(today);
        const hasBooking = dayKeys.has(key);
        return (
          <div key={key} className={`db-week-strip__day${isToday ? " db-week-strip__day--today" : ""}`}>
            <span className="db-week-strip__label">
              {day.toLocaleDateString("en-IN", { weekday: "short" })}
            </span>
            <span className="db-week-strip__date">{day.getDate()}</span>
            <span className={`db-week-strip__dot${hasBooking ? " db-week-strip__dot--active" : ""}`} />
          </div>
        );
      })}
    </div>
  );
}
