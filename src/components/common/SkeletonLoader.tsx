interface SkeletonLoaderProps {
  count: number;
  mobile?: boolean;
  grid?: boolean;
}

export default function SkeletonLoader({
  count,
  mobile = false,
  grid = true,
}: SkeletonLoaderProps) {
  if (mobile) {
    return (
      <>
        {Array.from({ length: count }, (_, idx) => (
          <div key={idx} className="m-pro-card" style={{ pointerEvents: "none" }}>
            <div
              className="skeleton"
              style={{ width: 56, height: 56, borderRadius: "50%", flexShrink: 0 }}
            />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
              <div className="skeleton" style={{ height: 16, width: "55%" }} />
              <div className="skeleton" style={{ height: 12, width: "40%" }} />
              <div style={{ display: "flex", gap: 6 }}>
                <div className="skeleton" style={{ height: 18, width: 60, borderRadius: 10 }} />
                <div className="skeleton" style={{ height: 18, width: 70, borderRadius: 10 }} />
              </div>
            </div>
          </div>
        ))}
      </>
    );
  }

  return (
    <>
      {Array.from({ length: count }, (_, idx) => (
        <div
          key={idx}
          className={grid ? "pro-card" : "pro-card-list"}
          style={{ pointerEvents: "none" }}
        >
          <div className="skeleton" style={{ aspectRatio: "4/3", borderRadius: "12px 12px 0 0" }} />
          <div className="pro-card-body" style={{ padding: 16 }}>
            <div className="skeleton" style={{ height: 18, width: "60%", marginBottom: 8 }} />
            <div className="skeleton" style={{ height: 12, width: "40%", marginBottom: 12 }} />
            <div style={{ display: "flex", gap: 6 }}>
              <div className="skeleton" style={{ height: 20, width: 60, borderRadius: 10 }} />
              <div className="skeleton" style={{ height: 20, width: 80, borderRadius: 10 }} />
            </div>
          </div>
        </div>
      ))}
    </>
  );
}
