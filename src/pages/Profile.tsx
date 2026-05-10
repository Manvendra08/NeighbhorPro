import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useAuth } from "../contexts/AuthContext";
import {
  createService,
  deleteService,
  getAllSocieties,
  getServicesByUser,
  updateService,
  updateUserProfile,
  deleteResidencyProof,
  uploadProfilePhoto,
  uploadResidencyProof,
} from "../services/firestoreService";
import { logActivity } from "../services/activityService";
import { CATEGORY_GROUPS, isBusinessCategory } from "../constants/serviceCatalog";
import {
  getSubscription,
  activateTrial,
  isSubActive,
  type Subscription,
} from "../services/subscriptionService";
import SubscriptionBanner from "../components/SubscriptionBanner";
import SubscribeSheet from "../components/SubscribeSheet";

const SKILL_SUGGESTIONS = [
  "Tax Filing & ITR",
  "CA Services",
  "Investment Advisory",
  "Mutual Fund Planning",
  "Insurance Planning",
  "Legal Advice",
  "Property & Real Estate Law",
  "Contract Review",
  "Will & Estate Planning",
  "General Physician",
  "Pediatrician",
  "Dietitian & Nutrition",
  "Mental Health Counselling",
  "Physiotherapy",
  "Homeopathy",
  "Ayurveda Consultation",
  "Dermatology Advice",
  "Personal Training",
  "Yoga",
  "Zumba",
  "Meditation & Mindfulness",
  "Pilates",
  "Functional Fitness",
  "School Tutoring",
  "JEE / NEET Coaching",
  "CAT / MBA Prep",
  "IELTS / GRE / TOEFL",
  "Coding for Kids",
  "Vedic Maths",
  "Abacus",
  "Olympiad Coaching",
  "IT Support",
  "Web Development",
  "App Development",
  "Cybersecurity",
  "Data & Analytics",
  "AI & Automation",
  "Cloud & DevOps",
  "Graphic Design",
  "UI/UX Design",
  "Interior Design",
  "Architecture Consultation",
  "Video Editing",
  "Content Writing",
  "Photography",
  "Event Planning",
  "Wedding Planning",
  "Birthday & Party Planning",
  "Guitar",
  "Piano / Keyboard",
  "Vocals & Singing",
  "Classical Dance (Bharatnatyam / Kathak)",
  "Western Dance",
  "Art & Painting",
  "Pottery & Crafts",
  "Career Coaching",
  "Resume & LinkedIn",
  "Public Speaking",
  "Language Coaching",
  "Beauty & Makeup",
  "Mehendi",
  "Pet Training",
  "Pet Grooming",
];

