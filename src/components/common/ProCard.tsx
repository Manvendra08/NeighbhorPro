import Avatar from "./Avatar";
import InfoTooltip from "./InfoTooltip";
import { computeAggregateRating } from "../../utils/rating";

interface ProCardData {
  uid: string;
  displayName?: string;
  photoURL?: string;
  isServiceProvider?: boolean;
  residentVerificationStatus?: string;
  locality?: string;
  society?: string;
  tower?: string;
  skills?: string[];
  priceAfterQuote?: boolean;
  hourlyRate?: number;
  rating?: number;
  reviewCount?: number;
}

interface ProCardProps {
  pro: ProCardData;
  mobile?: boolean;
  grid?: boolean;
  onBook: (uid: string) => void;
  onViewProfile: (uid: string) => void;
}

export default function ProCard({
  pro,
  mobile = false,
  grid = false,
  onBook,
  onViewProfile,
}: ProCardProps) {
  const uid = pro.uid;
  const name = pro.displayName || "Anonymous";
  const location = `${pro.locality || pro.society || "Community Member"}${pro.tower ? `, ${pro.tower}` : ""}`;
  const skills = pro.skills || [];
  const { rating, reviewCount } = computeAggregateRating(pro.rating, pro.reviewCount, undefined);
  const ratingLabel = reviewCount > 0
    ? `★ ${rating === null ? "—" : rating.toFixed(1)} (${reviewCount})`
    : "No reviews yet";
  const verificationTooltip = "This professional has uploaded a valid society residency proof verified by ProNeighbor.";

  if (mobile) {
    return (
      <div className="m-pro-card" onClick={() => onViewProfile(uid)}>
        <Avatar
          name={name}
          photoURL={pro.photoURL}
          alt={name}
          className="m-pro-avatar"
          fallbackClassName="m-pro-avatar-fallback"
          showProBadge={!!pro.isServiceProvider}
          proBadgeClassName="m-pro-verified-badge"
        />
        <div className="m-pro-info">
          <div className="m-pro-name">
            {name}
            {pro.residentVerificationStatus === "verified" && (
              <span style={{ marginLeft: 6, fontSize: 10, color: "var(--success)", fontWeight: 600, display: "inline-flex", alignItems: "center" }}>
                ✓ Verified Resident
                <InfoTooltip text={verificationTooltip} label="Verified resident proof" />
              </span>
            )}
          </div>
          <div className="m-pro-society">📍 {location}</div>
          <div className="m-pro-skills">
            {skills.slice(0, 2).map((skill) => (
              <span key={skill} className="skill-tag" style={{ fontSize: 10, padding: "2px 8px" }}>
                {skill}
              </span>
            ))}
            {skills.length > 2 && (
              <span className="skill-tag" style={{ fontSize: 10, padding: "2px 8px" }}>
                +{skills.length - 2}
              </span>
            )}
          </div>
        </div>
        <div className="m-pro-right">
          <div className="m-pro-rate">
            {pro.priceAfterQuote ? "Quote" : (pro.hourlyRate || 0) === 0 ? "Free" : `₹${pro.hourlyRate}/hr`}
          </div>
          <div className="m-pro-rating">{ratingLabel}</div>
          <button
            className="btn btn-primary btn-sm"
            style={{ marginTop: 6, padding: "6px 14px", fontSize: 12 }}
            onClick={(event) => {
              event.stopPropagation();
              onBook(uid);
            }}
          >
            Book
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={grid ? "pro-card" : "pro-card-list"}>
      <div onClick={() => onViewProfile(uid)} style={{ cursor: "pointer" }}>
        <div
          className="pro-card-img"
          style={{ position: "relative", aspectRatio: "4/3", overflow: "hidden", background: "var(--surface-3)" }}
        >
          <Avatar
            name={name}
            photoURL={pro.photoURL}
            alt={name}
            className="pro-card-avatar"
            fallbackClassName="pro-card-avatar-fallback"
            showProBadge={!!pro.isServiceProvider}
            proBadgeClassName="pro-card-verified-badge"
          />
        </div>
        <div className="pro-card-body">
          <div className="pro-card-main-info">
            <div className="pro-card-name">
              {name}
              {pro.residentVerificationStatus === "verified" && (
                <span
                  style={{
                    marginLeft: 8,
                    fontSize: 10,
                    background: "rgba(0,229,176,0.12)",
                    color: "var(--success)",
                    padding: "2px 8px",
                    borderRadius: 10,
                    fontWeight: 600,
                  }}
                >
                  ✓ Verified Resident
                  <InfoTooltip text={verificationTooltip} label="Verified resident proof" />
                </span>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <div className="pro-card-society" style={{ marginBottom: 4 }}>
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ marginRight: 4, verticalAlign: "middle" }}
                >
                  <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                {location}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {skills.slice(0, 3).map((skill) => (
                  <span key={skill} className="skill-tag" style={{ fontSize: 10, padding: "2px 6px" }}>
                    {skill}
                  </span>
                ))}
                {skills.length > 3 && (
                  <span className="skill-tag" style={{ fontSize: 10, padding: "2px 6px" }}>
                    +{skills.length - 3}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="pro-card-footer">
            {pro.priceAfterQuote ? (
              <span className="badge badge-accent">Quote-based</span>
            ) : (
              <span className="pro-card-rate">{(pro.hourlyRate || 0) === 0 ? "Free" : `₹${pro.hourlyRate}/hr`}</span>
            )}
            <div className="pro-card-rating">
              {reviewCount > 0 ? (
                <>
                  ★ {rating === null ? "—" : rating.toFixed(1)}
                  <span className="text-muted text-xs"> ({reviewCount})</span>
                </>
              ) : (
                <span className="text-muted text-xs">No reviews yet</span>
              )}
            </div>
          </div>
        </div>
      </div>
      <div style={{ padding: "0 14px 14px", display: "flex", gap: 8 }}>
        <button
          className="btn btn-primary btn-sm"
          style={{ flex: 1 }}
          onClick={(event) => {
            event.stopPropagation();
            onBook(uid);
          }}
        >
          Book
        </button>
        <button
          className="btn btn-secondary btn-sm"
          onClick={(event) => {
            event.stopPropagation();
            onViewProfile(uid);
          }}
        >
          View Profile
        </button>
      </div>
    </div>
  );
}
