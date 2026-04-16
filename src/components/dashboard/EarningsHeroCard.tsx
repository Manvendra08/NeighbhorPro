import SparklineChart from "./SparklineChart";

type EarningsHeroCardProps = {
  thisMonth: number;
  lastMonth: number;
  changePct: number | null;
  pendingPayoutNC: number;
  dailySeries: number[];
  isPositive: boolean;
};

export default function EarningsHeroCard({
  thisMonth,
  lastMonth,
  changePct,
  pendingPayoutNC,
  dailySeries,
  isPositive,
}: EarningsHeroCardProps) {
  return (
    <div className="db-earnings-hero">
      <div className="db-earnings-hero__copy">
        <span className="db-earnings-hero__eyebrow">This month</span>
        <div className="db-earnings-hero__value">{thisMonth.toLocaleString("en-IN")} NC</div>
        <div className="db-earnings-hero__meta">
          <span className={`db-earnings-hero__delta ${isPositive ? "is-up" : "is-down"}`}>
            {changePct === null ? "New activity" : `${changePct > 0 ? "+" : ""}${changePct}% vs last month`}
          </span>
          <span>{lastMonth.toLocaleString("en-IN")} NC last month</span>
        </div>
      </div>
      <div className="db-earnings-hero__chart">
        <SparklineChart data={dailySeries} />
        <div className="db-earnings-hero__foot">
          <span>14-day earnings trend</span>
          <strong>{pendingPayoutNC.toLocaleString("en-IN")} NC pending payout</strong>
        </div>
      </div>
    </div>
  );
}
