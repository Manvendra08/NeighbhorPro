import { useState, FormEvent, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

export { ForgotPasswordPage } from "./ForgotPasswordPage";

/* Styles are now in index.css */

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18">
    <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" />
    <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" />
    <path fill="#FBBC05" d="M3.964 10.707A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" />
    <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.96L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z" />
  </svg>
);

/* ══════════════════════════════════════════
   LOGIN PAGE
══════════════════════════════════════════ */
export function LoginPage() {
  const { signIn, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      await signIn(email, password);
      navigate("/dashboard");
    } catch (err: unknown) {
      const msg = (err as { code?: string })?.code;
      setError(
        msg === "auth/user-not-found" ? "No account found with this email." :
          msg === "auth/wrong-password" ? "Incorrect password." :
            msg === "auth/too-many-requests" ? "Too many attempts. Try again later." :
              "Sign-in failed. Check your credentials."
      );
    } finally { setLoading(false); }
  };

  const handleGoogle = async () => {
    setError(""); setLoading(true);
    try {
      await signInWithGoogle();
      navigate("/dashboard");
    } catch { setError("Google sign-in failed."); }
    finally { setLoading(false); }
  };

  return (
    <div className="auth-shell">
      <BrandPanel />
      <div className="auth-form-panel">
        <div className="auth-card">
          <Link to="/" className="auth-logo-link" title="Go to Home">
            <img src="/images/logo.png" alt="Logo" loading="lazy" style={{ width: 40, height: 40 }} />
          </Link>
          <h1 className="auth-title">Welcome back</h1>
          <p className="auth-sub">Sign in to your ProNeighbor account</p>

          {error && <div className="error-box">{error}</div>}

          <button className="btn-google" onClick={handleGoogle} disabled={loading}>
            <GoogleIcon /> Continue with Google
          </button>

          <div className="divider">or sign in with email</div>

          <form onSubmit={handleSubmit}>
            <div className="field">
              <label>Email</label>
              <input type="email" placeholder="you@example.com" value={email}
                onChange={e => setEmail(e.target.value)} required />
            </div>
            <div className="field">
              <label>Password</label>
              <input type="password" placeholder="••••••••" value={password}
                onChange={e => setPassword(e.target.value)} required />
            </div>
            <button className="btn-primary" type="submit" disabled={loading}>
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>

          <p className="auth-footer">
            <Link to="/forgot-password" style={{ fontSize: 13, color: 'var(--muted)' }}>Forgot password?</Link>
          </p>
          <p className="auth-footer">
            Don't have an account? <Link to="/register">Create one</Link>
          </p>
          <p className="auth-footer" style={{ marginTop: '8px', fontSize: '13px' }}>
            Need help? <Link to="/contact">Contact Support</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   SHARED BRAND PANEL
══════════════════════════════════════════ */
function BrandPanel({ register }: { register?: boolean }) {
  return (
    <div className="auth-brand" style={{
      backgroundImage: "linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.8)), url('/images/auth_bg.png')",
      backgroundSize: "cover",
      backgroundPosition: "center",
      color: "white"
    }}>
      <Link to="/" className="brand-logo" style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        color: "white",
        textShadow: "0 2px 8px rgba(0,0,0,0.3)",
        textDecoration: "none"
      }}>
        <img src="/images/logo_new.png" alt="Logo" loading="lazy" style={{ width: "44px", height: "44px", objectFit: "contain", borderRadius: "8px" }} />
        ProNeighbor
      </Link>
      <h2 className="brand-headline" style={{
        color: "white",
        textShadow: "0 2px 12px rgba(0,0,0,0.5)"
      }}>
        {register ? "Find trusted pros,\nnear you." : "Your community,\nyour experts."}
      </h2>
      <p className="brand-sub" style={{
        color: "rgba(255, 255, 255, 0.95)",
        textShadow: "0 1px 6px rgba(0,0,0,0.3)"
      }}>
        Connect with verified local professionals — CA, Tutor, Health experts, and more — within your neighborhood.
      </p>
      <div className="brand-pill" style={{
        background: "rgba(255, 255, 255, 0.12)",
        color: "white",
        borderColor: "rgba(255, 255, 255, 0.25)",
        textShadow: "0 1px 4px rgba(0,0,0,0.2)"
      }}>
        Launch in May 2026 for Park Street Residents
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   REGISTER PAGE
══════════════════════════════════════════ */
export function RegisterPage() {
  const { signUp, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref) {
      setReferralCode(ref.trim().toUpperCase());
    }
  }, [searchParams]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setError("Passwords do not match."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    setError(""); setLoading(true);
    try {
      await signUp(email, password, name, referralCode);
      navigate("/dashboard");
    } catch (err: unknown) {
      const msg = (err as { code?: string })?.code;
      const detail = (err as { message?: string })?.message;
      setError(
        msg === "auth/email-already-in-use" ? "This email is already registered." :
          msg === "auth/invalid-email" ? "Invalid email address." :
            msg === "auth/weak-password" ? "Password is too weak. Use at least 8 characters." :
              msg === "auth/too-many-requests" ? "Too many attempts. Please wait and try again." :
                msg === "auth/network-request-failed" ? "Network error. Check your internet and try again." :
                  msg === "permission-denied" ? "Signup setup is incomplete. Please contact support." :
                    detail ? `Registration failed: ${detail}` :
                      "Registration failed. Please try again."
      );
    } finally { setLoading(false); }
  };

  const handleGoogle = async () => {
    setError(""); setLoading(true);
    try {
      await signInWithGoogle(referralCode);
      navigate("/dashboard");
    } catch { setError("Google sign-in failed."); }
    finally { setLoading(false); }
  };

  return (
    <div className="auth-shell">
      <BrandPanel register />
      <div className="auth-form-panel">
        <div className="auth-card">
          <Link to="/" className="auth-logo-link" title="Go to Home">
            <img src="/images/logo.png" alt="Logo" loading="lazy" style={{ width: 40, height: 40 }} />
          </Link>
          <h1 className="auth-title">Create account</h1>
          <p className="auth-sub">Join your neighborhood network</p>

          {error && <div className="error-box">{error}</div>}

          <button className="btn-google" onClick={handleGoogle} disabled={loading}>
            <GoogleIcon /> Continue with Google
          </button>

          <div className="divider">or register with email</div>

          <form onSubmit={handleSubmit}>
            <div className="field">
              <label>Full Name</label>
              <input type="text" placeholder="John Doe" value={name} autoComplete="off"
                onChange={e => setName(e.target.value)} required />
            </div>
            <div className="field">
              <label>Email</label>
              <input type="email" placeholder="you@example.com" value={email}
                onChange={e => setEmail(e.target.value)} required />
            </div>
            <div className="field">
              <label>Password</label>
              <input type="password" placeholder="Min 8 characters" value={password}
                onChange={e => setPassword(e.target.value)} required />
            </div>
            <div className="field">
              <label>Confirm Password</label>
              <input type="password" placeholder="••••••••" value={confirm}
                onChange={e => setConfirm(e.target.value)} required />
            </div>
            <div className="field">
              <label>Referral Code (optional)</label>
              <input
                type="text"
                placeholder="PNXXXXXX"
                value={referralCode}
                onChange={e => setReferralCode(e.target.value.toUpperCase())}
                autoComplete="off"
              />
            </div>
            <div className="field check-field" style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginTop: '4px' }}>
              <input
                type="checkbox"
                id="terms"
                checked={acceptedTerms}
                onChange={e => setAcceptedTerms(e.target.checked)}
                style={{ width: 'auto', marginTop: '3px' }}
              />
              <label htmlFor="terms" style={{ fontSize: '13px', lineHeight: '1.4', color: 'var(--muted)', cursor: 'pointer' }}>
                I have read and agree to the <Link to="/terms" target="_blank" style={{ color: 'var(--accent)', fontWeight: 600 }}>Terms of Service</Link> and <Link to="/privacy" target="_blank" style={{ color: 'var(--accent)', fontWeight: 600 }}>Privacy Policy</Link>.
              </label>
            </div>
            <button className="btn-3d" type="submit" disabled={loading || !acceptedTerms || !name.trim() || !email.trim() || !password || !confirm} style={{ width: '100%', marginTop: '12px' }}>
              {loading ? "Creating account…" : "Create Account"}
            </button>
          </form>

          <p className="auth-footer">
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
          <p className="auth-footer" style={{ marginTop: '8px', fontSize: '13px' }}>
            Need help? <Link to="/contact">Contact Support</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
