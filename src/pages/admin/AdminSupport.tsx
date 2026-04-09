import { useEffect, useState, useRef } from "react";
import {
  collection, addDoc, getDocs, query, orderBy, serverTimestamp,
  doc, updateDoc, onSnapshot, Unsubscribe
} from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../contexts/AuthContext";
import { formatTimestampTime, formatTimestamp } from "../../services/firestoreService";
import { logAudit } from "./AdminAuditLog";

type Ticket = Record<string, unknown>;
type Message = Record<string, unknown>;
type TicketStatus = "open" | "pending" | "closed";

const PRIORITIES = ["low", "normal", "high", "urgent"];

export default function AdminSupport() {
  const { userProfile } = useAuth();
  const adminId = userProfile?.uid || "unknown";
  const adminName = userProfile?.displayName || "Admin";

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [filterStatus, setFilterStatus] = useState<TicketStatus | "all">("all");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const unsubRef = useRef<Unsubscribe | null>(null);

  const loadTickets = async () => {
    try {
      const snap = await getDocs(query(collection(db, "supportTickets"), orderBy("createdAt", "desc")));
      setTickets(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { loadTickets(); }, []);

  useEffect(() => {
    if (unsubRef.current) unsubRef.current();
    if (!selected) return;
    unsubRef.current = onSnapshot(
      query(collection(db, `supportTickets/${selected.id}/messages`), orderBy("timestamp", "asc")),
      snap => {
        setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      }
    );
    return () => { if (unsubRef.current) unsubRef.current(); };
  }, [selected?.id]);

  const handleSend = async () => {
    if (!reply.trim() || !selected) return;
    setSending(true);
    try {
      await addDoc(collection(db, `supportTickets/${selected.id}/messages`), {
        text: reply.trim(), senderId: adminId, senderName: adminName,
        senderRole: "admin", timestamp: serverTimestamp(),
      });
      await updateDoc(doc(db, "supportTickets", selected.id as string), {
        lastReply: reply.trim(), lastReplyAt: serverTimestamp(), status: "pending",
      });
      await logAudit(
        "support.reply", adminId, adminName,
        `Replied to ticket: "${selected.subject as string || "Support Request"}" from ${selected.userName as string || "user"}`,
        selected.id as string
      );
      setReply("");
      loadTickets();
    } catch { /* ignore */ }
    setSending(false);
  };

  const handleStatusChange = async (ticketId: string, status: TicketStatus) => {
    const ticket = tickets.find(t => t.id === ticketId);
    const prevStatus = ticket?.status as string || "unknown";
    await updateDoc(doc(db, "supportTickets", ticketId), { status });
    if (status === "closed" || status === "open") {
      await logAudit(
        `ticket.${status}`, adminId, adminName,
        `Changed ticket "${ticket?.subject as string || ticketId}" status: ${prevStatus} → ${status}`,
        ticketId
      );
    }
    if (selected?.id === ticketId) setSelected(prev => prev ? { ...prev, status } : null);
    loadTickets();
  };

  const handlePriorityChange = async (ticketId: string, priority: string) => {
    const ticket = tickets.find(t => t.id === ticketId);
    await updateDoc(doc(db, "supportTickets", ticketId), { priority });
    await logAudit(
      "ticket.priority_change", adminId, adminName,
      `Set ticket "${ticket?.subject as string || ticketId}" priority to: ${priority}`,
      ticketId
    );
    loadTickets();
  };

  const filtered = filterStatus === "all" ? tickets : tickets.filter(t => t.status === filterStatus);
  const counts = {
    all: tickets.length,
    open: tickets.filter(t => t.status === "open").length,
    pending: tickets.filter(t => t.status === "pending").length,
    closed: tickets.filter(t => t.status === "closed").length,
  };

  const statusBadge = (s: string) => s === "open" ? "badge-error" : s === "pending" ? "badge-warning" : "badge-success";
  const priorityColor = (p: string) => p === "urgent" ? "var(--error)" : p === "high" ? "var(--warning)" : p === "normal" ? "var(--accent)" : "var(--muted)";

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Support Center</h1>
          <p className="page-subtitle">User queries and live support chat</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {(["all", "open", "pending", "closed"] as const).map(s => (
            <button key={s} className={`chip${filterStatus === s ? " active" : ""}`} style={{ fontSize: 12 }} onClick={() => setFilterStatus(s)}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
              <span style={{ marginLeft: 4, opacity: 0.7 }}>({counts[s]})</span>
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 20, height: "calc(100vh - 220px)", minHeight: 500 }}>
        <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", background: "var(--bg-elevated)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)", fontSize: 12, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>
            {filtered.length} Ticket{filtered.length !== 1 ? "s" : ""}
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {loading ? (
              <div style={{ textAlign: "center", padding: 40 }}><div className="loader" style={{ margin: "0 auto" }} /></div>
            ) : filtered.length === 0 ? (
              <div className="empty-state" style={{ padding: "40px 16px" }}>
                <div className="empty-state-icon">🎫</div><div className="empty-state-title" style={{ fontSize: 15 }}>No tickets</div>
              </div>
            ) : filtered.map(t => (
              <div key={t.id as string} onClick={() => setSelected(t)}
                style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)", cursor: "pointer", background: selected?.id === t.id ? "var(--accent-dim)" : "transparent", transition: "background 0.15s" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {t.subject as string || "Support Request"}
                  </div>
                  <span className={`badge ${statusBadge(t.status as string)}`} style={{ fontSize: 10, flexShrink: 0, marginLeft: 6 }}>{t.status as string}</span>
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {t.userName as string || t.userEmail as string || "Anonymous"}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: priorityColor(t.priority as string), fontWeight: 600 }}>
                    {(t.priority as string || "normal").toUpperCase()}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>{formatTimestamp(t.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {selected ? (
          <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--border)", background: "var(--bg-elevated)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{selected.subject as string || "Support Request"}</div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>
                  From: {selected.userName as string || selected.userEmail as string || "User"} · {formatTimestamp(selected.createdAt)}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <select className="form-input" style={{ padding: "5px 10px", fontSize: 12, width: "auto" }}
                  value={selected.priority as string || "normal"}
                  onChange={e => handlePriorityChange(selected.id as string, e.target.value)}>
                  {PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                </select>
                {(["open", "pending", "closed"] as TicketStatus[]).map(s => (
                  <button key={s} className={`btn btn-sm ${selected.status === s ? "btn-primary" : "btn-secondary"}`}
                    onClick={() => handleStatusChange(selected.id as string, s)}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", gap: 10 }}>
                <div className="avatar avatar-sm" style={{ background: "var(--accent2-dim)", color: "var(--accent2)", flexShrink: 0 }}>
                  {((selected.userName as string) || "U").slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>{selected.userName as string} · {formatTimestamp(selected.createdAt)}</div>
                  <div style={{ background: "var(--surface-2)", borderRadius: "0 12px 12px 12px", padding: "10px 14px", fontSize: 14, maxWidth: 480 }}>
                    {selected.message as string || selected.body as string || "—"}
                  </div>
                </div>
              </div>

              {messages.map(m => {
                const isAdm = m.senderRole === "admin";
                return (
                  <div key={m.id as string} style={{ display: "flex", gap: 10, flexDirection: isAdm ? "row-reverse" : "row" }}>
                    <div className="avatar avatar-sm" style={{ flexShrink: 0, background: isAdm ? "var(--accent-dim)" : "var(--accent2-dim)", color: isAdm ? "var(--accent)" : "var(--accent2)" }}>
                      {((m.senderName as string) || "A").slice(0, 2).toUpperCase()}
                    </div>
                    <div style={{ maxWidth: 480 }}>
                      <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4, textAlign: isAdm ? "right" : "left" }}>
                        {m.senderName as string} · {formatTimestampTime(m.timestamp)}
                      </div>
                      <div style={{ background: isAdm ? "var(--accent)" : "var(--surface-2)", color: isAdm ? "#fff" : "var(--text)", borderRadius: isAdm ? "12px 0 12px 12px" : "0 12px 12px 12px", padding: "10px 14px", fontSize: 14 }}>
                        {m.text as string}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {selected.status !== "closed" ? (
              <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)", background: "var(--bg-elevated)", display: "flex", gap: 10 }}>
                <input className="form-input" style={{ borderRadius: "50px", padding: "9px 16px", flex: 1 }}
                  placeholder="Type your reply…" value={reply}
                  onChange={e => setReply(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()} />
                <button className="btn btn-primary btn-sm" onClick={handleSend} disabled={sending || !reply.trim()}>{sending ? "…" : "Send ↩"}</button>
                <button className="btn btn-secondary btn-sm" onClick={() => handleStatusChange(selected.id as string, "closed")}>Close Ticket</button>
              </div>
            ) : (
              <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
                Ticket closed ·
                <button className="btn btn-ghost btn-sm" onClick={() => handleStatusChange(selected.id as string, "open")} style={{ marginLeft: 8 }}>Reopen</button>
              </div>
            )}
          </div>
        ) : (
          <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div className="empty-state">
              <div className="empty-state-icon">💬</div>
              <div className="empty-state-title">Select a ticket</div>
              <div className="empty-state-desc">Choose a support ticket from the left to view and respond</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

