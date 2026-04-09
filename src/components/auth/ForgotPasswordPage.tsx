import { useState, FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

export function ForgotPasswordPage() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      await resetPassword(email);
      setSuccess(true);
    } catch (err: unknown) {
      const msg = (err as { code?: string })?.code;
      setError(
        msg === "auth/user-not-found" ? "No account found with this email." :
          msg === "auth/invalid-email" ? "Invalid email address." :
            "Failed to send reset email. Please try again."
      );
    } finally { setLoading(false); }
  };

  return (
    <div className="auth-shell">
      <div className="auth-brand" style={{
        backgroundImage: "linear-gradient(rgba(0, 0, 0, 0.4), rgba(0, 0, 0, 0.6)), url('/images/auth_bg.png')",
        backgroundSize: "cover", backgroundPosition: "center", color: "white"
      }}>
        <div className="brand-logo" style={{ display: "flex", alignItems: "center", gap: "12px", color: "white" }}>
          <img src="/images/logo.png" alt="Logo" loading="lazy" style={{ width: "44px", height: "44px", objectFit: "contain", borderRadius: "8px" }} />
          ProNeighbor
        </div>
        <h2 className="brand-headline" style={{ color: "white" }}>Reset your password</h2>
        <p className="brand-sub">We'll send you a link to get back into your account.</p>
      </div>
      <div className="auth-form-panel">
        <div className="auth-card">
          <h1 className="auth-title">Forgot Password</h1>
          <p className="auth-sub">Enter your email to receive a password reset link</p>

          {error && <div className="error-box">{error}</div>}

          {success ? (
            <div style={{ textAlign: "center", padding: "24px 0" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📧</div>
              <h3 style={{ marginBottom: 8 }}>Check your email</h3>
              <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 24 }}>
                We've sent a password reset link to <strong>{email}</strong>. Check your inbox and follow the instructions.
              </p>
              <Link to="/login" className="btn btn-primary" style={{ display: "inline-flex" }}>Back to Sign In</Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="field">
                <label>Email</label>
                <input type="email" placeholder="you@example.com" value={email}
                  onChange={e => setEmail(e.target.value)} required />
              </div>
              <button className="btn-primary" type="submit" disabled={loading}>
                {loading ? "Sending..." : "Send Reset Link"}
              </button>
            </form>
          )}

          <p className="auth-footer">
            Remember your password? <Link to="/login">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}


