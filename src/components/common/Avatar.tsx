interface AvatarProps {
  name: string;
  photoURL?: string;
  alt?: string;
  className?: string;
  fallbackClassName?: string;
  showProBadge?: boolean;
  proBadgeClassName?: string;
  proBadgeText?: string;
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
  showProBadge = false,
  proBadgeClassName,
  proBadgeText = "Pro",
}: AvatarProps) {
  const initials = getInitials(name || "?");

  return (
    <div className={className}>
      {photoURL ? (
        <img src={photoURL} alt={alt ?? name} loading="lazy" />
      ) : (
        <span className={fallbackClassName}>{initials}</span>
      )}
      {showProBadge && <span className={proBadgeClassName}>{proBadgeText}</span>}
    </div>
  );
}
