import { useState, useEffect, useRef } from "react";
import { toggleReactionToFeedPost } from "../../services/firestoreService";
import { relativeTime } from "../../utils/time";
import ReportModal from "./ReportModal";

type ReactionType = "heart" | "thumb";
type FeedReactions = Record<string, ReactionType>;

export default function FeedPostCard({ post, uid, onDelete }: {
  post: Record<string, unknown>; uid: string; onDelete: (id: string) => void;
}) {
  const [showReport, setShowReport] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isOwn = (post.authorId as string) === uid;
  const isHidden = post.hidden === true;
  const reactions = ((post.reactions as FeedReactions | undefined) ?? {}) as FeedReactions;
  const userReaction = reactions[uid];
  const heartCount = Object.values(reactions).filter((reaction) => reaction === "heart").length;
  const thumbCount = Object.values(reactions).filter((reaction) => reaction === "thumb").length;

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  if (isHidden && !isOwn) return null; // Hide reported posts from others

  const initials = ((post.authorName as string) || "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <>
      <div style={{
        padding: "16px 18px", background: "#fff", borderRadius: 14,
        border: "1px solid var(--border)", transition: "box-shadow 0.2s",
        ...(isHidden ? { opacity: 0.45 } : {}),
      }}
        onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.06)")}
        onMouseLeave={e => (e.currentTarget.style.boxShadow = "none")}
      >
        {/* Author row */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
            background: "linear-gradient(135deg, var(--accent-dim), var(--surface-2))",
            color: "var(--accent)", fontWeight: 700, fontSize: 13,
          }}>{initials}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text)" }}>
              {(post.authorName as string) || "Neighbor"}
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>{relativeTime(post.createdAt)}</div>
          </div>
          {/* Context menu */}
          <div style={{ position: "relative" }} ref={menuRef}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Open post actions"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              title="Post actions"
              style={{
              background: "none", border: "none", cursor: "pointer", fontSize: 16,
              color: "var(--muted)", padding: "4px 6px", borderRadius: 6,
            }}
            >
              ⋯
            </button>
            {menuOpen && (
              <div role="menu" style={{
                position: "absolute", right: 0, top: "100%", marginTop: 4,
                background: "#fff", border: "1px solid var(--border)", borderRadius: 10,
                boxShadow: "0 6px 20px rgba(0,0,0,0.1)", overflow: "hidden", zIndex: 30,
                minWidth: 160,
              }}>
                {isOwn ? (
                  <button onClick={() => { setMenuOpen(false); onDelete(post.id as string); }} style={{
                    display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "10px 14px",
                    background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "var(--error)",
                  }}>🗑️ Delete post</button>
                ) : (
                  <button onClick={() => { setMenuOpen(false); setShowReport(true); }} style={{
                    display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "10px 14px",
                    background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#D45C3B",
                  }}>🚩 Report post</button>
                )}
              </div>
            )}
          </div>
        </div>
        {/* Content */}
        <p style={{ fontSize: 14, lineHeight: 1.65, color: "var(--text-2)", margin: 0, whiteSpace: "pre-wrap" }}>
          {post.content as string}
        </p>

        {/* Action Bar: Reactions */}
        <div style={{ display: "flex", gap: 20, marginTop: 14, paddingTop: 12, borderTop: "1px solid rgba(0,0,0,0.03)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              onClick={() => toggleReactionToFeedPost(post.id as string, uid, "heart")}
              style={{
                display: "flex", alignItems: "center", gap: 5, border: "none",
                cursor: "pointer", fontSize: 13, color: userReaction === "heart" ? "#E0245E" : "var(--muted)",
                transition: "transform 0.1s", padding: "4px 8px", borderRadius: 8,
                background: userReaction === "heart" ? "rgba(224,36,94,0.08)" : "transparent",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = userReaction === "heart" ? "rgba(224,36,94,0.12)" : "var(--surface-2)")}
              onMouseLeave={e => (e.currentTarget.style.background = userReaction === "heart" ? "rgba(224,36,94,0.08)" : "transparent")}
            >
              <span>{userReaction === "heart" ? "❤️" : "🤍"}</span>
              <span style={{ fontWeight: 600 }}>{heartCount}</span>
            </button>

            <button
              onClick={() => toggleReactionToFeedPost(post.id as string, uid, "thumb")}
              style={{
                display: "flex", alignItems: "center", gap: 5, border: "none",
                cursor: "pointer", fontSize: 13, color: userReaction === "thumb" ? "var(--accent)" : "var(--muted)",
                transition: "transform 0.1s", padding: "4px 8px", borderRadius: 8,
                background: userReaction === "thumb" ? "rgba(27,107,138,0.08)" : "transparent",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = userReaction === "thumb" ? "rgba(27,107,138,0.12)" : "var(--surface-2)")}
              onMouseLeave={e => (e.currentTarget.style.background = userReaction === "thumb" ? "rgba(27,107,138,0.08)" : "transparent")}
            >
              <span>👍</span>
              <span style={{ fontWeight: 600 }}>{thumbCount}</span>
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--muted)", padding: "4px 8px" }}>
            <span>💬</span>
            <span style={{ fontWeight: 600 }}>{(post.commentCount as number) || 0}</span>
          </div>
        </div>

        {isHidden && isOwn && (
          <div style={{ marginTop: 8, fontSize: 11, color: "var(--error)", fontStyle: "italic" }}>
            This post has been flagged for review.
          </div>
        )}
      </div>

      {showReport && <ReportModal postId={post.id as string} uid={uid} onClose={() => setShowReport(false)} />}
    </>
  );
}
