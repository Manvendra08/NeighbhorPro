import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../contexts/AuthContext";
import { logAudit } from "./AdminAuditLog";
import { DEFAULT_SERVICE_CATEGORIES, normalizeServiceCategories } from "../../constants/serviceCatalog";

type Settings = {
  commissionRate: number;
  maintenanceMode: boolean;
  allowNewRegistrations: boolean;
  allowBookings: boolean;
  allowBrowse: boolean;
  supportEmail: string;
  platformName: string;
  maxSocietiesPerCity: number;
  freeTrialDays: number;
  minBookingAmount: number;
  maintenanceMessage: string;
  featureReviews: boolean;
  featureMessaging: boolean;
  featurePremiumSocieties: boolean;
  serviceCategories: string[];
  subscriptionEnabled?: boolean;
  sub3mPriceNC?: number;
  sub6mPriceNC?: number;
  sub12mPriceNC?: number;
  subscriptionGracePeriodDays?: number;
  subscriptionTrialDays?: number;
};

const DEFAULTS: Settings = {
  commissionRate: 10, maintenanceMode: false, allowNewRegistrations: true,
  allowBookings: true, allowBrowse: true, supportEmail: "support@pro-neighbor.in",
  platformName: "ProNeighbor", maxSocietiesPerCity: 50, freeTrialDays: 30,
  minBookingAmount: 0, maintenanceMessage: "We'll be back shortly. Scheduled maintenance.",
  featureReviews: true, featureMessaging: true, featurePremiumSocieties: true,
  serviceCategories: [...DEFAULT_SERVICE_CATEGORIES],
  subscriptionEnabled: false,
  sub3mPriceNC: 999,
  sub6mPriceNC: 1799,
  sub12mPriceNC: 2299,
  subscriptionGracePeriodDays: 5,
  subscriptionTrialDays: 30,
};

