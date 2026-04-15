import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getPublicProfile } from "../services/firestoreService";

export default function PublicProfile() {
  const { uid } = useParams<{ uid: string }>();
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!uid) {
      setLoading(false);
      setError("Invalid profile link.");
      return;
    }

    setLoading(true);
    setError("");
    getPublicProfile(uid)
      .then((result) => {
        if (!result) {
          setError("Profile not found.");
          setProfile(null);
          return;
        }
        setProfile(result);
      })
      .catch(() => {
        setError("Could not load this profile right now.");
        setProfile(null);
      })
      .finally(() => setLoading(false));
  }, [uid]);

  const displayName = useMemo(() => (profile?.displayName as string) || "Neighbor", [profile]);
  const photoURL = (profile?.photoURL as string) || "";
  const society = (profile?.society as string) || "";
  const tower = (profile?.tower as string) || "";
  const locality = (profile?.locality as string) || "";
  const bio = (profile?.bio as string) || "";
  const skills = Array.isArray(profile?.skills) ? (profile?.skills as string[]) : [];
  const initials = displayName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "24px 16px 40px" }}>
      <div style={{ marginBottom: 16 }}>
        <Link to="/dashboard" style={{ color: "var(--accent)", textDecoration: "none", fontSize: 14, fontWeight: 600 }}>
          ← Back to dashboard
        </Link>
      </div>

      {loading && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 20 }}>
          Loading profile...
        </div>
      )}

      {!loading && error && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 20, color: "var(--error)" }}>
          {error}
        </div>
      )}

      {!loading && !error && profile && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 22 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "linear-gradient(135deg, var(--accent-dim), var(--surface-2))",
              color: "var(--accent)",
              fontWeight: 700,
              fontSize: 20,
              flexShrink: 0,
            }}>
              {photoURL ? (
                <img src={photoURL} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : initials}
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 24 }}>{displayName}</h1>
              <div style={{ marginTop: 5, fontSize: 13, color: "var(--muted)" }}>
                {[society, tower, locality].filter(Boolean).join(" · ") || "Community member"}
              </div>
            </div>
          </div>

          {bio && (
            <div style={{ marginTop: 18 }}>
              <h2 style={{ margin: "0 0 8px", fontSize: 16 }}>About</h2>
              <p style={{ margin: 0, color: "var(--text-2)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{bio}</p>
            </div>
          )}

          {skills.length > 0 && (
            <div style={{ marginTop: 18 }}>
              <h2 style={{ margin: "0 0 10px", fontSize: 16 }}>Skills</h2>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {skills.map((skill) => (
                  <span
                    key={skill}
                    style={{
                      background: "var(--surface-2)",
                      border: "1px solid var(--border)",
                      borderRadius: 999,
                      padding: "5px 10px",
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}