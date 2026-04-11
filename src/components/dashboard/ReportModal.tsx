import { useState } from "react";
import { reportFeedPost, type FeedReportReason } from "../../services/firestoreService";

const REPORT_REASONS: { value: FeedReportReason; label: string; icon: string }[] = [
  { value: "offensive", label: "Offensive language", icon: "🚫" },
  { value: "scam",      label: "Scam or fraud",     icon: "⚠️" },
  { value: "spam",      label: "Spam",               icon: "📧" },
  { value: "policy_violation", label: "Violates app policies", icon: "📋" },
  { value: "other",     label: "Other",              icon: "❓" },
];

export default function ReportModal({ postId, uid, onClose }: { postId: string; uid: string; onClose: () => void }) {
  const [reason, setReason] = useState<FeedReportReason | "">("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!reason) return;
    setSubmitting(true);
    const res = await reportFeedPost(postId, uid, reason as FeedReportReason);
    setResult(res.alreadyReported ? "You've already reported this post." : "Report submitted. Our team will review it.");
    setSubmitting(false);
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20,
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "var(--surface)", borderRadius: 16, width: "100%", maxWidth: 400,
        padding: "28px 24px", boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
      }}>
        {result ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            <p style={{ fontWeight: 600, marginBottom: 20 }}>{result}</p>
            <button className="btn btn-primary" onClick={onClose} style={{ width: "100%" }}>Done</button>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Report Post</h3>
              <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "var(--muted)" }}>✕</button>
            </div>
            <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16 }}>
              Why are you reporting this post?
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
              {REPORT_REASONS.map(r => (
                <label key={r.value} style={{
                   display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
                   borderRadius: 10, cursor: "pointer", transition: "all 0.15s",
                   border: `2px solid ${reason === r.value ? "var(--accent)" : "var(--border)"}`,
                   background: reason === r.value ? "rgba(27,107,138,0.04)" : "transparent",
                }}>
                  <input type="radio" name="report" value={r.value} checked={reason === r.value}
                    onChange={() => setReason(r.value)} style={{ display: "none" }} />
                  <span style={{ fontSize: 18 }}>{r.icon}</span>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{r.label}</span>
                  {reason === r.value && <span style={{ marginLeft: "auto", color: "var(--accent)", fontWeight: 700 }}>✓</span>}
                </label>
              ))}
            </div>
            <button className="btn btn-primary" onClick={handleSubmit}
              disabled={!reason || submitting}
              style={{ width: "100%", opacity: !reason ? 0.5 : 1 }}>
              {submitting ? "Submitting…" : "Submit Report"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
