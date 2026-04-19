type BookingRow = Record<string, unknown>;
type SmartGreetingProps = {
  firstName: string;
  isPro: boolean;
  proBookings: BookingRow[];
  nextBooking: BookingRow | null;
  profileIncomplete: boolean;
  missingFields: string[];
};

function parseBookingDate(booking: BookingRow | null): Date | null {
  if (!booking) return null;
  const date = typeof booking.date === "string" ? booking.date.trim() : "";
  if (!date) return null;
  const [timeRaw] = String(booking.timeSlot || "").split("-");
  const maybeDate = new Date(timeRaw ? `${date} ${timeRaw.trim()}` : date);
  return Number.isNaN(maybeDate.getTime()) ? null : maybeDate;
}

function formatBookingTime(booking: BookingRow | null): string {
  if (!booking) return "";
  const bookingDate = parseBookingDate(booking);
  if (!bookingDate) {
    return `${booking.date || ""}${booking.timeSlot ? ` at ${booking.timeSlot}` : ""}`.trim();
  }
  return bookingDate.toLocaleString("en-IN", {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function SmartGreeting({
  firstName,
  isPro,
  proBookings,
  nextBooking,
  profileIncomplete,
  missingFields,
}: SmartGreetingProps) {
  const pendingRequests = proBookings.filter(booking => booking.status === "pending").length;
  const nextBookingDate = parseBookingDate(nextBooking);
  const within24Hours = nextBookingDate
    ? nextBookingDate.getTime() - Date.now() <= 24 * 60 * 60 * 1000 && nextBookingDate.getTime() >= Date.now() - (60 * 60 * 1000)
    : false;

  let title = `Welcome back, ${firstName} 👋`;
  let subtitle = isPro
    ? "Track requests, earnings, and completion in one place."
    : "Book trusted experts faster and keep your week organized.";
  let badge = isPro ? "Pro Control Center" : "";

  if (isPro && pendingRequests > 0) {
    title = `Morning, ${firstName} — ${pendingRequests} pending request${pendingRequests > 1 ? "s" : ""} need response`;
    subtitle = "Reply fast to keep conversion and trust high.";
    badge = "Needs Attention";
  } else if (within24Hours && nextBooking) {
    title = `Morning, ${firstName} — your next session is ${formatBookingTime(nextBooking)}`;
    subtitle = `Stay ready for ${(nextBooking.serviceName as string) || "your upcoming booking"}.`;
    badge = "Coming Up";
  } else if (profileIncomplete) {
    title = `${firstName}, finish your profile to unlock more trust`;
    subtitle = `Still missing ${missingFields.slice(0, 2).join(" and ")}.`;
    badge = "Profile Boost";
  }

  return (
    <div className="db-greeting">
        <div className="db-greeting__copy">
          {badge ? <span className="db-greeting__badge">{badge}</span> : null}
          <h1 className="db-greeting__title">{title}</h1>
          <p className="db-greeting__subtitle">{subtitle}</p>
        </div>
      <div className="db-greeting__pulse" aria-hidden="true">
        <div className="db-greeting__pulse-ring" />
        <div className="db-greeting__pulse-dot" />
      </div>
    </div>
  );
}
