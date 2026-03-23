import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function PWAInstallBanner() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSHint, setShowIOSHint] = useState(false);

  useEffect(() => {
    // Already installed — don't show
    if (window.matchMedia("(display-mode: standalone)").matches) return;

    // Check if dismissed before
    if (localStorage.getItem("pwa-banner-dismissed")) return;

    // iOS detection — no beforeinstallprompt, show manual hint instead
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as unknown as { MSStream: unknown }).MSStream;
    if (ios) { setIsIOS(true); setShowIOSHint(true); return; }

    // Android / Chrome — capture install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") setPrompt(null);
  };

  const handleDismiss = () => {
    localStorage.setItem("pwa-banner-dismissed", "1");
    setPrompt(null);
    setShowIOSHint(false);
    setDismissed(true);
  };

  if (dismissed || (!prompt && !showIOSHint)) return null;

  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 9999,
      background: "#0C1B2E", color: "#fff",
      padding: "14px 16px 20px",
      borderTop: "1px solid rgba(255,255,255,0.1)",
      display: "flex", alignItems: "center", gap: 12,
      boxShadow: "0 -4px 24px rgba(0,0,0,0.3)",
      // Safe area for iPhone notch
      paddingBottom: "calc(20px + env(safe-area-inset-bottom))",
    }}>
      <img src="/images/logo.png" alt="ProNeighbor" style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0 }} />

      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: "0.9rem" }}>
          Add ProNeighbor to Home Screen
        </div>
        <div style={{ fontSize: "0.75rem", opacity: 0.7, marginTop: 2 }}>
          {isIOS
            ? "Tap the Share button below, then 'Add to Home Screen'"
            : "Install for a faster, app-like experience"}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
        {!isIOS && (
          <button onClick={handleInstall} style={{ background: "linear-gradient(135deg,#F5692C,#E8450A)", color: "#fff", border: "none", borderRadius: 50, padding: "8px 16px", fontWeight: 700, fontSize: "0.82rem", cursor: "pointer", whiteSpace: "nowrap" }}>
            Install
          </button>
        )}
        <button onClick={handleDismiss} style={{ background: "rgba(255,255,255,0.1)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 50, padding: "8px 12px", fontSize: "0.82rem", cursor: "pointer" }}>
          {isIOS ? "Got it" : "Not now"}
        </button>
      </div>
    </div>
  );
}


