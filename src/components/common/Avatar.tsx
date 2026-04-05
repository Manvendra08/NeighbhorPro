interface AvatarProps {
  name: string;
  photoURL?: string;
  alt?: string;
  className?: string;
  fallbackClassName?: string;
  showVerifiedBadge?: boolean;
  verifiedBadgeClassName?: string;
}

const getInitials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

export default function Avatar({
  name,
  photoURL,
  alt,
  className,
  fallbackClassName,
  showVerifiedBadge = false,
  verifiedBadgeClassName,
}: AvatarProps) {
  const initials = getInitials(name || "?");

  return (
    <div className={className}>
      {photoURL ? (
        <img src={photoURL} alt={alt ?? name} loading="lazy" />
      ) : (
        <span className={fallbackClassName}>{initials}</span>
      )}
      {showVerifiedBadge && <span className={verifiedBadgeClassName}>✓</span>}
    </div>
  );
}
