import { useState } from "react";

type InfoTooltipProps = {
  text: string;
  label?: string;
};

export default function InfoTooltip({ text, label = "More info" }: InfoTooltipProps) {
  const [open, setOpen] = useState(false);
  const tooltipId = `tooltip-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${text.length}`;

  return (
    <span style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
      <button
        type="button"
        aria-label={label}
        aria-describedby={open ? tooltipId : undefined}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen(true);
        }}
        style={{
          width: 16,
          height: 16,
          borderRadius: "50%",
          border: "1px solid var(--success)",
          background: "var(--surface)",
          color: "var(--success)",
          fontSize: 11,
          fontWeight: 700,
          lineHeight: 1,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "help",
          padding: 0,
          marginLeft: 6,
        }}
      >
        i
      </button>
      {open && (
        <span
          role="tooltip"
          id={tooltipId}
          style={{
            position: "absolute",
            zIndex: 40,
            top: "calc(100% + 8px)",
            left: 0,
            minWidth: 220,
            maxWidth: 280,
            background: "var(--text)",
            color: "#fff",
            borderRadius: 8,
            padding: "8px 10px",
            fontSize: 11,
            fontWeight: 500,
            lineHeight: 1.35,
            boxShadow: "var(--shadow-lg)",
          }}
        >
          {text}
        </span>
      )}
    </span>
  );
}
