import { useMemo, useState } from "react";

type BookingRow = Record<string, unknown>;

type BookingPipelineProps = {
  bookings: BookingRow[];
};

type PipelineKey = "pending" | "confirmed" | "completed";

function toDate(value: unknown): Date | null {
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
  if (typeof booking.date === "string" && booking.date.trim()) {
    const parsed = new Date(booking.date);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return toDate(booking.updatedAt) || toDate(booking.createdAt);
}

export default function BookingPipeline({ bookings }: BookingPipelineProps) {
  const [activeTab, setActiveTab] = useState<PipelineKey>("pending");
  const startOfWeek = useMemo(() => {
    const now = new Date();
    const start = new Date(now);
    const day = start.getDay() || 7;
    start.setDate(start.getDate() - day + 1);
    start.setHours(0, 0, 0, 0);
    return start;
  }, []);

  const columns = useMemo(() => {
    const pending = bookings.filter(booking => booking.status === "pending");
    const confirmed = bookings.filter(booking => booking.status === "confirmed");
    const completed = bookings.filter((booking) => {
      if (!["completed", "reviewed"].includes(String(booking.status || ""))) return false;
      const date = bookingDate(booking);
      return date ? date.getTime() >= startOfWeek.getTime() : false;
    });

    return {
      pending,
      confirmed,
      completed,
    };
  }, [bookings, startOfWeek]);

  const meta = [
    { key: "pending" as const, label: "Pending", helper: "Needs response" },
    { key: "confirmed" as const, label: "Confirmed", helper: "Booked in" },
    { key: "completed" as const, label: "Completed", helper: "This week" },
  ];

  return (
    <div className="db-pipeline">
      <div className="db-pipeline__tabs">
        {meta.map(item => (
          <button
            key={item.key}
            type="button"
            className={`db-pipeline__tab${activeTab === item.key ? " is-active" : ""}`}
            onClick={() => setActiveTab(item.key)}
          >
            {item.label}
            <span>{columns[item.key].length}</span>
          </button>
        ))}
      </div>

      <div className="db-pipeline__grid">
        {meta.map(item => (
          <div
            key={item.key}
            className={`db-pipeline__col${activeTab === item.key ? " is-active" : ""}`}
          >
            <div className="db-pipeline__col-head">
              <div>
                <div className="db-pipeline__col-title">{item.label}</div>
                <div className="db-pipeline__col-helper">{item.helper}</div>
              </div>
              <span className="db-pipeline__count">{columns[item.key].length}</span>
            </div>

            <div className="db-pipeline__cards">
              {columns[item.key].slice(0, 3).map(booking => (
                <div key={String(booking.id || `${item.key}-${booking.clientId}`)} className="db-pipeline__card">
                  <strong>{String(booking.clientName || booking.proName || "Booking")}</strong>
                  <span>{String(booking.serviceName || "Session")}</span>
                  <small>{String(booking.date || "Date TBD")}{booking.timeSlot ? ` • ${booking.timeSlot}` : ""}</small>
                </div>
              ))}
              {columns[item.key].length === 0 && (
                <div className="db-pipeline__empty">No items here.</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
