import { useState, FormEvent } from "react";
import { useAuth } from "../contexts/AuthContext";
import { updateUserProfile, createService, getServicesByUser, deleteService } from "../services/firestoreService";
import { useEffect } from "react";

const SKILL_SUGGESTIONS = [
  "Tutoring", "IT & Tech", "Web Development", "Graphic Design", "Plumbing",
  "Electrical", "Health & Wellness", "Fitness", "Legal Advice", "Finance",
  "Cooking", "Music", "Photography", "Interior Design", "Yoga", "Language",
  "Career Coaching", "Gardening", "AC Repair", "Carpentry",
];

export default function Profile() {
  const { user, userProfile } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [newSkill, setNewSkill] = useState("");
  const [hourlyRate, setHourlyRate] = useState(0);
  const [isFree, setIsFree] = useState(true);
  const [society, setSociety] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Services
  const [services, setServices] = useState<Record<string, unknown>[]>([]);
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [svcTitle, setSvcTitle] = useState("");
  const [svcDesc, setSvcDesc] = useState("");
  const [svcPrice, setSvcPrice] = useState(0);
  const [svcDuration, setSvcDuration] = useState("30 min");
  const [svcCategory, setSvcCategory] = useState("");

  useEffect(() => {
    if (userProfile) {
      setDisplayName(userProfile.displayName || "");
      setBio(userProfile.bio || "");
      setSkills(userProfile.skills || []);
      setHourlyRate(userProfile.hourlyRate || 0);
      setIsFree(userProfile.isFreeConsultation ?? true);
      setSociety(userProfile.society || "");
    }
  }, [userProfile]);

  useEffect(() => {
    if (user) {
      getServicesByUser(user.uid).then(setServices);
    }
  }, [user]);

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
        isFreeConsultation: isFree,
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
      price: svcPrice,
      duration: svcDuration,
      category: svcCategory,
    });
    const updated = await getServicesByUser(user.uid);
    setServices(updated);
    setSvcTitle("");
    setSvcDesc("");
    setSvcPrice(0);
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
        <div className="avatar avatar-xl">
          {user?.photoURL ? (
            <img src={user.photoURL} alt="" />
          ) : (
            (displayName || "?").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
          )}
        </div>
        <div>
          <h3>{displayName || "Your Name"}</h3>
          <p className="text-muted text-sm">{user?.email}</p>
          {userProfile?.role === "admin" && <span className="badge badge-accent" style={{ marginTop: 6 }}>Admin</span>}
        </div>
      </div>

      <form onSubmit={handleSave}>
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

        {/* Skills */}
        <div className="card" style={{ marginBottom: 24 }}>
          <h3 className="card-title" style={{ marginBottom: 16 }}>Skills & Expertise</h3>

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
                checked={isFree}
                onChange={(e) => setIsFree(e.target.checked)}
                style={{ width: 18, height: 18, accentColor: "var(--accent)" }}
              />
              <span style={{ fontWeight: 500 }}>Offer free consultation (recommended to build trust)</span>
            </label>
          </div>

          {!isFree && (
            <div className="form-group">
              <label className="form-label">Hourly Rate (₹)</label>
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
          )}
        </div>

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
                <label className="form-label">Price (₹) — 0 for free</label>
                <input type="number" className="form-input" value={svcPrice} onChange={(e) => setSvcPrice(Number(e.target.value))} min={0} id="svc-price-input" />
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
    </div>
  );
}
