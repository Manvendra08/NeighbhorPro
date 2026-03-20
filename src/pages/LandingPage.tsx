import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";



export default function LandingPage() {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  /* Intersection observer for scroll-reveal */
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { (e.target as HTMLElement).style.opacity = "1"; (e.target as HTMLElement).style.transform = "translateY(0)"; obs.unobserve(e.target); } }),
      { threshold: 0.1 }
    );
    document.querySelectorAll(".lp-reveal").forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <div id="lp-root" style={{ fontFamily: "'DM Sans', sans-serif", overflowX: "hidden", background: "#fff", color: "#0C1B2E" }}>

      {/* ── NAV ── */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 200,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 6%", height: 70,
        background: "rgba(255,255,255,0.94)", backdropFilter: "blur(16px)",
        borderBottom: "1px solid rgba(0,0,0,0.06)",
        boxShadow: scrolled ? "0 2px 24px rgba(0,0,0,0.08)" : "none",
        transition: "box-shadow 0.3s",
      }}>
        <a href="#" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <img src="/images/logo.png" alt="ProNeighbor" style={{ height: 36 }} />
          <span style={{ fontFamily: "'Syne', 'DM Sans', sans-serif", fontWeight: 800, fontSize: "1.1rem", color: "#0C1B2E", letterSpacing: -0.5 }}>
            Pro<span style={{ color: "#F5692C" }}>Neighbour</span>
          </span>
        </a>
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          {[["How It Works", "how"], ["Features", "features"], ["Services", "categories"], ["Early Access", "early"]].map(([label, id]) => (
            <button key={id} onClick={() => scrollTo(id)} style={{ background: "none", border: "none", color: "#5C6E84", fontWeight: 500, fontSize: "0.88rem", cursor: "pointer", fontFamily: "inherit" }}>
              {label}
            </button>
          ))}
          <button onClick={() => navigate("/register")} style={{
            background: "linear-gradient(135deg,#F5692C,#E8450A)", color: "#fff", border: "none",
            padding: "10px 22px", borderRadius: 50, fontWeight: 700, fontSize: "0.88rem", cursor: "pointer",
            boxShadow: "0 4px 16px rgba(245,105,44,0.35)", transition: "opacity 0.2s",
          }}>
            Register as Expert
          </button>
          <button onClick={() => navigate("/login")} style={{
            background: "none", border: "1.5px solid rgba(27,107,138,0.3)", color: "#1B6B8A",
            padding: "9px 20px", borderRadius: 50, fontWeight: 600, fontSize: "0.85rem", cursor: "pointer",
          }}>
            Sign In
          </button>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{
        minHeight: "100vh",
        background: `linear-gradient(to bottom right, rgba(11,27,46,0.82) 0%, rgba(15,78,104,0.6) 60%, rgba(0,0,0,0.3) 100%), url('/images/hero-bg.jpg') center/cover no-repeat`,
        display: "flex", alignItems: "center", padding: "110px 6% 80px",
        position: "relative",
      }}>
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 100, background: "linear-gradient(to top,#fff,transparent)" }} />
        <div style={{ maxWidth: 1200, margin: "0 auto", width: "100%", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 60, alignItems: "center", position: "relative", zIndex: 2 }}>

          {/* Left */}
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(245,105,44,0.15)", border: "1px solid rgba(245,105,44,0.35)", padding: "6px 16px", borderRadius: 50, marginBottom: 24, color: "#FFB894", fontSize: "0.78rem", fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" }}>
              <span style={{ width: 7, height: 7, background: "#F5692C", borderRadius: "50%", display: "inline-block", animation: "lpPulse 1.8s infinite" }} />
              Launching May 2026 in Park Street, Wakad, Pune
            </div>
            <h1 style={{ fontFamily: "'Syne','DM Sans',sans-serif", fontSize: "clamp(2.2rem,4vw,3.6rem)", fontWeight: 800, color: "#fff", lineHeight: 1.1, letterSpacing: -1.5, marginBottom: 20 }}>
              Your Society's<br />Expert Network,<br /><span style={{ color: "#F5692C" }}>Finally Built Right.</span>
            </h1>
            <p style={{ color: "rgba(255,255,255,0.8)", fontSize: "1.05rem", lineHeight: 1.65, marginBottom: 36, maxWidth: 460 }}>
              Connect with verified professionals who live in your gated community. CA, doctor, yoga instructor, tutor — booked in minutes, trusted by neighbours.
            </p>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              <button onClick={() => navigate("/register")} style={{ background: "linear-gradient(135deg,#F5692C,#E8450A)", color: "#fff", border: "none", padding: "14px 32px", borderRadius: 50, fontWeight: 700, fontSize: "1rem", cursor: "pointer", boxShadow: "0 6px 24px rgba(245,105,44,0.45)", transition: "transform 0.2s" }}>
                Register as Expert
              </button>
              <button onClick={() => scrollTo("how")} style={{ background: "rgba(255,255,255,0.1)", color: "#fff", border: "1.5px solid rgba(255,255,255,0.4)", padding: "14px 32px", borderRadius: 50, fontWeight: 600, fontSize: "1rem", cursor: "pointer", backdropFilter: "blur(8px)" }}>
                See How It Works
              </button>
            </div>
            <div style={{ display: "flex", gap: 36, marginTop: 44 }}>
              {[["500+", "Pros Registered"], ["20+", "Service categories"]].map(([val, label]) => (
                <div key={label}>
                  <strong style={{ display: "block", fontFamily: "'Syne',sans-serif", fontSize: "1.6rem", fontWeight: 800, color: "#fff" }}>{val}</strong>
                  <span style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ borderRadius: 24, overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,0.4)" }}>
              <img src="/images/2.jpg" alt="Professionals in community" style={{ width: "100%", display: "block", objectFit: "cover", height: 320 }} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {[["⚡", "Instant Booking", "Book real-time slots, no back-and-forth"], ["🔒", "Society-Verified", "Every pro lives in your community"]].map(([icon, title, desc]) => (
                <div key={title} style={{ background: "rgba(255,255,255,0.1)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.18)", borderRadius: 16, padding: 20, color: "#fff" }}>
                  <div style={{ fontSize: "1.4rem", marginBottom: 8 }}>{icon}</div>
                  <strong style={{ display: "block", fontSize: "0.9rem", marginBottom: 4 }}>{title}</strong>
                  <small style={{ fontSize: "0.76rem", opacity: 0.7 }}>{desc}</small>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>



      {/* ── PROOF STRIP ── */}
      <div style={{ background: "#F4F7FB", padding: "20px 6%", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          {[["🏘️", "Exclusive to Park Street, Wakad residents"], ["⭐", "4.9/5 satisfaction rate"], ["💼", "CA, Doctor, Yoga, Tutor + 17 more"], ["🔐", "100% verified society residents only"]].map(([icon, text]) => (
            <div key={text as string} style={{ display: "flex", alignItems: "center", gap: 8, color: "#5C6E84", fontSize: "0.85rem" }}>
              <span>{icon}</span><span>{text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── REGISTER AS EXPERT SECTION ── */}
      <section id="register-expert" style={{
        background: `linear-gradient(to bottom right, rgba(11,27,46,0.90), rgba(15,78,104,0.78)), url('/images/cta-bg.jpg') center/cover no-repeat`,
        textAlign: "center", padding: "80px 6%", color: "#fff",
      }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <SectionTag light orange>Register as Expert</SectionTag>
          <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: "clamp(1.8rem,3vw,2.6rem)", fontWeight: 800, letterSpacing: -1, lineHeight: 1.15, color: "#fff", maxWidth: 600, margin: "0 auto 12px" }}>
            The professional network for <span style={{ color: "#F5692C" }}>Park Street residents.</span>
          </h2>
          <p style={{ fontSize: "1.02rem", color: "rgba(255,255,255,0.72)", lineHeight: 1.65, maxWidth: 460, margin: "0 auto 30px" }}>
            Join 847 other experts in your society. List your services and start earning locally.
          </p>
          <button onClick={() => navigate("/register")} style={{ background: "linear-gradient(135deg,#F5692C,#E8450A)", color: "#fff", border: "none", padding: "16px 40px", borderRadius: 50, fontWeight: 700, fontSize: "1.1rem", cursor: "pointer", boxShadow: "0 6px 24px rgba(245,105,44,0.45)" }}>
            Register as Expert
          </button>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how" style={{ padding: "90px 6%" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <SectionTag>How It Works</SectionTag>
          <h2 style={sTitle}>From need to booking<br />in under 3 minutes.</h2>
          <p style={sSub}>No cold calls. No WhatsApp forwards. Just a clean, trusted marketplace inside your gates.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 32 }}>
            {[
              ["01", "🏠", "Join Your Society", "Sign up with your society code. Your identity is verified — only genuine residents and pros get in."],
              ["02", "🔍", "Browse & Filter", "Search by category, rating, price, or availability. See neighbour endorsements before you book."],
              ["03", "✅", "Book Instantly", "Pick a real-time slot, confirm, and you're done. Group sessions, recurring bookings, video consults — all supported."],
            ].map(([num, icon, title, desc]) => (
              <div key={num as string} className="lp-reveal" style={{ textAlign: "center", padding: "40px 28px", opacity: 0, transform: "translateY(24px)", transition: "opacity 0.6s ease, transform 0.6s ease" }}>
                <div style={{ fontFamily: "'Syne',sans-serif", fontSize: "4rem", fontWeight: 800, color: "rgba(27,107,138,0.07)", lineHeight: 1, marginBottom: -8 }}>{num}</div>
                <div style={{ width: 72, height: 72, borderRadius: 20, background: "linear-gradient(135deg,rgba(27,107,138,0.12),rgba(27,107,138,0.05))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.7rem", margin: "0 auto 20px", border: "1px solid rgba(27,107,138,0.12)" }}>{icon}</div>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: 10, color: "#0C1B2E" }}>{title}</h3>
                <p style={{ fontSize: "0.9rem", color: "#5C6E84", lineHeight: 1.6 }}>{desc}</p>
              </div>
            ))}
          </div>
          {/* Showcase */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 56, alignItems: "center", marginTop: 64 }}>
            <div style={{ borderRadius: 24, overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,0.1)" }}>
              <img src="/images/1.jpg" alt="Find experts nearby" style={{ width: "100%", display: "block", objectFit: "cover", height: 360 }} />
            </div>
            <div>
              <SectionTag>For Residents</SectionTag>
              <h3 style={{ fontFamily: "'Syne',sans-serif", fontSize: "1.7rem", fontWeight: 800, letterSpacing: -1, lineHeight: 1.2, marginBottom: 16 }}>Find trusted help<br />next door, not<br />on the internet.</h3>
              <p style={{ color: "#5C6E84", lineHeight: 1.7, marginBottom: 24, fontSize: "0.95rem" }}>Every professional is your neighbour. Endorsements from fellow flat owners carry more weight than 5-star reviews from strangers. Stop scrolling Urban Company — start asking the CA in Tower B.</p>
              <button onClick={() => navigate("/register")} style={{ background: "linear-gradient(135deg,#F5692C,#E8450A)", color: "#fff", border: "none", padding: "12px 28px", borderRadius: 50, fontWeight: 700, fontSize: "0.9rem", cursor: "pointer", boxShadow: "0 4px 16px rgba(245,105,44,0.35)" }}>
                Join the Waitlist
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── CATEGORIES ── */}
      <section id="categories" style={{ background: "#F4F7FB", padding: "80px 6%" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <SectionTag>Service Categories</SectionTag>
          <h2 style={sTitle}>20+ professional categories,<br />all inside your gates.</h2>
          <p style={sSub}>From tax filing to yoga, from tutoring to pet care — your society has more talent than you think.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
            {[["📊", "Tax & CA"], ["💹", "Investment & Wealth"], ["⚖️", "Legal"], ["🏥", "Health & Wellness"], ["🧠", "Mental Health"], ["🧘", "Fitness & Yoga"], ["🥗", "Nutrition & Diet"], ["📚", "Tutoring & Academics"], ["💻", "IT & Tech"], ["🎨", "Design & Creative"], ["📷", "Photography"], ["🎵", "Music & Arts"], ["💼", "Career Coaching"], ["🎉", "Event Planning"], ["🐾", "Pet Care"], ["✨", "Beauty & Grooming"]].map(([icon, name]) => (
              <div key={name as string} className="lp-reveal" style={{ background: "#fff", border: "1.5px solid rgba(27,107,138,0.1)", borderRadius: 16, padding: "18px 16px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", opacity: 0, transform: "translateY(16px)", transition: "opacity 0.5s ease, transform 0.5s ease, border-color 0.2s, box-shadow 0.2s" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "#1B6B8A"; (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 20px rgba(27,107,138,0.12)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(27,107,138,0.1)"; (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
              >
                <span style={{ fontSize: "1.4rem" }}>{icon}</span>
                <span style={{ fontSize: "0.86rem", fontWeight: 600, color: "#0C1B2E" }}>{name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" style={{ background: "#0C1B2E", padding: "90px 6%" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <SectionTag light>Features</SectionTag>
          <h2 style={{ ...sTitle, color: "#fff" }}>Built for the way gated communities <em style={{ color: "#F5692C", fontStyle: "normal" }}>actually</em> work.</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 22, marginTop: 48 }}>
            {[
              ["⚡", null, "Instant Slot Booking", "Pros publish real-time availability. Pick a slot, confirm instantly. No back-and-forth, no ghosting."],
              ["👥", "Phase 2", "Group Sessions", "8 households book one yoga class at ₹150/head. Pro fills the calendar. Residents save 80%."],
              ["🔄", "Phase 2", "Recurring Bookings", 'One-click "Subscribe to this" — auto-books weekly yoga, monthly CA reviews, fortnightly check-ins.'],
              ["🤝", null, "Neighbour Endorsements", '"Endorsed by 4 neighbours in Tower B." Far more trusted than anonymous internet reviews.'],
              ["📹", "Phase 2", "Video Consultations", "Built-in video for CA, legal, mental health. Opens pros who don't need physical presence."],
              ["🏷️", "Phase 2", "Society Exclusive Deals", "Flash discounts only visible to your society. Creates urgency, drives first bookings."],
              ["📋", "Phase 2", "Society Noticeboard", "Replaces your 300-member WhatsApp chaos. Lost & Found, Alerts — structured, admin-moderated."],
              ["🏸", "Phase 2", "Amenity Booking", "Clubhouse, pool, badminton court — book through the app. No more calling the guard."],
              ["🔐", null, "Verified Pro Badges", "🎓 Degree · 🪪 ID · ✅ Background — critical for health, legal, mental health categories."],
            ].map(([icon, phase, title, desc]) => (
              <div key={title as string} className="lp-reveal" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 30, opacity: 0, transform: "translateY(20px)", transition: "opacity 0.6s ease, transform 0.6s ease, background 0.2s", position: "relative", overflow: "hidden" }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.09)"}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)"}
              >
                <div style={{ fontSize: "1.8rem", marginBottom: 16 }}>{icon}</div>
                {phase && <div style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", color: "#F5692C", background: "rgba(245,105,44,0.15)", borderRadius: 50, padding: "2px 10px", display: "inline-block", marginBottom: 8 }}>{phase}</div>}
                <h3 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: 10, color: "#fff" }}>{title}</h3>
                <p style={{ fontSize: "0.86rem", color: "rgba(255,255,255,0.58)", lineHeight: 1.6 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section style={{ padding: "90px 6%" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <SectionTag>Beta Feedback</SectionTag>
          <h2 style={sTitle}>What our pilot community is saying.</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 24, marginTop: 48 }}>
            {[
              ["RA", "Rahul Agarwal", "Magarpatta City, Pune", "I found a CA in my own tower. He filed my ITR for ₹800 and I could just walk over if I had questions. This is how it should have always worked."],
              ["PS", "Priya Sharma", "Yoga Instructor · Wakad, Pune", "I listed my yoga sessions and had 6 bookings in the first week — from neighbours I already knew. Zero marketing spend. The trust was already there."],
              ["NK", "Neha Kulkarni", "Prestige Bella Vista, Pune", "My daughter gets math tutoring from the IIT engineer in Block D. He charges ₹300/hr vs ₹900 on other platforms. Trust isn't an issue — we share the same elevator."],
            ].map(([initials, name, loc, quote]) => (
              <div key={name as string} className="lp-reveal" style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 16, padding: 32, boxShadow: "0 4px 32px rgba(0,0,0,0.07)", opacity: 0, transform: "translateY(20px)", transition: "opacity 0.6s ease, transform 0.6s ease" }}>
                <div style={{ color: "#F5692C", fontSize: "1.1rem", marginBottom: 16 }}>★★★★★</div>
                <p style={{ fontSize: "0.93rem", color: "#5C6E84", lineHeight: 1.7, marginBottom: 20, fontStyle: "italic" }}>"{quote}"</p>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 42, height: 42, borderRadius: "50%", background: "linear-gradient(135deg,#1B6B8A,#F5692C)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: "0.9rem" }}>{initials}</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "#0C1B2E" }}>{name}</div>
                    <div style={{ fontSize: "0.76rem", color: "#5C6E84" }}>{loc}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── EARLY ACCESS BENEFITS ── */}
      <section id="early" style={{ background: "linear-gradient(135deg,#FFF8F5,#F0F8FC)", padding: "90px 6%" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "center" }}>
          <div style={{ borderRadius: 24, overflow: "hidden", position: "relative", boxShadow: "0 24px 64px rgba(0,0,0,0.12)" }}>
            <img src="/images/cta-bg.jpg" alt="Community" style={{ width: "100%", display: "block", height: 420, objectFit: "cover" }} />
            <div style={{ position: "absolute", top: 20, left: 20, background: "linear-gradient(135deg,#F5692C,#E8450A)", color: "#fff", fontWeight: 700, fontSize: "0.78rem", padding: "8px 18px", borderRadius: 50, boxShadow: "0 4px 16px rgba(245,105,44,0.4)", letterSpacing: 0.5 }}>
              🎯 Founding Member — May 2026
            </div>
          </div>
          <div>
            <SectionTag>Early Joiner Benefits</SectionTag>
            <h2 style={sTitle}>First 1000 members get founder perks for life.</h2>
            <p style={{ color: "#5C6E84", lineHeight: 1.65, marginBottom: 8, fontSize: "0.95rem" }}>This is a one-time opportunity. Once we launch, these perks are gone.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: 28 }}>
              {[
                ["🏆", "Founder Badge on Profile", "Permanent social trust signal. Stands out in every search result, forever."],
                ["💰", "Zero Platform Fee — First 6 Months", "Pros keep 100% of earnings. Residents get 3 free booking credits on launch."],
                ["🚀", "Priority Society Onboarding", "Your society goes live before public launch. First-mover advantage in your community."],
                ["🎁", "Shape the Product", "Direct access to the founding team. Your feature requests get built first."],
                ["⭐", "Referral Credits That Stack", "₹200 credit per successful referral, with no cap. Viral loop that pays you back."],
              ].map(([icon, title, desc]) => (
                <div key={title as string} style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: "linear-gradient(135deg,#F5692C,#E8450A)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "0.88rem", marginTop: 2 }}>{icon}</div>
                  <div>
                    <strong style={{ display: "block", fontSize: "0.95rem", fontWeight: 700, color: "#0C1B2E", marginBottom: 2 }}>{title}</strong>
                    <span style={{ fontSize: "0.84rem", color: "#5C6E84" }}>{desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>



      {/* ── FOOTER ── */}
      <footer style={{ background: "#0C1B2E", color: "rgba(255,255,255,0.55)", padding: "60px 6% 28px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 40, paddingBottom: 40, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <img src="/images/logo.png" alt="ProNeighbor" style={{ height: 36 }} />
                <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, color: "#fff" }}>ProNeighbor</span>
              </div>
              <p style={{ fontSize: "0.86rem", lineHeight: 1.7, maxWidth: 240 }}>The professional services marketplace for gated communities. Trusted experts, next door.</p>
              <p style={{ marginTop: 12, fontSize: "0.78rem" }}>📍 Park Street, Wakad, Pune · Launched March 2026</p>
            </div>
            {[
              ["Product", [["How it Works", "#how"], ["Features", "#features"], ["Categories", "#categories"], ["Early Access", "#early"]]],
              ["For Pros", [["Register as Expert", "/register"], ["Earn Locally", "#features"], ["Founder Perks", "#early"]]],
              ["Company", [["About Us", "#"], ["Privacy Policy", "#"], ["Terms of Use", "#"], ["Contact", "mailto:hello@proneighbour.in"]]],
            ].map(([heading, links]) => (
              <div key={heading as string}>
                <h4 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, color: "#fff", marginBottom: 16, fontSize: "0.93rem" }}>{heading}</h4>
                {(links as [string, string][]).map(([label, href]) => (
                  <a key={label} href={href} style={{ display: "block", color: "rgba(255,255,255,0.5)", fontSize: "0.83rem", marginBottom: 10, textDecoration: "none" }}
                    onMouseEnter={e => (e.target as HTMLElement).style.color = "#fff"}
                    onMouseLeave={e => (e.target as HTMLElement).style.color = "rgba(255,255,255,0.5)"}
                  >{label}</a>
                ))}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 24, fontSize: "0.8rem", flexWrap: "wrap", gap: 8 }}>
            <span>© 2026 ProNeighbor. All rights reserved.</span>
            <span>Made with ❤️ in Pune, India 🇮🇳</span>
          </div>
        </div>
      </footer>

      {/* ── KEYFRAMES ── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&display=swap');
        @keyframes lpPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(1.4)} }
        #lp-root a { text-decoration: none; }
        @media (max-width: 900px) {
          #lp-root nav > div:last-child > button:not(:last-child) { display: none; }
        }
      `}</style>
    </div>
  );
}

/* ── Shared sub-components ── */
function SectionTag({ children, light, orange }: { children: React.ReactNode; light?: boolean; orange?: boolean }) {
  return (
    <div style={{
      display: "inline-block",
      background: orange ? "rgba(245,105,44,0.2)" : light ? "rgba(255,255,255,0.1)" : "rgba(27,107,138,0.1)",
      color: orange ? "#FFB894" : light ? "rgba(255,255,255,0.8)" : "#1B6B8A",
      fontSize: "0.76rem", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase",
      padding: "5px 14px", borderRadius: 50, marginBottom: 16,
    }}>{children}</div>
  );
}

const sTitle: React.CSSProperties = {
  fontFamily: "'Syne','DM Sans',sans-serif",
  fontSize: "clamp(1.7rem,2.8vw,2.6rem)",
  fontWeight: 800, letterSpacing: -1, lineHeight: 1.15,
  color: "#0C1B2E", marginBottom: 12,
};
const sSub: React.CSSProperties = {
  fontSize: "1rem", color: "#5C6E84", lineHeight: 1.65, maxWidth: 540, marginBottom: 48,
};
