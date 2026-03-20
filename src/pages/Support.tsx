import { useState, FormEvent } from "react";
import { useAuth } from "../contexts/AuthContext";
import { collection, doc, setDoc, addDoc, serverTimestamp, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { useEffect } from "react";

interface SupportMessage {
  id: string;
  text: string;
  senderRole: "user" | "admin";
  senderName?: string;
  timestamp: any;
}

export default function Support() {
  const { user, userProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<"chat" | "email" | "faq">("faq");
  const [chatMsg, setChatMsg] = useState("");
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const [ticketId, setTicketId] = useState<string | null>(null);

  // Listen for support chat messages
  useEffect(() => {
    if (!user) return;
    const tid = `support_${user.uid}`;
    setTicketId(tid);

    const q = query(
      collection(db, `supportTickets/${tid}/messages`),
      orderBy("timestamp", "asc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() } as SupportMessage)));
    });
    return unsub;
  }, [user]);

  const sendChat = async (e: FormEvent) => {
    e.preventDefault();
    if (!chatMsg.trim() || !user || !ticketId) return;
    setSending(true);

    const ticketRef = doc(db, "supportTickets", ticketId);
    
    // Update or create the parent ticket
    await setDoc(ticketRef, {
      subject: "Support Chat",
      userId: user.uid,
      userName: userProfile?.displayName || "User",
      userEmail: userProfile?.email || "",
      status: "open",
      priority: "normal",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });

    await addDoc(collection(db, `supportTickets/${ticketId}/messages`), {
      text: chatMsg.trim(),
      senderRole: "user",
      senderName: userProfile?.displayName || "User",
      timestamp: serverTimestamp(),
    });

    setChatMsg("");
    setSending(false);
  };

  const faqs = [
    { q: "How do I find a professional?", a: "Go to 'Browse Pros' from the sidebar. You can filter by skill, society, and rating to find the best match." },
    { q: "Is the platform free to use?", a: "Yes! Browsing, messaging, and booking professionals is completely free for residents." },
    { q: "How are professionals verified?", a: "All service providers go through community verification. Their identity is confirmed and they must be a registered resident of a listed society." },
    { q: "How do I become a service provider?", a: "Go to your Profile, toggle 'I offer professional services', add your skills and pricing. You'll appear in the browse directory." },
    { q: "Can I change my society after registration?", a: "Yes, you can update your society from your Profile page at any time." },
    { q: "How do reviews work?", a: "Residents can leave reviews after a booking is completed. All reviews are tied to verified bookings to prevent fake ratings." },
  ];

  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Support</h1>
          <p className="page-subtitle">Get help via chat, email, or browse FAQs</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab${activeTab === "faq" ? " active" : ""}`} onClick={() => setActiveTab("faq")}>FAQ</button>
        <button className={`tab${activeTab === "chat" ? " active" : ""}`} onClick={() => setActiveTab("chat")}>Chat Support</button>
        <button className={`tab${activeTab === "email" ? " active" : ""}`} onClick={() => setActiveTab("email")}>Email Support</button>
      </div>

      {/* FAQ Tab */}
      {activeTab === "faq" && (
        <div className="card" style={{ padding: 0 }}>
          {faqs.map((f, i) => (
            <div key={i} style={{ borderBottom: i < faqs.length - 1 ? "1px solid var(--border)" : "none" }}>
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                style={{
                  width: "100%", textAlign: "left", padding: "18px 22px", background: "none",
                  border: "none", cursor: "pointer", fontSize: 14, fontWeight: 600, fontFamily: "var(--font-body)",
                  color: "var(--text)", display: "flex", justifyContent: "space-between", alignItems: "center"
                }}
              >
                {f.q}
                <span style={{ color: "var(--muted)", fontSize: 18, transform: openFaq === i ? "rotate(180deg)" : "none", transition: "transform .2s" }}>▼</span>
              </button>
              {openFaq === i && (
                <div style={{ padding: "0 22px 18px", fontSize: 14, color: "var(--muted)", lineHeight: 1.7 }}>
                  {f.a}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Chat Tab */}
      {activeTab === "chat" && (
        <div className="card">
          <div style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, marginBottom: 4 }}>💬 Live Chat with Support</h3>
            <p style={{ fontSize: 13, color: "var(--muted)" }}>Messages are sent directly to the admin team. Replies will appear here.</p>
          </div>
          <div style={{
            background: "var(--surface-2)", borderRadius: "var(--radius)", padding: 16,
            minHeight: 260, maxHeight: 360, overflowY: "auto", marginBottom: 16,
            display: "flex", flexDirection: "column", gap: 10
          }}>
            {messages.length === 0 && (
              <div style={{ textAlign: "center", color: "var(--muted)", padding: "40px 0", fontSize: 14 }}>
                No messages yet. Send a message to start a conversation.
              </div>
            )}
            {messages.map(m => (
              <div key={m.id} style={{
                alignSelf: m.senderRole === "user" ? "flex-end" : "flex-start",
                background: m.senderRole === "user" ? "var(--accent)" : "var(--surface)",
                color: m.senderRole === "user" ? "#fff" : "var(--text)",
                padding: "10px 16px", borderRadius: 14, maxWidth: "75%", fontSize: 14,
                border: m.senderRole === "admin" ? "1px solid var(--border)" : "none"
              }}>
                {m.text}
              </div>
            ))}
          </div>
          <form onSubmit={sendChat} style={{ display: "flex", gap: 10 }}>
            <input
              className="form-input"
              placeholder="Type your message..."
              value={chatMsg}
              onChange={e => setChatMsg(e.target.value)}
              style={{ flex: 1 }}
            />
            <button type="submit" className="btn btn-primary" disabled={sending || !chatMsg.trim()}>
              {sending ? "..." : "Send"}
            </button>
          </form>
        </div>
      )}

      {/* Email Tab */}
      {activeTab === "email" && (
        <div className="card" style={{ textAlign: "center", padding: 48 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📧</div>
          <h3 style={{ marginBottom: 8 }}>Email Support</h3>
          <p style={{ color: "var(--muted)", marginBottom: 24, fontSize: 14 }}>
            Send us an email and we'll get back to you within 24 hours.
          </p>
          {emailSent ? (
            <div style={{ color: "var(--success)", fontWeight: 600 }}>✅ Email client opened!</div>
          ) : (
            <a
              href={`mailto:support@pro-neighbor.in?subject=Support Request from ${userProfile?.displayName || "User"}&body=Hi ProNeighbor team,%0A%0A`}
              className="btn btn-primary"
              onClick={() => setEmailSent(true)}
            >
              Open Email Client
            </a>
          )}
          <p style={{ marginTop: 24, fontSize: 13, color: "var(--muted)" }}>
            Or write to us at: <a href="mailto:support@pro-neighbor.in">support@pro-neighbor.in</a>
          </p>
        </div>
      )}
    </div>
  );
}
