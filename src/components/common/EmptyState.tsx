interface EmptyStateProps {
  icon?: string;
  title: string;
  description: string;
  className?: string;
}

export default function EmptyState({
  icon = "🔍",
  title,
  description,
  className = "empty-state",
}: EmptyStateProps) {
  return (
    <div className={className}>
      <div className="empty-state-icon">{icon}</div>
      <div className="empty-state-title">{title}</div>
      <div className="empty-state-desc">{description}</div>
    </div>
  );
}
