import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { getUserProfile, updateUserProfile } from "../services/firestoreService";
import Profile from "./Profile";
import ProAvailabilityEditor from "../components/ProAvailabilityEditor";
import { profileCompleteness as computeProfileCompleteness } from "../utils/account";

type Tab = "profile" | "availability" | "privacy" | "danger";
type PrivacySettings = {
  emailVisible: boolean;
  phoneVisible: boolean;
  flatVisible: boolean;
};

export const profileCompleteness = computeProfileCompleteness;

function DeleteAccountPanel() {
  const { deleteAccount, user } = useAuth();
  const [confirm, setConfirm] = useState(false);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const isEmailProvider = user?.providerData.some(provider => provider.providerId === "password");

  const handleDelete = async () => {
    setError("");
    setLoading(true);
    const res = await deleteAccount(isEmailProvider ? password : undefined);
    if (!res.success) {
      setError(res.reason ?? "Failed");
      setLoading(false);
    }
  };

  if (!confirm) {
    return (
      <div>
        <p style={{ fontSize: "0.88rem", color: "var(--muted)", lineHeight: 1.6, marginBottom: 16 }}>
          Your account will be anonymized immediately. Bookings and messages are retained for legal purposes for 30 days, then permanently deleted.
        </p>
        <button className="btn btn-danger" onClick={() => setConfirm(true)}>Delete My Account</button>
      </div>
    );
  }

  return (
    <div style={{ background: "rgba(220,38,38,0.05)", border: "1px solid rgba(220,38,38,0.2)", borderRadius: 12, padding: 20 }}>
      <p style={{ fontWeight: 700, color: "#dc2626", marginBottom: 12 }}>This cannot be undone.</p>
      {isEmailProvider && (
        <div className="form-group">
          <label className="form-label">Confirm your password</label>
          <input className="form-input" type="password" placeholder="Enter password" value={password} onChange={event => setPassword(event.target.value)} />
        </div>
      )}
      {error && <div className="error-box" style={{ marginBottom: 12 }}>{error}</div>}
      <div style={{ display: "flex", gap: 10 }}>
        <button className="btn btn-danger" onClick={handleDelete} disabled={loading || (Boolean(isEmailProvider) && !password)}>
          {loading ? "Deleting..." : "Yes, delete my account"}
        </button>
        <button className="btn btn-secondary" onClick={() => { setConfirm(false); setError(""); }}>Cancel</button>
      </div>
    </div>
  );
}

