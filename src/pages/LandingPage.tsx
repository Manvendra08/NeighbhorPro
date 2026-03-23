import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

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
  return (
    <div style={{
      display: "inline-block",
      background: orange ? "rgba(245,105,44,0.2)" : dark ? "rgba(255,255,255,0.1)" : "rgba(27,107,138,0.1)",
      color: orange ? "#FFB894" : dark ? "rgba(255,255,255,0.8)" : "#1B6B8A",
      fontSize: "clamp(0.65rem,2vw,0.76rem)", fontWeight: 700,
      letterSpacing: 1, textTransform: "uppercase" as const,
      padding: "5px 14px", borderRadius: 50, marginBottom: 14,
    }}>{children}</div>
  );
}

const ST: React.CSSProperties = {
  fontFamily: "'Syne','DM Sans',sans-serif",
  fontSize: "clamp(1.5rem,5vw,2.6rem)",
  fontWeight: 800, letterSpacing: -1, lineHeight: 1.15,
  color: "#0C1B2E", marginBottom: 12,
};
const SS: React.CSSProperties = {
  fontSize: "clamp(0.85rem,3vw,1rem)", color: "#5C6E84",
  lineHeight: 1.6, maxWidth: 540, marginBottom: 24,
};

export default function LandingPage() {
  const navigate  = useNavigate();
  const isMobile  = useIsMobile();
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
  const navLinks: [string, string][] = [["How It Works","how"],["Features","features"],["Services","categories"],["Early Access","early"]];

  return (
    <div id="lp-root" style={{ fontFamily: "'DM Sans',sans-serif", overflowX: "hidden", background: "#fff", color: "#0C1B2E" }}>

      {/* ── NAV ── */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 200,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: `0 ${px}`, height: isMobile ? 52 : 62,
        background: "rgba(255,255,255,0.95)", backdropFilter: "blur(16px)",
        borderBottom: "1px solid rgba(0,0,0,0.06)",
        boxShadow: scrolled ? "0 2px 24px rgba(0,0,0,0.08)" : "none",
        transition: "box-shadow 0.3s",
      }}>
        <a href="#" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <img src="/images/logo_new.png" alt="PN" style={{ height: isMobile ? 32 : 38, borderRadius: 6 }} />
          <span style={{ fontFamily: "'Syne','DM Sans',sans-serif", fontWeight: 800, fontSize: isMobile ? "1rem" : "1.1rem", color: "#0C1B2E", letterSpacing: -0.5 }}>
            Pro<span style={{ color: "#F5692C" }}>Neighbor</span>
          </span>
        </a>

        {/* Desktop links */}
        {!isMobile && (
          <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
            {navLinks.map(([label, id]) => (
              <button key={id} onClick={() => scrollTo(id)} style={{ background: "none", border: "none", color: "#5C6E84", fontWeight: 500, fontSize: "0.88rem", cursor: "pointer", fontFamily: "inherit" }}>{label}</button>
            ))}
            <button onClick={() => navigate("/register")} style={{ background: "linear-gradient(135deg,#F5692C,#E8450A)", color: "#fff", border: "none", padding: "9px 20px", borderRadius: 50, fontWeight: 700, fontSize: "0.85rem", cursor: "pointer", boxShadow: "0 4px 12px rgba(245,105,44,0.3)" }}>Join Waitlist</button>
            <button onClick={() => navigate("/login")} style={{ background: "none", border: "1.5px solid rgba(27,107,138,0.3)", color: "#1B6B8A", padding: "8px 18px", borderRadius: 50, fontWeight: 600, fontSize: "0.85rem", cursor: "pointer" }}>Sign In</button>
          </div>
        )}

        {/* Mobile: Sign In + hamburger */}
        {isMobile && (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={() => navigate("/login")} style={{ background: "none", border: "1.5px solid rgba(27,107,138,0.3)", color: "#1B6B8A", padding: "7px 14px", borderRadius: 50, fontWeight: 600, fontSize: "0.8rem", cursor: "pointer" }}>Sign In</button>
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
              {mobileMenuOpen
                ? <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0C1B2E" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0C1B2E" strokeWidth="2.5"><path d="M3 12h18M3 6h18M3 18h18"/></svg>}
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
          <button onClick={() => { setMobileMenuOpen(false); navigate("/register"); }} style={{ display: "block", width: "100%", marginTop: 16, background: "linear-gradient(135deg,#F5692C,#E8450A)", color: "#fff", border: "none", padding: "14px", borderRadius: 50, fontWeight: 700, fontSize: "1rem", cursor: "pointer" }}>Join Waitlist</button>
        </div>
      )}

      {/* ── HERO ── */}
      <section style={{
        minHeight: isMobile ? "100dvh" : "100vh",
        background: `linear-gradient(to bottom right, rgba(11,27,46,0.85) 0%, rgba(15,78,104,0.65) 60%, rgba(0,0,0,0.3) 100%), url('/images/hero-bg.jpg') center/cover no-repeat`,
        display: "flex", alignItems: isMobile ? "flex-end" : "center",
        padding: isMobile ? `${52+20}px ${px} 36px` : `90px ${px} 60px`,
        position: "relative",
      }}>
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: isMobile ? 60 : 100, background: "linear-gradient(to top,#fff,transparent)" }} />

        {/* Two-col on desktop, single col on mobile */}
        <div style={{
          maxWidth: 1200, margin: "0 auto", width: "100%", position: "relative", zIndex: 2,
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
          gap: isMobile ? 32 : 60,
          alignItems: "center",
        }}>
          {/* Text */}
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(245,105,44,0.15)", border: "1px solid rgba(245,105,44,0.35)", padding: "6px 14px", borderRadius: 50, marginBottom: 20, color: "#FFB894", fontSize: "clamp(0.68rem,2.2vw,0.78rem)", fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" }}>
              <span style={{ width: 7, height: 7, background: "#F5692C", borderRadius: "50%", display: "inline-block" }} />
              Launching May 2026 · Park Street, Wakad
            </div>
            <h1 style={{ fontFamily: "'Syne','DM Sans',sans-serif", fontSize: "clamp(2rem,7vw,3.6rem)", fontWeight: 800, color: "#fff", lineHeight: 1.1, letterSpacing: -1.5, marginBottom: 16 }}>
              Your Society's<br />Expert Network,<br /><span style={{ color: "#F5692C" }}>Built Right.</span>
            </h1>
            <p style={{ color: "rgba(255,255,255,0.8)", fontSize: "clamp(0.9rem,3vw,1.05rem)", lineHeight: 1.65, marginBottom: 28, maxWidth: 460 }}>
              Connect with verified professionals who live in your gated community. CA, doctor, yoga, tutor — booked in minutes.
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <button onClick={() => navigate("/register")} style={{ background: "linear-gradient(135deg,#F5692C,#E8450A)", color: "#fff", border: "none", padding: isMobile ? "12px 24px" : "14px 32px", borderRadius: 50, fontWeight: 700, fontSize: "clamp(0.88rem,3vw,1rem)", cursor: "pointer", boxShadow: "0 6px 24px rgba(245,105,44,0.45)" }}>
                Join Waitlist
              </button>
              <button onClick={() => scrollTo("how")} style={{ background: "rgba(255,255,255,0.1)", color: "#fff", border: "1.5px solid rgba(255,255,255,0.4)", padding: isMobile ? "12px 22px" : "14px 32px", borderRadius: 50, fontWeight: 600, fontSize: "clamp(0.88rem,3vw,1rem)", cursor: "pointer", backdropFilter: "blur(8px)" }}>
                How It Works
              </button>
            </div>

          </div>

          {/* Image panel — hidden on mobile (hero bg is enough) */}
          {!isMobile && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ borderRadius: 24, overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,0.4)" }}>
                <img src="/images/2.jpg" alt="Community" style={{ width: "100%", display: "block", objectFit: "cover", height: 300 }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                {[["⚡","Instant Booking","Book real-time slots"],["🔒","Society-Verified","Lives in your community"]].map(([icon,title,desc]) => (
                  <div key={title} style={{ background: "rgba(255,255,255,0.1)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.18)", borderRadius: 16, padding: 18, color: "#fff" }}>
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
      <div style={{ background: "#F4F7FB", padding: `16px ${px}`, borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          {[["🏘️","Exclusive to Park Street, Wakad"],["⭐","4.9/5 satisfaction"],["💼","CA, Doctor, Yoga + 17 more"],["🔐","Verified residents only"]].map(([icon,text]) => (
            <div key={text as string} style={{ display: "flex", alignItems: "center", gap: 8, color: "#5C6E84", fontSize: "clamp(0.76rem,2.5vw,0.85rem)" }}>
              <span>{icon}</span><span>{text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── HOW IT WORKS ── */}
      <section id="how" style={{ padding: `clamp(40px,6vw,72px) ${px}` }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <Tag>How It Works</Tag>
          <h2 style={ST}>From need to booking<br />in under 3 minutes.</h2>
          <p style={SS}>No cold calls. No WhatsApp forwards. A clean, trusted marketplace inside your gates.</p>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3,1fr)", gap: isMobile ? 12 : 24 }}>
            {[
              ["01","🏠","Join Your Society","Sign up with your society code. Only genuine residents and pros get in."],
              ["02","🔍","Browse & Filter","Search by category, rating, price, or availability. See neighbour endorsements."],
              ["03","✅","Book Instantly","Pick a real-time slot. Group sessions, recurring bookings — all supported."],
            ].map(([num,icon,title,desc]) => (
              <div key={num as string} className="lp-reveal" style={{ textAlign: "center", padding: isMobile ? "20px 14px" : "32px 20px", opacity: 0, transform: "translateY(20px)", transition: "opacity 0.6s ease, transform 0.6s ease", background: isMobile ? "var(--surface,#fff)" : "transparent", border: isMobile ? "1px solid #E8E4DC" : "none", borderRadius: 16 }}>
                <div style={{ fontFamily: "'Syne',sans-serif", fontSize: isMobile ? "2.5rem" : "4rem", fontWeight: 800, color: "rgba(27,107,138,0.07)", lineHeight: 1, marginBottom: -6 }}>{num}</div>
                <div style={{ width: 64, height: 64, borderRadius: 18, background: "linear-gradient(135deg,rgba(27,107,138,0.12),rgba(27,107,138,0.05))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.6rem", margin: "0 auto 16px", border: "1px solid rgba(27,107,138,0.1)" }}>{icon}</div>
                <h3 style={{ fontSize: "clamp(0.95rem,3vw,1.1rem)", fontWeight: 700, marginBottom: 8, color: "#0C1B2E" }}>{title}</h3>
                <p style={{ fontSize: "clamp(0.82rem,2.5vw,0.9rem)", color: "#5C6E84", lineHeight: 1.6 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CATEGORIES ── */}
      <section id="categories" style={{ background: "#F4F7FB", padding: `clamp(40px,6vw,64px) ${px}` }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <Tag>Service Categories</Tag>
          <h2 style={ST}>20+ categories, all inside your gates.</h2>
          <p style={SS}>From tax filing to yoga — your society has more talent than you think.</p>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(4,1fr)", gap: isMobile ? 10 : 14 }}>
            {[["📊","Tax & CA"],["💹","Investment"],["⚖️","Legal"],["🏥","Health"],["🧠","Mental Health"],["🧘","Fitness & Yoga"],["🥗","Nutrition"],["📚","Tutoring"],["💻","IT & Tech"],["🎨","Design"],["📷","Photography"],["🎵","Music & Arts"],["💼","Career Coaching"],["🎉","Event Planning"],["🐾","Pet Care"],["✨","Beauty"]].map(([icon,name]) => (
              <div key={name as string} className="lp-reveal" style={{ background: "#fff", border: "1.5px solid rgba(27,107,138,0.1)", borderRadius: isMobile ? 12 : 16, padding: isMobile ? "14px 12px" : "18px 16px", display: "flex", alignItems: "center", gap: 10, opacity: 0, transform: "translateY(12px)", transition: "opacity 0.5s ease, transform 0.5s ease" }}>
                <span style={{ fontSize: isMobile ? "1.2rem" : "1.4rem" }}>{icon}</span>
                <span style={{ fontSize: "clamp(0.78rem,2.5vw,0.88rem)", fontWeight: 600, color: "#0C1B2E" }}>{name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" style={{ background: "#0C1B2E", padding: `clamp(40px,6vw,72px) ${px}` }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <Tag dark>Features</Tag>
          <h2 style={{ ...ST, color: "#fff" }}>Built for how gated communities <em style={{ color: "#F5692C", fontStyle: "normal" }}>actually</em> work.</h2>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3,1fr)", gap: isMobile ? 10 : 20, marginTop: 24 }}>
            {[
              ["⚡",null,"Instant Slot Booking","Real-time availability. Pick a slot, confirm instantly."],
              ["👥","Phase 2","Group Sessions","8 households book one yoga class at ₹150/head."],
              ["🔄","Phase 2","Recurring Bookings","Auto-books weekly yoga, monthly CA reviews."],
              ["🤝",null,"Neighbour Endorsements","Endorsed by 4 neighbours in Tower B. Far more trusted."],
              ["📹","Phase 2","Video Consultations","Built-in video for CA, legal, mental health."],
              ["🔐",null,"Verified Pro Badges","🎓 Degree · 🪪 ID · ✅ Background checks."],
            ].map(([icon,phase,title,desc]) => (
              <div key={title as string} className="lp-reveal" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: isMobile ? 20 : 28, opacity: 0, transform: "translateY(16px)", transition: "opacity 0.6s ease, transform 0.6s ease" }}>
                <div style={{ fontSize: isMobile ? "1.5rem" : "1.8rem", marginBottom: 12 }}>{icon}</div>
                {phase && <div style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", color: "#F5692C", background: "rgba(245,105,44,0.15)", borderRadius: 50, padding: "2px 10px", display: "inline-block", marginBottom: 8 }}>{phase}</div>}
                <h3 style={{ fontSize: "clamp(0.9rem,3vw,1rem)", fontWeight: 700, marginBottom: 8, color: "#fff" }}>{title}</h3>
                <p style={{ fontSize: "clamp(0.8rem,2.5vw,0.86rem)", color: "rgba(255,255,255,0.58)", lineHeight: 1.6 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── EARLY ACCESS ── */}
      <section id="early" style={{ background: "linear-gradient(135deg,#FFF8F5,#F0F8FC)", padding: `clamp(40px,6vw,72px) ${px}` }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? 32 : 64, alignItems: "center" }}>
          {!isMobile && (
            <div style={{ borderRadius: 24, overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,0.12)", position: "relative" }}>
              <img src="/images/cta-bg.jpg" alt="Community" style={{ width: "100%", display: "block", height: 400, objectFit: "cover" }} />
              <div style={{ position: "absolute", top: 16, left: 16, background: "linear-gradient(135deg,#F5692C,#E8450A)", color: "#fff", fontWeight: 700, fontSize: "0.75rem", padding: "7px 16px", borderRadius: 50, letterSpacing: 0.5 }}>🎯 Founding Member — May 2026</div>
            </div>
          )}
          <div>
            <Tag>Early Joiner Benefits</Tag>
            <h2 style={ST}>First 1000 members get founder perks for life.</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 24 }}>
              {[
                ["🏆","Founder Badge","Permanent social trust signal on every profile."],
                ["💰","Zero Platform Fee — 6 Months","Pros keep 100%. Residents get 3 free credits."],
                ["🚀","Priority Onboarding","Your society goes live before public launch."],
                ["⭐","Referral Credits Stack","₹200 per successful referral, no cap."],
              ].map(([icon,title,desc]) => (
                <div key={title as string} style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, background: "linear-gradient(135deg,#F5692C,#E8450A)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "0.84rem", marginTop: 2 }}>{icon}</div>
                  <div>
                    <strong style={{ display: "block", fontSize: "clamp(0.88rem,3vw,0.95rem)", fontWeight: 700, color: "#0C1B2E", marginBottom: 2 }}>{title}</strong>
                    <span style={{ fontSize: "clamp(0.78rem,2.5vw,0.84rem)", color: "#5C6E84" }}>{desc}</span>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => navigate("/register")} style={{ marginTop: 28, background: "linear-gradient(135deg,#F5692C,#E8450A)", color: "#fff", border: "none", padding: "14px 32px", borderRadius: 50, fontWeight: 700, fontSize: "clamp(0.88rem,3vw,1rem)", cursor: "pointer", boxShadow: "0 6px 20px rgba(245,105,44,0.35)", width: isMobile ? "100%" : "auto" }}>
              Claim Founder Access
            </button>
          </div>
        </div>
      </section>

      {/* ── CTA BAND ── */}
      <section style={{ background: "linear-gradient(to right, rgba(11,27,46,0.92), rgba(15,78,104,0.8)), url('/images/cta-bg.jpg') center/cover", textAlign: "center", padding: `clamp(40px,6vw,64px) ${px}`, color: "#fff" }}>
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          <Tag dark orange>Join Waitlist</Tag>
          <h2 style={{ ...ST, color: "#fff", fontSize: "clamp(1.5rem,5vw,2.4rem)" }}>The professional network for <span style={{ color: "#F5692C" }}>Park Street residents.</span></h2>
          <p style={{ ...SS, color: "rgba(255,255,255,0.72)", marginBottom: 28 }}>Join 847 experts. List your services and start earning locally.</p>
          <button onClick={() => navigate("/register")} style={{ background: "linear-gradient(135deg,#F5692C,#E8450A)", color: "#fff", border: "none", padding: isMobile ? "14px 32px" : "16px 44px", borderRadius: 50, fontWeight: 700, fontSize: "clamp(0.92rem,3vw,1.1rem)", cursor: "pointer", boxShadow: "0 6px 24px rgba(245,105,44,0.45)", width: isMobile ? "100%" : "auto" }}>
            Join Waitlist
          </button>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ background: "#0C1B2E", color: "rgba(255,255,255,0.55)", padding: `clamp(36px,6vw,60px) ${px} 24px` }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "2fr 1fr 1fr 1fr", gap: isMobile ? 28 : 40, paddingBottom: 32, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ gridColumn: isMobile ? "1 / -1" : "auto" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <img src="/images/logo_new.png" alt="PN" style={{ height: 32 }} />
                <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, color: "#fff", fontSize: "1rem" }}>ProNeighbor</span>
              </div>
              <p style={{ fontSize: "0.84rem", lineHeight: 1.7, maxWidth: 260 }}>The professional services marketplace for gated communities.</p>
              <p style={{ marginTop: 10, fontSize: "0.76rem" }}>📍 Park Street, Wakad, Pune · May 2026</p>
            </div>
            {[
              ["Product",[["How it Works","#how"],["Features","#features"],["Categories","#categories"],["Early Access","#early"]]],
              ["For Pros",[["Join Waitlist","#"],["Founder Perks","#early"]]],
              ["Company",[["Privacy","/privacy"],["Terms","/terms"],["Contact","mailto:hello@ProNeighbor.in"]]],
            ].map(([heading, links]) => (
              <div key={heading as string}>
                <h4 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, color: "#fff", marginBottom: 14, fontSize: "0.9rem" }}>{heading as string}</h4>
                {(links as [string,string][]).map(([label,href]) => (
                  <a key={label} href={href} style={{ display: "block", color: "rgba(255,255,255,0.48)", fontSize: "0.82rem", marginBottom: 9, textDecoration: "none" }}>{label}</a>
                ))}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 20, fontSize: "0.78rem", flexWrap: "wrap", gap: 8 }}>
            <span>© 2026 ProNeighbor. All rights reserved.</span>
            <span>Made with ❤️ in Pune 🇮🇳</span>
          </div>
        </div>
      </footer>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&display=swap');
        #lp-root a { text-decoration: none; }
        #lp-root * { box-sizing: border-box; }
        @media (max-width: 768px) {
          #lp-root { padding-top: 0; }
        }
      `}</style>
    </div>
  );
}


