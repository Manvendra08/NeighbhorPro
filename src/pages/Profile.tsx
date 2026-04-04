import { useState, FormEvent, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { updateUserProfile, createService, getServicesByUser, deleteService, updateService, uploadProfilePhoto, getAllSocieties, uploadResidencyProof } from "../services/firestoreService";
import { logActivity } from "../services/activityService";

// ── White-collar skills for gated-society professionals — Park Street, Wakad, Pune
// Grouped by domain for the suggestion pills (shown 8 at a time, filtered by what's not already added)
const SKILL_SUGGESTIONS = [
  // Finance & Legal
  "Tax Filing & ITR",
  "CA Services",
  "Investment Advisory",
  "Mutual Fund Planning",
  "Insurance Planning",
  "Legal Advice",
  "Property & Real Estate Law",
  "Contract Review",
  "Will & Estate Planning",
  // Health & Medical
  "General Physician",
  "Pediatrician",
  "Dietitian & Nutrition",
  "Mental Health Counselling",
  "Physiotherapy",
  "Homeopathy",
  "Ayurveda Consultation",
  "Dermatology Advice",
  // Fitness & Wellness
  "Personal Training",
  "Yoga",
  "Zumba",
  "Meditation & Mindfulness",
  "Pilates",
  "Functional Fitness",
  // Education & Coaching
  "School Tutoring",
  "JEE / NEET Coaching",
  "CAT / MBA Prep",
  "IELTS / GRE / TOEFL",
  "Coding for Kids",
  "Vedic Maths",
  "Abacus",
  "Olympiad Coaching",
  // Technology
  "IT Support",
  "Web Development",
  "App Development",
  "Cybersecurity",
  "Data & Analytics",
  "AI & Automation",
  "Cloud & DevOps",
  // Design & Creative
  "Graphic Design",
  "UI/UX Design",
  "Interior Design",
  "Architecture Consultation",
  "Video Editing",
  "Content Writing",
  // Photography & Events
  "Photography",
  "Event Planning",
  "Wedding Planning",
  "Birthday & Party Planning",
  // Music & Arts
  "Guitar",
  "Piano / Keyboard",
  "Vocals & Singing",
  "Classical Dance (Bharatnatyam / Kathak)",
  "Western Dance",
  "Art & Painting",
  "Pottery & Crafts",
  // Lifestyle & Career
  "Career Coaching",
  "Resume & LinkedIn",
  "Public Speaking",
  "Language Coaching",
  "Beauty & Makeup",
  "Mehendi",
  "Pet Training",
  "Pet Grooming",
];

// Flat category list for the service form dropdown — maps 1:1 to BrowsePros CATEGORIES
const SERVICE_CATEGORIES = [
  "Tax & CA",
  "Investment & Wealth",
  "Legal",
  "Health & Wellness",
  "Mental Health",
  "Fitness & Yoga",
  "Nutrition & Diet",
  "Tutoring & Academics",
  "Test Prep",
  "IT & Tech",
  "Design & Creative",
  "Photography",
  "Music & Arts",
  "Career Coaching",
  "Language Learning",
  "Event Planning",
  "Beauty & Grooming",
  "Pet Care",
  "Other",
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
  const [societies, setSocieties] = useState<Record<string, unknown>[]>([]);
  const [errors, setErrors] = useState<{ displayName?: string; bio?: string; society?: string; tower?: string; phoneNumber?: string; serviceProvider?: string }>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [locality, setLocality] = useState("");
  const [tower, setTower] = useState("");
  const [flatNumber, setFlatNumber] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("+91-");
  const [uploadingProof, setUploadingProof] = useState(false);

  // Services
  const [services, setServices] = useState<Record<string, unknown>[]>([]);
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [svcTitle, setSvcTitle] = useState("");
  const [svcDesc, setSvcDesc] = useState("");
  const [svcIsFree, setSvcIsFree] = useState(false);
  const [svcPrice, setSvcPrice] = useState("");
  const [svcQuote, setSvcQuote] = useState(false);
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
      setLocality(userProfile.locality || "");
      setTower(userProfile.tower || "");
      setFlatNumber(userProfile.flatNumber || "");
      setPhoneNumber(userProfile.phoneNumber || "+91-");
    }
  }, [userProfile]);

  useEffect(() => {
    const loadSocieties = async () => {
      try {
        const res = await getAllSocieties();
        setSocieties(res.data);
      } catch {
        // ignore
      }
    };
    loadSocieties();
  }, []);

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
    const nextErrors: typeof errors = {};
    if (!displayName.trim()) {
      nextErrors.displayName = "Display name is required.";
    }
    const cleanedBio = bio.trim();
    const looksPlaceholder = /^(x|xy|xyz|test|bio|na|n\/a|none|hello)$/i.test(cleanedBio);
    if (cleanedBio && (cleanedBio.length < 20 || looksPlaceholder)) {
      nextErrors.bio = "Write a meaningful bio (minimum 20 characters, no placeholders).";
    }
    if (!society.trim()) {
      nextErrors.society = "Society is required.";
    }
    if (!tower.trim()) {
      nextErrors.tower = "Tower / Wing is required.";
    }
    // Indian phone validation: +91 followed by 10 digits starting with 6-9
    const phoneRegex = /^\+91[6-9]\d{9}$/;
    const normalizedPhone = phoneNumber.replace(/[\s-]/g, "");
    if (!normalizedPhone || normalizedPhone === "+91") {
      nextErrors.phoneNumber = "Mobile number is required.";
    } else if (!phoneRegex.test(normalizedPhone)) {
      nextErrors.phoneNumber = "Invalid Indian mobile number. Use +91XXXXXXXXXX.";
    }
    if (isServiceProvider && userProfile?.residentVerificationStatus !== "verified") {
      nextErrors.serviceProvider = "Residency verification is required to enable Service Provider mode.";
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }
    setSaving(true);
    try {
      await updateUserProfile(user.uid, {
        displayName, bio, skills, hourlyRate, isServiceProvider,
        priceAfterQuote, society, locality, tower, flatNumber, phoneNumber: normalizedPhone,
      });
      logActivity(user.uid, "user.profile_update", `Profile updated: ${displayName}`, { isServiceProvider, skillCount: skills.length, society });
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

  const handleServiceSave = async () => {
    if (!user || !svcTitle.trim()) return;
    if (userProfile?.residentVerificationStatus !== "verified") {
      alert("Residency verification is required before listing services.");
      return;
    }
    const payload = {
      userId: user.uid,
      title: svcTitle,
      description: svcDesc,
      price: svcQuote ? 0 : Number(svcPrice),
      isFree: svcIsFree, // Keep this if it's still relevant, otherwise remove.
      quoteBased: svcQuote,
      duration: svcDuration,
      category: svcCategory,
    };
    if (editingServiceId) {
      await updateService(editingServiceId, payload);
    } else {
      await createService(payload);
    }
    const updated = await getServicesByUser(user.uid);
    setServices(updated);
    setSvcTitle("");
    setSvcDesc("");
    setSvcPrice("");
    setSvcIsFree(false);
    setSvcQuote(false);
    setSvcDuration("30 min");
    setSvcCategory("");
    setEditingServiceId(null);
    setShowServiceForm(false);
  };

  const startEditService = (svc: Record<string, unknown>) => {
    setEditingServiceId(svc.id as string);
    setSvcTitle((svc.title as string) || "");
    setSvcDesc((svc.description as string) || "");
    const quote = !!svc.quoteBased;
    const free = !!svc.isFree || ((svc.price as number) || 0) === 0;
    setSvcQuote(quote);
    setSvcIsFree(!quote && free);
    setSvcPrice(String((svc.price as number) || 0));
    setSvcDuration((svc.duration as string) || "30 min");
    setSvcCategory((svc.category as string) || "");
    setShowServiceForm(true);
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
      <div className="card" style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 20 }}>
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
        <div className="card" style={{ marginTop: 32, marginBottom: errors.serviceProvider ? 8 : 32, display: "flex", alignItems: "center", justifyContent: "space-between", border: errors.serviceProvider ? "1px solid var(--error)" : isServiceProvider ? "1px solid var(--success)" : "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ fontSize: 24, color: isServiceProvider ? "var(--success)" : "var(--muted)" }}>💼</div>
            <div>
              <h3 className="card-title">Enable Service Provider Mode</h3>
              <p className="text-muted text-sm">Turn this on to list your skills and offer services to the community.</p>
            </div>
          </div>
          <label className="toggle-switch" style={{ position: "relative", display: "inline-block", width: 48, height: 26 }}>
            <input
              type="checkbox"
              checked={isServiceProvider}
              onChange={(e) => {
                const next = e.target.checked;
                if (next && userProfile?.residentVerificationStatus !== "verified") {
                  alert("Residency verification is mandatory before enabling Service Provider mode.");
                  return;
                }
                setIsServiceProvider(next);
              }}
              style={{ opacity: 0, width: 0, height: 0 }}
            />
            <span className="slider" style={{ position: "absolute", cursor: "pointer", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: isServiceProvider ? "#4ADE80" : "var(--surface-3)", transition: ".4s", borderRadius: 26, border: "1px solid var(--border)" }}>
              <span style={{ position: "absolute", height: 20, width: 20, left: 2, bottom: 2, backgroundColor: "white", transition: ".4s", borderRadius: "50%", transform: isServiceProvider ? "translateX(22px)" : "none", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }}></span>
            </span>
          </label>
        </div>
        {errors.serviceProvider && (
          <div className="text-sm" style={{ color: "var(--error)", marginBottom: 32 }}>
            {errors.serviceProvider}
          </div>
        )}

        {/* Basic info */}
        <div className="card" style={{ marginBottom: 24 }}>
          <h3 className="card-title" style={{ marginBottom: 16 }}>Basic Information</h3>

          <div className="form-group">
            <label className="form-label">
              Display Name <span style={{ color: "var(--error)" }}>*</span>
            </label>
            <input
              className="form-input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your full name"
              id="profile-name-input"
            />
            {errors.displayName && (
              <div className="text-sm" style={{ color: "var(--error)", marginTop: 4 }}>
                {errors.displayName}
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">
              Bio <span style={{ color: "var(--muted)", fontSize: "0.75rem", fontWeight: "normal" }}>(optional)</span>
            </label>
            <textarea
              className="form-input"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell your neighbors about your professional background in 1-2 sentences."
              id="profile-bio-input"
              rows={3}
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              Phone Number <span style={{ color: "var(--error)" }}>*</span> <span style={{ color: "var(--muted)", fontSize: "0.75rem", fontWeight: "normal" }}>(Indian Carriers)</span>
            </label>
            <input
              className="form-input"
              value={phoneNumber}
              onChange={(e) => {
                let val = e.target.value;
                // Enforce +91- prefix and allow only numbers after it
                if (!val.startsWith("+91-")) {
                  val = "+91-" + val.replace(/^\+?91?-?/, "");
                }
                const suffix = val.slice(4).replace(/\D/g, "").slice(0, 10);
                setPhoneNumber("+91-" + suffix);
              }}
              placeholder="+91-9876543210"
              id="profile-phone-input"
              maxLength={14}
            />
            <p className="text-muted" style={{ fontSize: "0.75rem", marginTop: 4 }}>Make sure your enter correct mobile number. You can Hide / Unhide mobile number in Privacy setting.</p>
            {(errors as any).phoneNumber && (
              <div className="text-sm" style={{ color: "var(--error)", marginTop: 4 }}>
                {(errors as any).phoneNumber}
              </div>
            )}
          </div>


        </div>

        {/* Residence Information */}
        <div className="card" style={{ marginBottom: 24 }}>
          <h3 className="card-title" style={{ marginBottom: 16 }}>📍 Residence Information</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div className="form-group" style={{ gridColumn: "1 / -1" }}>
              <label className="form-label">
                Society <span style={{ color: "var(--error)" }}>*</span>
              </label>
              <select
                className="form-input"
                value={society}
                onChange={(e) => {
                  setSociety(e.target.value);
                  const selected = societies.find(s => s.name === e.target.value);
                  if (selected) setLocality((selected.locality as string) || "");
                }}
                id="profile-society-select"
              >
                <option value="">Select your society…</option>
                {societies.map((s) => (
                  <option key={s.id as string} value={s.name as string}>
                    {s.name as string}
                  </option>
                ))}
              </select>
              {errors.society && (
                <div className="text-sm" style={{ color: "var(--error)", marginTop: 4 }}>
                  {errors.society}
                </div>
              )}
            </div>
            <div className="form-group">
              <label className="form-label">Tower / Wing <span style={{ color: "var(--error)" }}>*</span></label>
              <input
                className="form-input"
                value={tower}
                onChange={(e) => setTower(e.target.value)}
                placeholder="e.g., Tower A"
                id="profile-tower-input"
              />
              {errors.tower && (
                <div className="text-sm" style={{ color: "var(--error)", marginTop: 4 }}>
                  {errors.tower}
                </div>
              )}
            </div>
            <div className="form-group">
              <label className="form-label">Flat Number</label>
              <input
                className="form-input"
                value={flatNumber}
                onChange={(e) => setFlatNumber(e.target.value)}
                placeholder="e.g., 402"
                id="profile-flat-input"
              />
            </div>
          </div>

          {/* Residency Proof Upload */}
          <div style={{ borderTop: "1px solid var(--border)", marginTop: 16, paddingTop: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div>
                <label className="form-label" style={{ marginBottom: 4 }}>Residency Proof (required to book, enable Pro mode, and list services)</label>
                <p className="text-muted" style={{ fontSize: 12, margin: 0 }}>Upload a clear photo of your proof document. JPG, JPEG, and PNG files only.</p>
              </div>
              {userProfile?.residentVerificationStatus === "verified" && (
                <span className="badge badge-success" style={{ fontSize: 11 }}>✓ Verified Resident</span>
              )}
              {userProfile?.residentVerificationStatus === "pending" && (
                <span className="badge badge-warning" style={{ fontSize: 11 }}>⏳ Pending Review</span>
              )}
            </div>
            {userProfile?.residencyProofUrl && (
              <div style={{ marginBottom: 8, fontSize: 12 }}>
                <a href={userProfile.residencyProofUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>📎 View uploaded proof</a>
              </div>
            )}
            <label style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: uploadingProof ? "default" : "pointer", padding: "8px 16px", border: "1px dashed var(--border)", borderRadius: "var(--radius-sm)", fontSize: 13, color: "var(--muted)" }}>
              📄 {uploadingProof ? "Uploading…" : "Upload proof document"}
              <input
                type="file"
                accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                style={{ display: "none" }}
                disabled={uploadingProof}
                onChange={async (e) => {
                  if (!e.target.files?.[0] || !user) return;
                  setUploadingProof(true);
                  try {
                    await uploadResidencyProof(user.uid, e.target.files[0]);
                    logActivity(user.uid, "verification.submitted", `Residency proof uploaded: ${e.target.files[0].name}`, { fileName: e.target.files[0].name, fileSize: e.target.files[0].size });
                  } catch (err: any) {
                    alert(err.message || "Upload failed. Please try again.");
                  }
                  setUploadingProof(false);
                }}
              />
            </label>
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
                {SKILL_SUGGESTIONS.filter((s) => !skills.includes(s)).slice(0, 10).map((s) => (
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
            <button className="btn btn-primary btn-sm" onClick={() => {
              if (showServiceForm) {
                setShowServiceForm(false);
                setEditingServiceId(null);
              } else {
                setShowServiceForm(true);
              }
            }}>
              {showServiceForm ? "Cancel" : "+ Add Service"}
            </button>
          </div>

          {showServiceForm && (
            <div style={{ marginBottom: 20, padding: 16, background: "var(--surface-2)", borderRadius: "var(--radius-sm)" }}>
              <div className="form-group">
                <label className="form-label">Service Title</label>
                <input className="form-input" value={svcTitle} onChange={(e) => setSvcTitle(e.target.value)} placeholder="e.g., ITR Filing, Yoga Sessions, JEE Maths" id="svc-title-input" />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea className="form-input" value={svcDesc} onChange={(e) => setSvcDesc(e.target.value)} placeholder="What does this service include?" id="svc-desc-input" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ display: "flex", justifyContent: "space-between" }}>
                    Price (NC)
                    <div style={{ display: "flex", gap: 12 }}>
                      <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer", fontWeight: "normal", color: "var(--success)" }}>
                        <input type="checkbox" checked={svcIsFree} onChange={(e) => { setSvcIsFree(e.target.checked); if (e.target.checked) setSvcQuote(false); }} />
                        Free
                      </label>
                    </div>
                  </label>
                  <input type="number" className="form-input" value={(svcIsFree || svcQuote) ? 0 : svcPrice} onChange={(e) => setSvcPrice(e.target.value)} min={0} disabled={svcIsFree || svcQuote} id="svc-price-input" />
                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontWeight: "normal", fontSize: "0.75rem", color: "var(--muted)", marginTop: 6 }}>
                    <input type="checkbox" checked={svcQuote} onChange={(e) => { setSvcQuote(e.target.checked); if (e.target.checked) setSvcIsFree(false); }} />
                    Fee after understanding the work (Quote-based)
                  </label>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Duration</label>
                  <select className="form-input" value={svcDuration} onChange={(e) => setSvcDuration(e.target.value)} id="svc-duration-select">
                    <option>15 min</option><option>30 min</option><option>45 min</option><option>1 hour</option><option>2 hours</option>
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Category</label>
                  <select className="form-input" value={svcCategory} onChange={(e) => setSvcCategory(e.target.value)} id="svc-category-select">
                    <option value="">Select…</option>
                    {SERVICE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <button className="btn btn-success" onClick={handleServiceSave} disabled={!svcTitle.trim()}>
                {editingServiceId ? "Update Service" : "Save Service"}
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
                      {svc.quoteBased ? "Quote-based" : (svc.isFree || (svc.price as number) === 0) ? "Free" : `${svc.price} NC`} · {svc.duration as string}
                      {svc.category ? <span style={{ marginLeft: 8 }} className="badge badge-muted">{svc.category as string}</span> : null}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => startEditService(svc)} title="Edit">Edit</button>
                    <button
                      className="btn btn-danger btn-sm btn-icon"
                      onClick={() => handleDeleteService(svc.id as string)}
                      title="Delete"
                    >
                      🗑
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

