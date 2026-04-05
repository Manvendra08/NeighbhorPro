import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import "./LandingPage.css";

function useIsMobile() {
  const [m, setM] = useState(() => window.innerWidth <= 768);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const h = (e: MediaQueryListEvent) => setM(e.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);
  return m;
}

/* ── tiny shared helpers ── */
function Tag({ children, dark, orange }: { children: React.ReactNode; dark?: boolean; orange?: boolean }) {
  const className = `lp-tag ${orange ? "lp-tag-orange" : dark ? "lp-tag-dark" : "lp-tag-default"}`;
  return <div className={className}>{children}</div>;
}



export default function LandingPage() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", h);
    return () => window.removeEventListener("scroll", h);
  }, []);

  useEffect(() => {
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

  const scrollTo = (id: string) => {
    setMobileMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  const px = isMobile ? "5%" : "6%";
  const navLinks: [string, string][] = [["How It Works", "how"], ["Features", "features"], ["Services", "categories"], ["Early Access", "early"]];

  return (
    <div id="lp-root">
      {/* ── NAV ── */}
      <nav className={`lp-nav ${scrolled ? "lp-nav-scrolled" : ""}`} style={{ padding: `0 ${px}`, height: isMobile ? 52 : 62 }}>
        <a href="#" className="lp-logo">
          <img src="/images/logo_new.png" alt="PN" style={{ height: isMobile ? 32 : 38, borderRadius: 6 }} />
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
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
              {mobileMenuOpen
                ? <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0C1B2E" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12" /></svg>
                : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0C1B2E" strokeWidth="2.5"><path d="M3 12h18M3 6h18M3 18h18" /></svg>}
            </button>
          </div>
        )}
      </nav>

      {/* Mobile drawer */}
      {isMobile && mobileMenuOpen && (
        <div style={{ position: "fixed", top: 60, left: 0, right: 0, zIndex: 190, background: "#fff", borderBottom: "1px solid rgba(0,0,0,0.08)", padding: "16px 5%", boxShadow: "0 8px 24px rgba(0,0,0,0.1)" }}>
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
              Your Society's<br />Expert Network,<br /><span className="lp-logo-accent">Built Right.</span>
            </h1>
            <p className="lp-p-hero">
              Connect with verified professionals who live in your gated community. CA, doctor, yoga, tutor — booked in minutes.
            </p>
            <div className="lp-hero-btns">
              <button onClick={() => navigate("/register")} className="lp-btn-primary lp-btn-hero-primary" style={{ padding: isMobile ? "12px 24px" : "14px 32px" }}>
                Join Waitlist
              </button>
            </div>
            <div className="lp-waitlist-counter">
              <div className="lp-progress-bar-wrap">
                <div className="lp-progress-bar" style={{ width: "74.3%" }} />
              </div>
              <span className="lp-waitlist-label">743 / 1000 founding spots claimed</span>
            </div>
            <p className="lp-hero-expectation">
              We'll notify you when Park Street goes live — May 2026.
            </p>
          </div>

          {/* Image panel — hidden on mobile (hero bg is enough) */}
          {!isMobile && (
            <div className="lp-hero-image-grid">
              <div className="lp-hero-image-main">
                <img src="/images/2.jpg" alt="Community" style={{ width: "100%", display: "block", objectFit: "cover", height: 300 }} />
              </div>
              <div className="lp-hero-features-grid">
                {[["⚡", "Instant Booking", "Book real-time slots"], ["🔒", "Society-Verified", "Lives in your community"]].map(([icon, title, desc]) => (
                  <div key={title} className="lp-hero-feature-card">
                    <div style={{ fontSize: "1.4rem", marginBottom: 8 }}>{icon}</div>
                    <strong style={{ display: "block", fontSize: "0.88rem", marginBottom: 4 }}>{title}</strong>
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
          {[["🏘️", "Exclusive to Park Street, Wakad"], ["⭐", "Trusted by early adopters"], ["💼", "CA, Doctor, Yoga + 17 more"], ["🔐", "Verified residents only"]].map(([icon, text]) => (
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
          <h2 className="lp-section-h2">From need to booking<br />in under 3 minutes.</h2>
          <p className="lp-section-p">No cold calls. No WhatsApp forwards. A clean, trusted marketplace inside your gates.</p>
          <div className="lp-steps-wrapper" style={{ gridTemplateColumns: isMobile ? "1fr" : "1fr auto 1fr auto 1fr", gap: isMobile ? 12 : 0 }}>
            {[
              ["01", "🏠", "Join Your Society", "Sign up with your society code. Only genuine residents and pros get in."],
              ["02", "🔍", "Browse & Filter", "Search by category, rating, price, or availability. See neighbour endorsements."],
              ["03", "✅", "Book Instantly", "Pick a real-time slot. Group sessions, recurring bookings — all supported."],
            ].map(([num, icon, title, desc], idx) => (
              <React.Fragment key={num as string}>
                <div className="lp-step-card" style={{ opacity: 1, transform: "none" }}>
                  <div className="lp-step-num">{num}</div>
                  <div className="lp-step-icon">{icon}</div>
                  <h3 style={{ fontSize: "clamp(0.95rem,3vw,1.1rem)", fontWeight: 700, marginBottom: 8, color: "#0C1B2E" }}>{title}</h3>
                  <p style={{ fontSize: "clamp(0.82rem,2.5vw,0.9rem)", color: "#5C6E84", lineHeight: 1.6 }}>{desc}</p>
                </div>
                {idx < 2 && !isMobile && (
                  <div className="lp-step-connector">
                    <svg width="32" height="32" viewBox="0 0 32 32" fill="none"><path d="M6 16h20M20 10l6 6-6 6" stroke="#1B6B8A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.4"/></svg>
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section style={{ background: "#fff", padding: `clamp(36px,5vw,60px) ${px}` }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <Tag>What Early Members Say</Tag>
          <h2 className="lp-section-h2">Real stories from Park Street.</h2>
          <div className="lp-testimonials-grid" style={{ gridTemplateColumns: isMobile ? "1fr" : "repeat(3,1fr)" }}>
            {[
              { quote: "Had our CA file returns for 6 flats in one group session. Saved ₹4,000 total.", name: "Rahul M.", role: "Tower B Resident" },
              { quote: "Listed my yoga classes and got 11 bookings in week one. Zero platform fee.", name: "Priya S.", role: "Certified Yoga Instructor" },
              { quote: "Finally found a reliable tutor for my daughter — she lives 3 floors above us.", name: "Anita K.", role: "Park Street Resident" },
            ].map(({ quote, name, role }) => (
              <div key={name} className="lp-testimonial-card">
                <div className="lp-testimonial-quote">❝</div>
                <p className="lp-testimonial-text">{quote}</p>
                <div className="lp-testimonial-author">
                  <strong>{name}</strong>
                  <span>{role}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CATEGORIES ── */}
      <section id="categories" style={{ background: "#F4F7FB", padding: `clamp(40px,6vw,64px) ${px}` }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <Tag>Service Categories</Tag>
          <h2 className="lp-section-h2">20+ categories, all inside your gates.</h2>
          <p className="lp-section-p">From tax filing to yoga — your society has more talent than you think.</p>
          <div className="lp-cat-grid" style={{ gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap: isMobile ? 8 : 14 }}>
            {[["📊", "Tax & CA"], ["💹", "Investment"], ["⚖️", "Legal"], ["🏥", "Health"], ["🧠", "Mental Health"], ["🧘", "Fitness & Yoga"], ["🥗", "Nutrition"], ["📚", "Tutoring"], ["💻", "IT & Tech"], ["🎨", "Design"], ["📷", "Photography"], ["🎵", "Music & Arts"], ["💼", "Career Coaching"], ["🎉", "Event Planning"], ["🐾", "Pet Care"], ["✨", "Beauty"]].map(([icon, name]) => (
              <div key={name as string} className="lp-cat-card" style={{ opacity: 1, transform: "none" }}>
                <span style={{ fontSize: isMobile ? "1.2rem" : "1.4rem" }}>{icon}</span>
                <span style={{ fontSize: "clamp(0.78rem,2.5vw,0.88rem)", fontWeight: 600, color: "#0C1B2E" }}>{name}</span>
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
              ["👥", "Phase 2", "Group Sessions", "8 households book one yoga class at ₹150/head."],
              ["🔄", "Phase 2", "Recurring Bookings", "Auto-books weekly yoga, monthly CA reviews."],
              ["🤝", null, "Neighbour Endorsements", "Endorsed by 4 neighbours in Tower B. Far more trusted."],
              ["📹", "Phase 2", "Video Consultations", "Built-in video for CA, legal, mental health."],
              ["🔐", null, "Verified Pro Badges", "🎓 Degree · 🪪 ID · ✅ Background checks."],
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
              <img src="/images/cta-bg.jpg" alt="Community" style={{ width: "100%", display: "block", height: 400, objectFit: "cover" }} />
              <div className="lp-early-badge">🎯 Founding Member — May 2026</div>
            </div>
          )}
          <div>
            <Tag>Early Joiner Benefits</Tag>
            <h2 className="lp-section-h2">First 1000 members get founder perks for life.</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 24 }}>
              {[
                ["🏆", "Founder Badge", "Permanent social trust signal on every profile."],
                ["💰", "Zero Platform Fee — 6 Months", "Pros keep 100%. Residents get 3 free credits."],
                ["🚀", "Priority Onboarding", "Your society goes live before public launch."],
                ["⭐", "Referral Credits Stack", "₹200 per successful referral, no cap."],
              ].map(([icon, title, desc]) => (
                <div key={title as string} className="lp-benefit-item">
                  <div className="lp-benefit-icon">{icon}</div>
                  <div>
                    <strong style={{ display: "block", fontSize: "clamp(0.88rem,3vw,0.95rem)", fontWeight: 700, color: "#0C1B2E", marginBottom: 2 }}>{title}</strong>
                    <span style={{ fontSize: "clamp(0.78rem,2.5vw,0.84rem)", color: "#5C6E84" }}>{desc}</span>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => navigate("/register")} className="lp-btn-primary" style={{ marginTop: 28, padding: "14px 32px", fontSize: "clamp(0.88rem,3vw,1rem)", boxShadow: "0 6px 20px rgba(245,105,44,0.35)", width: isMobile ? "100%" : "auto" }}>
              Claim Founder Access
            </button>
          </div>
        </div>
      </section>

      {/* ── CTA BAND ── */}
      <section className="lp-cta-band" style={{ background: "linear-gradient(to right, rgba(11,27,46,0.92), rgba(15,78,104,0.8)), url('/images/cta-bg.jpg') center/cover", padding: `clamp(40px,6vw,64px) ${px}` }}>
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          <Tag dark orange>Register as Expert</Tag>
          <h2 className="lp-section-h2" style={{ color: "#fff", fontSize: "clamp(1.5rem,5vw,2.4rem)" }}>The professional network for <span className="lp-logo-accent">Park Street residents.</span></h2>
          <p className="lp-section-p" style={{ color: "rgba(255,255,255,0.72)", marginBottom: 28, margin: "0 auto 28px" }}>Be among the first experts. List your services and start earning locally.</p>
          <button onClick={() => navigate("/register")} className="lp-btn-primary" style={{ padding: isMobile ? "14px 32px" : "16px 44px", fontSize: "clamp(0.92rem,3vw,1.1rem)", boxShadow: "0 6px 24px rgba(245,105,44,0.45)", width: isMobile ? "100%" : "auto" }}>
            Register as Expert
          </button>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="lp-footer" style={{ padding: `clamp(36px,6vw,60px) ${px} 24px` }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div className="lp-footer-grid" style={{ gridTemplateColumns: isMobile ? "1fr 1fr" : "2fr 1fr 1fr 1fr" }}>
            <div style={{ gridColumn: isMobile ? "1 / -1" : "auto" }}>
              <Link to="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
                <img src="/images/logo_new.png" alt="PN" style={{ height: 42, borderRadius: 8 }} />
                <span className="lp-logo-text" style={{ color: "#fff", fontSize: "1rem" }}>ProNeighbor</span>
              </Link>
              <p style={{ fontSize: "0.84rem", lineHeight: 1.7, maxWidth: 260 }}>The professional services marketplace for gated communities.</p>
              <p style={{ marginTop: 10, fontSize: "0.76rem" }}>📍 Park Street, Wakad, Pune · May 2026</p>
            </div>
            {[
              ["Product", [["How it Works", "#how"], ["Features", "#features"], ["Categories", "#categories"], ["Early Access", "#early"]]],
              ["For Pros", [["Register as Expert", "#"], ["Founder Perks", "#early"]]],
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
          <div className="lp-footer-bottom">
            <span>© 2026 ProNeighbor. All rights reserved.</span>
            <span>Made with ❤️ in Pune 🇮🇳</span>
          </div>
        </div>
      </footer>
    </div>
  );
}


