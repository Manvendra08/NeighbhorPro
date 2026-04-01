import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { logActivity } from "../services/activityService";
import EmojiPicker, { EmojiClickData } from "emoji-picker-react";
import {
  subscribeToConversations,
  subscribeToMessages,
  sendMessage,
  uploadAttachment,
  getPublicProfile,
  getLatestBookingBetweenUsers,
  markConversationRead,
  getAllUserRows,
  getOrCreateConversation,
} from "../services/firestoreService";
import { Timestamp } from "firebase/firestore";
import { relativeTime } from "../utils/time";
import { createTicket } from "../services/supportService";


export default function Messages() {
  const { user, userProfile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [conversations, setConversations] = useState<Record<string, unknown>[]>([]);
  const [activeConv, setActiveConv] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, unknown>[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const [otherUsers, setOtherUsers] = useState<Record<string, Record<string, unknown>>>({});
  const [loading, setLoading] = useState(true);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [attachmentLoading, setAttachmentLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const loggedConvsRef = useRef<Set<string>>(new Set());

  // New Chat Modal state
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [allUsers, setAllUsers] = useState<Record<string, unknown>[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [linkedBookingId, setLinkedBookingId] = useState<string | null>(null);
  const [reportingConversation, setReportingConversation] = useState(false);

  const getOtherUserId = useCallback((conv: Record<string, unknown>) => {
    const participants = conv.participants as string[];
    return participants.find((p) => p !== user?.uid) || "";
  }, [user]);

  // Subscribe to conversations
  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToConversations(user.uid, (convos) => {
      setConversations(convos);
      setLoading(false);

      // Compute unread counts from lastReadAt + lastMessageAt
      const counts: Record<string, number> = {};
      convos.forEach(c => {
        const lastReadAt = (c.lastReadAt as Record<string, Timestamp> | undefined)?.[user.uid];
        const lastMessageAt = c.lastMessageAt as Timestamp | undefined;
        const lastSenderId = (c.lastSenderId as string) || "";
        if (lastSenderId !== user.uid && lastMessageAt) {
          if (!lastReadAt || lastMessageAt.seconds > lastReadAt.seconds) {
            counts[c.id as string] = (counts[c.id as string] || 0) + 1;
          }
        }
      });
      setUnreadCounts(counts);

      // Load other user profiles
      convos.forEach((c) => {
        const participants = c.participants as string[];
        const otherId = participants.find((p) => p !== user.uid);
        if (otherId && !otherUsers[otherId]) {
          getPublicProfile(otherId).then((profile) => {
            if (profile) {
              setOtherUsers((prev) => ({ ...prev, [otherId]: profile }));
            } else {
              const fallbackName = (c.participantNames as Record<string, string> | undefined)?.[otherId] || "User";
              const fallbackPhoto = (c.participantPhotos as Record<string, string> | undefined)?.[otherId] || "";
              setOtherUsers((prev) => ({
                ...prev,
                [otherId]: {
                  uid: otherId,
                  displayName: fallbackName,
                  photoURL: fallbackPhoto,
                },
              }));
            }
          });
        }
      });
    });
    return unsub;
  }, [user]);

  // Set active conversation from URL param
  useEffect(() => {
    const convParam = searchParams.get("conv");
    if (convParam) setActiveConv(convParam);
  }, [searchParams]);

  // Subscribe to messages of active conversation, mark as read
  useEffect(() => {
    if (!activeConv || !user) return;
    const unsub = subscribeToMessages(activeConv, (msgs) => {
      setMessages(msgs);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    });
    // Mark as read
    markConversationRead(activeConv, user.uid).catch(() => {});
    setUnreadCounts(prev => ({ ...prev, [activeConv]: 0 }));
    return unsub;
  }, [activeConv, user]);

  useEffect(() => {
    if (!activeConv || !user) {
      setLinkedBookingId(null);
      return;
    }
    const conv = conversations.find(c => (c.id as string) === activeConv);
    if (!conv) {
      setLinkedBookingId(null);
      return;
    }
    const otherId = getOtherUserId(conv);
    if (!otherId) {
      setLinkedBookingId(null);
      return;
    }
    getLatestBookingBetweenUsers(user.uid, otherId)
      .then(booking => setLinkedBookingId((booking?.id as string) || null))
      .catch(() => setLinkedBookingId(null));
  }, [activeConv, conversations, user, getOtherUserId]);

  const handleReportConversation = async () => {
    if (!user || !activeConv || reportingConversation) return;
    const proceed = window.confirm("Report this conversation for review by support?");
    if (!proceed) return;

    setReportingConversation(true);
    try {
      const displayName = (userProfile?.displayName as string) || user.displayName || "User";
      const email = (userProfile?.email as string) || user.email || "";
      await createTicket({
        uid: user.uid,
        displayName,
        email,
        subject: `Chat report: ${activeConv}`,
        category: "dispute",
        bookingId: linkedBookingId || undefined,
      });
      alert("Conversation reported. Support will review it shortly.");
    } catch {
      alert("Could not submit report. Please try again.");
    } finally {
      setReportingConversation(false);
    }
  };

  const formatMessageTimestamp = (ts: unknown): string => {
    if (!(ts instanceof Timestamp)) return "";
    return ts.toDate().toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleSend = async () => {
    if (!newMsg.trim() || !activeConv || !user) return;
    const text = newMsg.trim();
    setNewMsg("");
    setShowEmojiPicker(false);
    await sendMessage(activeConv, user.uid, text);
    markConversationRead(activeConv, user.uid).catch(() => {});
    // Log once per conversation per session (throttle to avoid per-message writes)
    if (!loggedConvsRef.current.has(activeConv)) {
      loggedConvsRef.current.add(activeConv);
      logActivity(user.uid, "message.sent", `Sent message in conversation ${activeConv}`, { convId: activeConv });
    }
  };

  const onEmojiClick = (emojiData: EmojiClickData) => {
    setNewMsg(prev => prev + emojiData.emoji);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeConv || !user) return;
    if (file.size > 10 * 1024 * 1024) { alert("File must be less than 10MB"); return; }
    try {
      setAttachmentLoading(true);
      const result = await uploadAttachment(activeConv, file);
      await sendMessage(activeConv, user.uid, newMsg.trim(), {
        url: result.url, type: result.resourceType, name: file.name,
      });
      setNewMsg(""); setShowEmojiPicker(false);
    } catch (err: unknown) {
      alert((err as Error).message || "Failed to upload file");
    } finally {
      setAttachmentLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const filteredConvos = conversations.filter(conv => {
    if (!search) return true;
    const otherId = getOtherUserId(conv);
    const other = otherUsers[otherId];
    const name = ((other?.displayName as string) || "").toLowerCase();
    const last = ((conv.lastMessage as string) || "").toLowerCase();
    return name.includes(search.toLowerCase()) || last.includes(search.toLowerCase());
  });
  
  const handleStartNewChat = async (targetUid: string) => {
    if (!user) return;
    try {
      const convId = await getOrCreateConversation(user.uid, targetUid);
      setActiveConv(convId);
      setShowNewChatModal(false);
      setUserSearch("");
      // Add ?conv= to URL without full reload
      const url = new URL(window.location.href);
      url.searchParams.set("conv", convId);
      window.history.pushState({}, "", url.toString());
    } catch (err) {
      alert("Failed to start chat.");
    }
  };

  useEffect(() => {
    if (showNewChatModal && allUsers.length === 0) {
      setSearchingUsers(true);
      getAllUserRows().then(rows => {
        setAllUsers(rows.filter(u => u.uid !== user?.uid));
        setSearchingUsers(false);
      });
    }
  }, [showNewChatModal, user, allUsers.length]);

  const filteredUsers = allUsers.filter(u => {
    const q = userSearch.toLowerCase();
    const name = ((u.displayName as string) || "").toLowerCase();
    const email = ((u.email as string) || "").toLowerCase();
    const society = ((u.society as string) || "").toLowerCase();
    return name.includes(q) || email.includes(q) || society.includes(q);
  });

  const totalUnread = Object.values(unreadCounts).reduce((a, b) => a + b, 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Messages {totalUnread > 0 && <span className="badge badge-error" style={{ fontSize: 12, marginLeft: 8 }}>{totalUnread}</span>}
          </h1>
          <p className="page-subtitle">Chat with professionals and clients</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowNewChatModal(true)}>
          <span style={{ marginRight: 6 }}>+</span> New Chat
        </button>
      </div>

      <div className="chat-layout">
        {/* Conversation list */}
        <div className={`chat-list ${activeConv ? 'hidden-mobile' : ''}`}>
          {/* Search bar */}
          <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)" }}>
            <input
              className="form-input"
              style={{ fontSize: 13, padding: "6px 10px" }}
              placeholder="🔍 Search conversations…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {loading ? (
            <div style={{ textAlign: "center", padding: 40 }}>
              <div className="loader" style={{ margin: "0 auto" }} />
            </div>
          ) : filteredConvos.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
              {search ? "No conversations match your search." : "No conversations yet. Book a consultation to start chatting!"}
            </div>
          ) : (
            filteredConvos.map((conv) => {
              const otherId = getOtherUserId(conv);
              const other = otherUsers[otherId];
              const fallbackName = ((conv.participantNames as Record<string, string> | undefined)?.[otherId] as string | undefined) || "User";
              const fallbackPhoto = ((conv.participantPhotos as Record<string, string> | undefined)?.[otherId] as string | undefined) || "";
              const displayName = (other?.displayName as string) || fallbackName;
              const displayPhoto = (other?.photoURL as string) || fallbackPhoto;
              const initials = (displayName || "?")
                .split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
              const unread = unreadCounts[conv.id as string] || 0;
              const isActive = activeConv === conv.id;

              return (
                <div
                  key={conv.id as string}
                  className={`chat-list-item${isActive ? " active" : ""}`}
                  onClick={() => setActiveConv(conv.id as string)}
                  style={{ position: "relative" }}
                >
                  <div className="avatar avatar-sm" style={{ position: "relative", flexShrink: 0 }}>
                    {displayPhoto ? <img src={displayPhoto} alt="" /> : initials}
                    {unread > 0 && (
                      <span style={{
                        position: "absolute", top: -3, right: -3,
                        background: "var(--error)", color: "#fff",
                        borderRadius: "50%", fontSize: 9, fontWeight: 700,
                        width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center",
                        border: "2px solid var(--surface)",
                      }}>{unread > 9 ? "9+" : unread}</span>
                    )}
                  </div>
                  <div style={{ flex: 1, overflow: "hidden" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <span style={{ fontWeight: unread > 0 ? 700 : 600, fontSize: 14 }}>
                        {displayName}
                      </span>
                      <span style={{ fontSize: 10, color: "var(--muted)", whiteSpace: "nowrap", marginLeft: 6 }}>
                        {relativeTime(conv.lastMessageAt)}
                      </span>
                    </div>
                    <div className="text-muted text-xs" style={{
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      fontWeight: unread > 0 ? 600 : 400, color: unread > 0 ? "var(--text)" : undefined,
                    }}>
                      {(conv.lastMessage as string) || "No messages yet"}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Chat messages */}
        <div className={`chat-messages ${!activeConv ? 'hidden-mobile' : ''}`}>
          {!activeConv ? (
            <div className="empty-state" style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <div className="empty-state-icon">💬</div>
              <div className="empty-state-title">Select a conversation</div>
              <div className="empty-state-desc">Choose a conversation from the list to start chatting</div>
            </div>
          ) : (
            <>
              {/* Chat header */}
              {(() => {
                const conv = conversations.find((c) => c.id === activeConv);
                const otherId = conv ? getOtherUserId(conv) : "";
                const other = otherUsers[otherId];
                const fallbackName = ((conv?.participantNames as Record<string, string> | undefined)?.[otherId] as string | undefined) || "User";
                const fallbackPhoto = ((conv?.participantPhotos as Record<string, string> | undefined)?.[otherId] as string | undefined) || "";
                const displayName = (other?.displayName as string) || fallbackName;
                const displayPhoto = (other?.photoURL as string) || fallbackPhoto;
                return (
                  <div style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "12px 20px",
                    borderBottom: "1px solid var(--border)",
                    background: "var(--bg-elevated)",
                  }}>
                    <button 
                      className="btn btn-ghost btn-icon mobile-back-btn" 
                      onClick={() => {
                         setActiveConv(null);
                         // Remove conv from URL natively
                         const url = new URL(window.location.href);
                         url.searchParams.delete("conv");
                         window.history.pushState({}, "", url.toString());
                      }} 
                      style={{ padding: 4, display: "none", marginRight: -4, marginLeft: -12 }}
                      title="Back to conversations"
                    >
                      ←
                    </button>
                    <div className="avatar avatar-sm">
                      {displayPhoto ? (
                        <img src={displayPhoto} alt="" />
                      ) : (
                        (displayName || "?").slice(0, 2).toUpperCase()
                      )}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600 }}>{displayName}</div>
                      {(other?.isServiceProvider as boolean) && (
                        <div style={{ fontSize: 11, color: "var(--success)" }}>✓ Professional</div>
                      )}
                    </div>
                    <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                      {linkedBookingId && (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => navigate(`/bookings/${linkedBookingId}`)}
                          title="Open related booking"
                        >
                          View Booking
                        </button>
                      )}
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={handleReportConversation}
                        disabled={reportingConversation}
                        title="Report conversation"
                      >
                        {reportingConversation ? "Reporting..." : "Report"}
                      </button>
                    </div>
                  </div>
                );
              })()}

              <div className="chat-messages-body">
                {messages.length === 0 ? (
                  <div style={{ textAlign: "center", padding: 40, color: "var(--muted)", fontSize: 13 }}>
                    No messages yet. Say hello! 👋
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isMine = (msg.senderId as string) === user?.uid;
                    return (
                      <div key={msg.id as string}>
                        <div className={`chat-bubble${isMine ? " mine" : ""}`}>
                          {msg.attachmentUrl ? (
                            <div style={{ marginBottom: msg.text ? 8 : 0 }}>
                              {(msg.attachmentType as string) === "image" ? (
                                <img
                                  src={msg.attachmentUrl as string}
                                  alt="attachment"
                                  style={{ maxWidth: 200, borderRadius: 8, display: "block", marginBottom: 4 }}
                                />
                              ) : (
                                <a
                                  href={msg.attachmentUrl as string}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{
                                    display: "flex", alignItems: "center", gap: 6,
                                    color: isMine ? "white" : "var(--primary)",
                                    textDecoration: "underline", wordBreak: "break-all",
                                  }}
                                >
                                  📄 {(msg.attachmentName as string) || "Document"}
                                </a>
                              )}
                            </div>
                          ) : null}
                          {msg.text as string}
                        </div>
                        <div className="chat-bubble-time" style={{ textAlign: isMine ? "right" : "left" }}>
                          {formatMessageTimestamp(msg.timestamp)}
                          {isMine && <span style={{ marginLeft: 4, opacity: 0.5 }}>✓</span>}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="chat-input-bar" style={{ position: "relative", gap: 8 }}>
                {showEmojiPicker && (
                  <div style={{ position: "absolute", bottom: "100%", left: 0, marginBottom: 8, zIndex: 10 }}>
                    <EmojiPicker onEmojiClick={onEmojiClick} />
                  </div>
                )}

                <input
                  type="file"
                  style={{ display: "none" }}
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*,.pdf,.doc,.docx,.txt"
                />

                <button
                  className="btn btn-outline btn-icon"
                  onClick={() => fileInputRef.current?.click()}
                  title="Attach file (max 10MB)"
                  disabled={attachmentLoading}
                  style={{ padding: "0 12px" }}
                >
                  {attachmentLoading ? "⏳" : "📎"}
                </button>

                <button
                  className="btn btn-outline btn-icon"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  title="Add emoji"
                  style={{ padding: "0 12px" }}
                >
                  😀
                </button>

                <input
                  type="text"
                  placeholder="Type a message…"
                  value={newMsg}
                  onChange={(e) => setNewMsg(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }}
                  id="chat-message-input"
                  style={{ flex: 1 }}
                />
                <button className="btn btn-primary" onClick={handleSend} disabled={!newMsg.trim() && !attachmentLoading}>
                  Send
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* New Chat Modal */}
      {showNewChatModal && (
        <div className="modal-overlay" onClick={() => setShowNewChatModal(false)}>
          <div className="modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Start a New Chat</h3>
              <button className="modal-close" onClick={() => setShowNewChatModal(false)}>✕</button>
            </div>
            <div style={{ padding: "0 0 16px" }}>
              <input 
                className="form-input" 
                placeholder="Search name, email, or society…" 
                autoFocus
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
              />
            </div>
            <div style={{ maxHeight: 320, overflowY: "auto", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)" }}>
              {searchingUsers ? (
                <div style={{ padding: 40, textAlign: "center" }}><div className="loader" style={{ margin: "0 auto" }} /></div>
              ) : filteredUsers.length === 0 ? (
                <div style={{ padding: 30, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>No users found.</div>
              ) : (
                filteredUsers.map(u => {
                  const initials = ((u.displayName as string) || "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
                  return (
                    <div 
                      key={u.uid as string} 
                      className="chat-list-item" 
                      onClick={() => handleStartNewChat(u.uid as string)}
                      style={{ padding: "10px 14px" }}
                    >
                      <div className="avatar avatar-sm">
                        {(u.photoURL as string) ? <img src={u.photoURL as string} alt="" /> : initials}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{u.displayName as string || "Anonymous"}</div>
                        <div style={{ fontSize: 12, color: "var(--muted)" }}>{u.society as string || "Neighbor"}</div>
                      </div>
                      {!!u.isServiceProvider && (
                        <span className="badge badge-accent" style={{ fontSize: 9 }}>Pro</span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

