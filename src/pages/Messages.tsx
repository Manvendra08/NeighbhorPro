import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import EmojiPicker, { EmojiClickData } from "emoji-picker-react";
import {
  subscribeToConversations,
  subscribeToMessages,
  sendMessage,
  uploadAttachment,
  getUserProfile,
  formatTimestampTime,
} from "../services/firestoreService";

export default function Messages() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [conversations, setConversations] = useState<Record<string, unknown>[]>([]);
  const [activeConv, setActiveConv] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, unknown>[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const [otherUsers, setOtherUsers] = useState<Record<string, Record<string, unknown>>>({});
  const [loading, setLoading] = useState(true);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [attachmentLoading, setAttachmentLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Subscribe to conversations
  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToConversations(user.uid, (convos) => {
      setConversations(convos);
      setLoading(false);

      // Load other user profiles
      convos.forEach((c) => {
        const participants = c.participants as string[];
        const otherId = participants.find((p) => p !== user.uid);
        if (otherId && !otherUsers[otherId]) {
          getUserProfile(otherId).then((profile) => {
            if (profile) {
              setOtherUsers((prev) => ({ ...prev, [otherId]: profile }));
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

  // Subscribe to messages of active conversation
  useEffect(() => {
    if (!activeConv) return;
    const unsub = subscribeToMessages(activeConv, (msgs) => {
      setMessages(msgs);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    });
    return unsub;
  }, [activeConv]);

  const handleSend = async () => {
    if (!newMsg.trim() || !activeConv || !user) return;
    const text = newMsg.trim();
    setNewMsg("");
    setShowEmojiPicker(false);
    await sendMessage(activeConv, user.uid, text);
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
    
    try {
      setAttachmentLoading(true);
      const result = await uploadAttachment(activeConv, file);
      await sendMessage(activeConv, user.uid, newMsg.trim(), {
        url: result.url,
        type: result.resourceType,
        name: file.name
      });
      setNewMsg("");
      setShowEmojiPicker(false);
    } catch (err: any) {
      alert(err.message || "Failed to upload file");
    } finally {
      setAttachmentLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const getOtherUserId = (conv: Record<string, unknown>) => {
    const participants = conv.participants as string[];
    return participants.find((p) => p !== user?.uid) || "";
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Messages</h1>
          <p className="page-subtitle">Chat with professionals and clients</p>
        </div>
      </div>

      <div className="chat-layout">
        {/* Conversation list */}
        <div className="chat-list">
          {loading ? (
            <div style={{ textAlign: "center", padding: 40 }}>
              <div className="loader" style={{ margin: "0 auto" }} />
            </div>
          ) : conversations.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
              No conversations yet. Book a consultation to start chatting!
            </div>
          ) : (
            conversations.map((conv) => {
              const otherId = getOtherUserId(conv);
              const other = otherUsers[otherId];
              const initials = ((other?.displayName as string) || "?")
                .split(" ")
                .map((w) => w[0])
                .join("")
                .slice(0, 2)
                .toUpperCase();

              return (
                <div
                  key={conv.id as string}
                  className={`chat-list-item${activeConv === conv.id ? " active" : ""}`}
                  onClick={() => setActiveConv(conv.id as string)}
                >
                  <div className="avatar avatar-sm">
                    {(other?.photoURL as string) ? (
                      <img src={other.photoURL as string} alt="" />
                    ) : (
                      initials
                    )}
                  </div>
                  <div style={{ flex: 1, overflow: "hidden" }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>
                      {(other?.displayName as string) || "User"}
                    </div>
                    <div className="text-muted text-xs" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {(conv.lastMessage as string) || "No messages yet"}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Chat messages */}
        <div className="chat-messages">
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
                return (
                  <div style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "12px 20px",
                    borderBottom: "1px solid var(--border)",
                    background: "var(--bg-elevated)",
                  }}>
                    <div className="avatar avatar-sm">
                      {(other?.photoURL as string) ? (
                        <img src={other.photoURL as string} alt="" />
                      ) : (
                        ((other?.displayName as string) || "?").slice(0, 2).toUpperCase()
                      )}
                    </div>
                    <div style={{ fontWeight: 600 }}>{(other?.displayName as string) || "User"}</div>
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
                                    textDecoration: "underline",
                                    wordBreak: "break-all"
                                  }}
                                >
                                  📄 {(msg.attachmentName as string) || "Document"}
                                </a>
                              )}
                            </div>
                          ) : null}
                          {msg.text as string}
                        </div>
                        <div
                          className="chat-bubble-time"
                          style={{ textAlign: isMine ? "right" : "left" }}
                        >
                          {formatTimestampTime(msg.timestamp)}
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
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSend();
                  }}
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
    </div>
  );
}
