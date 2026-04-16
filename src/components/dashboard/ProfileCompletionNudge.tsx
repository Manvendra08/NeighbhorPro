import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { ProfileCompletionResult } from "../../hooks/useProfileCompletion";

type ProfileCompletionNudgeProps = {
  completion: ProfileCompletionResult;
};

const STORAGE_KEY = "pn_profile_nudge_dismissed";

export default function ProfileCompletionNudge({ completion }: ProfileCompletionNudgeProps) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(localStorage.getItem(STORAGE_KEY) === "true");
  }, []);

  if (completion.complete || dismissed) return null;

  return (
    <div className="db-profile-nudge">
      <div
        className="db-profile-nudge__ring"
        style={{ background: `conic-gradient(var(--accent) ${completion.percent}%, rgba(0,0,0,0.08) 0)` }}
      >
        <div className="db-profile-nudge__ring-center">
          <strong>{completion.percent}%</strong>
          <span>complete</span>
        </div>
      </div>

      <div className="db-profile-nudge__copy">
        <div className="db-profile-nudge__title">Finish your profile and earn 20 NC</div>
        <div className="db-profile-nudge__meta">
          Missing:
          {" "}
          {completion.missingTop.join(", ")}
        </div>
        <div className="db-profile-nudge__actions">
          <Link className="btn btn-primary btn-sm" to="/account">Complete now</Link>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              localStorage.setItem(STORAGE_KEY, "true");
              setDismissed(true);
            }}
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
