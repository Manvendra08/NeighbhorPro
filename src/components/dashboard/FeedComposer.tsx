import { useState, useRef } from "react";
import { createFeedPost } from "../../services/firestoreService";
import EmojiPicker from "./EmojiPicker";

export default function FeedComposer({ uid, displayName, locality }: { uid: string; displayName: string; locality?: string }) {
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const handlePost = async () => {
    if (!text.trim() || posting) return;
    setPosting(true);
    try {
      await createFeedPost({ authorId: uid, authorName: displayName, content: text.trim(), locality });
      setText(""); setShowEmoji(false);
    } finally { setPosting(false); }
  };

  const insertEmoji = (emoji: string) => {
    if (!textRef.current) { setText(prev => prev + emoji); return; }
    const ta = textRef.current;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const newText = text.slice(0, start) + emoji + text.slice(end);
    setText(newText);
    setTimeout(() => { ta.selectionStart = ta.selectionEnd = start + emoji.length; ta.focus(); }, 0);
  };

  return (
    <div style={{
      background: "var(--surface)", borderRadius: 14, border: "1px solid var(--border)",
      padding: "18px", marginTop: 8,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <span style={{ fontSize: 16 }}>✍️</span>
        <span style={{ fontWeight: 700, fontSize: 14, color: "var(--text)" }}>Share with your neighborhood</span>
      </div>
      <textarea
        ref={textRef}
        className="form-input"
        placeholder="What's on your mind? Ask for recommendations, share updates…"
        value={text}
        onChange={e => setText(e.target.value)}
        rows={3}
        style={{ width: "100%", resize: "none", fontSize: 14, borderRadius: 10, marginBottom: 10 }}
      />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ position: "relative" }}>
          <button onClick={() => setShowEmoji(!showEmoji)} style={{
            background: showEmoji ? "var(--accent-dim)" : "none",
            border: "1px solid var(--border)", borderRadius: 8, padding: "6px 10px",
            cursor: "pointer", fontSize: 18,
          }} title="Add emoji">😊</button>
          {showEmoji && <EmojiPicker onSelect={insertEmoji} onClose={() => setShowEmoji(false)} />}
        </div>
        <button className="btn btn-primary" disabled={!text.trim() || posting} onClick={handlePost}
          style={{ padding: "8px 24px", borderRadius: 10 }}>
          {posting ? "Posting…" : "Post"}
        </button>
      </div>
    </div>
  );
}
