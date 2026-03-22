import { useState, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";
import { updateUserProfile, uploadProfilePhoto } from "../services/firestoreService";
import Profile from "./Profile";
import ProAvailabilityEditor from "../components/ProAvailabilityEditor";
import { getLedger, ledgerColor, ledgerSign } from "../services/coinService";
import { formatTimestamp } from "../services/firestoreService";
import type { LedgerEntry } from "../services/coinService";

type Tab = "profile" | "availability" | "privacy" | "history" | "activity" | "danger";

// ── Profile completeness calculation ──────────────────────────────────────
function profileCompleteness(p: Record<string, unknown> | null): { pct: number; missing: string[] } {
  if (!p) return { pct: 0, missing: [] };
  const checks: [boolean, string][] = [
    [!!(p.displayName as string)?.trim(),    "Display name"],
    [!!(p.bio as string)?.trim(),            "Bio"],
    [!!(p.society as string)?.trim(),        "Society / community"],
    [!!(p.flatNumber as string)?.trim(),     "Flat number"],
    [!!(p.locality as string)?.trim(),       "Locality"],
    [!!p.photoURL,                            "Profile photo"],
    [(p.skills as string[])?.length > 0,     "At least one skill"],
    [!!(p.phoneNumber as string)?.trim(),    "Phone number"],
  ];
  const missing = checks.filter(([ok]) => !ok).map(([, label]) => label);
  return { pct: Math.round(((checks.length - missing.length) / checks.length) * 100), missing };
}

// ── Phone OTP sub-component ────────────────────────────────────────────────
function PhoneVerifier() {
  const { user, sendPhoneOTP, verifyPhoneOTP } = useAuth();
  const [phone, setPhone]         = useState("");
  const [otp, setOtp]             = useState("");
  const [step, setStep]           = useState<"input"|"otp"|"done">("input");
  const [vId, setVId]             = useState("");
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");

  const handleSend = async () => {
    setError(""); setLoading(true);
    try {
      const id = await sendPhoneOTP(phone.trim(), "recaptcha-container");
      setVId(id); setStep("otp");
    } catch (e: unknown) { setError((e as Error).message ?? "Failed to send OTP"); }
    setLoading(false);
  };

  const handleVerify = async () => {
    setError(""); setLoading(true);
    try {
      await verifyPhoneOTP(vId, otp.trim());
      setStep("done");
    } catch { setError("Invalid OTP. Please try again."); }
    setLoading(false);
  };

  if (step === "done") return <div style={{ color: "#16a34a", fontWeight: 600 }}>✅ Phone number verified!</div>;

  return (
    <div>
      <div id="recaptcha-container" />
      {step === "input" && (
        <div style={{ display: "flex", gap: 10 }}>
          <input className="form-input" placeholder="+91 98765 43210" value={phone} onChange={e => setPhone(e.target.value)} style={{ flex: 1 }} />
          <button className="btn btn-primary" onClick={handleSend} disabled={loading || !phone.trim()}>{loading ? "Sending…" : "Send OTP"}</button>
        </div>
      )}
      {step === "otp" && (
        <div>
          <p className="text-muted text-sm" style={{ marginBottom: 10 }}>OTP sent to {phone}.</p>
          <div style={{ display: "flex", gap: 10 }}>
            <input className="form-input" placeholder="6-digit OTP" value={otp} onChange={e => setOtp(e.target.value)} maxLength={6} style={{ flex: 1, letterSpacing: 4, fontFamily: "monospace" }} />
            <button className="btn btn-primary" onClick={handleVerify} disabled={loading || otp.length < 6}>{loading ? "Verifying…" : "Verify"}</button>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => setStep("input")} style={{ marginTop: 8 }}>← Change number</button>
        </div>
      )}
      {error && <div className="error-box" style={{ marginTop: 10 }}>{error}</div>}
    </div>
  );
}

