import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { applyActionCode } from "firebase/auth";
import { auth } from "../../firebase";

type State = "verifying" | "success" | "already_verified" | "error";

export function EmailVerifiedPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [state, setState] = useState<State>("verifying");

  const oobCode = searchParams.get("oobCode");

  useEffect(() => {
    if (!oobCode) { setState("error"); return; }

    applyActionCode(auth, oobCode)
      .then(() => {
        // Reload current user so emailVerified flag updates
        auth.currentUser?.reload();
        setState("success");
      })
      .catch((err) => {
        // auth/invalid-action-code or auth/expired-action-code
        if (err.code === "auth/invalid-action-code") {
          setState("already_verified"); // likely clicked link twice
        } else {
          setState("error");
        }
      });
  }, [oobCode]);

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #F0F8FC 0%, #FFF8F5 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "24px", fontFamily: "'DM Sans', sans-serif",
    }}>
      <div style={{
        background: "#fff", borderRadius: 20,
        boxShadow: "0 8px 48px rgba(0,0,0,0.10)",
        padding: "48px 44px", maxWidth: 460, width: "100%", textAlign: "center",
      }}>

        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 36 }}>
          <img src="/images/logo.png" alt="ProNeighbor" style={{ height: 36 }} />
          <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: "1.15rem", color: "#0C1B2E", letterSpacing: -0.5 }}>
            Pro<span style={{ color: "#F5692C" }}>Neighbour</span>
          </span>
        </div>

        {/* Verifying */}
        {state === "verifying" && (
          <>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(27,107,138,0.08)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px" }}>
              <div style={{ width: 28, height: 28, border: "3px solid rgba(27,107,138,0.2)", borderTopColor: "#1B6B8A", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            </div>
            <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: "1.4rem", fontWeight: 800, color: "#0C1B2E", marginBottom: 10 }}>Verifying your email…</h2>
            <p style={{ color: "#5C6E84", fontSize: "0.95rem", lineHeight: 1.6 }}>Just a moment while we confirm your address.</p>
          </>
        )}

        {/* Success */}
        {state === "success" && (
          <>
            <div style={{ width: 72, height: 72, borderRadius: "50%", background: "rgba(22,163,74,0.1)", border: "2px solid rgba(22,163,74,0.2)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px", fontSize: "2rem" }}>
              ✅
            </div>
            <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: "1.5rem", fontWeight: 800, color: "#0C1B2E", marginBottom: 10 }}>Email verified!</h2>
            <p style={{ color: "#5C6E84", fontSize: "0.95rem", lineHeight: 1.65, marginBottom: 32 }}>
              Your ProNeighbor account is now fully activated. Welcome to your community's professional network.
            </p>
            <div style={{ background: "rgba(27,107,138,0.06)", border: "1px solid rgba(27,107,138,0.15)", borderRadius: 12, padding: "14px 18px", marginBottom: 28, textAlign: "left" }}>
              <div style={{ fontSize: "0.82rem", color: "#1B6B8A", fontWeight: 700, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>You're all set to</div>
              {["Browse verified professionals in your society", "Book consultations using NeighbourCoins", "List your own skills and start earning"].map(item => (
                <div key={item} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.88rem", color: "#0C1B2E", marginBottom: 4 }}>
                  <span style={{ color: "#16a34a", fontWeight: 700 }}>✓</span> {item}
                </div>
              ))}
            </div>
            <button
              onClick={() => navigate("/dashboard")}
              style={{ width: "100%", background: "linear-gradient(135deg,#1B6B8A,#0F4E68)", color: "#fff", border: "none", borderRadius: 50, padding: "14px 28px", fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: "1rem", cursor: "pointer", boxShadow: "0 6px 20px rgba(27,107,138,0.3)" }}
            >
              Go to Dashboard →
            </button>
          </>
        )}

        {/* Already verified */}
        {state === "already_verified" && (
          <>
            <div style={{ width: 72, height: 72, borderRadius: "50%", background: "rgba(27,107,138,0.08)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px", fontSize: "2rem" }}>
              🔒
            </div>
            <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: "1.4rem", fontWeight: 800, color: "#0C1B2E", marginBottom: 10 }}>Already verified</h2>
            <p style={{ color: "#5C6E84", fontSize: "0.95rem", lineHeight: 1.65, marginBottom: 28 }}>
              This link has already been used. Your email is verified — you can sign in normally.
            </p>
            <button
              onClick={() => navigate("/login")}
              style={{ width: "100%", background: "linear-gradient(135deg,#F5692C,#E8450A)", color: "#fff", border: "none", borderRadius: 50, padding: "14px 28px", fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: "1rem", cursor: "pointer" }}
            >
              Sign In
            </button>
          </>
        )}

        {/* Error */}
        {state === "error" && (
          <>
            <div style={{ width: 72, height: 72, borderRadius: "50%", background: "rgba(220,38,38,0.08)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px", fontSize: "2rem" }}>
              ⚠️
            </div>
            <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: "1.4rem", fontWeight: 800, color: "#0C1B2E", marginBottom: 10 }}>Link expired or invalid</h2>
            <p style={{ color: "#5C6E84", fontSize: "0.95rem", lineHeight: 1.65, marginBottom: 28 }}>
              This verification link has expired or is no longer valid. Sign in and we'll send you a fresh one.
            </p>
            <button
              onClick={() => navigate("/login")}
              style={{ width: "100%", background: "linear-gradient(135deg,#F5692C,#E8450A)", color: "#fff", border: "none", borderRadius: 50, padding: "14px 28px", fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: "1rem", cursor: "pointer", marginBottom: 12 }}
            >
              Sign In & Resend Email
            </button>
          </>
        )}

        {/* Footer */}
        <p style={{ marginTop: 28, fontSize: "0.78rem", color: "#9AABB8" }}>
          Need help? <a href="mailto:support@proneighbour.in" style={{ color: "#1B6B8A", textDecoration: "none" }}>support@proneighbour.in</a>
        </p>

        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500&display=swap');
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    </div>
  );
}
