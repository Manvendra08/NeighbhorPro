import { useState, FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

/* ── shared styles injected once ── */
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg:       #060b18;
    --surface:  #0d1425;
    --border:   rgba(255,255,255,0.07);
    --accent:   #3d7eff;
    --accent2:  #00e5b0;
    --text:     #f0f4ff;
    --muted:    #8892a4;
    --error:    #ff5c5c;
    --radius:   14px;
  }

  body { background: var(--bg); color: var(--text); font-family: 'DM Sans', sans-serif; }

  .auth-shell {
    min-height: 100vh;
    display: grid;
    grid-template-columns: 1fr 1fr;
  }
  @media (max-width: 768px) {
    .auth-shell { grid-template-columns: 1fr; }
    .auth-brand { display: none; }
  }

  /* ── brand panel ── */
  .auth-brand {
    background: radial-gradient(ellipse at 30% 50%, #1a3a6e 0%, #060b18 60%);
    display: flex; flex-direction: column; justify-content: center; padding: 60px;
    position: relative; overflow: hidden;
  }
  .auth-brand::before {
    content: '';
    position: absolute; inset: 0;
    background: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%233d7eff' fill-opacity='0.04'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
    opacity: 1;
  }
  .brand-logo {
    font-family: 'Syne', sans-serif;
    font-size: 28px; font-weight: 800; letter-spacing: -0.5px;
    background: linear-gradient(135deg, #fff 40%, var(--accent2));
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    margin-bottom: 48px;
  }
  .brand-headline {
    font-family: 'Syne', sans-serif;
    font-size: 42px; font-weight: 700; line-height: 1.1;
    margin-bottom: 20px;
  }
  .brand-sub {
    font-size: 16px; color: var(--muted); line-height: 1.6; max-width: 340px;
  }
  .brand-pill {
    display: inline-flex; align-items: center; gap: 8px;
    background: rgba(61,126,255,0.12); border: 1px solid rgba(61,126,255,0.25);
    border-radius: 50px; padding: 6px 14px;
    font-size: 13px; color: var(--accent2);
    margin-top: 40px;
  }
  .brand-pill::before { content: '●'; font-size: 8px; }

  /* ── form panel ── */
  .auth-form-panel {
    display: flex; align-items: center; justify-content: center;
    padding: 40px 24px;
    background: var(--bg);
  }
  .auth-card {
    width: 100%; max-width: 420px;
  }
  .auth-title {
    font-family: 'Syne', sans-serif;
    font-size: 26px; font-weight: 700;
    margin-bottom: 6px;
  }
  .auth-sub { font-size: 14px; color: var(--muted); margin-bottom: 32px; }

  /* ── google btn ── */
  .btn-google {
    width: 100%; display: flex; align-items: center; justify-content: center; gap: 10px;
    background: var(--surface); border: 1px solid var(--border);
    color: var(--text); font-size: 14px; font-weight: 500;
    padding: 12px; border-radius: var(--radius); cursor: pointer;
    transition: border-color 0.2s, background 0.2s;
    font-family: 'DM Sans', sans-serif;
  }
  .btn-google:hover { border-color: rgba(255,255,255,0.18); background: #121929; }
  .btn-google svg { flex-shrink: 0; }

  /* ── divider ── */
  .divider {
    display: flex; align-items: center; gap: 12px;
    margin: 24px 0; color: var(--muted); font-size: 12px;
  }
  .divider::before, .divider::after {
    content: ''; flex: 1; height: 1px; background: var(--border);
  }

  /* ── field ── */
  .field { margin-bottom: 16px; }
  .field label {
    display: block; font-size: 13px; font-weight: 500;
    margin-bottom: 6px; color: #c8d0e0;
  }
  .field input {
    width: 100%; background: var(--surface); border: 1px solid var(--border);
    color: var(--text); font-size: 14px; font-family: 'DM Sans', sans-serif;
    padding: 11px 14px; border-radius: var(--radius);
    outline: none; transition: border-color 0.2s;
  }
  .field input:focus { border-color: var(--accent); }
  .field input::placeholder { color: var(--muted); }

  /* ── primary btn ── */
  .btn-primary {
    width: 100%; padding: 13px;
    background: linear-gradient(135deg, var(--accent), #2556cc);
    color: #fff; font-size: 15px; font-weight: 600;
    border: none; border-radius: var(--radius); cursor: pointer;
    font-family: 'DM Sans', sans-serif;
    transition: opacity 0.2s, transform 0.1s;
    margin-top: 8px;
  }
  .btn-primary:hover { opacity: 0.92; }
  .btn-primary:active { transform: scale(0.99); }
  .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

  /* ── error ── */
  .error-box {
    background: rgba(255,92,92,0.1); border: 1px solid rgba(255,92,92,0.3);
    color: var(--error); font-size: 13px; padding: 10px 14px;
    border-radius: 10px; margin-bottom: 16px;
  }

  /* ── footer link ── */
  .auth-footer {
    text-align: center; margin-top: 24px;
    font-size: 14px; color: var(--muted);
  }
  .auth-footer a { color: var(--accent); text-decoration: none; font-weight: 500; }
  .auth-footer a:hover { text-decoration: underline; }

  /* ── loader ── */
  .loader {
    width: 36px; height: 36px; border-radius: 50%;
    border: 3px solid rgba(61,126,255,0.2);
    border-top-color: var(--accent);
    animation: spin 0.7s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
`;

function injectStyles() {
  if (typeof document !== "undefined" && !document.getElementById("np-auth-styles")) {
    const style = document.createElement("style");
    style.id = "np-auth-styles";
    style.textContent = GLOBAL_CSS;
    document.head.appendChild(style);
  }
}

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18">
    <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
    <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"/>
    <path fill="#FBBC05" d="M3.964 10.707A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"/>
    <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.96L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z"/>
  </svg>
);

/* ══════════════════════════════════════════
   LOGIN PAGE
══════════════════════════════════════════ */
export function LoginPage() {
  injectStyles();
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
          <h1 className="auth-title">Welcome back</h1>
          <p className="auth-sub">Sign in to your NeighbhorPro account</p>

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
            Don't have an account? <Link to="/register">Create one</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   REGISTER PAGE
══════════════════════════════════════════ */
export function RegisterPage() {
  injectStyles();
  const { signUp, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setError("Passwords do not match."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    setError(""); setLoading(true);
    try {
      await signUp(email, password, name);
      navigate("/dashboard");
    } catch (err: unknown) {
      const msg = (err as { code?: string })?.code;
      setError(
        msg === "auth/email-already-in-use" ? "This email is already registered." :
        msg === "auth/invalid-email" ? "Invalid email address." :
        "Registration failed. Please try again."
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
      <BrandPanel register />
      <div className="auth-form-panel">
        <div className="auth-card">
          <h1 className="auth-title">Create account</h1>
          <p className="auth-sub">Join your neighbourhood network</p>

          {error && <div className="error-box">{error}</div>}

          <button className="btn-google" onClick={handleGoogle} disabled={loading}>
            <GoogleIcon /> Continue with Google
          </button>

          <div className="divider">or register with email</div>

          <form onSubmit={handleSubmit}>
            <div className="field">
              <label>Full Name</label>
              <input type="text" placeholder="Manvendra Anjan" value={name}
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
            <button className="btn-primary" type="submit" disabled={loading}>
              {loading ? "Creating account…" : "Create Account"}
            </button>
          </form>

          <p className="auth-footer">
            Already have an account? <Link to="/login">Sign in</Link>
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
    <div className="auth-brand">
      <div className="brand-logo">NeighbhorPro</div>
      <h2 className="brand-headline">
        {register ? "Find trusted pros,\nnear you." : "Your community,\nyour experts."}
      </h2>
      <p className="brand-sub">
        Connect with verified local professionals — plumbers, tutors, electricians, and more — within your neighbourhood.
      </p>
      <div className="brand-pill">Live in Pimpri Chinchwad & beyond</div>
    </div>
  );
}
