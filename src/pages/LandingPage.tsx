import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import "./LandingPage.css";
import { getPlatformSettings } from "../services/firestoreService";
import { DEFAULT_SERVICE_CATEGORIES, normalizeServiceCategories, CATEGORY_GROUPS, SERVICE_CATEGORY_ICONS } from "../constants/serviceCatalog";

function useIsMobile() {
  const [m, setM] = useState(() => (typeof window !== "undefined" ? window.innerWidth <= 768 : false));
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 768px)");
    const h = (e: MediaQueryListEvent) => setM(e.matches);
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", h);
      return () => mq.removeEventListener("change", h);
    }
    mq.addListener(h);
    return () => mq.removeListener(h);
  }, []);
  return m;
}

/* ── tiny shared helpers ── */
function Tag({ children, dark, orange }: { children: React.ReactNode; dark?: boolean; orange?: boolean }) {
  const className = `lp-tag ${orange ? "lp-tag-orange" : dark ? "lp-tag-dark" : "lp-tag-default"}`;
  return <h2 className={className}>{children}</h2>;
}

export default function LandingPage() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [societyModalOpen, setSocietyModalOpen] = useState(false);
  const [societyForm, setSocietyForm] = useState({
    fullName: "",
    email: "",
    societyName: "",
    area: "",
    city: "",
    pinCode: "",
  });
  const [tab, setTab] = useState("resident");
  const [counter, setCounter] = useState(0);
  const [serviceCategories, setServiceCategories] = useState<string[]>(DEFAULT_SERVICE_CATEGORIES);
  const adminEmail = "support@proneighbor.com";

  useEffect(() => {
    if (typeof window === "undefined") return;
    const h = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", h);
    return () => window.removeEventListener("scroll", h);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const obs = new IntersectionObserver(
      (entries) => entries.forEach(e => {
        if (e.isIntersecting) {
          (e.target as HTMLElement).style.opacity = "1";
          (e.target as HTMLElement).style.transform = "translateY(0)";
          obs.unobserve(e.target);
        }
      }),
      { threshold: 0.08 }
    );
    document.querySelectorAll(".lp-reveal").forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    // Animate counter from 0 to 24
    const end = 24;
    const duration = 2000; // 2 seconds
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const ease = 1 - Math.pow(1 - progress, 3);
      const current = Math.floor(ease * end);
      setCounter(current);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    getPlatformSettings()
      .then((settings) => {
        setServiceCategories(normalizeServiceCategories(settings.serviceCategories));
      })
      .catch(() => {
        setServiceCategories(DEFAULT_SERVICE_CATEGORIES);
      });
  }, []);

  const scrollTo = (id: string) => {
    setMobileMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  const px = isMobile ? "5%" : "6%";
  const navLinks: [string, string][] = [["How It Works", "how"], ["Features", "features"], ["Services", "categories"], ["Early Access", "early"]];

  // Generate service groups from CATEGORY_GROUPS
  const groupHeadings: Record<string, { heading: string; subtitle: string; comingSoon: boolean }> = {
    "Business": {
      heading: "Business - Learn, grow, repeat.",
      subtitle: "Weekly or monthly commitments with pros in your society.",
      comingSoon: false,
    },
    "Services": {
      heading: "Services - Everyday needs, one flat away.",
      subtitle: "On-demand help from neighbours you already trust.",
      comingSoon: false,
    },
    "E-Commerce": {
      heading: "E-Commerce - Turn your hobby into a hustle.",
      subtitle: "Society-based micro-businesses coming to your app soon.",
      comingSoon: true,
    },
  };

  const groupTagIcons: Record<string, string> = {
    "Business": "🔄",
    "Services": "🏠",
    "E-Commerce": "🛍️",
  };

  const serviceGroups = Object.entries(CATEGORY_GROUPS).map(([groupName, categories]) => ({
    tag: groupName.toLowerCase(),
    heading: groupHeadings[groupName]?.heading || groupName,
    subtitle: groupHeadings[groupName]?.subtitle || "",
    comingSoon: groupHeadings[groupName]?.comingSoon || false,
    items: categories.map((cat) => ({
      icon: SERVICE_CATEGORY_ICONS[cat] || "✨",
      label: cat,
    })),
  }));

  const residentSteps = [
    ["01", "🏠", "Join Your Society", "Sign up with your society code. Only genuine residents and pros get in."],
    ["02", "🔍", "Browse & Filter", "Search by category, rating, price, or availability. See neighbour endorsements."],
    ["03", "✅", "Book Instantly", "Confirm your booking, pay securely via NeighbourCoins or UPI, and leave a review after the session. Your neighbour's reputation grows with every 5-star experience."],
  ];

  const proSteps = [
    ["01", "👤", "Build Your Profile", "Upload credentials, set service categories, add intro video or photo gallery. Get your Verified Pro Badge within 48 hours."],
    ["02", "📅", "Receive Bookings", "Residents in your society discover and book you directly. Accept, reschedule, or decline — you control your calendar."],
    ["03", "💰", "Earn & Grow", "Complete sessions, collect NeighbourCoins and UPI payouts, build reviews. Top-rated Pros get featured placement."],
  ];

  const submitSocietyRequest = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const subject = encodeURIComponent(`Society launch request: ${societyForm.societyName || "New society"}`);
    const body = encodeURIComponent(
      [
        `Dear ${societyForm.fullName}`,
        "Thank you for your interest. Please send this email to submit your society registration request. You will be among the first to be notified when we decide to launch our services in your society.",
        "",
        "Captured details:",
        `Full name: ${societyForm.fullName}`,
        `Email: ${societyForm.email}`,
        `Society name: ${societyForm.societyName}`,
        `Area/Locality: ${societyForm.area}`,
        `City: ${societyForm.city}`,
        `Pin code: ${societyForm.pinCode}`,
      ].join("\n")
    );

    window.location.href = `mailto:${adminEmail}?subject=${subject}&body=${body}`;
    setSocietyModalOpen(false);
  };

  return (
    <div id="lp-root">
      {/* ── NAV ── */}
      <nav className={`lp-nav ${scrolled ? "lp-nav-scrolled" : ""}`} style={{ padding: `0 ${px}`, height: isMobile ? 52 : 62 }}>
        <a href="#" className="lp-logo">
          <img src="/images/logo_new.png" alt="PN" loading="lazy" style={{ height: isMobile ? 32 : 38, borderRadius: 6 }} />
          <span className="lp-logo-text" style={{ fontSize: isMobile ? "1rem" : "1.1rem" }}>
            Pro<span className="lp-logo-accent">Neighbor</span>
          </span>
        </a>

        {/* Desktop links */}
        {!isMobile && (
          <div className="lp-nav-links">
            {navLinks.map(([label, id]) => (
              <button key={id} onClick={() => scrollTo(id)} className="lp-nav-link">{label}</button>
            ))}
            <button onClick={() => navigate("/register")} className="lp-btn-primary lp-nav-btn-register">Register as Expert</button>
            <button onClick={() => navigate("/login")} className="lp-btn-secondary lp-nav-btn-signin">Sign In</button>
          </div>
        )}

        {/* Mobile: Sign In + hamburger */}
        {isMobile && (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={() => navigate("/login")} className="lp-btn-secondary lp-nav-btn-signin" style={{ padding: "7px 14px", fontSize: "0.8rem" }}>Sign In</button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={mobileMenuOpen ? true : false}
              aria-controls="landing-mobile-menu"
              style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}
            >
              {mobileMenuOpen
                ? <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0C1B2E" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12" /></svg>
                : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0C1B2E" strokeWidth="2.5"><path d="M3 12h18M3 6h18M3 18h18" /></svg>}
            </button>
          </div>
        )}
      </nav>

      {/* Mobile drawer */}
      {isMobile && mobileMenuOpen && (
        <div id="landing-mobile-menu" style={{ position: "fixed", top: 60, left: 0, right: 0, zIndex: 190, background: "#fff", borderBottom: "1px solid rgba(0,0,0,0.08)", padding: "16px 5%", boxShadow: "0 8px 24px rgba(0,0,0,0.1)" }}>
          {navLinks.map(([label, id]) => (
            <button key={id} onClick={() => scrollTo(id)} style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", color: "#0C1B2E", fontWeight: 600, fontSize: "1rem", cursor: "pointer", fontFamily: "inherit", padding: "12px 0", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>{label}</button>
          ))}
          <button onClick={() => { setMobileMenuOpen(false); navigate("/register"); }} style={{ display: "block", width: "100%", marginTop: 16, background: "linear-gradient(135deg,#F5692C,#E8450A)", color: "#fff", border: "none", padding: "14px", borderRadius: 50, fontWeight: 700, fontSize: "1rem", cursor: "pointer" }}>Register as Expert</button>
        </div>
      )}

      {/* ── HERO ── */}
      <section className="lp-hero" style={{
        minHeight: isMobile ? "100dvh" : "100vh",
        background: isMobile
          ? `linear-gradient(to bottom right, rgba(11,27,46,0.92) 0%, rgba(15,78,104,0.82) 60%, rgba(0,0,0,0.55) 100%), url('/images/hero-bg.jpg') center/cover no-repeat`
          : `linear-gradient(to bottom right, rgba(11,27,46,0.85) 0%, rgba(15,78,104,0.65) 60%, rgba(0,0,0,0.3) 100%), url('/images/hero-bg.jpg') center/cover no-repeat`,
        padding: isMobile ? `${52 + 20}px ${px} 36px` : `90px ${px} 60px`,
      }}>
        <div className="lp-hero-overlay" style={{ height: isMobile ? 60 : 100 }} />

        {/* Two-col on desktop, single col on mobile */}
        <div className="lp-hero-container" style={{ gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? 32 : 60 }}>
          {/* Text */}
          <div>
            <div className="lp-hero-badge">
              <span className="lp-hero-badge-dot" />
              Launching May 2026 · Park Street, Wakad
            </div>
            <h1 className="lp-h1">
              Your Society's<br />Professionals Network,<br /><span className="lp-logo-accent">Right here.</span>
            </h1>
            <p className="lp-p-hero">
              Connect with verified professionals who live in your gated community. CA, doctor, yoga, tutor — booked in minutes.
            </p>
            <div className="lp-hero-join-wrap">
              <div className="lp-sub-label lp-sub-label-hero">Get notified when Park Street goes live</div>
              <div className="lp-hero-btns">
                <button onClick={() => navigate("/register")} className="lp-btn-primary lp-btn-hero-primary" style={{ padding: isMobile ? "12px 24px" : "14px 32px" }}>
                  Join Waitlist
                </button>
              </div>
            </div>
            <div className="lp-waitlist-counter">
              <div className="lp-progress-bar-wrap">
                <div className="lp-progress-bar" style={{ width: `${(counter / 200) * 100}%` }} />
              </div>
              <span className="lp-waitlist-label">{counter} / 200 founding spots claimed</span>
            </div>
            <div className="lp-hero-expansion-stack" style={{ marginTop: 14, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
              <span className="lp-hero-expansion-text">Not from Park Street?</span>
              <button
                type="button"
                onClick={() => setSocietyModalOpen(true)}
                className="lp-hero-expansion-link"
                style={{ marginTop: 4, cursor: "pointer", textAlign: "left" }}
              >
                &rarr; Register your society for the next launch
              </button>
            </div>
          </div>

          {/* Image panel — hidden on mobile (hero bg is enough) */}
          {!isMobile && (
            <div className="lp-hero-image-grid">
              <div className="lp-hero-image-main">
                <img src="/images/2.jpg" alt="Community" loading="lazy" style={{ width: "100%", display: "block", objectFit: "cover", height: 300 }} />
              </div>
              <div className="lp-hero-features-grid">
                {[["⚡", "Instant Booking", "Book real-time slots"], ["🔒", "Society-Verified", "Lives in your community"]].map(([icon, title, desc]) => (
                  <div key={title} className="lp-hero-feature-card">
                    <div style={{ fontSize: "1.4rem", marginBottom: 8 }}>{icon}</div>
                    <h3 style={{ display: "block", fontSize: "0.88rem", margin: "0 0 4px", fontWeight: 700, fontFamily: "inherit", lineHeight: 1.35 }}>{title}</h3>
                    <small style={{ fontSize: "0.75rem", opacity: 0.7 }}>{desc}</small>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── PROOF STRIP ── */}
      <div className="lp-proof-strip" style={{ padding: `16px ${px}` }}>
        <div className="lp-proof-container">
          {[["🏘️", "Pilot launch exclusive to Park Street, Wakad"], ["⭐", "Trusted by early adopters"], ["💼", "CA, Tuition, Yoga + 17 more"], ["🔐", "Verified residents only"], ["🪙", "NeighbourCoins Rewards"]].map(([icon, text]) => (
            <div key={text as string} className="lp-proof-item">
              <span>{icon}</span><span>{text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── HOW IT WORKS ── */}
      <section id="how" style={{ padding: `clamp(40px,6vw,72px) ${px}` }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <Tag>How It Works</Tag>
          <h2 className="lp-section-h2">From need to booking in under 15 minutes.</h2>
          <p className="lp-section-p">No cold calls. No WhatsApp forwards. A clean, trusted marketplace inside your gates.</p>
          <div style={{ marginBottom: 24 }}>
            <div className="lp-tabs">
              <button className={`lp-tab ${tab === "resident" ? "lp-tab-active" : ""}`} onClick={() => setTab("resident")}>I'm a Resident</button>
              <button className={`lp-tab ${tab === "pro" ? "lp-tab-active" : ""}`} onClick={() => setTab("pro")}>I'm a Professional</button>
            </div>
          </div>
          <div className="lp-steps-wrapper" style={{ gridTemplateColumns: isMobile ? "1fr" : "1fr auto 1fr auto 1fr", gap: isMobile ? 12 : 0 }}>
            {(tab === "resident" ? residentSteps : proSteps).map(([num, icon, title, desc], idx) => (
              <React.Fragment key={num as string}>
                <div className="lp-step-card" style={{ opacity: 1, transform: "none" }}>
                  <div className="lp-step-num">{num}</div>
                  <div className="lp-step-icon">{icon}</div>
                  <h3 style={{ fontSize: "clamp(0.95rem,3vw,1.1rem)", fontWeight: 700, marginBottom: 8, color: "#0C1B2E" }}>{title}</h3>
                  <p style={{ fontSize: "clamp(0.82rem,2.5vw,0.9rem)", color: "#5C6E84", lineHeight: 1.6 }}>{desc}</p>
                </div>
                {idx < 2 && !isMobile && (
                  <div className="lp-step-connector">
                    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="#1B6B8A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.4"/>
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA BAND ── */}
      <section id="pro" className="lp-cta-band" style={{ background: "linear-gradient(to right, rgba(11,27,46,0.92), rgba(15,78,104,0.8)), url('/images/cta-bg.jpg') center/cover", padding: `clamp(40px,6vw,64px) ${px}` }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <Tag dark orange>Register as Expert</Tag>
          <h2 className="lp-section-h2" style={{ color: "#fff", fontSize: "clamp(1.5rem,5vw,2.4rem)" }}>The professional network for <span className="lp-logo-accent">Park Street residents.</span></h2>
          <div className="lp-pro-benefits-row">
            {[
              ["🚫 Zero Commission", "3 months, then 15% flat - no surprises"],
              ["📅 Own Your Schedule", "Set availability, rates, and accept/decline freely"],
              ["⭐ Build Reputation", "Verified badges, reviews boost your discovery rank"],
            ].map(([title, desc]) => (
              <div key={title as string} className="lp-pro-benefit-card">
                <h3 className="lp-pro-benefit-title">{title}</h3>
                <span className="lp-pro-benefit-desc">{desc}</span>
              </div>
            ))}
          </div>
          <div className="lp-pro-trust-lines">
            <em>Verification completed within 48 hours</em>
            <em>Payouts every 7 days via UPI or bank transfer</em>
          </div>
          <button onClick={() => navigate("/register")} className="lp-btn-primary" style={{ padding: isMobile ? "14px 32px" : "16px 44px", fontSize: "clamp(0.92rem,3vw,1.1rem)", boxShadow: "0 6px 24px rgba(245,105,44,0.45)", width: isMobile ? "100%" : "auto" }}>
            Register as Expert
          </button>
        </div>
      </section>

      {/* ── APP MOCKUP ── */}
      <section id="app-mockup" style={{ background: "linear-gradient(180deg, #fff 0%, #F0F7FA 50%, #fff 100%)", padding: `clamp(56px,8vw,96px) ${px}`, overflow: "hidden" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? 48 : 80, alignItems: "center" }}>
            <div className="lp-reveal" style={{ order: isMobile ? 2 : 1 }}>
              <Tag>See It In Action</Tag>
              <h2 className="lp-section-h2">Discover pros who live<br />in your building.</h2>
              <p className="lp-section-p" style={{ marginBottom: 32 }}>
                See real-time availability, verified ratings, and neighbour endorsements - then book in one tap.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {[
                  { icon: "⭐", title: "Verified ratings & reviews", desc: "Only residents who completed bookings can review" },
                  { icon: "📅", title: "Real-time availability", desc: "See open slots today and book instantly" },
                  { icon: "🏘️", title: "Tower-level trust", desc: "Know exactly which building your pro lives in" },
                  { icon: "🪙", title: "Pay with NeighbourCoins", desc: "Earn coins on every booking, use them on the next" },
                ].map(({ icon, title, desc }) => (
                  <div key={title} style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0, background: "linear-gradient(135deg, rgba(13,107,107,0.12), rgba(27,107,138,0.08))", border: "1px solid rgba(13,107,107,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem" }}>{icon}</div>
                    <div>
                      <h3 style={{ margin: "0 0 2px", fontWeight: 700, fontSize: "0.92rem", color: "#0C1B2E", fontFamily: "inherit", lineHeight: 1.35 }}>{title}</h3>
                      <div style={{ fontSize: "0.8rem", color: "#5C6E84", lineHeight: 1.5 }}>{desc}</div>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={() => navigate("/browse")} className="lp-btn-primary" style={{ marginTop: 32, padding: "13px 28px", fontSize: "0.92rem", boxShadow: "0 6px 20px rgba(245,105,44,0.35)" }}>
                Browse Professionals →
              </button>
            </div>

            <div className="lp-reveal mockup-scene" style={{ order: isMobile ? 1 : 2, display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
              <div className="mockup-glow" />
              <div className="phone-frame">
                <div className="phone-notch" />
                <div className="phone-status-bar">
                  <span>9:41</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <svg width="14" height="10" viewBox="0 0 14 10" fill="rgba(255,255,255,0.8)"><rect x="0" y="4" width="2" height="6" rx="1" /><rect x="3" y="2" width="2" height="8" rx="1" /><rect x="6" y="0" width="2" height="10" rx="1" /><rect x="9" y="3" width="2" height="7" rx="1" opacity="0.3" /></svg>
                    <svg width="15" height="11" viewBox="0 0 15 11" fill="rgba(255,255,255,0.8)"><path d="M7.5 2.5C9.8 2.5 11.8 3.5 13.2 5L14.5 3.5C12.7 1.7 10.2 0.5 7.5 0.5C4.8 0.5 2.3 1.7 0.5 3.5L1.8 5C3.2 3.5 5.2 2.5 7.5 2.5Z" opacity="0.4" /><path d="M7.5 5.5C9 5.5 10.4 6.1 11.4 7.1L12.7 5.6C11.3 4.3 9.5 3.5 7.5 3.5C5.5 3.5 3.7 4.3 2.3 5.6L3.6 7.1C4.6 6.1 6 5.5 7.5 5.5Z" opacity="0.7" /><circle cx="7.5" cy="10" r="1.5" /></svg>
                    <svg width="24" height="12" viewBox="0 0 24 12" fill="none"><rect x="0.5" y="0.5" width="20" height="11" rx="2.5" stroke="rgba(255,255,255,0.5)" strokeWidth="1" /><rect x="2" y="2" width="15" height="8" rx="1.5" fill="rgba(255,255,255,0.85)" /><path d="M22 4.5V7.5C22.8 7.2 23.5 6.2 23.5 6C23.5 5.8 22.8 4.8 22 4.5Z" fill="rgba(255,255,255,0.5)" /></svg>
                  </div>
                </div>
                <div className="phone-screen">
                  <div className="app-topbar">
                    <div className="app-logo-mark">PN</div>
                    <span className="app-topbar-title">Browse Experts</span>
                    <div className="app-topbar-avatar">RK</div>
                  </div>
                  <div className="app-search">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2.5"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
                    <span>Search skill or name…</span>
                  </div>
                  <div className="app-chips">
                    {["All", "Yoga", "CA / Tax", "Health"].map((c, i) => (
                      <span key={c} className={`app-chip ${i === 1 ? "app-chip-active" : ""}`}>{c}</span>
                    ))}
                  </div>
                  <div className="app-results-label">4 experts near you · Tower B</div>
                  <div className="pro-card-mockup pro-card-featured">
                    <div className="pro-card-mockup-top">
                      <div className="pro-avatar pro-avatar-priya">PS</div>
                      <div className="pro-info">
                        <div className="pro-name">Priya Sharma <span className="pro-verified-badge">✓ Verified</span></div>
                        <div className="pro-meta">Yoga Coach · Tower B, Flat 402</div>
                        <div className="pro-rating-row"><span className="pro-stars">★★★★★</span><span className="pro-rating-num">4.9</span><span className="pro-review-count">(34 reviews)</span></div>
                      </div>
                      <div className="pro-price-block"><div className="pro-price">₹290</div><div className="pro-price-unit">/session</div></div>
                    </div>
                    <div className="pro-endorsement"><div className="endorsement-faces">{["MK", "RS", "AP"].map(e => <span key={e} className="e-face">{e}</span>)}</div><span className="endorsement-text">Trusted by 12 residents in Tower B</span></div>
                    <div className="pro-slots-row"><span className="pro-slots-label">Today</span>{["7:00 AM", "8:00 AM", "5:30 PM"].map((s, i) => <span key={s} className={`pro-slot ${i === 0 ? "pro-slot-active" : ""}`}>{s}</span>)}</div>
                    <button className="pro-book-btn">Book Now · 7:00 AM</button>
                  </div>
                  <div className="pro-card-mockup pro-card-compact">
                    <div className="pro-avatar pro-avatar-amit">AK</div>
                    <div className="pro-info" style={{ flex: 1 }}>
                      <div className="pro-name" style={{ fontSize: "0.75rem" }}>Amit Kumar <span className="pro-verified-badge">✓</span></div>
                      <div className="pro-meta">CA · Tax Filing · Tower A</div>
                      <div className="pro-rating-row"><span className="pro-stars" style={{ fontSize: "0.6rem" }}>★★★★★</span><span className="pro-rating-num" style={{ fontSize: "0.65rem" }}>4.8</span><span className="pro-review-count">(28)</span></div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                      <div className="pro-price" style={{ fontSize: "0.8rem" }}>₹0</div>
                      <div className="pro-price-unit">Free consult</div>
                      <button className="pro-book-btn-sm">Book</button>
                    </div>
                  </div>
                  <div className="app-bottom-nav">
                    {[
                      { icon: "🏠", label: "Home", active: false },
                      { icon: "🔍", label: "Browse", active: true },
                      { icon: "📅", label: "Bookings", active: false },
                      { icon: "💬", label: "Chat", active: false },
                      { icon: "👤", label: "Profile", active: false },
                    ].map(({ icon, label, active }) => (
                      <div key={label} className={`app-nav-item ${active ? "app-nav-active" : ""}`}>
                        <span className="app-nav-icon">{icon}</span>
                        <span className="app-nav-label">{label}</span>
                        {active && <div className="app-nav-pip" />}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <p className="mockup-caption">"Discover pros who live in your building - see ratings, availability, and book instantly."</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── CATEGORIES ── */}
      <section id="categories" style={{ background: "#F4F7FB", padding: `clamp(40px,6vw,64px) ${px}` }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <Tag>Service Categories</Tag>
          <h2 className="lp-section-h2">20+ categories, all inside your gates.</h2>
          <p className="lp-section-p">From tax filing to yoga — your society has more talent than you think.</p>

          <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 28 : 36, marginTop: 32 }}>
            {serviceGroups.map((group) => (
              <div key={group.tag} className="lp-cat-group lp-reveal" style={{ position: "relative" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                  <span style={{ fontSize: "1.1rem" }}>{groupTagIcons[group.tag] || "✨"}</span>
                  <h3 className="lp-cat-group-heading">{group.heading}</h3>
                  {group.comingSoon && <span className="lp-coming-soon">Coming Soon</span>}
                </div>
                <p className="lp-cat-group-subtitle">{group.subtitle}</p>
                <div
                  className="lp-cat-grid"
                  style={{
                    gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : `repeat(${Math.min(group.items.length, 4)}, 1fr)`,
                    gap: isMobile ? 8 : 14,
                  }}
                >
                  {group.items
                    .filter((item) => group.comingSoon || serviceCategories.includes(item.label))
                    .map((item) => (
                      <div
                        key={item.label}
                        className={`lp-cat-card${group.comingSoon ? " lp-cat-card--dim" : ""}`}
                        style={{ opacity: 1, transform: "none" }}
                      >
                        <span style={{ fontSize: isMobile ? "1.2rem" : "1.4rem" }}>{item.icon}</span>
                        <span style={{ fontSize: "clamp(0.78rem,2.5vw,0.88rem)", fontWeight: 600, color: "#0C1B2E" }}>{item.label}</span>
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className="lp-footer" style={{ padding: `clamp(40px,6vw,72px) ${px}` }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <Tag dark>Features</Tag>
          <h2 className="lp-section-h2" style={{ color: "#fff" }}>Built for how gated communities <em style={{ color: "#F5692C", fontStyle: "normal" }}>actually</em> work.</h2>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(3, 1fr)", gap: isMobile ? 8 : 20, marginTop: 24 }}>
            {[
              ["⚡", null, "Instant Slot Booking", "Real-time availability. Pick a slot, confirm instantly."],
              ["🔄", null, "Recurring Bookings", "Auto-books weekly yoga, monthly CA reviews."],
              ["🤝", null, "Neighbour Endorsements", "Endorsed by 4 neighbours in Tower B. Far more trusted."],
              ["🔐", null, "Verified Pro Badges", "🎓 Degree · 🪪 ID · ✅ Background checks."],
              ["🏠", null, "Society-Only Booking", "Only residents of your registered society can book."],
              ["🪙", null, "NeighbourCoins Wallet", "Earn NC credits on every booking. Redeem them for future services."],
            ].map(([icon, phase, title, desc]) => (
              <div key={title as string} className={`lp-feature-card-dark${phase ? " lp-phase2" : ""}`} style={{ opacity: 1, transform: "none", textAlign: "left" }}>
                <div style={{ fontSize: isMobile ? "1.5rem" : "1.8rem", marginBottom: 12 }}>{icon}</div>
                {phase && <div className="lp-feature-phase">{phase}</div>}
                <h3 style={{ fontSize: "clamp(0.9rem,3vw,1rem)", fontWeight: 700, marginBottom: 8, color: "#fff" }}>{title}</h3>
                <p style={{ fontSize: "clamp(0.8rem,2.5vw,0.86rem)", color: "rgba(255,255,255,0.58)", lineHeight: 1.6 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── EARLY ACCESS ── */}
      <section id="early" style={{ background: "linear-gradient(135deg,#FFF8F5,#F0F8FC)", padding: `clamp(40px,6vw,72px) ${px}` }}>
        <div className="lp-early-container" style={{ gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr" }}>
          {!isMobile && (
            <div className="lp-early-image">
              <img src="/images/cta-bg.jpg" alt="Community" loading="lazy" style={{ width: "100%", display: "block", height: 400, objectFit: "cover" }} />
              <div className="lp-early-badge">🎯 Founding Member — May 2026</div>
            </div>
          )}
          <div>
            <Tag>Early Joiner Benefits</Tag>
            <h2 className="lp-section-h2">First 200 get founder perks for life.</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
              {[
                ["🏆", "Founder Badge", "Permanent social trust signal on every profile."],
                ["💰", "Zero Platform Fee — 3 Months", "Pros keep 100%."],
                ["🪙", "Early Wallet Credit", "₹200 in NeighbourCoins (NC) on your first booking"],
                ["🚀", "Priority Onboarding", "Your society goes live before public launch."],
              ].map(([icon, title, desc]) => (
                <div key={title as string} className="lp-benefit-item">
                  <div className="lp-benefit-icon">{icon}</div>
                  <div>
                    <h3 style={{ display: "block", fontSize: "clamp(0.88rem,3vw,0.95rem)", fontWeight: 700, color: "#0C1B2E", margin: "0 0 2px", fontFamily: "inherit", lineHeight: 1.35 }}>{title}</h3>
                    <span style={{ fontSize: "clamp(0.78rem,2.5vw,0.84rem)", color: "#5C6E84" }}>{desc}</span>
                  </div>
                </div>
              ))}
              <div className="lp-early-cta-row">
                <div className="lp-early-referral-box" style={{ background: "linear-gradient(135deg, #FFF8F5, #E8F4FD)", border: "2px solid #F5692C", borderRadius: "20px", padding: "14px", textAlign: "center" }}>
                  <div style={{ fontSize: "clamp(0.9rem,3vw,1rem)", fontWeight: 600, color: "#F5692C" }}>
                    🎁 Refer a neighbour · Earn ₹200 in NeighbourCoins (NC) · No cap on referrals
                  </div>
                </div>
                <button onClick={() => navigate("/register")} className="lp-btn-secondary lp-early-cta-btn" style={{ padding: "14px 32px", fontSize: "clamp(0.88rem,3vw,1rem)", boxShadow: "0 6px 20px rgba(245,105,44,0.35)", width: "auto" }}>
                  Reserve My Founder Spot
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {societyModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="society-modal-title"
          onClick={() => setSocietyModalOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 500,
            background: "rgba(7, 18, 31, 0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 420,
              background: "#fff",
              borderRadius: 20,
              padding: 20,
              boxShadow: "0 24px 60px rgba(0, 0, 0, 0.25)",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 16 }}>
              <div>
                <div className="lp-sub-label" style={{ marginBottom: 8 }}>Society launch request</div>
                <h3 id="society-modal-title" style={{ margin: 0, fontSize: "1.2rem", fontWeight: 800, color: "#0C1B2E" }}>Register your society</h3>
              </div>
              <button
                type="button"
                aria-label="Close society request form"
                onClick={() => setSocietyModalOpen(false)}
                style={{ background: "none", border: "none", fontSize: 20, lineHeight: 1, cursor: "pointer", color: "#5C6E84" }}
              >
                ×
              </button>
            </div>

            <form onSubmit={submitSocietyRequest} style={{ display: "grid", gap: 12 }}>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#0C1B2E" }}>Full name</span>
                <input
                  value={societyForm.fullName}
                  onChange={(event) => setSocietyForm((current) => ({ ...current, fullName: event.target.value }))}
                  required
                  placeholder="Riya Sharma"
                  style={{ width: "100%", border: "1px solid rgba(12,27,46,0.14)", borderRadius: 12, padding: "12px 14px", font: "inherit" }}
                />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#0C1B2E" }}>Email</span>
                <input
                  type="email"
                  value={societyForm.email}
                  onChange={(event) => setSocietyForm((current) => ({ ...current, email: event.target.value }))}
                  required
                  placeholder="riya@example.com"
                  style={{ width: "100%", border: "1px solid rgba(12,27,46,0.14)", borderRadius: 12, padding: "12px 14px", font: "inherit" }}
                />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#0C1B2E" }}>Society name</span>
                <input
                  value={societyForm.societyName}
                  onChange={(event) => setSocietyForm((current) => ({ ...current, societyName: event.target.value }))}
                  required
                  placeholder="Green Valley Residency"
                  style={{ width: "100%", border: "1px solid rgba(12,27,46,0.14)", borderRadius: 12, padding: "12px 14px", font: "inherit" }}
                />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#0C1B2E" }}>Area</span>
                <input
                  value={societyForm.area}
                  onChange={(event) => setSocietyForm((current) => ({ ...current, area: event.target.value }))}
                  required
                  placeholder="Park Street"
                  style={{ width: "100%", border: "1px solid rgba(12,27,46,0.14)", borderRadius: 12, padding: "12px 14px", font: "inherit" }}
                />
              </label>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#0C1B2E" }}>City</span>
                  <input
                    value={societyForm.city}
                    onChange={(event) => setSocietyForm((current) => ({ ...current, city: event.target.value }))}
                    required
                    placeholder="Pune"
                    style={{ width: "100%", border: "1px solid rgba(12,27,46,0.14)", borderRadius: 12, padding: "12px 14px", font: "inherit" }}
                  />
                </label>

                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#0C1B2E" }}>Pin code</span>
                  <input
                    value={societyForm.pinCode}
                    onChange={(event) => setSocietyForm((current) => ({ ...current, pinCode: event.target.value }))}
                    required
                    inputMode="numeric"
                    placeholder="411057"
                    style={{ width: "100%", border: "1px solid rgba(12,27,46,0.14)", borderRadius: 12, padding: "12px 14px", font: "inherit" }}
                  />
                </label>
              </div>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
                <button type="button" onClick={() => setSocietyModalOpen(false)} className="lp-btn-secondary" style={{ padding: "11px 18px", fontSize: 14 }}>
                  Cancel
                </button>
                <button type="submit" className="lp-btn-primary" style={{ padding: "11px 18px", fontSize: 14 }}>
                  Send to admin
                </button>
              </div>

              <div style={{ fontSize: 12, color: "#5C6E84", lineHeight: 1.5 }}>
                This will open an email draft to {adminEmail} with the society details prefilled.
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── FAQ ── */}
      <section id="faq" className="lp-faq-section" style={{ padding: `clamp(40px,6vw,64px) ${px}` }}>
        <div className="lp-faq-container">
          <Tag>FAQ</Tag>
          <h2 className="lp-section-h2">Questions people ask before joining.</h2>
          <div className="lp-faq-list">
            {[
              [
                "How does society verification work?",
                "You'll receive a society code from your building admin or via the app. Enter it during signup to unlock your community's professional network.",
              ],
              [
                "Is there a fee to book services?",
                "Booking is free. You pay the professional's stated rate, plus earn NeighbourCoins on every transaction.",
              ],
              [
                "What if I need to cancel?",
                "Cancel up to 2 hours before your session for a full refund in NeighbourCoins. Within 2 hours, a 25% credit applies.",
              ],
              [
                "How long does verification take?",
                "Profile verification (ID + degree/credential check) is completed within 48 hours of submission.",
              ],
              [
                "When and how do I receive payouts?",
                "Earnings are transferred weekly via UPI or bank transfer, with a minimum payout of ₹200.",
              ],
              [
                "Can I set my own rates?",
                "Yes. You control your service pricing. ProNeighbor charges zero commission for the first 6 months, then a flat 10% platform fee.",
              ],
            ].map(([question, answer]) => (
              <details key={question as string} className="lp-faq-item">
                <summary className="lp-faq-summary">
                  <span>{question}</span>
                  <span className="lp-faq-icon" aria-hidden="true">▼</span>
                </summary>
                <p className="lp-faq-answer">{answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="lp-footer" style={{ padding: `clamp(36px,6vw,60px) ${px} 24px` }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div className="lp-footer-grid" style={{ gridTemplateColumns: isMobile ? "1fr 1fr" : "2fr 1fr 1fr 1fr" }}>
            <div style={{ gridColumn: isMobile ? "1 / -1" : "auto" }}>
              <Link to="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
                <img src="/images/logo_new.png" alt="PN" loading="lazy" style={{ height: 42, borderRadius: 8 }} />
                <span className="lp-logo-text" style={{ color: "#fff", fontSize: "1rem" }}>ProNeighbor</span>
              </Link>
              <p style={{ fontSize: "0.84rem", lineHeight: 1.7, maxWidth: 260 }}>Hyperlocal Professionals Network.</p>
              <p style={{ marginTop: 10, fontSize: "0.76rem" }}>📍 Park Street, Wakad, Pune · May 2026</p>
            </div>
            {[
              ["Product", [["How it Works", "#how"], ["Features", "#features"], ["Categories", "#categories"], ["Early Access", "#early"]]],
              ["For Pros", [["Register as Expert", "#pro"], ["Founder Perks", "#early"]]],
              ["Company", [["Privacy", "/privacy"], ["Terms", "/terms"], ["Contact", "/contact"]]],
            ].map(([heading, links]) => (
              <div key={heading as string}>
                <h4 className="lp-footer-h4">{heading as string}</h4>
                {(links as [string, string][]).map(([label, href]) => (
                  <a key={label} href={href} className="lp-footer-link">{label}</a>
                ))}
              </div>
            ))}
          </div>
          <div className="lp-footer-socials">
            <div className="lp-footer-social-links" aria-label="Social links">
              <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="lp-footer-social-link" aria-label="Instagram">
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
                  <rect x="3" y="3" width="18" height="18" rx="5" ry="5" fill="none" stroke="currentColor" strokeWidth="1.8" />
                  <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1.8" />
                  <circle cx="17" cy="7" r="1.2" fill="currentColor" />
                </svg>
              </a>
              <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" className="lp-footer-social-link" aria-label="LinkedIn">
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
                  <rect x="3" y="3" width="18" height="18" rx="3" ry="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
                  <path d="M8 10.5v6M8 8.2v.01M12 16.5v-3.5c0-1.4.8-2.3 2.1-2.3s1.9.9 1.9 2.3v3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
              <a href="https://chat.whatsapp.com/" target="_blank" rel="noopener noreferrer" className="lp-footer-social-link" aria-label="WhatsApp Community">
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
                  <path d="M12 4a8 8 0 0 0-6.9 12L4 20l4.1-1.1A8 8 0 1 0 12 4Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M9.6 9.4c.2-.5.4-.5.7-.5h.5c.2 0 .4.1.5.3l.8 1.7c.1.2.1.4 0 .6l-.4.6c-.1.1-.1.3 0 .4.3.5.8 1 1.3 1.3.1.1.3.1.4 0l.6-.4c.2-.1.4-.1.6 0l1.7.8c.2.1.3.3.3.5v.5c0 .3 0 .5-.5.7-.8.3-1.9.2-3.5-.6-1.2-.7-2.4-1.9-3.1-3.1-.8-1.6-.9-2.7-.6-3.5Z" fill="currentColor" />
                </svg>
              </a>
            </div>
            <div className="lp-footer-app-signals-right">
              <div className="lp-footer-app-badge" role="status" aria-label="Play Store app coming soon">
                <span className="lp-footer-play-icon" aria-hidden="true">▶</span>
                <span>Mobile App - Coming soon</span>
              </div>
            </div>
          </div>
          <div className="lp-footer-bottom">
            <span>© 2026 ProNeighbor. All rights reserved.</span>
            <span>Made with ❤️ in Pune 🇮🇳</span>
          </div>
        </div>
      </footer>
    </div>
  );
}