export default function MyAccount() {
  const { user, userProfile, logout } = useAuth();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>("profile");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [privacy, setPrivacy] = useState<PrivacySettings>({ emailVisible: false, phoneVisible: false, flatVisible: false });
  const [viewAsProfile, setViewAsProfile] = useState<Record<string, unknown> | null>(null);
  const [viewAsUid, setViewAsUid] = useState<string | null>(null);
  const [viewAsLoading, setViewAsLoading] = useState(false);
  const [viewAsError, setViewAsError] = useState("");

  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam === "availability" && userProfile?.isServiceProvider) {
      setTab("availability");
    }
  }, [searchParams, userProfile?.isServiceProvider]);

  useEffect(() => {
    const isAdmin = userProfile?.role === "admin";
    if (!isAdmin) {
      setViewAsUid(null);
      setViewAsProfile(null);
      setViewAsLoading(false);
      return;
    }

    const storedUid = searchParams.get("viewAsUid");
    if (!storedUid || storedUid === user?.uid) {
      setViewAsUid(null);
      setViewAsProfile(null);
      setViewAsLoading(false);
      return;
    }

    setViewAsUid(storedUid);
    setViewAsLoading(true);
    setViewAsError("");
    getUserProfile(storedUid)
      .then(profile => {
        if (!profile) {
          setViewAsUid(null);
          setViewAsProfile(null);
          setViewAsError("Could not load the selected user.");
          return;
        }
        setViewAsProfile(profile);
      })
      .catch(() => {
        setViewAsUid(null);
        setViewAsProfile(null);
        setViewAsError("Could not load the selected user.");
      })
      .finally(() => setViewAsLoading(false));
  }, [user?.uid, userProfile?.role, searchParams]);

  const isAdminViewAs = userProfile?.role === "admin" && Boolean(viewAsUid && viewAsProfile);
  const accountProfile = (isAdminViewAs ? viewAsProfile : userProfile) as Record<string, unknown> | null;
  const accountUid = isAdminViewAs ? viewAsUid : user?.uid ?? null;
  const { pct, missing } = profileCompleteness(accountProfile);

  useEffect(() => {
    setPrivacy({
      emailVisible: Boolean(accountProfile?.emailVisible),
      phoneVisible: Boolean(accountProfile?.phoneVisible),
      flatVisible: Boolean(accountProfile?.flatVisible),
    });
  }, [accountProfile]);

  const handleTabChange = (nextTab: Tab) => {
    setTab(nextTab);
    if (nextTab === "privacy") {
      setPrivacy({
        emailVisible: Boolean(accountProfile?.emailVisible),
        phoneVisible: Boolean(accountProfile?.phoneVisible),
        flatVisible: Boolean(accountProfile?.flatVisible),
      });
    }
  };

  const savePrivacy = async () => {
    if (!accountUid) return;
    setSaving(true);
    try {
      await updateUserProfile(accountUid, privacy);
      if (isAdminViewAs) {
        setViewAsProfile(prev => (prev ? { ...prev, ...privacy } : prev));
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const exitViewAs = () => {
    setViewAsUid(null);
    setViewAsProfile(null);
    setViewAsError("");
    setTab("profile");
    // Remove query param from URL so refresh doesn't jump back
    const np = new URLSearchParams(searchParams);
    np.delete("viewAsUid");
    window.history.replaceState({}, "", "/account" + (np.toString() ? "?" + np.toString() : ""));
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: "profile", label: "Profile" },
    ...(!isAdminViewAs && Boolean(accountProfile?.isServiceProvider) ? [{ key: "availability" as Tab, label: "Availability" }] : []),
    { key: "privacy", label: "Privacy" },
    { key: "danger", label: isAdminViewAs ? "Session" : "Account" },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">My Account</h1>
          <p className="page-subtitle">Manage profile, privacy, and account settings</p>
        </div>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 18px", minWidth: 200 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: "0.82rem" }}>
            <span style={{ fontWeight: 600 }}>Profile completeness</span>
            <span style={{ color: pct >= 80 ? "#16a34a" : pct >= 50 ? "#C4882A" : "#dc2626", fontWeight: 700 }}>{pct}%</span>
          </div>
          <div style={{ height: 6, background: "var(--surface-2)", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${pct}%`, background: pct >= 80 ? "#16a34a" : pct >= 50 ? "#C4882A" : "#dc2626", borderRadius: 3, transition: "width 0.4s" }} />
          </div>
          {missing.length > 0 && pct < 100 && (
            <div style={{ fontSize: "0.72rem", color: "var(--muted)", marginTop: 6 }}>
              Missing: {missing.slice(0, 2).join(", ")}{missing.length > 2 ? ` +${missing.length - 2}` : ""}
            </div>
          )}
        </div>
      </div>

      {viewAsError && <div className="error-box" style={{ marginBottom: 16 }}>{viewAsError}</div>}
      {viewAsLoading && <div className="card" style={{ marginBottom: 16 }}>Loading selected user profile...</div>}

      {isAdminViewAs && accountProfile && (
        <div className="card" style={{ marginBottom: 20, border: "1px solid rgba(61,126,255,0.25)", background: "var(--accent-dim)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Login As Session</div>
              <div className="text-muted text-sm">You are viewing the profile for {(accountProfile.displayName as string) || (accountProfile.email as string) || viewAsUid}.</div>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={exitViewAs}>Exit Login As</button>
          </div>
        </div>
      )}

      <div className="tabs">
        {tabs.map(({ key, label }) => (
          <button key={key} className={`tab${tab === key ? " active" : ""}`} onClick={() => handleTabChange(key)}>{label}</button>
        ))}
      </div>

      {viewAsLoading ? (
        <div className="card" style={{ marginTop: 16 }}>Loading selected user profile...</div>
      ) : (
        <>
          {tab === "profile" && <Profile profileOverride={accountProfile} uidOverride={accountUid} isAdminViewAs={isAdminViewAs} />}
          {tab === "availability" && !isAdminViewAs && <ProAvailabilityEditor />}

          {tab === "privacy" && (
        <div style={{ maxWidth: 560 }}>
          <div className="card" style={{ marginBottom: 20 }}>
            <h3 className="card-title" style={{ marginBottom: 4 }}>Visibility Controls</h3>
            <p className="text-muted text-sm" style={{ marginBottom: 20 }}>Control what other users can see on your profile.</p>
            {[
              { key: "emailVisible", label: "Show email on profile", desc: "Other users can see your email only when this is enabled." },
              { key: "phoneVisible", label: "Show phone number on profile", desc: "Other users can see and call your number only when enabled." },
              { key: "flatVisible", label: "Show flat number on profile", desc: "Neighbors can see your flat number only when enabled." },
            ].map(({ key, label, desc }) => (
              <div key={key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0", borderBottom: "1px solid var(--border)" }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: "0.92rem" }}>{label}</div>
                  <div style={{ fontSize: "0.78rem", color: "var(--muted)", marginTop: 2 }}>{desc}</div>
                </div>
                <button
                  onClick={() => setPrivacy(prev => ({ ...prev, [key]: !prev[key as keyof PrivacySettings] }))}
                  style={{ width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer", background: privacy[key as keyof PrivacySettings] ? "#1B6B8A" : "var(--border)", position: "relative", transition: "background 0.2s", flexShrink: 0 }}
                >
                  <div style={{ position: "absolute", top: 2, left: privacy[key as keyof PrivacySettings] ? 22 : 2, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
                </button>
              </div>
            ))}
            <div style={{ marginTop: 20 }}>
              <button className="btn btn-primary" onClick={savePrivacy} disabled={saving}>{saving ? "Saving..." : saved ? "Saved" : "Save Privacy Settings"}</button>
            </div>
          </div>
        </div>
          )}

          {tab === "danger" && (
        <div style={{ maxWidth: 560 }}>
          {isAdminViewAs ? (
            <div className="card" style={{ marginBottom: 20 }}>
              <h3 className="card-title" style={{ marginBottom: 4 }}>Login As Session</h3>
              <p className="text-muted text-sm" style={{ marginBottom: 16 }}>End this session to return to your own admin account view.</p>
              <button className="btn btn-secondary" onClick={exitViewAs}>Exit Login As</button>
            </div>
          ) : (
            <>
              <div className="card" style={{ marginBottom: 20 }}>
                <h3 className="card-title" style={{ marginBottom: 4 }}>Sign Out</h3>
                <p className="text-muted text-sm" style={{ marginBottom: 16 }}>You will need to sign in again to access your account.</p>
                <button className="btn btn-secondary" onClick={logout}>Sign Out</button>
              </div>
              <div className="card" style={{ border: "1px solid rgba(220,38,38,0.25)" }}>
                <h3 className="card-title" style={{ marginBottom: 4, color: "#dc2626" }}>Delete Account</h3>
                <DeleteAccountPanel />
              </div>
            </>
          )}
        </div>
          )}
        </>
      )}
    </div>
  );
}
