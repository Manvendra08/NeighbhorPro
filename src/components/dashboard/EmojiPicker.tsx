import { useEffect, useRef } from "react";

export const EMOJI_ROWS = [
  ["😀","😂","🥰","😎","🤔","😢","🔥","💯","👍","👎"],
  ["❤️","🎉","🙏","✅","⭐","💪","🏠","📢","🤝","💡"],
  ["👋","🫡","😤","🥳","😴","🤑","🧘","📚","🎵","🐾"],
];

export default function EmojiPicker({ onSelect, onClose }: { onSelect: (e: string) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div ref={ref} style={{
      position: "absolute", bottom: "100%", left: 0, marginBottom: 8,
      background: "#fff", border: "1px solid var(--border)", borderRadius: 12,
      padding: 10, boxShadow: "0 8px 32px rgba(0,0,0,0.12)", zIndex: 50,
      width: "min(320px, 90vw)",
    }}>
      {EMOJI_ROWS.map((row, i) => (
        <div key={i} style={{ display: "flex", gap: 2, marginBottom: i < EMOJI_ROWS.length - 1 ? 4 : 0 }}>
          {row.map(emoji => (
            <button key={emoji} onClick={() => onSelect(emoji)} style={{
              background: "none", border: "none", fontSize: 20, cursor: "pointer",
              padding: "4px 5px", borderRadius: 6, transition: "background 0.15s",
            }}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--surface-2)")}
              onMouseLeave={e => (e.currentTarget.style.background = "none")}
            >{emoji}</button>
          ))}
        </div>
      ))}
    </div>
  );
}
