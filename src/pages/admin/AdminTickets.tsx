import { useEffect, useState, useRef } from "react";
import { useAuth } from "../../contexts/AuthContext";
import {
  getAllTickets, sendTicketMessage, subscribeTicketMessages, updateTicketStatus,
  assignTicketToAdmin, clearTicketAssignment,
  type SupportTicket, type TicketMessage, type TicketStatus,
} from "../../services/supportService";
import { formatTimestamp, formatTimestampTime, getAllUserRows } from "../../services/firestoreService";
import { logAudit } from "./AdminAuditLog";

const STATUS_BADGE: Record<TicketStatus, string> = {
  open: "badge-error", in_progress: "badge-warning", resolved: "badge-success", closed: "badge-muted",
};

export default function AdminTickets() {
  const { userProfile } = useAuth();
  const adminId   = userProfile?.uid || "admin";
  const adminName = userProfile?.displayName || "Admin";

  type AdminAssignee = { uid: string; displayName: string; email?: string };

  const [tickets, setTickets]     = useState<SupportTicket[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminAssignee[]>([]);
  const [loading, setLoading]     = useState(true);
  const [selected, setSelected]   = useState<SupportTicket | null>(null);
  const [messages, setMessages]   = useState<TicketMessage[]>([]);
  const [reply, setReply]         = useState("");
  const [sending, setSending]     = useState(false);
  const [filter, setFilter]       = useState<TicketStatus | "all">("open");
  const [assigneeScope, setAssigneeScope] = useState<"all" | "mine" | "unassigned">("all");
  const endRef                    = useRef<HTMLDivElement>(null);
  const unsubRef                  = useRef<(() => void) | null>(null);

  const load = async () => {
    setLoading(true);
    const [data, userRows] = await Promise.all([getAllTickets(), getAllUserRows(300)]);
    const admins = userRows
      .filter((u) => u.role === "admin" && !u.disabled)
      .map((u) => ({
        uid: (u.uid as string) || "",
        displayName: ((u.displayName as string) || (u.email as string) || "Admin").trim(),
        email: (u.email as string) || "",
      }))
      .filter((u) => !!u.uid);

    const currentAdminPresent = admins.some((u) => u.uid === adminId);
    const nextAdmins = currentAdminPresent
      ? admins
      : [{ uid: adminId, displayName: adminName, email: (userProfile?.email as string) || "" }, ...admins];

    setAdminUsers(nextAdmins);
    setTickets(data);

    if (selected?.id) {
      const refreshed = data.find((t) => t.id === selected.id);
      if (refreshed) {
        setSelected(refreshed);
      }
    }
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

    if (!selected.assignedAdminId) {
      await assignTicketToAdmin(selected.id, adminId, adminName);
      await logAudit("ticket.assign", adminId, adminName, `Assigned ticket ${selected.id.slice(0, 8)} to ${adminName}`, selected.id);
      setSelected(prev => prev ? {
        ...prev,
        assignedAdminId: adminId,
        assignedAdminName: adminName,
      } : null);
    }
    
    if (selected.status === "open") {
      await updateTicketStatus(selected.id, "in_progress", adminId);
      await logAudit("ticket.status", adminId, adminName, `Ticket ${selected.id.slice(0,8)} → in_progress`, selected.id);
      setSelected(prev => prev ? { ...prev, status: "in_progress" } : null);
      load();
    }

    setReply("");
    setSending(false);
  };

  const handleAssign = async (assigneeUid: string) => {
    if (!selected?.id) return;
    if (assigneeUid === ((selected.assignedAdminId as string) || "")) return;

    if (!assigneeUid) {
      await clearTicketAssignment(selected.id);
      await logAudit("ticket.unassign", adminId, adminName, `Unassigned ticket ${selected.id.slice(0, 8)}`, selected.id);
      setSelected(prev => prev ? {
        ...prev,
        assignedAdminId: undefined,
        assignedAdminName: undefined,
        assignedAt: undefined,
      } : null);
      await load();
      return;
    }

    const assignee = adminUsers.find(u => u.uid === assigneeUid);
    if (!assignee) return;

    await assignTicketToAdmin(selected.id, assignee.uid, assignee.displayName);
    await logAudit("ticket.assign", adminId, adminName, `Assigned ticket ${selected.id.slice(0, 8)} to ${assignee.displayName}`, selected.id);
    setSelected(prev => prev ? {
      ...prev,
      assignedAdminId: assignee.uid,
      assignedAdminName: assignee.displayName,
    } : null);
    await load();
  };

  const handleStatus = async (status: TicketStatus) => {
    if (!selected?.id) return;
    let adminNote = "";
    if (status === "resolved" || status === "closed") {
      const note = window.prompt(`Add resolution note before marking as ${status} (required):`);
      if (!note || !note.trim()) return;
      adminNote = note.trim();
    }

    const ok = window.confirm(`Change ticket status to ${status.replace("_", " ")}?`);
    if (!ok) return;

    await updateTicketStatus(selected.id, status, adminId);
    
    // Auto-send a system message so the client is notified in their thread
    const statusMsg = `[SYSTEM] Ticket status has been set to: ${status.replace("_", " ").toUpperCase()}${adminNote ? ` | Note: ${adminNote}` : ""}`;
    await sendTicketMessage(selected.id, { text: statusMsg, senderRole: "admin", senderName: "System" });
    
    await logAudit("ticket.status", adminId, adminName, `Ticket ${selected.id.slice(0,8)} → ${status}${adminNote ? ` | Note: ${adminNote}` : ""}`, selected.id);
    setSelected(prev => prev ? { ...prev, status } : null);
    load();
  };

  const visible = tickets.filter(t => {
    const matchStatus = filter === "all" ? true : t.status === filter;
    const matchAssignee =
      assigneeScope === "all"
        ? true
        : assigneeScope === "mine"
          ? (t.assignedAdminId as string) === adminId
          : !(t.assignedAdminId as string);
    return matchStatus && matchAssignee;
  });
  const counts: Record<string, number> = { all: tickets.length };
  (["open","in_progress","resolved","closed"] as TicketStatus[]).forEach(s => { counts[s] = tickets.filter(t => t.status === s).length; });
  const assigneeCounts = {
    all: tickets.length,
    mine: tickets.filter(t => (t.assignedAdminId as string) === adminId).length,
    unassigned: tickets.filter(t => !(t.assignedAdminId as string)).length,
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Support Tickets</h1>
          <p className="page-subtitle">All user tickets</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {(["all","open","in_progress","resolved","closed"] as const).map(s => (
            <button key={s} className={`chip${filter === s ? " active" : ""}`} style={{ fontSize: 11 }} onClick={() => setFilter(s)}>
              {s === "all" ? "All" : s.replace("_"," ")} ({counts[s] ?? 0})
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {([
          { key: "all", label: "All Tickets" },
          { key: "mine", label: "Assigned to Me" },
          { key: "unassigned", label: "Unassigned" },
        ] as const).map(scope => (
          <button
            key={scope.key}
            className={`chip${assigneeScope === scope.key ? " active" : ""}`}
            style={{ fontSize: 11 }}
            onClick={() => setAssigneeScope(scope.key)}
          >
            {scope.label} ({assigneeCounts[scope.key]})
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 60 }}><div className="loader" style={{ margin: "0 auto" }} /></div>
      ) : (
        <div className="admin-split-layout" style={{ height: "calc(100vh - 220px)", minHeight: 500 }}>
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
                    <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>#{t.ticketNumber || t.id?.slice(0, 8)}</span>
                    <span style={{ fontSize: 11, color: "var(--muted)" }}>{formatTimestamp(t.createdAt)}</span>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                    📂 {t.category}{t.bookingId ? ` · Booking ${t.bookingId.slice(0,8)}…` : ""}
                    {t.assignedAdminName ? ` · Assignee: ${t.assignedAdminName as string}` : " · Unassigned"}
                  </div>
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
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>{selected.displayName} · {selected.email}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
                    Assignee: {(selected.assignedAdminName as string) || "Unassigned"}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                  <select
                    className="form-input"
                    style={{ minWidth: 180, padding: "6px 10px", fontSize: 12 }}
                    value={(selected.assignedAdminId as string) || ""}
                    onChange={(e) => { void handleAssign(e.target.value); }}
                  >
                    <option value="">Unassigned</option>
                    {adminUsers.map(a => (
                      <option key={a.uid} value={a.uid}>{a.displayName}</option>
                    ))}
                  </select>
                  {((selected.assignedAdminId as string) || "") !== adminId && (
                    <button className="btn btn-ghost btn-sm" onClick={() => { void handleAssign(adminId); }} style={{ fontSize: 11 }}>
                      Assign to Me
                    </button>
                  )}
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

