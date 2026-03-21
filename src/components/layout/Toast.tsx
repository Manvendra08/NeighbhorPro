import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";

type ToastType = "success" | "error" | "info";

export interface ToastMessage {
  id: number;
  message: string;
  type: ToastType;
}

let toastCounter = 0;
let addToastFn: ((msg: string, type: ToastType) => void) | null = null;

export const useToast = () => {
  return {
    toast: {
      success: (msg: string) => addToastFn?.(msg, "success"),
      error: (msg: string) => addToastFn?.(msg, "error"),
      info: (msg: string) => addToastFn?.(msg, "info"),
    },
  };
};

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    addToastFn = (message: string, type: ToastType) => {
      const id = ++toastCounter;
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4000);
    };
    return () => {
      addToastFn = null;
    };
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  if (toasts.length === 0) return null;

  return createPortal(
    <div style={{
      position: "fixed",
      bottom: 24,
      left: "50%",
      transform: "translateX(-50%)",
      zIndex: 9999,
      display: "flex",
      flexDirection: "column",
      gap: 8,
      pointerEvents: "none",
    }}>
      {toasts.map((t) => {
        const bg = t.type === "success" ? "var(--success)" : t.type === "error" ? "var(--error)" : "var(--accent)";
        return (
          <div key={t.id} style={{
            background: bg,
            color: "#fff",
            padding: "12px 20px",
            borderRadius: 8,
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            display: "flex",
            alignItems: "center",
            gap: 12,
            minWidth: 280,
            maxWidth: "90vw",
            pointerEvents: "auto",
            animation: "slideUp 0.3s ease-out",
          }}>
            <span style={{ fontSize: 18 }}>
              {t.type === "success" ? "✓" : t.type === "error" ? "✕" : "ℹ"}
            </span>
            <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{t.message}</span>
            <button
              onClick={() => removeToast(t.id)}
              style={{ background: "none", border: "none", color: "rgba(255,255,255,0.7)", cursor: "pointer", padding: 4 }}
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>,
    document.body
  );
}
