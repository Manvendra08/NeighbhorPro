import { useEffect, useState, useRef, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { logActivity } from "../services/activityService";
import EmojiPicker, { EmojiClickData } from "emoji-picker-react";
import {
  subscribeToConversations,
  subscribeToMessages,
  sendMessage,
  uploadAttachment,
  getLatestBookingBetweenUsers,
  getBookingById,
  getConversationBookingId,
  markConversationRead,
} from "../services/firestoreService";
import { Timestamp } from "firebase/firestore";
import { relativeTime } from "../utils/time";
import { createTicket } from "../services/supportService";
import { fetchCachedPublicProfile } from "../lib/queryClient";


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
  const messageListRef = useRef<HTMLDivElement>(null);
  const loggedConvsRef = useRef<Set<string>>(new Set());

  const [linkedBookingId, setLinkedBookingId] = useState<string | null>(null);
  const [linkedBookingStatus, setLinkedBookingStatus] = useState<string | null>(null);
  const [conversationBookingStatus, setConversationBookingStatus] = useState<Record<string, string>>({});
  const [reportingConversation, setReportingConversation] = useState(false);

  // Find the nearest scrollable ancestor for the virtualizer. On mobile the
  // outer `.mobile-content` may be the actual scroll container, so we walk up
  // the DOM to find an element with overflow auto/scroll. This ensures the
  // virtualizer attaches to the right scroll element and the chat scrolls
  // correctly on small screens.
  const findScrollParent = useCallback((el: HTMLElement | null) => {
    if (!el || typeof window === "undefined") return el;
    let cur: HTMLElement | null = el;
    while (cur && cur !== document.documentElement) {
      const style = window.getComputedStyle(cur);
      const overflowY = style.overflowY || style.overflow;
      if (overflowY && (overflowY === "auto" || overflowY === "scroll")) return cur;
      cur = cur.parentElement;
    }
    return document.scrollingElement as HTMLElement | null || document.documentElement;
  }, []);

  const messageVirtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => findScrollParent(messageListRef.current),
    estimateSize: () => 92,
    overscan: 8,
  });

  const getOtherUserId = useCallback((conv: Record<string, unknown>) => {
    const participants = conv.participants as string[];
    return participants.find((p) => p !== user?.uid) || "";
  }, [user]);

  const fallbackDisplayNameFromUid = useCallback((uid: string) => {
    if (!uid) return "Member";
    const suffix = uid.slice(-4).toUpperCase();
    return `Member ${suffix}`;
  }, []);

  const openConversation = useCallback((conversationId: string) => {
    navigate(`/messages?conv=${encodeURIComponent(conversationId)}`);
  }, [navigate]);

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
          fetchCachedPublicProfile(otherId).then((profile) => {
            if (profile) {
              setOtherUsers((prev) => ({ ...prev, [otherId]: profile }));
            } else {
              const fallbackName = (c.participantNames as Record<string, string> | undefined)?.[otherId] || fallbackDisplayNameFromUid(otherId);
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
  }, [user, fallbackDisplayNameFromUid]);

  // Set active conversation from URL param
  useEffect(() => {
    const convParam = searchParams.get("conv");
    setActiveConv(convParam || null);
  }, [searchParams]);

  // Subscribe to messages of active conversation, mark as read
  useEffect(() => {
    if (!activeConv || !user) return;
    const unsub = subscribeToMessages(activeConv, (msgs) => {
      setMessages(msgs);
    });
    // Mark as read
    markConversationRead(activeConv, user.uid).catch(() => {});
    setUnreadCounts(prev => ({ ...prev, [activeConv]: 0 }));
    return unsub;
  }, [activeConv, user]);

  useEffect(() => {
    if (!activeConv || messages.length === 0) return;
    requestAnimationFrame(() => {
      messageVirtualizer.scrollToIndex(messages.length - 1, { align: "end" });
    });
  }, [activeConv, messages.length, messageVirtualizer]);

  useEffect(() => {
    messageVirtualizer.measure();
  }, [messages.length, messageVirtualizer]);

  useEffect(() => {
    if (!activeConv || !user) {
      setLinkedBookingId(null);
      setLinkedBookingStatus(null);
      return;
    }
    const conv = conversations.find(c => (c.id as string) === activeConv);
    const bookingId = (conv?.bookingId as string | undefined) || getConversationBookingId(activeConv);
    if (bookingId) {
      setLinkedBookingId(bookingId);
      getBookingById(bookingId)
        .then(booking => {
          setLinkedBookingStatus((booking?.status as string) || null);
        })
        .catch(() => {
          setLinkedBookingStatus(null);
        });
      return;
    }

    if (!conv) {
      setLinkedBookingId(null);
      setLinkedBookingStatus(null);
      return;
    }

    const otherId = getOtherUserId(conv);
    if (!otherId) {
      setLinkedBookingId(null);
      setLinkedBookingStatus(null);
      return;
    }
    getLatestBookingBetweenUsers(user.uid, otherId)
      .then(booking => {
        setLinkedBookingId((booking?.id as string) || null);
        setLinkedBookingStatus((booking?.status as string) || null);
      })
      .catch(() => {
        setLinkedBookingId(null);
        setLinkedBookingStatus(null);
      });
  }, [activeConv, conversations, user, getOtherUserId]);

  useEffect(() => {
    if (!user || conversations.length === 0) {
      setConversationBookingStatus({});
      return;
    }

    const bookingPairs = conversations
      .map(conv => {
        const conversationId = conv.id as string;
        const bookingId = (conv.bookingId as string | undefined) || getConversationBookingId(conversationId);
        return { conversationId, bookingId };
      })
      .filter(pair => Boolean(pair.bookingId));

    if (bookingPairs.length === 0) {
      setConversationBookingStatus({});
      return;
    }

    let alive = true;
    Promise.all(
      bookingPairs.map(async ({ conversationId, bookingId }) => {
        const booking = await getBookingById(bookingId as string).catch(() => null);
        const status = String((booking?.status as string) || "").toLowerCase();
        return { conversationId, status };
      })
    ).then(results => {
      if (!alive) return;
      const next: Record<string, string> = {};
      results.forEach(({ conversationId, status }) => {
        next[conversationId] = status;
      });
      setConversationBookingStatus(next);
    });

    return () => {
      alive = false;
    };
  }, [conversations, user]);

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
    
    if (file.size > 10 * 1024 * 1024) { 
      alert("File must be less than 10MB"); 
      return; 
    }
    
    const allowedTypes = [
      "image/jpeg", "image/png", "image/webp", "image/gif",
      "application/pdf", 
      "application/msword", 
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain"
    ];
    if (!allowedTypes.includes(file.type)) {
      alert("Invalid file type. Only images, PDF, Word, and text files are allowed.");
      return;
    }

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
  
  const totalUnread = Object.values(unreadCounts).reduce((a, b) => a + b, 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Messages {totalUnread > 0 && <span className="badge badge-error" style={{ fontSize: 12, marginLeft: 8 }}>{totalUnread}</span>}
          </h1>
          <p className="page-subtitle">Chat history for your bookings</p>
        </div>
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
              const fallbackName = ((conv.participantNames as Record<string, string> | undefined)?.[otherId] as string | undefined) || fallbackDisplayNameFromUid(otherId);
              const fallbackPhoto = ((conv.participantPhotos as Record<string, string> | undefined)?.[otherId] as string | undefined) || "";
              const displayName = (other?.displayName as string) || fallbackName;
              const displayPhoto = (other?.photoURL as string) || fallbackPhoto;
              const initials = (displayName || "?")
                .split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
              const unread = unreadCounts[conv.id as string] || 0;
              const isActive = activeConv === conv.id;
              const convStatus = String(conversationBookingStatus[conv.id as string] || "").toLowerCase();
              const isConversationClosed = convStatus === "closed" || convStatus === "cancelled";

              return (
                <div
                  key={conv.id as string}
                  className={`chat-list-item${isActive ? " active" : ""}`}
                  onClick={() => openConversation(conv.id as string)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openConversation(conv.id as string);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={`Open conversation with ${displayName}`}
                  style={{ position: "relative" }}
                >
                  <div className="avatar avatar-sm" style={{ position: "relative", flexShrink: 0 }}>
                    {displayPhoto ? <img src={displayPhoto} alt="" loading="lazy" /> : initials}
                    {(other?.isServiceProvider as boolean) && (
                      <span style={{
                        position: "absolute",
                        bottom: -3,
                        left: -2,
                        minWidth: 24,
                        height: 14,
                        borderRadius: 999,
                        background: "linear-gradient(135deg, #16a34a, #15803d)",
                        color: "#fff",
                        fontSize: 8,
                        fontWeight: 700,
                        letterSpacing: 0.3,
                        textTransform: "uppercase",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        border: "1px solid var(--surface)",
                        padding: "0 4px",
                      }}>Pro</span>
                    )}
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
                    {(conv.bookingId as string | undefined) && (
                      <div style={{ marginTop: 4 }}>
                        <span className="badge badge-muted" style={{ fontSize: 10 }}>
                          Booking #{String(conv.bookingId).slice(0, 8)}…
                        </span>
                        {isConversationClosed && (
                          <span
                            className="badge badge-muted"
                            style={{ fontSize: 10, marginLeft: 6, background: "#e5e7eb", color: "#4b5563", border: "1px solid #d1d5db" }}
                          >
                            {convStatus === "cancelled" ? "Cancelled" : "Closed"}
                          </span>
                        )}
                      </div>
                    )}
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
                const fallbackName = ((conv?.participantNames as Record<string, string> | undefined)?.[otherId] as string | undefined) || fallbackDisplayNameFromUid(otherId);
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
                         navigate("/messages");
                      }} 
                      style={{ padding: 4, display: "none", marginRight: -4, marginLeft: -12 }}
                      title="Back to conversations"
                      aria-label="Back to conversations"
                    >
                      ←
                    </button>
                    <div className="avatar avatar-sm" style={{ position: "relative" }}>
                      {displayPhoto ? (
                        <img src={displayPhoto} alt="" loading="lazy" />
                      ) : (
                        (displayName || "?").slice(0, 2).toUpperCase()
                      )}
                      {(other?.isServiceProvider as boolean) && (
                        <span style={{
                          position: "absolute",
                          bottom: -3,
                          right: -3,
                          minWidth: 24,
                          height: 14,
                          borderRadius: 999,
                          background: "linear-gradient(135deg, #16a34a, #15803d)",
                          color: "#fff",
                          fontSize: 8,
                          fontWeight: 700,
                          letterSpacing: 0.3,
                          textTransform: "uppercase",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          border: "1px solid var(--surface)",
                          padding: "0 4px",
                        }}>Pro</span>
                      )}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600 }}>{displayName}</div>
                      {(other?.isServiceProvider as boolean) && (
                        <div style={{ fontSize: 10, color: "#15803d", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3 }}>Pro</div>
                      )}
                      {linkedBookingId && (
                        <div style={{ marginTop: 4, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                          <span className="badge badge-muted" style={{ fontSize: 10 }}>
                            Booking #{linkedBookingId.slice(0, 8)}…
                          </span>
                          {linkedBookingStatus && (
                            <span className={`badge ${linkedBookingStatus === "cancelled" ? "badge-error" : linkedBookingStatus === "closed" ? "badge-muted" : "badge-accent"}`} style={{ fontSize: 10 }}>
                              {linkedBookingStatus}
                            </span>
                          )}
                        </div>
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

              <div className="chat-messages-body" ref={messageListRef}>
                {messages.length === 0 ? (
                  <div style={{ textAlign: "center", padding: 40, color: "var(--muted)", fontSize: 13 }}>
                    No messages yet. Say hello! 👋
                  </div>
                ) : (
                  <div style={{ height: messageVirtualizer.getTotalSize(), position: "relative", width: "100%" }}>
                    {messageVirtualizer.getVirtualItems().map((virtualRow) => {
                      const msg = messages[virtualRow.index];
                      const isMine = (msg.senderId as string) === user?.uid;
                      return (
                        <div
                          key={msg.id as string}
                          data-index={virtualRow.index}
                          ref={messageVirtualizer.measureElement}
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            width: "100%",
                            transform: `translateY(${virtualRow.start}px)`,
                          }}
                        >
                        <div className={`chat-bubble${isMine ? " mine" : ""}`}>
                          {msg.attachmentUrl ? (
                            <div style={{ marginBottom: msg.text ? 8 : 0 }}>
                              {(msg.attachmentType as string) === "image" ? (
                                <img
                                  src={msg.attachmentUrl as string}
                                  alt="attachment"
                                  loading="lazy"
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
                    })}
                  </div>
                )}
              </div>

              {linkedBookingStatus === "closed" || linkedBookingStatus === "cancelled" ? (
                <div style={{ padding: "16px 20px", textAlign: "center", borderTop: "1px solid var(--border)", color: "var(--muted)", fontSize: 14 }}>
                  This booking is closed/cancelled. New messages cannot be sent.
                </div>
              ) : (
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
                    aria-label="Attach file"
                  />

                  <button
                    className="btn btn-outline btn-icon"
                    onClick={() => fileInputRef.current?.click()}
                    title="Attach file (max 10MB)"
                    aria-label="Attach file"
                    disabled={attachmentLoading}
                    style={{ padding: "0 12px" }}
                  >
                    {attachmentLoading ? "⏳" : "📎"}
                  </button>

                  <button
                    className="btn btn-outline btn-icon"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    title="Add emoji"
                    aria-label="Add emoji"
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
              )}
            </>
          )}
        </div>
      </div>

    </div>
  );
}

