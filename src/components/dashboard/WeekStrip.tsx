import { Link } from "react-router-dom";

type BookingRow = Record<string, unknown>;

type WeekStripProps = {
  bookings: BookingRow[];
};

function getDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseBookingDate(booking: BookingRow): Date | null {
  const date = typeof booking.date === "string" ? booking.date.trim() : "";
  if (!date) return null;
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const parsed = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : new Date(date);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export default function WeekStrip({ bookings }: WeekStripProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekEnd = new Date(today);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const openThisWeek = bookings.filter((booking) => {
    const status = String(booking.status || "");
    if (!["pending", "confirmed"].includes(status)) return false;
    const parsed = parseBookingDate(booking);
    if (!parsed) return false;
    const date = new Date(parsed);
    date.setHours(0, 0, 0, 0);
    return date.getTime() >= today.getTime() && date.getTime() < weekEnd.getTime();
  });

  const dayKeys = new Set(
    openThisWeek
      .map(parseBookingDate)
      .filter((value): value is Date => Boolean(value))
      .map(getDateKey),
  );

  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() + index);
    return date;
  });

  const bookingCount = openThisWeek.length;

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
