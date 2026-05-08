interface ActiveProPillProps {
  status: string | null | undefined;
  size?: "sm" | "md";
}

const ACTIVE_STATES: ReadonlySet<string> = new Set([
  "trial",
  "trial_ending",
  "active",
  "renewing",
  "past_due",
  "grace",
  "comped",
]);

export default function ActiveProPill({ status, size = "md" }: ActiveProPillProps) {
  if (!status || !ACTIVE_STATES.has(status)) return null;

  const isSm = size === "sm";

  const pillStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: isSm ? 3 : 5,
    background: "#dcfce7",
    color: "#15803d",
    border: "1px solid #86efac",
    borderRadius: 20,
    padding: isSm ? "2px 8px" : "4px 12px",
    fontSize: isSm ? "0.72rem" : "0.82rem",
    fontWeight: isSm ? 600 : 700,
    whiteSpace: "nowrap",
    cursor: "default",
    userSelect: "none",
    letterSpacing: "0.01em",
    lineHeight: 1.4,
  };

  const tooltipContainerStyle: React.CSSProperties = {
    position: "relative",
    display: "inline-flex",
  };

  const tooltipStyle: React.CSSProperties = {
    visibility: "hidden",
    opacity: 0,
    position: "absolute",
    bottom: "calc(100% + 6px)",
    left: "50%",
    transform: "translateX(-50%)",
    background: "#1f2937",
    color: "#fff",
    fontSize: "0.75rem",
    padding: "5px 10px",
    borderRadius: 7,
    whiteSpace: "nowrap",
    pointerEvents: "none",
    zIndex: 50,
    transition: "opacity 0.15s ease",
  };

  return (
    <span
      style={tooltipContainerStyle}
      onMouseEnter={e => {
        const tooltip = e.currentTarget.querySelector<HTMLElement>("[data-tooltip]");
        if (tooltip) {
          tooltip.style.visibility = "visible";
          tooltip.style.opacity = "1";
        }
      }}
      onMouseLeave={e => {
        const tooltip = e.currentTarget.querySelector<HTMLElement>("[data-tooltip]");
        if (tooltip) {
          tooltip.style.visibility = "hidden";
          tooltip.style.opacity = "0";
        }
      }}
    >
      <span style={pillStyle}>
        ✓ Active Pro
      </span>
      <span data-tooltip style={tooltipStyle}>
        Verified neighbour committed to keeping a live listing
      </span>
    </span>
  );
}