// ── Delete account sub-component ──────────────────────────────────────────
function DeleteAccountPanel() {
  const { deleteAccount, user } = useAuth();
  const [confirm, setConfirm] = useState(false);
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const isEmailProvider = user?.providerData.some(p => p.providerId === "password");

  const handleDelete = async () => {
    setError(""); setLoading(true);
    const res = await deleteAccount(isEmailProvider ? password : undefined);
    if (!res.success) { setError(res.reason ?? "Failed"); setLoading(false); }
    // On success Firebase logs out automatically
  };

  if (!confirm) return (
    <div>
      <p style={{ fontSize: "0.88rem", color: "var(--muted)", lineHeight: 1.6, marginBottom: 16 }}>
        Your account will be anonymised immediately (DPDP compliant). Bookings and messages are retained for legal purposes for 30 days, then permanently deleted.
      </p>
      <button className="btn btn-danger" onClick={() => setConfirm(true)}>Delete My Account</button>
    </div>
  );

  return (
    <div style={{ background: "rgba(220,38,38,0.05)", border: "1px solid rgba(220,38,38,0.2)", borderRadius: 12, padding: 20 }}>
      <p style={{ fontWeight: 700, color: "#dc2626", marginBottom: 12 }}>⚠️ This cannot be undone.</p>
      {isEmailProvider && (
        <div className="form-group">
          <label className="form-label">Confirm your password</label>
          <input className="form-input" type="password" placeholder="Enter password" value={password} onChange={e => setPassword(e.target.value)} />
        </div>
      )}
      {error && <div className="error-box" style={{ marginBottom: 12 }}>{error}</div>}
      <div style={{ display: "flex", gap: 10 }}>
        <button className="btn btn-danger" onClick={handleDelete} disabled={loading || (isEmailProvider && !password)}>
          {loading ? "Deleting…" : "Yes, delete my account"}
        </button>
        <button className="btn btn-secondary" onClick={() => { setConfirm(false); setError(""); }}>Cancel</button>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function MyAccount() {
  const { user, userProfile, logout } = useAuth();
  const [tab, setTab]         = useState<Tab>("profile");
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [ledger, setLedger]   = useState<LedgerEntry[] | null>(null);
  const [ledgerLL, setLL]     = useState(false);
  const [privacy, setPrivacy] = useState({
    phoneVisible: userProfile?.phoneVisible ?? false,
    flatVisible:  userProfile?.flatVisible  ?? false,
  });
  const up = userProfile as Record<string, unknown> | null;
  const { pct, missing } = profileCompleteness(up);

  const handleTabChange = async (t: Tab) => {
    setTab(t);
    if (t === "history" && !ledger && user) {
      setLL(true);
      const data = await getLedger(user.uid, 30);
      setLedger(data); setLL(false);
    }
    if (t === "privacy" && up) {
      setPrivacy({ phoneVisible: !!(up.phoneVisible), flatVisible: !!(up.flatVisible) });
    }
  };

  const savePrivacy = async () => {
    if (!user) return;
    setSaving(true);
    await updateUserProfile(user.uid, privacy);
    setSaved(true); setTimeout(() => setSaved(false), 2000);
    setSaving(false);
  };

  const TABS: { key: Tab; label: string }[] = [
    { key: "profile",      label: "Profile" },
    ...(userProfile?.isServiceProvider ? [{ key: "availability" as Tab, label: "Availability" }] : []),
    { key: "privacy",      label: "Privacy" },
    { key: "history",      label: "Transactions" },
    { key: "activity",     label: "Activity" },
    { key: "danger",       label: "⚠️ Account" },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">My Account</h1>
          <p className="page-subtitle">Manage profile, privacy, and account settings</p>
        </div>
        {/* Completeness meter */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 18px", minWidth: 200 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: "0.82rem" }}>
            <span style={{ fontWeight: 600 }}>Profile completeness</span>
            <span style={{ color: pct >= 80 ? "#16a34a" : pct >= 50 ? "#C4882A" : "#dc2626", fontWeight: 700 }}>{pct}%</span>
          </div>
          <div style={{ height: 6, background: "var(--surface-2)", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${pct}%`, background: pct >= 80 ? "#16a34a" : pct >= 50 ? "#C4882A" : "#dc2626", borderRadius: 3, transition: "width 0.4s" }} />
          </div>
          {missing.length > 0 && pct < 100 && (
            <div style={{ fontSize: "0.72rem", color: "var(--muted)", marginTop: 6 }}>Missing: {missing.slice(0, 2).join(", ")}{missing.length > 2 ? ` +${missing.length - 2}` : ""}</div>
          )}
        </div>
      </div>

      <div className="tabs">
        {TABS.map(({ key, label }) => (
          <button key={key} className={`tab${tab === key ? " active" : ""}`} onClick={() => handleTabChange(key)}>{label}</button>
        ))}
      </div>

      {tab === "profile"      && <Profile />}
      {tab === "availability" && <ProAvailabilityEditor />}

      {/* ── PRIVACY ── */}
      {tab === "privacy" && (
        <div style={{ maxWidth: 560 }}>
          <div className="card" style={{ marginBottom: 20 }}>
            <h3 className="card-title" style={{ marginBottom: 4 }}>Visibility Controls</h3>
            <p className="text-muted text-sm" style={{ marginBottom: 20 }}>Control what other users can see on your profile.</p>
            {[
              { key: "phoneVisible", label: "Show phone number on profile", desc: "Other verified users can see and call your number." },
              { key: "flatVisible",  label: "Show flat number on profile",  desc: "Neighbours can see your flat number for in-person sessions." },
            ].map(({ key, label, desc }) => (
              <div key={key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0", borderBottom: "1px solid var(--border)" }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: "0.92rem" }}>{label}</div>
                  <div style={{ fontSize: "0.78rem", color: "var(--muted)", marginTop: 2 }}>{desc}</div>
                </div>
                <button
                  onClick={() => setPrivacy(p => ({ ...p, [key]: !p[key as keyof typeof p] }))}
                  style={{ width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer", background: privacy[key as keyof typeof privacy] ? "#1B6B8A" : "var(--border)", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
                  <div style={{ position: "absolute", top: 2, left: privacy[key as keyof typeof privacy] ? 22 : 2, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
                </button>
              </div>
            ))}
            <div style={{ marginTop: 20 }}>
              <button className="btn btn-primary" onClick={savePrivacy} disabled={saving}>{saving ? "Saving…" : saved ? "✓ Saved" : "Save Privacy Settings"}</button>
            </div>
          </div>

          {/* Phone number */}
          <div className="card">
            <h3 className="card-title" style={{ marginBottom: 4 }}>Phone Number</h3>
            <p className="text-muted text-sm" style={{ marginBottom: 16 }}>
              {userProfile?.phoneNumber
                ? <span style={{ color: "#16a34a" }}>✅ Verified: {userProfile.phoneNumber}</span>
                : "Add a verified phone number for trusted bookings."}
            </p>
            {!userProfile?.phoneNumber && <PhoneVerifier />}
          </div>
        </div>
      )}

      {/* ── TRANSACTION HISTORY ── */}
      {tab === "history" && (
        <div>
          {ledgerLL ? (
            <div style={{ textAlign: "center", padding: 60 }}><div className="loader" style={{ margin: "0 auto" }} /></div>
          ) : !ledger || ledger.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📋</div>
              <div className="empty-state-title">No transactions yet</div>
              <div className="empty-state-desc">Your booking and coin activity will appear here once you make your first booking.</div>
              <a href="/browse" className="btn btn-primary" style={{ marginTop: 16 }}>Browse Professionals</a>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Date</th><th>Description</th><th>Type</th><th style={{ textAlign: "right" }}>Amount</th><th style={{ textAlign: "right" }}>Balance</th></tr></thead>
                <tbody>
                  {ledger.map(entry => (
                    <tr key={entry.id}>
                      <td style={{ color: "var(--muted)", fontSize: 13 }}>{formatTimestamp(entry.createdAt)}</td>
                      <td style={{ fontWeight: 500 }}>{entry.description}</td>
                      <td><span className="badge badge-muted" style={{ fontSize: "0.72rem" }}>{entry.type.replace(/_/g, " ")}</span></td>
                      <td style={{ textAlign: "right", fontWeight: 700, color: ledgerColor(entry.type) }}>{ledgerSign(entry.amount)} NC</td>
                      <td style={{ textAlign: "right", color: "var(--muted)", fontSize: 13 }}>{entry.balanceAfter.toLocaleString("en-IN")} NC</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── ACTIVITY ── */}
      {tab === "activity" && (
        <div className="card">
          <div className="card-header"><h3 className="card-title">Recent Activity</h3></div>
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {[
              [true,  "👤", "Account created",          `Joined as ${userProfile?.role || "user"}`,                     "Since registration"],
              [userProfile?.isServiceProvider, "🛠️", "Service provider", `${(userProfile?.skills as string[])?.length || 0} skills listed`, "Active"],
              [(userProfile?.reviewCount || 0) > 0, "⭐", "Reviews received", `${userProfile?.reviewCount} reviews · ${(userProfile?.rating as number)?.toFixed(1)} avg`, "Cumulative"],
              [userProfile?.society,  "🏘️", "Society linked",       userProfile?.society,                                "Active"],
              [userProfile?.phoneNumber, "📱", "Phone verified",    userProfile?.phoneNumber,                            "Verified"],
            ].filter(([show]) => show).map(([, icon, title, desc, time]) => (
              <div key={title as string} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 0", borderBottom: "1px solid var(--border)" }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--accent-dim)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{icon as string}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{title as string}</div>
                  <div style={{ fontSize: 13, color: "var(--muted)" }}>{desc as string}</div>
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap" }}>{time as string}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── DANGER ZONE ── */}
      {tab === "danger" && (
        <div style={{ maxWidth: 560 }}>
          <div className="card" style={{ marginBottom: 20 }}>
            <h3 className="card-title" style={{ marginBottom: 4 }}>Sign Out</h3>
            <p className="text-muted text-sm" style={{ marginBottom: 16 }}>You'll need to sign in again to access your account.</p>
            <button className="btn btn-secondary" onClick={logout}>Sign Out</button>
          </div>
          <div className="card" style={{ border: "1px solid rgba(220,38,38,0.25)" }}>
            <h3 className="card-title" style={{ marginBottom: 4, color: "#dc2626" }}>Delete Account</h3>
            <DeleteAccountPanel />
          </div>
        </div>
      )}
    </div>
  );
}
