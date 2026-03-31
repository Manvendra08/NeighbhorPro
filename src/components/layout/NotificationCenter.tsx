import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { usePushNotifications } from "../../hooks/usePushNotifications";
import { type AppNotification, useNotifications } from "../../hooks/useNotifications";

interface NotificationCenterProps {
    mobile?: boolean;
}

const iconForKind: Record<AppNotification["kind"], string> = {
    message: "💬",
    booking: "📅",
    wallet: "🪙",
    ticket: "🎫",
    broadcast: "📣",
    admin_action: "🛠️",
};

function timeAgo(ms: number) {
    const diff = Math.max(1, Math.floor((Date.now() - ms) / 1000));
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
}

export default function NotificationCenter({ mobile = false }: NotificationCenterProps) {
    const { user, userProfile } = useAuth();
    const navigate = useNavigate();
    const { permission, requestPermission } = usePushNotifications(user?.uid);
    const { notifications, loading, unreadCount, isRead, markRead, markAllRead } = useNotifications(
        user?.uid,
        userProfile
    );

    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const onClickOutside = (e: MouseEvent) => {
            if (!rootRef.current || rootRef.current.contains(e.target as Node)) return;
            setOpen(false);
        };
        document.addEventListener("mousedown", onClickOutside);
        return () => document.removeEventListener("mousedown", onClickOutside);
    }, []);

    const handleNavigate = (item: AppNotification) => {
        markRead(item.id);
        setOpen(false);
        navigate(item.actionUrl);
    };

    return (
        <div className={`notification-center${mobile ? " mobile" : ""}`} ref={rootRef}>
            <button
                className={`topbar-btn ${unreadCount > 0 ? "notification-bell-pulse" : ""}`}
                onClick={() => setOpen(prev => !prev)}
                title={permission === "default" ? "Enable notifications" : "Notifications"}
                aria-label="Notifications"
            >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                {unreadCount > 0 ? (
                    <span className="notification-count">{unreadCount > 99 ? "99+" : unreadCount}</span>
                ) : (
                    permission === "granted" && <span className="topbar-badge" />
                )}
            </button>

            {open && (
                <div className={`notification-panel${mobile ? " mobile" : ""}`}>
                    <div className="notification-panel-head">
                        <div>
                            <div className="notification-title">Notifications</div>
                            <div className="notification-subtitle">
                                {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
                            </div>
                        </div>
                        <div className="notification-actions">
                            {permission !== "granted" && (
                                <button className="btn btn-secondary btn-sm" onClick={requestPermission}>
                                    Enable Push
                                </button>
                            )}
                            <button className="btn btn-ghost btn-sm" onClick={markAllRead} disabled={unreadCount === 0}>
                                Mark all read
                            </button>
                        </div>
                    </div>

                    <div className="notification-list">
                        {loading ? (
                            <div style={{ textAlign: "center", padding: 26 }}>
                                <div className="loader" style={{ margin: "0 auto" }} />
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="notification-empty">
                                <div className="notification-empty-icon">🔔</div>
                                <div className="notification-empty-title">No alerts yet</div>
                                <div className="notification-empty-sub">Updates for messages, bookings, wallet, and tickets will appear here.</div>
                            </div>
                        ) : (
                            notifications.map(item => {
                                const unread = !isRead(item.id);
                                return (
                                    <button
                                        key={item.id}
                                        className={`notification-item ${item.kind} ${unread ? " unread" : ""}`}
                                        onClick={() => handleNavigate(item)}
                                    >
                                        <span className="notification-item-icon">{iconForKind[item.kind]}</span>
                                        <div className="notification-item-body">
                                            <div className="notification-item-row">
                                                <span className="notification-item-title">{item.title}</span>
                                                <span className={`notification-priority ${item.priority}`}>{item.priority}</span>
                                            </div>
                                            <div className="notification-item-text">{item.body}</div>
                                            <div className="notification-item-time">{timeAgo(item.createdAt)}</div>
                                        </div>
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
