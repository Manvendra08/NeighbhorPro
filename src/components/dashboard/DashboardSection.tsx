import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";

type DashboardSectionProps = {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  actionTo?: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  children: ReactNode;
  className?: string;
};

export default function DashboardSection({
  title,
  subtitle,
  actionLabel,
  actionTo,
  collapsible = false,
  defaultCollapsed = false,
  children,
  className = "",
}: DashboardSectionProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <section className={`db-section ${className}`.trim()}>
      <div className="db-section__head">
        <div>
          <h2 className="db-section__title">{title}</h2>
          {subtitle && <p className="db-section__subtitle">{subtitle}</p>}
        </div>
        <div className="db-section__actions">
          {actionLabel && actionTo && (
            <Link className="db-section__link" to={actionTo}>
              {actionLabel}
            </Link>
          )}
          {collapsible && (
            <button
              type="button"
              className="db-section__toggle"
              onClick={() => setCollapsed(current => !current)}
            >
              {collapsed ? "Expand" : "Collapse"}
            </button>
          )}
        </div>
      </div>
      {!collapsed && <div className="db-section__body">{children}</div>}
    </section>
  );
}
