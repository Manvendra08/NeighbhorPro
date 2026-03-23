import { useEffect, useState, useRef } from "react";
import { useAuth } from "../../contexts/AuthContext";
import {
  getAllTickets, sendTicketMessage, subscribeTicketMessages, updateTicketStatus,
  type SupportTicket, type TicketMessage, type TicketStatus,
} from "../../services/supportService";
import { formatTimestamp, formatTimestampTime } from "../../services/firestoreService";
import { logAudit } from "./AdminAuditLog";

const STATUS_BADGE: Record<TicketStatus, string> = {
  open: "badge-error", in_progress: "badge-warning", resolved: "badge-success", closed: "badge-muted",
};
const PRIORITY_COLOR: Record<string, string> = {
  urgent: "var(--error)", high: "var(--warning)", normal: "var(--accent)", low: "var(--muted)",
};

export default function AdminTickets() {
  const { userProfile } = useAuth();
  const adminId   = userProfile?.uid || "admin";
  const adminName = userProfile?.displayName || "Admin";

  const [tickets, setTickets]     = useState<SupportTicket[]>([]);
  const [loading, setLoading]     = useState(true);
  const [selected, setSelected]   = useState<SupportTicket | null>(null);
  const [messages, setMessages]   = useState<TicketMessage[]>([]);
  const [reply, setReply]         = useState("");
  const [sending, setSending]     = useState(false);
  const [filter, setFilter]       = useState<TicketStatus | "all">("open");
  const endRef                    = useRef<HTMLDivElement>(null);
  const unsubRef                  = useRef<(() => void) | null>(null);

  const load = async () => {
    const data = await getAllTickets();
    setTickets(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (unsubRef.current) unsubRef.current();
    if (!selected?.id) return;
    unsubRef.current = subscribeTicketMessages(selected.id, msgs => {
      setMessages(msgs);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
    });
    return () => { if (unsubRef.current) unsubRef.current(); };
  }, [selected?.id]);

  const handleSend = async () => {
    if (!reply.trim() || !selected?.id) return;
    setSending(true);
    await sendTicketMessage(selected.id, { text: reply.trim(), senderRole: "admin", senderName: adminName });
    await logAudit("ticket.reply", adminId, adminName, `Replied to ticket: ${selected.subject}`, selected.id);
    setReply("");
    setSending(false);
  };

  const handleStatus = async (status: TicketStatus) => {
    if (!selected?.id) return;
    await updateTicketStatus(selected.id, status, adminId);
    await logAudit("ticket.status", adminId, adminName, `Ticket ${selected.id.slice(0,8)} → ${status}`, selected.id);
    setSelected(prev => prev ? { ...prev, status } : null);
    load();
  };

  const visible = filter === "all" ? tickets : tickets.filter(t => t.status === filter);
  const counts: Record<string, number> = { all: tickets.length };
  (["open","in_progress","resolved","closed"] as TicketStatus[]).forEach(s => { counts[s] = tickets.filter(t => t.status === s).length; });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Support Tickets</h1>
          <p className="page-subtitle">All user tickets with SLA tracking</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {(["all","open","in_progress","resolved","closed"] as const).map(s => (
            <button key={s} className={`chip${filter === s ? " active" : ""}`} style={{ fontSize: 11 }} onClick={() => setFilter(s)}>
              {s === "all" ? "All" : s.replace("_"," ")} ({counts[s] ?? 0})
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 60 }}><div className="loader" style={{ margin: "0 auto" }} /></div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 20, height: "calc(100vh - 220px)", minHeight: 500 }}>
          {/* List */}
          <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden", display: "flex", flexDirection: "column", background: "var(--bg-elevated)" }}>
            <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", fontSize: 11, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>{visible.length} ticket{visible.length !== 1 ? "s" : ""}</div>
            <div style={{ flex: 1, overflowY: "auto" }}>
              {visible.length === 0 ? (
                <div className="empty-state" style={{ padding: "40px 16px" }}><div className="empty-state-icon">🎫</div><div className="empty-state-title" style={{ fontSize: 15 }}>No tickets</div></div>
              ) : visible.map(t => (
                <div key={t.id} onClick={() => setSelected(t)} style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)", cursor: "pointer", background: selected?.id === t.id ? "var(--accent-dim)" : "transparent", transition: "background 0.15s" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.subject}</div>
                    <span className={`badge ${STATUS_BADGE[t.status]}`} style={{ fontSize: 10, flexShrink: 0, marginLeft: 6 }}>{t.status.replace("_"," ")}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>{t.displayName || t.email}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 11, color: PRIORITY_COLOR[t.priority], fontWeight: 600 }}>{t.priority.toUpperCase()} · SLA {t.slaHours}h</span>
                    <span style={{ fontSize: 11, color: "var(--muted)" }}>{formatTimestamp(t.createdAt)}</span>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>📂 {t.category}{t.bookingId ? ` · Booking ${t.bookingId.slice(0,8)}…` : ""}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Chat panel */}
          {selected ? (
            <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
              {/* Header */}
              <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--border)", background: "var(--bg-elevated)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{selected.subject}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>{selected.displayName} · {selected.email} · SLA {selected.slaHours}h response</div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  {(["open","in_progress","resolved","closed"] as TicketStatus[]).filter(s => s !== selected.status).map(s => (
                    <button key={s} className="btn btn-secondary btn-sm" onClick={() => handleStatus(s)} style={{ fontSize: 11 }}>→ {s.replace("_"," ")}</button>
                  ))}
                </div>
              </div>

              {/* Messages */}
              <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
                {messages.map(m => {
                  const isAdm = m.senderRole === "admin";
                  return (
                    <div key={m.id} style={{ display: "flex", gap: 10, flexDirection: isAdm ? "row-reverse" : "row" }}>
                      <div className="avatar avatar-sm" style={{ flexShrink: 0, background: isAdm ? "var(--accent-dim)" : "var(--accent2-dim)", color: isAdm ? "var(--accent)" : "var(--accent2)" }}>
                        {((m.senderName as string) || "?").slice(0,2).toUpperCase()}
                      </div>
                      <div style={{ maxWidth: 480 }}>
                        <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4, textAlign: isAdm ? "right" : "left" }}>{m.senderName} · {formatTimestampTime(m.timestamp)}</div>
                        <div style={{ background: isAdm ? "var(--accent)" : "var(--surface-2)", color: isAdm ? "#fff" : "var(--text)", borderRadius: isAdm ? "12px 0 12px 12px" : "0 12px 12px 12px", padding: "10px 14px", fontSize: 14 }}>
                          {m.text as string}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={endRef} />
              </div>

              {/* Reply bar */}
              {selected.status !== "closed" && selected.status !== "resolved" ? (
                <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)", background: "var(--bg-elevated)", display: "flex", gap: 10 }}>
                  <input className="form-input" style={{ borderRadius: 50, flex: 1 }} placeholder="Type your reply…" value={reply} onChange={e => setReply(e.target.value)} onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()} />
                  <button className="btn btn-primary btn-sm" onClick={handleSend} disabled={sending || !reply.trim()}>{sending ? "…" : "Send ↩"}</button>
                </div>
              ) : (
                <div style={{ padding: "10px 16px", borderTop: "1px solid var(--border)", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
                  Ticket {selected.status} · <button className="btn btn-ghost btn-sm" onClick={() => handleStatus("open")}>Reopen</button>
                </div>
              )}
            </div>
          ) : (
            <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div className="empty-state"><div className="empty-state-icon">💬</div><div className="empty-state-title">Select a ticket</div><div className="empty-state-desc">Choose a ticket to view and respond</div></div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

