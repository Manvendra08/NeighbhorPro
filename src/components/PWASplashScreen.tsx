import { useEffect, useState } from "react";

/**
 * PWASplashScreen
 * Shows ONLY when:
 *   1. App is running in standalone mode (saved to home screen)
 *   2. On a mobile device
 * Auto-dismisses after 2s with fade-out animation.
 */
export default function PWASplashScreen() {
  const [visible, setVisible] = useState(false);
  const [fading, setFading]   = useState(false);

  useEffect(() => {
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches
      || (navigator as unknown as { standalone?: boolean }).standalone === true;
    const isMobile = window.innerWidth <= 768 || /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

    if (!isStandalone || !isMobile) return;

    // Only show once per session (not on every page nav)
    if (sessionStorage.getItem("splash-shown")) return;
    sessionStorage.setItem("splash-shown", "1");

    setVisible(true);
    const fadeTimer  = setTimeout(() => setFading(true),  1800);
    const hideTimer  = setTimeout(() => setVisible(false), 2300);
    return () => { clearTimeout(fadeTimer); clearTimeout(hideTimer); };
  }, []);

  if (!visible) return null;

  return (
    <div style={{
      position:   "fixed",
      inset:      0,
      zIndex:     99999,
      display:    "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      background: "linear-gradient(160deg, #0C1B2E 0%, #1B6B8A 100%)",
      transition: "opacity 0.5s ease",
      opacity:    fading ? 0 : 1,
      paddingTop: "env(safe-area-inset-top)",
      paddingBottom: "env(safe-area-inset-bottom)",
    }}>
      {/* Logo with pulse ring */}
      <div style={{ position: "relative", marginBottom: 28 }}>
        <div style={{
          position: "absolute", inset: -12,
          borderRadius: "50%",
          border: "2px solid rgba(255,255,255,0.15)",
          animation: "splashPulse 1.5s ease-in-out infinite",
        }} />
        <img
          src="/images/logo.png"
          alt="ProNeighbor"
          style={{
            width: 88, height: 88,
            borderRadius: 22,
            boxShadow: "0 8px 40px rgba(0,0,0,0.35)",
            display: "block",
          }}
        />
      </div>

      {/* Wordmark */}
      <div style={{
        fontFamily: "'Playfair Display', serif",
        fontWeight: 800,
        fontSize: "clamp(24px, 7vw, 32px)",
        color: "#fff",
        letterSpacing: -0.5,
        marginBottom: 8,
      }}>
        Pro<span style={{ color: "#F5692C" }}>Neighbour</span>
      </div>

      <div style={{
        fontSize: "clamp(12px, 3.5vw, 14px)",
        color: "rgba(255,255,255,0.55)",
        fontFamily: "'DM Sans', sans-serif",
        letterSpacing: 0.3,
      }}>
        Your society's professional network
      </div>

      {/* Loading dots */}
      <div style={{ display: "flex", gap: 6, marginTop: 48 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: 6, height: 6,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.4)",
            animation: `splashDot 1.2s ease-in-out ${i * 0.2}s infinite`,
          }} />
        ))}
      </div>

      <style>{`
        @keyframes splashPulse {
          0%, 100% { transform: scale(1);    opacity: 0.6; }
          50%       { transform: scale(1.12); opacity: 0.2; }
        }
        @keyframes splashDot {
          0%, 80%, 100% { transform: scale(0.7); opacity: 0.3; }
          40%            { transform: scale(1.2); opacity: 1;   }
        }
      `}</style>
    </div>
  );
}


