import { useState, useEffect, useRef, FormEvent } from "react";
import { useAuth } from "../contexts/AuthContext";
import {
  createTicket, sendTicketMessage, subscribeTicketMessages,
  getFAQs, generateTicketNumber, updateTicketStatus,
  subscribeUserTickets,
  type SupportTicket, type TicketMessage, type FAQ,
} from "../services/supportService";

type Tab = "faq" | "tickets" | "new";

const CATEGORIES = ["general", "booking", "payment", "account", "other"] as const;
const CATEGORY_LABELS: Record<string, string> = {
  general: "General", booking: "Booking Issue", payment: "Payment / NC",
  account: "Account", other: "Other",
};

function TicketChat({ ticket, onBack, onStatusChange }: { ticket: SupportTicket; onBack: () => void; onStatusChange?: (status: SupportTicket["status"]) => void }) {
  const { userProfile } = useAuth();
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [localStatus, setLocalStatus] = useState(ticket.status);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocalStatus(ticket.status);
  }, [ticket.status]);

  useEffect(() => {
    if (!ticket.id) return;
    const unsub = subscribeTicketMessages(ticket.id, msgs => {
      setMessages(msgs);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
    });
    return unsub;
  }, [ticket.id]);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !ticket.id) return;
    setSending(true);
    await sendTicketMessage(ticket.id, { text: text.trim(), senderRole: "user", senderName: userProfile?.displayName || "User" });
    setText(""); setSending(false);
  };

  const toggleStatus = async (newStatus: "open" | "closed") => {
    if (!ticket.id) return;
    await updateTicketStatus(ticket.id, newStatus);
    setLocalStatus(newStatus);
    onStatusChange?.(newStatus);
  };

  const statusColors: Record<string, string> = { open: "#C4882A", in_progress: "#1B6B8A", resolved: "#16a34a", closed: "var(--muted)" };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <button className="btn btn-ghost btn-sm" onClick={onBack}>← Back</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700 }}>{ticket.subject}</div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>#{ticket.ticketNumber || ticket.id?.slice(0, 8)}</div>
        </div>
        <span className="badge" style={{ background: statusColors[localStatus] + "18", color: statusColors[localStatus], border: `1px solid ${statusColors[localStatus]}40` }}>
          {localStatus.replace("_", " ")}
        </span>
      </div>
      <div style={{ background: "var(--surface-2)", borderRadius: 12, padding: 16, height: 340, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
        {messages.length === 0 && <div style={{ textAlign: "center", color: "var(--muted)", paddingTop: 40 }}>No messages yet. We'll reply shortly.</div>}
        {messages.map(m => (
          <div key={m.id} style={{ alignSelf: m.senderRole === "user" ? "flex-end" : "flex-start", background: m.senderRole === "user" ? "var(--accent)" : "var(--surface)", color: m.senderRole === "user" ? "#fff" : "var(--text)", padding: "10px 16px", borderRadius: 14, maxWidth: "75%", fontSize: 14, border: m.senderRole === "admin" ? "1px solid var(--border)" : "none" }}>
            {m.senderRole === "admin" && <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 4, opacity: 0.7 }}>Support Team</div>}
            {m.text}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      {/* Non-admin: can only open or close. In-progress/resolved are admin-managed. */}
      {localStatus !== "resolved" && localStatus !== "in_progress" && (
        <form onSubmit={send} style={{ display: "flex", gap: 10, marginBottom: 12 }}>
          <input className="form-input" placeholder="Type your message…" value={text} onChange={e => setText(e.target.value)} style={{ flex: 1 }} />
          <button type="submit" className="btn btn-primary" disabled={sending || !text.trim()}>{sending ? "…" : "Send"}</button>
        </form>
      )}
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        {localStatus === "open" && (
          <button className="btn btn-secondary btn-sm" onClick={() => toggleStatus("closed")}>✕ Close Ticket</button>
        )}
        {localStatus === "closed" && (
          <button className="btn btn-primary btn-sm" onClick={() => toggleStatus("open")}>↺ Reopen Ticket</button>
        )}
        {(localStatus === "in_progress" || localStatus === "resolved") && (
          <span style={{ fontSize: 13, color: "var(--muted)" }}>This ticket is being handled by our support team.</span>
        )}
      </div>
    </div>
  );
}

// ── New ticket form ───────────────────────────────────────────────────────
function NewTicketForm({ onCreated }: { onCreated: (t: SupportTicket) => void }) {
  const { user, userProfile } = useAuth();
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState<typeof CATEGORIES[number]>("general");
  const [description, setDesc] = useState("");
  const [ticketNumber, setTicketNumber] = useState("");
  const [submitting, setSub] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    generateTicketNumber().then(setTicketNumber);
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !userProfile) return;
    if (!subject.trim() || !description.trim()) { setError("Please fill all required fields."); return; }
    setSub(true); setError("");
    const { id, ticketNumber: generatedNumber } = await createTicket({
      uid: user.uid, displayName: userProfile.displayName, email: userProfile.email,
      subject: subject.trim(), category,
    });
    await sendTicketMessage(id, { text: description.trim(), senderRole: "user", senderName: userProfile.displayName });
    onCreated({
      id: id,
      ticketNumber: generatedNumber,
      uid: user.uid,
      displayName: userProfile.displayName,
      email: userProfile.email,
      subject: subject.trim(),
      category,
      status: "open",
      createdAt: null,
      updatedAt: null,
    });
    setSub(false);
  };

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 560 }}>
      <div className="card">
        <h3 className="card-title" style={{ marginBottom: 4 }}>Open a Support Ticket</h3>
        {error && <div className="error-box" style={{ marginBottom: 16 }}>{error}</div>}
        <div style={{ display: "flex", gap: 16 }}>
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">Category *</label>
            <select className="form-input" value={category} onChange={e => setCategory(e.target.value as typeof CATEGORIES[number])}>
              {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">Ticket Number</label>
            <input
              className="form-input"
              value={ticketNumber || "Generating…"}
              readOnly
              disabled
              style={{ background: "var(--surface-2)", color: "var(--muted)", cursor: "not-allowed", fontFamily: "monospace", letterSpacing: 1 }}
            />
            <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>Auto-assigned. Cannot be changed.</p>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Subject *</label>
          <input className="form-input" placeholder="Brief description of your issue" value={subject} onChange={e => setSubject(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Description *</label>
          <textarea className="form-input" placeholder="Please describe your issue in detail…" value={description} onChange={e => setDesc(e.target.value)} style={{ minHeight: 120 }} />
        </div>
        <button type="submit" className="btn btn-primary" disabled={submitting || !ticketNumber}>{submitting ? "Submitting…" : "Submit Ticket"}</button>
      </div>
    </form>
  );
}

// ── Main Support page ─────────────────────────────────────────────────────
export default function Support() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("faq");
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [faqCat, setFaqCat] = useState("All");
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [activeTicket, setActive] = useState<SupportTicket | null>(null);
  useEffect(() => { getFAQs().then(setFaqs); }, []);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeUserTickets(user.uid, t => {
      setTickets(t);
      setActive(prev => prev ? (t.find(x => x.id === prev.id) || prev) : null);
    });
    return unsub;
  }, [user]);

  const faqCategories = ["All", ...Array.from(new Set(faqs.map(f => f.category)))];
  const visibleFaqs = faqCat === "All" ? faqs : faqs.filter(f => f.category === faqCat);

  const statusColors: Record<string, string> = { open: "#C4882A", in_progress: "#1B6B8A", resolved: "#16a34a", closed: "var(--muted)" };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Support</h1>
          <p className="page-subtitle">Browse FAQs or open a ticket — we respond within 24 hours.</p>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab${tab === "faq" ? " active" : ""}`} onClick={() => setTab("faq")}>FAQ</button>
        <button className={`tab${tab === "tickets" ? " active" : ""}`} onClick={() => setTab("tickets")}>My Tickets</button>
        <button className={`tab${tab === "new" ? " active" : ""}`} onClick={() => setTab("new")}>+ New Ticket</button>
      </div>

      {/* ── FAQ ── */}
      {tab === "faq" && (
        <div>
          {faqCategories.length > 1 && (
            <div className="filter-chips" style={{ marginBottom: 20 }}>
              {faqCategories.map(c => (
                <button key={c} className={`chip${faqCat === c ? " active" : ""}`} onClick={() => setFaqCat(c)}>
                  {c.charAt(0).toUpperCase() + c.slice(1)}
                </button>
              ))}
            </div>
          )}
          <div className="card" style={{ padding: 0 }}>
            {visibleFaqs.length === 0 && <div className="empty-state"><div className="empty-state-icon">🔍</div><div className="empty-state-title">No FAQs in this category</div></div>}
            {visibleFaqs.map((f, i) => (
              <div key={f.id ?? i} style={{ borderBottom: i < visibleFaqs.length - 1 ? "1px solid var(--border)" : "none" }}>
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)} style={{ width: "100%", textAlign: "left", padding: "18px 22px", background: "none", border: "none", cursor: "pointer", fontSize: 14, fontWeight: 600, fontFamily: "var(--font-body)", color: "var(--text)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  {f.question}
                  <span style={{ color: "var(--muted)", fontSize: 18, transform: openFaq === i ? "rotate(180deg)" : "none", transition: "transform .2s", flexShrink: 0, marginLeft: 12 }}>▼</span>
                </button>
                {openFaq === i && <div style={{ padding: "0 22px 18px", fontSize: 14, color: "var(--muted)", lineHeight: 1.7 }}>{f.answer}</div>}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 24, textAlign: "center" }}>
            <p className="text-muted text-sm" style={{ marginBottom: 12 }}>Didn't find your answer?</p>
            <button className="btn btn-primary" onClick={() => setTab("new")}>Open a Support Ticket</button>
          </div>
        </div>
      )}

      {/* ── TICKETS ── */}
      {tab === "tickets" && (
        <div>
          {activeTicket ? (
            <TicketChat
              ticket={activeTicket}
              onBack={() => setActive(null)}
              onStatusChange={status => {
                setTickets(prev => prev.map(t => t.id === activeTicket.id ? { ...t, status } : t));
                setActive(prev => prev ? { ...prev, status } : null);
              }}
            />
          ) : (
            <>
              {tickets.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">🎫</div>
                  <div className="empty-state-title">No tickets yet</div>
                  <div className="empty-state-desc">Open a ticket if you need help with a booking, payment, or anything else.</div>
                  <button className="btn btn-primary btn-sm" onClick={() => setTab("new")} style={{ marginTop: 12 }}>Open a Ticket</button>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {tickets.map(t => (
                    <div key={t.id} className="card" style={{ display: "flex", alignItems: "center", gap: 14, cursor: "pointer", padding: "16px 20px" }} onClick={() => setActive(t)}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{t.subject}</div>
                        <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                          {CATEGORY_LABELS[t.category]} · #{t.ticketNumber || t.id?.slice(0, 8)}
                        </div>
                      </div>
                      <span className="badge" style={{ background: statusColors[t.status] + "18", color: statusColors[t.status], border: `1px solid ${statusColors[t.status]}40` }}>
                        {t.status.replace("_", " ")}
                      </span>
                      <span style={{ color: "var(--muted)" }}>›</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── NEW TICKET ── */}
      {tab === "new" && (
        <NewTicketForm onCreated={t => { setTickets(prev => [t, ...prev]); setActive(t); setTab("tickets"); }} />
      )}
    </div>
  );
}

