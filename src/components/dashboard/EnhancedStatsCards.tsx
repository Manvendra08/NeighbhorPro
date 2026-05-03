import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import SparklineChart from "./SparklineChart";

export type DashboardStatCard = {
  label: string;
  value: string;
  helper: string;
  helperContent?: ReactNode;
  icon: string;
  tone?: "accent" | "success" | "warning" | "danger";
  to?: string;
  sparkline?: number[];
};

type EnhancedStatsCardsProps = {
  cards: DashboardStatCard[];
};

export default function EnhancedStatsCards({ cards }: EnhancedStatsCardsProps) {
  return (
    <div className="db-stats-grid">
      {cards.map(card => {
        const content = (
          <>
            <div className="db-stats-card__head">
              <span className={`db-stats-card__icon db-stats-card__icon--${card.tone || "accent"}`}>
                {card.icon}
              </span>
              {card.sparkline && card.sparkline.length > 0 && (
                <SparklineChart className="db-stats-card__sparkline" data={card.sparkline} />
              )}
            </div>
            <div className="db-stats-card__value">{card.value}</div>
            <div className="db-stats-card__label">{card.label}</div>
            <div className="db-stats-card__helper">{card.helper}</div>
            {card.helperContent}
          </>
        );

        return card.to ? (
          <Link key={card.label} className="db-stats-card" to={card.to}>
            {content}
          </Link>
        ) : (
          <div key={card.label} className="db-stats-card">
            {content}
          </div>
        );
      })}
    </div>
  );
}
