import { Link } from "react-router-dom";

type QuickActionsProps = {
  isPro: boolean;
};

export default function QuickActions({ isPro }: QuickActionsProps) {
  const actions = isPro
    ? [
        { to: "/bookings", icon: "🗂", label: "Manage Requests", helper: "Review pending bookings" },
        { to: "/account?tab=availability", icon: "🕒", label: "Availability", helper: "Open your weekly slots" },
        { to: "/wallet", icon: "🪙", label: "Earnings", helper: "Wallet, payouts, ledger" },
        { to: "/messages", icon: "💬", label: "Messages", helper: "Stay responsive" },
      ]
    : [
        { to: "/browse", icon: "🔎", label: "Browse Pros", helper: "Discover trusted experts" },
        { to: "/bookings", icon: "📅", label: "My Bookings", helper: "Track upcoming sessions" },
        { to: "/wallet", icon: "🪙", label: "Wallet", helper: "Coins, rewards, payouts" },
        { to: "/messages", icon: "💬", label: "Messages", helper: "Coordinate with pros" },
      ];

  return (
    <div className="db-quick-actions" aria-label="Quick actions">
      {actions.map(action => (
        <Link key={action.label} className="db-quick-actions__item" to={action.to}>
          <span className="db-quick-actions__icon" aria-hidden="true">{action.icon}</span>
          <span className="db-quick-actions__label">{action.label}</span>
          <span className="db-quick-actions__helper">{action.helper}</span>
        </Link>
      ))}
    </div>
  );
}
