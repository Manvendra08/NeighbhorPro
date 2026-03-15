import { useState, FormEvent, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { updateUserProfile, createService, getServicesByUser, deleteService, uploadProfilePhoto } from "../services/firestoreService";

const SKILL_SUGGESTIONS = [
  "Tutoring", "IT & Tech", "Web Development", "Graphic Design", "Food",
  "Event Management", "Health & Wellness", "Fitness", "Legal Advice", "Finance",
  "Interior Design", "Music", "Photography", "Catering", "Yoga", "Language",
  "Career Coaching", "Gardening", "AC Repair", "Carpentry",
];

export default function Profile() {
  const { user, userProfile } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [newSkill, setNewSkill] = useState("");
  const [hourlyRate, setHourlyRate] = useState(0);
  const [isServiceProvider, setIsServiceProvider] = useState(false);
  const [priceAfterQuote, setPriceAfterQuote] = useState(false);
  const [society, setSociety] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Services
  const [services, setServices] = useState<Record<string, unknown>[]>([]);
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [svcTitle, setSvcTitle] = useState("");
  const [svcDesc, setSvcDesc] = useState("");
  const [svcIsFree, setSvcIsFree] = useState(false);
  const [svcPrice, setSvcPrice] = useState(0);
  const [svcDuration, setSvcDuration] = useState("30 min");
  const [svcCategory, setSvcCategory] = useState("");

  useEffect(() => {
    if (userProfile) {
      setDisplayName(userProfile.displayName || "");
      setBio(userProfile.bio || "");
      setSkills(userProfile.skills || []);
      setHourlyRate(userProfile.hourlyRate || 0);
      setIsServiceProvider(userProfile.isServiceProvider || false);
      setPriceAfterQuote(userProfile.priceAfterQuote || false);
      setSociety(userProfile.society || "");
    }
  }, [userProfile]);

  useEffect(() => {
    if (user) {
      getServicesByUser(user.uid).then(setServices);
    }
  }, [user]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !user) return;
    const file = e.target.files[0];
    setUploadingPhoto(true);
    try {
      await uploadProfilePhoto(user.uid, file);
    } catch { /* ignore */ }
    setUploadingPhoto(false);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      await updateUserProfile(user.uid, {
        displayName,
        bio,
        skills,
        hourlyRate,
        isServiceProvider,
        priceAfterQuote,
        society,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch { /* ignore */ }
    setSaving(false);
  };

  const addSkill = (skill: string) => {
    const trimmed = skill.trim();
    if (trimmed && !skills.includes(trimmed)) {
      setSkills([...skills, trimmed]);
    }
    setNewSkill("");
  };

  const removeSkill = (skill: string) => {
    setSkills(skills.filter((s) => s !== skill));
  };

  const handleAddService = async () => {
    if (!user || !svcTitle.trim()) return;
    await createService({
      userId: user.uid,
      title: svcTitle,
      description: svcDesc,
      price: svcIsFree ? 0 : svcPrice,
      isFree: svcIsFree,
      duration: svcDuration,
      category: svcCategory,
    });
    const updated = await getServicesByUser(user.uid);
    setServices(updated);
    setSvcTitle("");
    setSvcDesc("");
    setSvcPrice(0);
    setSvcIsFree(false);
    setSvcDuration("30 min");
    setSvcCategory("");
    setShowServiceForm(false);
  };

  const handleDeleteService = async (id: string) => {
    await deleteService(id);
    setServices(services.filter((s) => s.id !== id));
  };

  return (
    <div style={{ maxWidth: 680, margin: "0 auto" }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">My Profile</h1>
          <p className="page-subtitle">Manage your professional profile</p>
        </div>
      </div>

      {/* Profile avatar */}
      <div className="card" style={{ marginBottom: 24, display: "flex", alignItems: "center", gap: 20 }}>
        <div style={{ position: "relative" }}>
          <div className="avatar avatar-xl avatar-upload" style={{ position: "relative", overflow: "hidden" }}>
            {user?.photoURL ? (
              <img src={user.photoURL} alt="" />
            ) : (
              (displayName || "?").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
            )}
            <label className="avatar-upload-overlay" style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", cursor: "pointer", opacity: 0, transition: "opacity 0.2s" }}>
              <span style={{ fontSize: 24 }}>📷</span>
              <input type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: "none" }} disabled={uploadingPhoto} />
            </label>
          </div>
          {isServiceProvider && (
            <div className="provider-badge" style={{ position: "absolute", bottom: -2, right: -2, background: "var(--success)", color: "#000", width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid var(--surface)", fontSize: 12, fontWeight: "bold", zIndex: 1 }} title="Service Provider">✓</div>
          )}
        </div>
        <div>
          <h3>{displayName || "Your Name"}</h3>
          <p className="text-muted text-sm">{user?.email}</p>
          {userProfile?.role === "admin" && <span className="badge badge-accent" style={{ marginTop: 6 }}>Admin</span>}
        </div>
      </div>

      <form onSubmit={handleSave}>
        {/* Service Provider Toggle */}
        <div className="card" style={{ marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h3 className="card-title">Enable Service Provider Mode</h3>
            <p className="text-muted text-sm">Turn this on to list your skills and offer services to the community.</p>
          </div>
          <label className="toggle-switch" style={{ position: "relative", display: "inline-block", width: 48, height: 26 }}>
            <input type="checkbox" checked={isServiceProvider} onChange={(e) => setIsServiceProvider(e.target.checked)} style={{ opacity: 0, width: 0, height: 0 }} />
            <span className="slider" style={{ position: "absolute", cursor: "pointer", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: isServiceProvider ? "var(--accent2)" : "var(--surface-2)", transition: ".4s", borderRadius: 26, border: "1px solid var(--border)" }}>
              <span style={{ position: "absolute", height: 20, width: 20, left: 2, bottom: 2, backgroundColor: isServiceProvider ? "#000" : "var(--muted)", transition: ".4s", borderRadius: "50%", transform: isServiceProvider ? "translateX(22px)" : "none" }}></span>
            </span>
          </label>
        </div>

        {/* Basic info */}
        <div className="card" style={{ marginBottom: 24 }}>
          <h3 className="card-title" style={{ marginBottom: 16 }}>Basic Information</h3>

          <div className="form-group">
            <label className="form-label">Display Name</label>
            <input
              className="form-input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your full name"
              id="profile-name-input"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Bio</label>
            <textarea
              className="form-input"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell your neighbors about your professional background…"
              id="profile-bio-input"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Society / Community</label>
            <input
              className="form-input"
              value={society}
              onChange={(e) => setSociety(e.target.value)}
              placeholder="e.g., Sunflower Heights, Pimpri"
              id="profile-society-input"
            />
          </div>
        </div>

        {isServiceProvider && (
          <>
            {/* Skills */}
            <div className="card" style={{ marginBottom: 24 }}>
              <h3 className="card-title" style={{ marginBottom: 16 }}>Skills & Expertise</h3>
              
              <div className="tips-card" style={{ background: "var(--accent-dim)", border: "1px solid rgba(61,126,255,0.2)", borderRadius: "var(--radius-sm)", padding: "12px 16px", marginBottom: 20 }}>
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <span style={{ fontSize: 20 }}>💡</span>
                  <div>
                    <strong style={{ display: "block", color: "var(--accent)", marginBottom: 4 }}>Best Practices for Success</strong>
                    <ul style={{ margin: 0, paddingLeft: 16, fontSize: 13, color: "var(--text-2)", display: "flex", flexDirection: "column", gap: 4 }}>
                      <li>Add 3-5 specific skills to improve your visibility in search.</li>
                      <li>Start by offering a free consultation to build trust and gather your first positive reviews.</li>
                      <li>Once established, add paid services to start earning steady income.</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
            {skills.map((s) => (
              <span className="skill-tag" key={s} style={{ cursor: "pointer" }} onClick={() => removeSkill(s)}>
                {s} ✕
              </span>
            ))}
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <input
              className="form-input"
              value={newSkill}
              onChange={(e) => setNewSkill(e.target.value)}
              placeholder="Add a skill…"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addSkill(newSkill);
                }
              }}
              style={{ flex: 1 }}
              id="profile-skill-input"
            />
            <button type="button" className="btn btn-secondary" onClick={() => addSkill(newSkill)}>
              Add
            </button>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {SKILL_SUGGESTIONS.filter((s) => !skills.includes(s)).slice(0, 8).map((s) => (
              <button
                type="button"
                key={s}
                className="chip"
                onClick={() => addSkill(s)}
                style={{ fontSize: 11 }}
              >
                + {s}
              </button>
            ))}
          </div>
        </div>

            {/* Pricing */}
            <div className="card" style={{ marginBottom: 24 }}>
              <h3 className="card-title" style={{ marginBottom: 16 }}>Consultation Pricing</h3>

              <div className="form-group">
                <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={priceAfterQuote}
                    onChange={(e) => setPriceAfterQuote(e.target.checked)}
                    style={{ width: 18, height: 18, accentColor: "var(--accent)" }}
                  />
                  <span style={{ fontWeight: 500 }}>💬 Price after understanding the work (Quote-based)</span>
                </label>
              </div>

              <div className="form-group">
                <label className="form-label">Base Hourly Rate (₹)</label>
                <input
                  type="number"
                  className="form-input"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(Number(e.target.value))}
                  min={0}
                  placeholder="500"
                  style={{ maxWidth: 200 }}
                  id="profile-rate-input"
                />
              </div>
            </div>
          </>
        )}

        {saved && (
          <div style={{
            background: "var(--accent2-dim)",
            border: "1px solid rgba(0,229,176,0.3)",
            color: "var(--accent2)",
            padding: "10px 16px",
            borderRadius: "var(--radius)",
            fontSize: 14,
            fontWeight: 500,
            marginBottom: 16,
          }}>
            ✓ Profile saved successfully!
          </div>
        )}

        <button className="btn btn-primary btn-lg" type="submit" disabled={saving} style={{ width: "100%", marginBottom: 32 }}>
          {saving ? "Saving…" : "Save Profile"}
        </button>
      </form>

      {/* Services */}
      {isServiceProvider && (
        <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <h3 className="card-title">My Services</h3>
          <button className="btn btn-primary btn-sm" onClick={() => setShowServiceForm(!showServiceForm)}>
            {showServiceForm ? "Cancel" : "+ Add Service"}
          </button>
        </div>

        {showServiceForm && (
          <div style={{ marginBottom: 20, padding: 16, background: "var(--surface-2)", borderRadius: "var(--radius-sm)" }}>
            <div className="form-group">
              <label className="form-label">Service Title</label>
              <input className="form-input" value={svcTitle} onChange={(e) => setSvcTitle(e.target.value)} placeholder="e.g., Math Tutoring" id="svc-title-input" />
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea className="form-input" value={svcDesc} onChange={(e) => setSvcDesc(e.target.value)} placeholder="What does this service include?" id="svc-desc-input" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div className="form-group">
                <label className="form-label" style={{ display: "flex", justifyContent: "space-between" }}>
                  Price (₹)
                  <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer", fontWeight: "normal", color: "var(--success)" }}>
                    <input type="checkbox" checked={svcIsFree} onChange={(e) => setSvcIsFree(e.target.checked)} />
                    Free Service
                  </label>
                </label>
                <input type="number" className="form-input" value={svcIsFree ? 0 : svcPrice} onChange={(e) => setSvcPrice(Number(e.target.value))} min={0} disabled={svcIsFree} id="svc-price-input" />
              </div>
              <div className="form-group">
                <label className="form-label">Duration</label>
                <select className="form-input" value={svcDuration} onChange={(e) => setSvcDuration(e.target.value)} id="svc-duration-select">
                  <option>15 min</option>
                  <option>30 min</option>
                  <option>45 min</option>
                  <option>1 hour</option>
                  <option>2 hours</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Category</label>
              <select className="form-input" value={svcCategory} onChange={(e) => setSvcCategory(e.target.value)} id="svc-category-select">
                <option value="">Select…</option>
                {SKILL_SUGGESTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <button className="btn btn-success" onClick={handleAddService} disabled={!svcTitle.trim()}>
              Save Service
            </button>
          </div>
        )}

        {services.length === 0 && !showServiceForm ? (
          <p className="text-muted">No services listed. Add your first service to attract clients!</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {services.map((svc) => (
              <div
                key={svc.id as string}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "12px 14px",
                  background: "var(--surface-2)",
                  borderRadius: "var(--radius-sm)",
                }}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>{svc.title as string}</div>
                  <div className="text-muted text-sm">
                    {(svc.price as number) === 0 ? "Free" : `₹${svc.price}`} · {svc.duration as string}
                  </div>
                </div>
                <button
                  className="btn btn-danger btn-sm btn-icon"
                  onClick={() => handleDeleteService(svc.id as string)}
                  title="Delete"
                >
                  🗑
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      )}
    </div>
  );
}