export default function AdminSettings() {
  const { userProfile } = useAuth();
  const adminId = userProfile?.uid || "unknown";
  const adminName = userProfile?.displayName || "Admin";

  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [prevSettings, setPrevSettings] = useState<Settings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [dirty, setDirty] = useState(false);
  const [showMaintModal, setShowMaintModal] = useState(false);

  const showToast = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3000); };

  useEffect(() => {
    const load = async () => {
      try {
        const snap = await getDoc(doc(db, "config", "platformSettings"));
        if (snap.exists()) {
          const data = { ...DEFAULTS, ...snap.data() as Settings };
          data.serviceCategories = normalizeServiceCategories((snap.data() as Record<string, unknown>).serviceCategories);
          setSettings(data);
          setPrevSettings(data);
        }
      } catch { /* ignore */ }
      setLoading(false);
    };
    load();
  }, []);

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => {
    setSettings(s => ({ ...s, [k]: v }));
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, "config", "platformSettings"), { ...settings, updatedAt: serverTimestamp() }, { merge: true });

      // Build a diff summary for the audit log
      const changed: string[] = [];
      (Object.keys(settings) as (keyof Settings)[]).forEach(k => {
        const nextValue = Array.isArray(settings[k]) ? JSON.stringify(settings[k]) : settings[k];
        const prevValue = Array.isArray(prevSettings[k]) ? JSON.stringify(prevSettings[k]) : prevSettings[k];
        if (nextValue !== prevValue) {
          changed.push(`${k}: ${prevSettings[k]} → ${settings[k]}`);
        }
      });
      if (changed.length > 0) {
        await logAudit(
          "settings.update", adminId, adminName,
          `Updated platform settings: ${changed.slice(0, 5).join("; ")}${changed.length > 5 ? ` (+${changed.length - 5} more)` : ""}`
        );
      }

      setPrevSettings({ ...settings });
      showToast("✓ Settings saved");
      setDirty(false);
    } catch { showToast("Save failed", false); }
    setSaving(false);
  };

  const Toggle = ({ label, desc, k }: { label: string; desc?: string; k: keyof Settings }) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0", borderBottom: "1px solid var(--border)" }}>
      <div>
        <div style={{ fontWeight: 500, fontSize: 14 }}>{label}</div>
        {desc && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{desc}</div>}
      </div>
      <button 
        onClick={() => {
          if (k === "maintenanceMode") setShowMaintModal(true);
          else {
            const highImpactFlags: (keyof Settings)[] = [
              "allowNewRegistrations",
              "allowBrowse",
              "allowBookings",
              "featureMessaging",
              "featureReviews",
              "featurePremiumSocieties",
            ];
            if (highImpactFlags.includes(k)) {
              const nextValue = !settings[k];
              const ok = window.confirm(
                `${label}: ${nextValue ? "Enable" : "Disable"}? This change is staged until you click Save Changes.`
              );
              if (!ok) return;
            }
            set(k, !settings[k] as Settings[typeof k]);
          }
        }}
        style={{ width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer", background: settings[k] ? "var(--accent)" : "rgba(136,146,164,0.3)", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
        <span style={{ position: "absolute", top: 3, left: settings[k] ? 23 : 3, width: 18, height: 18, borderRadius: 9, background: "#fff", transition: "left 0.2s", display: "block" }} />
      </button>
    </div>
  );

  if (loading) return <div style={{ textAlign: "center", padding: 80 }}><div className="loader" style={{ margin: "0 auto" }} /></div>;

  return (
    <div>
      {toast && (
        <div style={{ position: "fixed", top: 20, right: 24, zIndex: 9999, background: toast.ok ? "var(--success)" : "var(--error)", color: "#fff", padding: "10px 20px", borderRadius: "var(--radius-sm)", fontWeight: 600, fontSize: 13, boxShadow: "var(--shadow-lg)" }}>
          {toast.msg}
        </div>
      )}

      <div className="page-header">
        <div>
          <h1 className="page-title">Platform Settings</h1>
          <p className="page-subtitle">Global configuration and feature flags</p>
        </div>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving || !dirty}>
          {saving ? "Saving…" : dirty ? "💾 Save Changes" : "✓ Saved"}
        </button>
      </div>

      {settings.maintenanceMode && (
        <div style={{ background: "rgba(255,92,92,0.1)", border: "1px solid rgba(255,92,92,0.3)", borderRadius: "var(--radius-sm)", padding: "12px 16px", marginBottom: 20, color: "var(--error)", fontWeight: 600, fontSize: 14 }}>
          ⚠ Platform is in Maintenance Mode — users cannot access the app
        </div>
      )}

      <div className="grid grid-2" style={{ gap: 24, alignItems: "start" }}>
        <div>
          <div className="card" style={{ marginBottom: 20 }}>
            <h3 className="card-title" style={{ marginBottom: 20 }}>⚙️ Core Configuration</h3>
            <div className="flex gap-16 item-center flex-wrap" style={{ marginBottom: 16 }}>
              {[
                { label: "Platform Name", k: "platformName" as const, type: "text", placeholder: "ProNeighbor" },
                { label: "Support Email", k: "supportEmail" as const, type: "email", placeholder: "support@pro-neighbor.in" },
              ].map(f => (
                <div className="form-group" key={f.k} style={{ flex: "1 1 200px", marginBottom: 0 }}>
                  <label className="form-label">{f.label}</label>
                  <input className="form-input" type={f.type} placeholder={f.placeholder} value={settings[f.k] as string} onChange={e => set(f.k, e.target.value as never)} />
                </div>
              ))}
            </div>

            <div className="form-group">
              <label className="form-label">Commission Rate (%)</label>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <input type="range" min={0} max={30} value={settings.commissionRate} onChange={e => set("commissionRate", +e.target.value)} style={{ flex: 1 }} />
                <span style={{ fontWeight: 700, fontSize: 20, color: "var(--accent)", minWidth: 40, textAlign: "right" }}>{settings.commissionRate}%</span>
              </div>
              <span className="form-hint">Current: {settings.commissionRate}% of every completed booking</span>
              {settings.commissionRate !== prevSettings.commissionRate && (
                <div style={{ marginTop: 8, fontSize: 12, color: "var(--warning)" }}>
                  Changing commission affects future booking settlement calculations. Review legal and policy implications before saving.
                </div>
              )}
            </div>

            <div className="grid grid-2" style={{ gap: 16 }}>
              {[
                { label: "Free Trial Days", k: "freeTrialDays" as const, min: 0, max: 90 },
                { label: "Min Booking ₹", k: "minBookingAmount" as const, min: 0, max: 5000 },
                { label: "Max Societies/City", k: "maxSocietiesPerCity" as const, min: 1, max: 500 },
              ].map(f => (
                <div className="form-group" key={f.k} style={{ marginBottom: 0 }}>
                  <label className="form-label">{f.label}</label>
                  <input className="form-input" type="number" min={f.min} max={f.max} value={settings[f.k] as number} onChange={e => set(f.k, +e.target.value as never)} />
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <h3 className="card-title" style={{ marginBottom: 8 }}>🚧 Maintenance</h3>
            <Toggle label="Maintenance Mode" desc="Locks app for all non-admin users" k="maintenanceMode" />
            {settings.maintenanceMode && (
              <div className="form-group" style={{ marginTop: 14 }}>
                <label className="form-label">Maintenance Message</label>
                <textarea className="form-input" value={settings.maintenanceMessage} onChange={e => set("maintenanceMessage", e.target.value)} rows={2} />
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="card" style={{ marginBottom: 20 }}>
            <h3 className="card-title" style={{ marginBottom: 8 }}>🚩 Feature Flags</h3>
            <p className="text-muted text-sm" style={{ marginBottom: 10 }}>
              Changes below are staged locally and apply only after clicking Save Changes.
            </p>
            <Toggle label="New Registrations" desc="Allow new users to sign up" k="allowNewRegistrations" />
            <Toggle label="Browse Professionals" desc="Users can browse service pros" k="allowBrowse" />
            <Toggle label="Bookings" desc="Users can create new bookings" k="allowBookings" />
            <Toggle label="Messaging" desc="In-app chat between users" k="featureMessaging" />
            <Toggle label="Reviews & Ratings" desc="Allow users to leave reviews" k="featureReviews" />
            <Toggle label="Premium Societies" desc="Society subscription upgrades" k="featurePremiumSocieties" />
          </div>

          <div className="card" style={{ marginBottom: 20 }}>
            <h3 className="card-title" style={{ marginBottom: 8 }}>🧩 Service Categories</h3>
            <p className="text-muted text-sm" style={{ marginBottom: 8 }}>
              Service categories are managed on the Service Management page.
            </p>
            <Link to="/admin/services" className="btn btn-secondary btn-sm" style={{ display: "inline-flex" }}>
              Open Service Management
            </Link>
          </div>

          <div className="card">
            <h3 className="card-title" style={{ marginBottom: 8 }}>💳 Business Subscription</h3>
            <p className="text-muted text-sm" style={{ marginBottom: 12 }}>
              Business category listings require an active subscription. NC-only payment.
            </p>

            <Toggle label="Subscription Enabled" desc="Require subscription for Business listings" k={"subscriptionEnabled" as keyof Settings} />

            <div style={{ marginTop: 20, marginBottom: 6, fontWeight: 600, fontSize: 13, color: "var(--text)" }}>
              Plan Pricing (NeighbourCoins)
            </div>

            {([
              { label: "3 Months", k: "sub3mPriceNC" as const, badge: null },
              { label: "6 Months", k: "sub6mPriceNC" as const, badge: "Best value" },
              { label: "12 Months", k: "sub12mPriceNC" as const, badge: null },
            ] as const).map(row => (
              <div key={row.k} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                <span style={{ flex: "0 0 90px", fontSize: 14, color: "var(--text)" }}>{row.label}</span>
                <input
                  className="form-input"
                  type="number"
                  min={0}
                  max={99999}
                  value={settings[row.k] ?? 0}
                  onChange={e => set(row.k, +e.target.value as never)}
                  style={{ flex: 1, marginBottom: 0 }}
                />
                {row.badge && (
                  <span style={{ fontSize: 11, fontWeight: 600, color: "var(--accent)", background: "rgba(var(--accent-rgb),0.1)", padding: "2px 8px", borderRadius: 10, whiteSpace: "nowrap" }}>
                    ✨ {row.badge}
                  </span>
                )}
              </div>
            ))}

            <div className="form-group" style={{ marginTop: 20, marginBottom: 0 }}>
              <label className="form-label">Grace Period (days after expiry before listing pauses)</label>
              <input
                className="form-input"
                type="number"
                min={0}
                max={30}
                value={settings.subscriptionGracePeriodDays ?? 5}
                onChange={e => set("subscriptionGracePeriodDays", +e.target.value as never)}
              />
            </div>

            <div style={{ marginTop: 16, padding: "12px 14px", background: "rgba(136,146,164,0.08)", borderRadius: "var(--radius-sm)", fontSize: 13, color: "var(--muted)" }}>
              Free Trial: First {settings.subscriptionTrialDays ?? 30} days free for all new Business listing pros (universal).
            </div>
          </div>
        </div>
      </div>

      {showMaintModal && (
        <div className="modal-overlay" onClick={() => setShowMaintModal(false)}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ color: "var(--error)" }}>⚠ Maintenance Mode</h3>
              <button className="modal-close" onClick={() => setShowMaintModal(false)}>✕</button>
            </div>
            <p style={{ fontSize: 14, color: "var(--muted)", marginBottom: 16 }}>
              {settings.maintenanceMode ? "Re-enable platform access for all users?" : "Lock the platform for all non-admin users? Existing sessions will be interrupted."}
            </p>
            <div className="modal-actions">
              <button className="btn btn-secondary btn-sm" onClick={() => setShowMaintModal(false)}>Cancel</button>
              <button className="btn btn-danger btn-sm" onClick={() => { set("maintenanceMode", !settings.maintenanceMode); setShowMaintModal(false); }}>
                {settings.maintenanceMode ? "Go Live" : "Enable Maintenance"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

