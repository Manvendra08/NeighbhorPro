import { useState, useEffect, FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mail, MapPin, Phone, MessageSquare, Send, ArrowLeft } from "lucide-react";

/* ── tiny shared helpers ── */
function Tag({ children, orange }: { children: React.ReactNode; orange?: boolean }) {
  return (
    <div style={{
      display: "inline-block",
      background: orange ? "rgba(245,105,44,0.1)" : "rgba(27,107,138,0.1)",
      color: orange ? "#F5692C" : "#1B6B8A",
      fontSize: "0.75rem", fontWeight: 700,
      letterSpacing: 1, textTransform: "uppercase",
      padding: "5px 14px", borderRadius: 50, marginBottom: 14,
    }}>{children}</div>
  );
}

export default function Contact() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Simulate API call
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
    }, 1500);
  };

  return (
    <div className="contact-page" style={{ 
      minHeight: '100vh', 
      background: '#fff', 
      fontFamily: "'DM Sans', sans-serif",
      color: '#0C1B2E'
    }}>
      {/* ── HEADER / NAV ── */}
      <nav style={{
        padding: '20px 6%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid rgba(0,0,0,0.05)',
        position: 'sticky',
        top: 0,
        background: 'rgba(255,255,255,0.8)',
        backdropFilter: 'blur(10px)',
        zIndex: 100
      }}>
        <Link to="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <img src="/images/logo_new.png" alt="PN" style={{ height: 32, borderRadius: 6 }} />
          <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: "1rem", color: "#0C1B2E", letterSpacing: -0.5 }}>
            Pro<span style={{ color: "#F5692C" }}>Neighbor</span>
          </span>
        </Link>
        <button 
          onClick={() => navigate(-1)} 
          style={{ 
            background: 'none', 
            border: 'none', 
            display: 'flex', 
            alignItems: 'center', 
            gap: 6, 
            color: '#5C6E84', 
            fontWeight: 500, 
            cursor: 'pointer' 
          }}
        >
          <ArrowLeft size={18} /> Back
        </button>
      </nav>

      <main style={{ padding: '60px 6%' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          
          <div style={{ textAlign: 'center', marginBottom: '60px' }}>
            <Tag>Get in Touch</Tag>
            <h1 style={{ 
              fontFamily: "'Syne', sans-serif", 
              fontSize: 'clamp(2rem, 5vw, 3.5rem)', 
              fontWeight: 800, 
              letterSpacing: '-2px',
              marginBottom: '20px'
            }}>How can we help you?</h1>
            <p style={{ color: '#5C6E84', fontSize: '1.1rem', maxWidth: '600px', margin: '0 auto' }}>
              Have questions about our services or need support? Our team is here to help you connect with your neighborhood.
            </p>
          </div>

          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
            gap: '40px',
            alignItems: 'start'
          }}>
            
            {/* ── FORM SECTION ── */}
            <div style={{ 
              background: '#F8FAFC', 
              padding: '40px', 
              borderRadius: '24px',
              border: '1px solid rgba(0,0,0,0.05)'
            }}>
              {submitted ? (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <div style={{ 
                    width: '64px', 
                    height: '64px', 
                    background: 'rgba(27,107,138,0.1)', 
                    color: '#1B6B8A', 
                    borderRadius: '50%', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    margin: '0 auto 20px'
                  }}>
                    <MessageSquare size={32} />
                  </div>
                  <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: '1.5rem', marginBottom: '10px' }}>Message Sent!</h2>
                  <p style={{ color: '#5C6E84', marginBottom: '30px' }}>Thank you for reaching out. Our team will get back to you within 24 hours.</p>
                  <button 
                    onClick={() => setSubmitted(false)}
                    className="btn-3d"
                    style={{ width: '100%' }}
                  >
                    Send Another Message
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit}>
                  <div className="field" style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '0.9rem' }}>Full Name</label>
                    <input 
                      type="text" 
                      placeholder="John Doe" 
                      required 
                      style={{ 
                        width: '100%', 
                        padding: '12px 16px', 
                        borderRadius: '12px', 
                        border: '1px solid rgba(0,0,0,0.1)',
                        background: '#fff'
                      }} 
                    />
                  </div>
                  <div className="field" style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '0.9rem' }}>Email Address</label>
                    <input 
                      type="email" 
                      placeholder="john@example.com" 
                      required 
                      style={{ 
                        width: '100%', 
                        padding: '12px 16px', 
                        borderRadius: '12px', 
                        border: '1px solid rgba(0,0,0,0.1)',
                        background: '#fff'
                      }} 
                    />
                  </div>
                  <div className="field" style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '0.9rem' }}>Subject</label>
                    <select 
                      required 
                      style={{ 
                        width: '100%', 
                        padding: '12px 16px', 
                        borderRadius: '12px', 
                        border: '1px solid rgba(0,0,0,0.1)',
                        background: '#fff'
                      }}
                    >
                      <option value="">Select a topic</option>
                      <option value="general">General Inquiry</option>
                      <option value="support">Technical Support</option>
                      <option value="billing">Billing Question</option>
                      <option value="partnership">Partnership</option>
                    </select>
                  </div>
                  <div className="field" style={{ marginBottom: '30px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '0.9rem' }}>Message</label>
                    <textarea 
                      placeholder="How can we help?" 
                      required 
                      rows={5}
                      style={{ 
                        width: '100%', 
                        padding: '12px 16px', 
                        borderRadius: '12px', 
                        border: '1px solid rgba(0,0,0,0.1)',
                        background: '#fff',
                        resize: 'none'
                      }} 
                    />
                  </div>
                  <button 
                    type="submit" 
                    className="btn-3d" 
                    disabled={loading}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
                  >
                    {loading ? "Sending..." : <>Send Message <Send size={18} /></>}
                  </button>
                </form>
              )}
            </div>

            {/* ── INFO SECTION ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
              <div style={{ 
                borderRadius: '24px', 
                overflow: 'hidden', 
                height: '250px',
                position: 'relative',
                boxShadow: '0 20px 40px rgba(0,0,0,0.1)'
              }}>
                <img 
                  src="/images/contact-hero.png" 
                  alt="Support Team" 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                />
                <div style={{ 
                  position: 'absolute', 
                  bottom: 0, 
                  left: 0, 
                  right: 0, 
                  padding: '20px', 
                  background: 'linear-gradient(to top, rgba(0,0,0,0.6), transparent)',
                  color: '#fff'
                }}>
                  <p style={{ fontWeight: 600, fontSize: '0.9rem' }}>Always online to support you.</p>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-start' }}>
                  <div style={{ padding: '10px', background: 'rgba(27,107,138,0.1)', color: '#1B6B8A', borderRadius: '12px' }}>
                    <Mail size={20} />
                  </div>
                  <div>
                    <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '4px' }}>Email Us</h4>
                    <p style={{ color: '#5C6E84', fontSize: '0.95rem' }}>support@proneighbor.com</p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-start' }}>
                  <div style={{ padding: '10px', background: 'rgba(245,105,44,0.1)', color: '#F5692C', borderRadius: '12px' }}>
                    <Phone size={20} />
                  </div>
                  <div>
                    <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '4px' }}>Call Us</h4>
                    <p style={{ color: '#5C6E84', fontSize: '0.95rem' }}>+91 1800-PRO-NEIGHBOR</p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-start' }}>
                  <div style={{ padding: '10px', background: 'rgba(27,107,138,0.1)', color: '#1B6B8A', borderRadius: '12px' }}>
                    <MapPin size={20} />
                  </div>
                  <div>
                    <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '4px' }}>Visit Us</h4>
                    <p style={{ color: '#5C6E84', fontSize: '0.95rem' }}>Hub 24, Cyber Park, Sector 62<br />Noida, UP, India</p>
                  </div>
                </div>
              </div>

              <div style={{ 
                marginTop: '10px',
                padding: '20px', 
                background: 'rgba(27,107,138,0.05)', 
                borderRadius: '16px',
                border: '1px dashed rgba(27,107,138,0.2)'
              }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '10px', color: '#1B6B8A' }}>Quick Help</h4>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <li><Link to="/faq" style={{ color: '#5C6E84', fontSize: '0.85rem', textDecoration: 'none' }}>→ Frequently Asked Questions</Link></li>
                  <li><Link to="/support" style={{ color: '#5C6E84', fontSize: '0.85rem', textDecoration: 'none' }}>→ Raise a Support Ticket</Link></li>
                  <li><Link to="/terms" style={{ color: '#5C6E84', fontSize: '0.85rem', textDecoration: 'none' }}>→ Terms of Service</Link></li>
                </ul>
              </div>
            </div>

          </div>
        </div>
      </main>

      <footer style={{ 
        padding: '40px 6%', 
        borderTop: '1px solid rgba(0,0,0,0.05)', 
        textAlign: 'center',
        background: '#FAFBFD'
      }}>
        <p style={{ color: '#5C6E84', fontSize: '0.9rem' }}>
          © 2026 ProNeighbor. All rights reserved. Connecting neighbors, creating community.
        </p>
      </footer>
    </div>
  );
}
