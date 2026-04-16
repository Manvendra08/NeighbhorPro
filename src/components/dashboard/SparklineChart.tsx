type SparklineChartProps = {
  data: number[];
  color?: string;
  className?: string;
};

export default function SparklineChart({
  data,
  color = "currentColor",
  className = "",
}: SparklineChartProps) {
  const safe = data.length > 1 ? data : [0, ...(data.length ? data : [0]), 0];
  const min = Math.min(...safe);
  const max = Math.max(...safe);
  const range = max - min || 1;

  const points = safe
    .map((value, index) => {
      const x = (index / Math.max(1, safe.length - 1)) * 100;
      const y = 28 - (((value - min) / range) * 24);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg
      viewBox="0 0 100 30"
      preserveAspectRatio="none"
      className={`db-sparkline ${className}`.trim()}
      aria-hidden="true"
    >
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