function getDeliverableProofUrl(url: unknown): string {
  return typeof url === "string" && url
    ? url.replace(/\/raw\/upload\//i, "/image/upload/")
    : "";
}

type ProfileProps = {
  profileOverride?: Record<string, unknown> | null;
  uidOverride?: string | null;
  isAdminViewAs?: boolean;
};

type ProfileErrors = {
  displayName?: string;
  bio?: string;
  flatNumber?: string;
  society?: string;
  tower?: string;
  phoneNumber?: string;
  serviceProvider?: string;
};

export default function Profile({ profileOverride, uidOverride, isAdminViewAs = false }: ProfileProps) {
  const { user, userProfile } = useAuth();
  const targetProfile = (profileOverride as typeof userProfile | null | undefined) ?? userProfile;
  const targetUid = uidOverride ?? user?.uid ?? null;

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [newSkill, setNewSkill] = useState("");
  const [hourlyRate, setHourlyRate] = useState(0);
  const [isServiceProvider, setIsServiceProvider] = useState(false);
  const [priceAfterQuote, setPriceAfterQuote] = useState(false);
  const [society, setSociety] = useState("");
  const [locality, setLocality] = useState("");
  const [tower, setTower] = useState("");
  const [flatNumber, setFlatNumber] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("+91-");
  const [societies, setSocieties] = useState<Record<string, unknown>[]>([]);
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [deletingProof, setDeletingProof] = useState(false);

  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [services, setServices] = useState<Record<string, unknown>[]>([]);
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [svcTitle, setSvcTitle] = useState("");
  const [svcDesc, setSvcDesc] = useState("");
  const [svcFeeType, setSvcFeeType] = useState<"free" | "quote" | "hourly" | "monthly">("free");
  const [svcPrice, setSvcPrice] = useState("");
  const [svcCategory, setSvcCategory] = useState("");
  const [svcCategoryGroup, setSvcCategoryGroup] = useState("");

  const [sub, setSub] = useState<Subscription | null>(null);
  const [showSubscribeSheet, setShowSubscribeSheet] = useState(false);

  useEffect(() => {
    if (!targetProfile) return;
    setDisplayName((targetProfile.displayName as string) || "");
    setBio((targetProfile.bio as string) || "");
    setSkills(Array.isArray(targetProfile.skills) ? (targetProfile.skills as string[]) : []);
    setHourlyRate(Number(targetProfile.hourlyRate) || 0);
    setIsServiceProvider(Boolean(targetProfile.isServiceProvider));
    setPriceAfterQuote(Boolean(targetProfile.priceAfterQuote));
    setSociety((targetProfile.society as string) || "");
    setLocality((targetProfile.locality as string) || "");
    setTower((targetProfile.tower as string) || "");
    setFlatNumber((targetProfile.flatNumber as string) || "");
    setPhoneNumber((targetProfile.phoneNumber as string) || "+91-");
  }, [targetProfile]);

  useEffect(() => {
    const loadSocieties = async () => {
      try {
        const res = await getAllSocieties();
        setSocieties(res.data);
      } catch {
        setSocieties([]);
      }
    };
    loadSocieties();
  }, []);

  useEffect(() => {
    if (!society) return;
    const selected = societies.find(item => (item.name as string) === society);
    if (!selected) return;
    const mappedLocality = ((selected.locality as string) || (selected.city as string) || "").trim();
    setLocality(mappedLocality);
  }, [society, societies]);

  useEffect(() => {
    if (!targetUid) return;
    getServicesByUser(targetUid).then(setServices).catch((err) => {
      console.error("Failed to load services:", err);
      setServices([]);
    });
  }, [targetUid]);

  const fetchSub = async () => {
    if (!targetUid) return;
    try {
      const result = await getSubscription(targetUid);
      setSub(result);
    } catch {
      setSub(null);
    }
  };

  useEffect(() => {
    void fetchSub();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetUid]);

  useEffect(() => {
    return () => {
      if (savedTimerRef.current) {
        clearTimeout(savedTimerRef.current);
      }
    };
  }, []);

  const handlePhotoUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !targetUid || isAdminViewAs) return;
    
    if (file.size > 5 * 1024 * 1024) {
      alert("Image is too large. Max size is 5MB.");
      return;
    }
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      alert("Invalid file type for profile photo. Only JPG, PNG, and WebP images are allowed.\n\nFor residency proof (PDF/DOC), please use the 'Upload proof document' button below.");
      return;
    }
    
    setUploadingPhoto(true);
    try {
      await uploadProfilePhoto(targetUid, file);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    if (!targetUid) return;

    const nextErrors: ProfileErrors = {};
    const trimmedBio = bio.trim();
    const normalizedPhone = phoneNumber.replace(/[\s-]/g, "");
    const phoneRegex = /^\+91[6-9]\d{9}$/;

    if (!displayName.trim()) nextErrors.displayName = "Display name is required.";
    if (trimmedBio.length > 500) nextErrors.bio = "Bio must be 500 characters or less.";
    if (!society.trim()) nextErrors.society = "Society is required.";
    if (!tower.trim()) nextErrors.tower = "Tower / Wing is required.";
    if (!flatNumber.trim()) nextErrors.flatNumber = "Flat Number is required.";
    if (!normalizedPhone || normalizedPhone === "+91") nextErrors.phoneNumber = "Mobile number is required.";
    else if (!phoneRegex.test(normalizedPhone)) nextErrors.phoneNumber = "Invalid Indian mobile number. Use +91XXXXXXXXXX or +91-XXXXXXXXXX.";
    if (isServiceProvider && targetProfile?.residentVerificationStatus !== "verified") {
      nextErrors.serviceProvider = "Residency verification is required to enable Service Provider mode.";
    }

    setErrors(nextErrors);
    setSaveError("");
    if (Object.keys(nextErrors).length > 0) return;

    setSaving(true);
    try {
      await updateUserProfile(targetUid, {
        displayName,
        bio,
        skills,
        hourlyRate,
        isServiceProvider,
        priceAfterQuote,
        society,
        locality,
        tower,
        flatNumber,
        phoneNumber: normalizedPhone,
      });
      void logActivity(targetUid, "user.profile_update", `Profile updated: ${displayName}`, {
        isServiceProvider,
        skillCount: skills.length,
        society,
        adminViewAs: isAdminViewAs,
      });
      setSaved(true);
      if (savedTimerRef.current) {
        clearTimeout(savedTimerRef.current);
      }
      savedTimerRef.current = setTimeout(() => setSaved(false), 2500);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Profile save failed. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const addSkill = (skill: string) => {
    const trimmed = skill.trim();
    if (trimmed && !skills.includes(trimmed)) setSkills(prev => [...prev, trimmed]);
    setNewSkill("");
  };

  const removeSkill = (skill: string) => setSkills(prev => prev.filter(item => item !== skill));

  const handleServiceSave = async () => {
    if (!targetUid || !svcTitle.trim() || isAdminViewAs) return;
    if (targetProfile?.residentVerificationStatus !== "verified") {
      alert("Residency verification is required before listing services.");
      return;
    }

    // Business category: auto-activate trial if user has no active subscription
    if (isBusinessCategory(svcCategory) && !isSubActive(sub)) {
      try {
        const newSub = await activateTrial(targetUid);
        setSub(newSub);
        // Wait 500ms for Firestore denorm to propagate
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "";
        // TRIAL_ALREADY_USED or ACTIVE_SUB_EXISTS: check again whether sub is now active
        if (msg !== "TRIAL_ALREADY_USED" && msg !== "ACTIVE_SUB_EXISTS") {
          alert("Business category listings require an active subscription. Please subscribe from your Wallet.");
          return;
        }
        // Re-fetch sub in case it exists but wasn't loaded
        try {
          const refreshed = await getSubscription(targetUid);
          setSub(refreshed);
          if (!isSubActive(refreshed)) {
            alert("Business category listings require an active subscription. Please subscribe from your Wallet.");
            return;
          }
        } catch {
          alert("Business category listings require an active subscription. Please subscribe from your Wallet.");
          return;
        }
      }
    }

    const payload = {
      userId: targetUid,
      title: svcTitle,
      description: svcDesc,
      price: (svcFeeType === "hourly" || svcFeeType === "monthly") ? Number(svcPrice) : 0,
      isFree: svcFeeType === "free",
      quoteBased: svcFeeType === "quote",
      feeType: svcFeeType,
      category: svcCategory,
    };

    if (editingServiceId) {
      await updateService(editingServiceId, payload);
    } else {
      try {
        await createService(payload);
      } catch (err: any) {
        alert(err.message || "Failed to create service.");
        return;
      }
    }

    const updated = await getServicesByUser(targetUid).catch((err) => {
      console.error("Failed to refresh services:", err);
      return services;
    });
    setServices(updated);
    setSvcTitle("");
    setSvcDesc("");
    setSvcPrice("");
    setSvcFeeType("free");
    setSvcCategory("");
    setSvcCategoryGroup("");
    setEditingServiceId(null);
    setShowServiceForm(false);
  };

  const startEditService = (service: Record<string, unknown>) => {
    if (isAdminViewAs) return;
    setEditingServiceId(service.id as string);
    setSvcTitle((service.title as string) || "");
    setSvcDesc((service.description as string) || "");
    
    // Determine fee type from service data
    let feeType: "free" | "quote" | "hourly" | "monthly" = "free";
    const feeTypeField = (service.feeType as string) || "";
    const price = Number(service.price) || 0;
    const quoteBased = Boolean(service.quoteBased);
    const isFree = Boolean(service.isFree) || price === 0;
    
    if (feeTypeField === "monthly") {
      feeType = "monthly";
    } else if (feeTypeField === "hourly") {
      feeType = "hourly";
    } else if (quoteBased) {
      feeType = "quote";
    } else if (isFree) {
      feeType = "free";
    }
    
    setSvcFeeType(feeType);
    setSvcPrice(String(price));
    const cat = (service.category as string) || "";
    setSvcCategory(cat);
    // Find group for this category
    let foundGroup = "";
    for (const [group, cats] of Object.entries(CATEGORY_GROUPS)) {
      if (cats.includes(cat)) {
        foundGroup = group;
        break;
      }
    }
    setSvcCategoryGroup(foundGroup);
    setShowServiceForm(true);
  };

  const handleDeleteService = async (id: string) => {
    if (isAdminViewAs) return;
    await deleteService(id);
    setServices(prev => prev.filter(service => service.id !== id));
  };

  const targetEmail = (targetProfile?.email as string) || user?.email || "";
  const verificationStatus = (targetProfile?.residentVerificationStatus as string) || "none";
  const proofUrl = getDeliverableProofUrl(
    targetProfile?.residencyProofUrl || targetProfile?.residencyProofPreviewUrl
  );
  const rejectionNote = typeof targetProfile?.verificationReviewNote === "string" ? targetProfile.verificationReviewNote.trim() : "";
  const hasRejectedProof = verificationStatus === "none" && Boolean(proofUrl) && Boolean(rejectionNote);
  const canDeleteProof = Boolean(proofUrl) && verificationStatus !== "verified" && !isAdminViewAs;

  const handleDeleteProof = async () => {
    if (!targetUid || !canDeleteProof) return;
    const ok = window.confirm("Delete uploaded residency proof? You can upload a new document after this.");
    if (!ok) return;

    setDeletingProof(true);
    try {
      await deleteResidencyProof(targetUid);
      void logActivity(targetUid, "verification.submitted", "Residency proof deleted");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to delete residency proof.");
    } finally {
      setDeletingProof(false);
    }
  };

  return (
    <div style={{ maxWidth: 680, margin: "0 auto" }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">{isAdminViewAs ? "User Profile" : "My Profile"}</h1>
          <p className="page-subtitle">{isAdminViewAs ? "Admin access session for this user profile" : "Manage your professional profile"}</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 20 }}>
        <div style={{ position: "relative" }}>
          <div className="avatar avatar-xl avatar-upload" style={{ position: "relative", overflow: "hidden" }}>
            {targetProfile?.photoURL ? (
              <img src={targetProfile.photoURL as string} alt="" loading="lazy" />
            ) : (
              (displayName || "?").split(" ").map(word => word[0]).join("").slice(0, 2).toUpperCase()
            )}
            <label className="avatar-upload-overlay" style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", cursor: isAdminViewAs ? "not-allowed" : "pointer", opacity: 0, transition: "opacity 0.2s" }}>
              <span style={{ fontSize: 24 }}>+</span>
              <input type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: "none" }} disabled={uploadingPhoto || isAdminViewAs} />
            </label>
          </div>
          {isServiceProvider && (
            <div className="provider-badge" style={{ position: "absolute", bottom: -2, right: -2, background: "var(--success)", color: "#000", width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid var(--surface)", fontSize: 12, fontWeight: "bold", zIndex: 1 }} title="Service Provider">OK</div>
          )}
        </div>
        <div>
          <h3>{displayName || "Your Name"}</h3>
          <p className="text-muted text-sm">{targetEmail}</p>
          {userProfile?.role === "admin" && <span className="badge badge-accent" style={{ marginTop: 6 }}>Admin</span>}
          {isAdminViewAs && <p className="text-muted text-sm" style={{ marginTop: 6 }}>Photo and proof uploads are disabled in Login As mode.</p>}
        </div>
      </div>

      <form onSubmit={handleSave}>
        <div className="card" style={{ marginTop: 32, marginBottom: errors.serviceProvider ? 8 : 32, display: "flex", alignItems: "center", justifyContent: "space-between", border: errors.serviceProvider ? "1px solid var(--error)" : isServiceProvider ? "1px solid var(--success)" : "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ fontSize: 24, color: isServiceProvider ? "var(--success)" : "var(--muted)" }}>SP</div>
            <div>
              <h3 className="card-title">Enable Service Provider Mode</h3>
              <p className="text-muted text-sm">Turn this on to list your skills and offer services to the community.</p>
            </div>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={isServiceProvider}
              onChange={(event) => {
                const next = event.target.checked;
                if (next && targetProfile?.residentVerificationStatus !== "verified") {
                  alert("Residency verification is mandatory before enabling Service Provider mode.");
                  return;
                }
                setIsServiceProvider(next);
              }}
              disabled={isAdminViewAs}
              aria-label="Enable Service Provider Mode"
            />
            <span className={`slider ${isAdminViewAs ? 'disabled' : ''}`}>
              <span className="slider-round" />
            </span>
          </label>
        </div>
        {errors.serviceProvider && <div className="text-sm" style={{ color: "var(--error)", marginBottom: 32 }}>{errors.serviceProvider}</div>}

        <div className="card" style={{ marginBottom: 24 }}>
          <h3 className="card-title" style={{ marginBottom: 16 }}>Basic Information</h3>

          <div className="form-group">
            <label className="form-label">Display Name <span style={{ color: "var(--error)" }}>*</span></label>
            <input className="form-input" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Your full name" id="profile-name-input" />
            {errors.displayName && <div className="text-sm" style={{ color: "var(--error)", marginTop: 4 }}>{errors.displayName}</div>}
          </div>

          <div className="form-group">
            <label className="form-label">Email ID</label>
            <input className="form-input" value={targetEmail} readOnly disabled id="profile-email-input" />
            <p className="text-muted" style={{ fontSize: "0.75rem", marginTop: 4 }}>Auto-filled from signup and cannot be edited.</p>
          </div>

          <div className="form-group">
            <label className="form-label">Phone Number <span style={{ color: "var(--error)" }}>*</span></label>
            <input
              className="form-input"
              value={phoneNumber}
              onChange={(event) => {
                let value = event.target.value;
                if (!value.startsWith("+91-")) value = "+91-" + value.replace(/^\+?91?-?/, "");
                const suffix = value.slice(4).replace(/\D/g, "").slice(0, 10);
                setPhoneNumber(`+91-${suffix}`);
              }}
              placeholder="+91-9876543210"
              id="profile-phone-input"
              maxLength={14}
            />
            <p className="text-muted" style={{ fontSize: "0.75rem", marginTop: 4 }}>You can hide or unhide your mobile number in Privacy settings.</p>
            {errors.phoneNumber && <div className="text-sm" style={{ color: "var(--error)", marginTop: 4 }}>{errors.phoneNumber}</div>}
          </div>

          <div className="form-group">
            <label className="form-label">Bio <span style={{ color: "var(--muted)", fontSize: "0.75rem", fontWeight: "normal" }}>(optional)</span></label>
            <textarea className="form-input" value={bio} onChange={(event) => setBio(event.target.value)} placeholder="Tell your neighbors about your professional background in 1-2 sentences." id="profile-bio-input" rows={3} maxLength={500} />
            <p className="text-muted" style={{ fontSize: "0.75rem", marginTop: 4, textAlign: "right" }}>{bio.length}/500</p>
            {errors.bio && <div className="text-sm" style={{ color: "var(--error)", marginTop: 4 }}>{errors.bio}</div>}
          </div>
        </div>

        <div className="card" style={{ marginBottom: 24 }}>
          <h3 className="card-title" style={{ marginBottom: 16 }}>Residence Information</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div className="form-group" style={{ gridColumn: "1 / -1" }}>
              <label className="form-label">Society <span style={{ color: "var(--error)" }}>*</span></label>
              <select
                className="form-input"
                value={society}
                onChange={(event) => {
                  setSociety(event.target.value);
                  const selected = societies.find(item => item.name === event.target.value);
                  if (selected) setLocality(((selected.locality as string) || (selected.city as string) || "").trim());
                }}
                id="profile-society-select"
              >
                <option value="">Select your society...</option>
                {societies.map(item => (
                  <option key={item.id as string} value={item.name as string}>{item.name as string}</option>
                ))}
              </select>
              {errors.society && <div className="text-sm" style={{ color: "var(--error)", marginTop: 4 }}>{errors.society}</div>}
            </div>
            <div className="form-group">
              <label className="form-label">Tower / Wing <span style={{ color: "var(--error)" }}>*</span></label>
              <input className="form-input" value={tower} onChange={(event) => setTower(event.target.value)} placeholder="e.g., Tower A" id="profile-tower-input" />
              {errors.tower && <div className="text-sm" style={{ color: "var(--error)", marginTop: 4 }}>{errors.tower}</div>}
            </div>
            <div className="form-group">
              <label className="form-label">Flat Number <span style={{ color: "var(--error)" }}>*</span></label>
              <input className="form-input" value={flatNumber} onChange={(event) => setFlatNumber(event.target.value)} placeholder="e.g., 402" id="profile-flat-input" />
              {errors.flatNumber && <div className="text-sm" style={{ color: "var(--error)", marginTop: 4 }}>{errors.flatNumber}</div>}
            </div>
            <div className="form-group" style={{ gridColumn: "1 / -1" }}>
              <label className="form-label">Locality</label>
              <input
                className="form-input"
                value={locality}
                readOnly
                placeholder="Auto-filled from selected society"
                id="profile-locality-input"
              />
              <p className="text-muted" style={{ fontSize: "0.75rem", marginTop: 4 }}>
                Auto-filled based on society name.
              </p>
            </div>
          </div>

          <div style={{ borderTop: "1px solid var(--border)", marginTop: 16, paddingTop: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div>
                <label className="form-label" style={{ marginBottom: 4 }}>Residency Proof</label>
                <p className="text-muted" style={{ fontSize: 12, margin: 0 }}>Upload a clear JPG, PNG, WebP, PDF, or DOC document.</p>
              </div>
              {verificationStatus === "verified" && <span className="badge badge-success" style={{ fontSize: 11 }}>Verified Resident</span>}
              {verificationStatus === "pending" && <span className="badge badge-warning" style={{ fontSize: 11 }}>Pending Review</span>}
              {hasRejectedProof && <span className="badge badge-error" style={{ fontSize: 11 }}>Rejected</span>}
            </div>
            {hasRejectedProof && (
              <div style={{ marginBottom: 10, padding: 10, border: "1px solid rgba(255, 92, 92, 0.25)", borderRadius: 6, background: "rgba(255, 92, 92, 0.08)", fontSize: 12 }}>
                <strong style={{ color: "var(--error)" }}>Reason: </strong>
                <span>{rejectionNote}</span>
              </div>
            )}
            {proofUrl && (
              <div style={{ marginBottom: 8, fontSize: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <a
                  href={proofUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "var(--accent)" }}
                >View uploaded proof</a>
                {canDeleteProof && (
                  <button type="button" className="btn btn-danger btn-sm" onClick={handleDeleteProof} disabled={deletingProof || uploadingProof}>
                    {deletingProof ? "Deleting..." : "Delete proof"}
                  </button>
                )}
              </div>
            )}
            <label style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: uploadingProof || isAdminViewAs ? "default" : "pointer", padding: "8px 16px", border: "1px dashed var(--border)", borderRadius: "var(--radius-sm)", fontSize: 13, color: "var(--muted)" }}>
              {uploadingProof ? "Uploading..." : isAdminViewAs ? "Upload disabled in Login As mode" : "Upload proof document"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                style={{ display: "none" }}
                disabled={uploadingProof || isAdminViewAs}
                onChange={async (event) => {
                        const file = event.target.files?.[0];
                  if (!file || !targetUid || isAdminViewAs) return;
                  
                  if (file.size > 10 * 1024 * 1024) {
                    alert("Proof document is too large. Max size is 10MB.");
                    return;
                  }

                  const allowedTypes = [
                    "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif",
                    "application/pdf", "application/msword",
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  ];

                  // Fallback to file extension check if MIME type is missing or incorrect (common on some mobile devices)
                  const fileName = file.name.toLowerCase();
                  const isAllowedExtension = /\.(jpe?g|png|webp|heic|heif|pdf|docx?)$/i.test(fileName);
                  const isAllowedType = allowedTypes.includes(file.type) || (!file.type && isAllowedExtension);

                  if (!isAllowedType) {
                    alert("Invalid file type. Accepted: JPG, PNG, WebP, PDF, DOC, DOCX.");
                    return;
                  }

                  setUploadingProof(true);
                  try {
                    await uploadResidencyProof(targetUid, file);
                    void logActivity(targetUid, "verification.submitted", `Residency proof uploaded: ${file.name}`, { fileName: file.name, fileSize: file.size });
                  } catch (error) {
                    alert(error instanceof Error ? error.message : "Upload failed. Please try again.");
                  } finally {
                    setUploadingProof(false);
                  }
                }}
              />
            </label>
          </div>
        </div>

        {isServiceProvider && (
          <div className="card" style={{ marginBottom: 24 }}>
            <h3 className="card-title" style={{ marginBottom: 16 }}>Skills & Expertise</h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
              {skills.map(skill => (
                <span className="skill-tag" key={skill} style={{ cursor: isAdminViewAs ? "default" : "pointer" }} onClick={() => !isAdminViewAs && removeSkill(skill)}>
                  {skill}{isAdminViewAs ? "" : " x"}
                </span>
              ))}
            </div>
            {!isAdminViewAs && (
              <>
                <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                  <input
                    className="form-input"
                    value={newSkill}
                    onChange={(event) => setNewSkill(event.target.value)}
                    placeholder="Add a skill..."
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addSkill(newSkill);
                      }
                    }}
                    style={{ flex: 1 }}
                    id="profile-skill-input"
                  />
                  <button type="button" className="btn btn-secondary" onClick={() => addSkill(newSkill)}>Add</button>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {SKILL_SUGGESTIONS.filter(skill => !skills.includes(skill)).slice(0, 10).map(skill => (
                    <button type="button" key={skill} className="chip" onClick={() => addSkill(skill)} style={{ fontSize: 11 }}>+ {skill}</button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {saveError && <div className="error-box" style={{ marginBottom: 16 }}>{saveError}</div>}
        {saved && (
          <div style={{ background: "var(--accent2-dim)", border: "1px solid rgba(0,229,176,0.3)", color: "var(--accent2)", padding: "10px 16px", borderRadius: "var(--radius)", fontSize: 14, fontWeight: 500, marginBottom: 16 }}>
            Profile saved successfully.
          </div>
        )}

        <button className="btn btn-primary btn-lg" type="submit" disabled={saving} style={{ width: "100%", marginBottom: 32 }}>
          {saving ? "Saving..." : "Save Profile"}
        </button>
      </form>

      {isServiceProvider && !isAdminViewAs && (
        <SubscriptionBanner sub={sub} onChoosePlan={() => setShowSubscribeSheet(true)} />
      )}

      {isServiceProvider && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header">
            <h3 className="card-title">My Services</h3>
            {!isAdminViewAs && (
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
            )}
          </div>

          {showServiceForm && !isAdminViewAs && (
            <div style={{ marginBottom: 20, padding: 16, background: "var(--surface-2)", borderRadius: "var(--radius-sm)" }}>
              {svcCategory && isBusinessCategory(svcCategory) && !isSubActive(sub) && (
                <div style={{ 
                  marginBottom: 16, 
                  padding: "12px 16px", 
                  background: "rgba(27,107,138,0.1)", 
                  border: "1px solid rgba(27,107,138,0.3)", 
                  borderRadius: "var(--radius-sm)", 
                  fontSize: "0.88rem",
                  color: "#1B6B8A"
                }}>
                  <strong>💳 Subscription Required:</strong> Business category listings require an active monthly subscription.
                  <span> <a href="/wallet" style={{ color: "#1B6B8A", textDecoration: "underline" }}>Subscribe now</a> to activate your listing.</span>
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Service Category</label>
                  <select className="form-input" value={svcCategoryGroup} onChange={(event) => { setSvcCategoryGroup(event.target.value); setSvcCategory(""); }} id="svc-category-group-select">
                    <option value="">Select category...</option>
                    {Object.keys(CATEGORY_GROUPS).map(group => <option key={group} value={group}>{group}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Service Name</label>
                  <select className="form-input" value={svcCategory} onChange={(event) => setSvcCategory(event.target.value)} id="svc-category-select" disabled={!svcCategoryGroup}>
                    <option value="">Select a service...</option>
                    {svcCategoryGroup && CATEGORY_GROUPS[svcCategoryGroup]?.map(category => <option key={category} value={category}>{category}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Service Title</label>
                <input className="form-input" value={svcTitle} onChange={(event) => setSvcTitle(event.target.value)} placeholder="e.g., ITR Filing, Yoga Sessions, JEE Maths" id="svc-title-input" />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea className="form-input" value={svcDesc} onChange={(event) => setSvcDesc(event.target.value)} placeholder="What does this service include?" id="svc-desc-input" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Fee Type</label>
                  <select className="form-input" value={svcFeeType} onChange={(event) => setSvcFeeType(event.target.value as "free" | "quote" | "hourly" | "monthly")} id="svc-fee-type-select">
                    <option value="free">Free</option>
                    <option value="quote">Quote-based</option>
                    <option value="hourly">Hourly Fee</option>
                    <option value="monthly">Monthly Fee</option>
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Amount (NC)</label>
                  <input type="number" className="form-input" value={svcPrice} onChange={(event) => setSvcPrice(event.target.value)} min={0} disabled={svcFeeType !== "hourly" && svcFeeType !== "monthly"} id="svc-price-input" placeholder={svcFeeType === "hourly" || svcFeeType === "monthly" ? "Enter amount" : "N/A"} />
                </div>
              </div>
              {svcFeeType === "quote" && (
                <div style={{ fontSize: "0.85rem", color: "var(--muted)", marginTop: 8, marginBottom: 12 }}>
                  💡 Quote-based: You'll provide a custom quote after discussing requirements with the client.
                </div>
              )}
              {svcFeeType === "free" && (
                <div style={{ fontSize: "0.85rem", color: "var(--muted)", marginTop: 8, marginBottom: 12 }}>
                  💡 Free services help build credibility and boost your visibility in the community.
                </div>
              )}
              <div style={{ marginTop: 16 }} />
              <button className="btn btn-success" onClick={handleServiceSave} disabled={!svcTitle.trim()}>
                {editingServiceId ? "Update Service" : "Save Service"}
              </button>
            </div>
          )}

          {services.length === 0 && !showServiceForm ? (
            <p className="text-muted">No services listed yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {services.map(service => (
                <div key={service.id as string} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", background: "var(--surface-2)", borderRadius: "var(--radius-sm)" }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{service.title as string}</div>
                    <div className="text-muted text-sm">
                      {service.quoteBased ? "Quote-based" : (service.isFree || (service.price as number) === 0) ? "Free" : (service.feeType === "monthly") ? `${service.price} NC/mo` : `${service.price} NC/hr`}
                      {service.category ? <span style={{ marginLeft: 8 }} className="badge badge-muted">{service.category as string}</span> : null}
                    </div>
                  </div>
                  {!isAdminViewAs && (
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => startEditService(service)}>Edit</button>
                      <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDeleteService(service.id as string)} title="Delete">X</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {isServiceProvider && !isAdminViewAs && (
            <div style={{ marginTop: 24, padding: 16, background: "rgba(27,107,138,0.05)", border: "1px solid rgba(27,107,138,0.2)", borderRadius: "var(--radius-sm)", fontSize: "0.88rem" }}>
              <div style={{ fontWeight: 700, marginBottom: 8, color: "#1B6B8A" }}>💡 Pro Tips</div>
              <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.8, color: "var(--text)" }}>
                <li>Offer at least one free consultation to build trust and credibility</li>
                <li>Respond to booking requests within 24 hours for better visibility</li>
                <li>Complete your profile with skills, bio, and a professional photo</li>
                <li>Encourage clients to leave reviews after completed sessions</li>
                <li>Free services get 3x more visibility in search results</li>
              </ul>
            </div>
          )}
        </div>
      )}

      {showSubscribeSheet && !isAdminViewAs && targetUid && (
        <SubscribeSheet
          uid={targetUid}
          cashableBalance={((targetProfile as unknown as Record<string, unknown>)?.cashableBalance as number) ?? 0}
          trialUsed={((targetProfile as unknown as Record<string, unknown>)?.trialUsed as boolean) ?? false}
          onClose={() => setShowSubscribeSheet(false)}
          onSuccess={() => {
            setShowSubscribeSheet(false);
            void fetchSub();
          }}
        />
      )}
    </div>
  );
}
