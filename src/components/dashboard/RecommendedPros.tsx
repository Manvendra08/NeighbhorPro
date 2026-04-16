import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getRecommendedPros } from "../../services/firestoreService";

type RecommendedProsProps = {
  uid: string;
  userTower?: string;
  compact?: boolean;
};

export default function RecommendedPros({
  uid,
  userTower,
  compact = false,
}: RecommendedProsProps) {
  const navigate = useNavigate();
  const [pros, setPros] = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    getRecommendedPros(uid, compact ? 3 : 4).then(setPros).catch(() => {});
  }, [compact, uid]);

  if (!pros.length) return null;

  return (
    <div className="db-recommended">
      {!compact && (
        <div className="db-recommended__head">
          <span>⭐ Top Pros</span>
          <Link to="/browse">View all</Link>
        </div>
      )}

      <div className="db-recommended__list">
        {pros.map((pro) => {
          const displayName = (pro.displayName as string) || "Pro";
          const initials = displayName
            .split(" ")
            .map((word: string) => word[0])
            .join("")
            .slice(0, 2)
            .toUpperCase();
          const why = userTower && (pro.tower as string) === userTower ? "Same tower" : "Top rated";

          return (
            <div
              key={pro.uid as string}
              className="db-recommended__item"
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/pro/${pro.uid}`)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  navigate(`/pro/${pro.uid}`);
                }
              }}
            >
              <div className="db-recommended__avatar">
                {(pro.photoURL as string)
                  ? <img src={pro.photoURL as string} alt="" loading="lazy" />
                  : initials}
              </div>

              <div className="db-recommended__content">
                <div className="db-recommended__name-row">
                  <strong>{displayName}</strong>
                  <span className="db-recommended__why">{why}</span>
                </div>
                <div className="db-recommended__meta">
                  <span>★ {(pro.rating as number) ? (pro.rating as number).toFixed(1) : "New"}</span>
                  {(pro.tower as string) && <span>{pro.tower as string}</span>}
                </div>
              </div>

              <button
                className="btn btn-primary btn-sm"
                onClick={(event) => {
                  event.stopPropagation();
                  navigate(`/book/${pro.uid}`);
                }}
              >
                Book
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
