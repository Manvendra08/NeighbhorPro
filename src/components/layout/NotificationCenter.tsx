import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
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

    // Stable callback — Firestore listeners in useNotifications are already live,
    // so a foreground FCM message doesn't need to force a re-fetch. We use this
    // slot to show a toast or badge flash in the future if needed.
    const onForegroundMessage = useCallback(() => {
        // Foreground FCM message received — Firestore real-time listeners will
        // pick up the underlying data change automatically.
    }, []);

    const { permission, requestPermission } = usePushNotifications(user?.uid, onForegroundMessage);
    const { notifications, loading, unreadCount, isRead, markRead, clearAll } = useNotifications(
        user?.uid,
        userProfile
    );

    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const actionRefs = useRef<Array<HTMLButtonElement | null>>([]);

    // Auto-prompt once per session when the panel is first opened and permission
    // is still "default". This surfaces the browser permission dialog without
    // requiring the user to find the "Enable Push" button.
    const autoPromptedRef = useRef(false);
    useEffect(() => {
        if (!open || autoPromptedRef.current) return;
        if (permission === "default" && user?.uid) {
            autoPromptedRef.current = true;
            void requestPermission();
        }
    }, [open, permission, user?.uid, requestPermission]);

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

    const focusAction = (index: number) => {
        const items = actionRefs.current.filter(Boolean);
        if (items.length === 0) return;
        items[((index % items.length) + items.length) % items.length]?.focus();
    };

    useEffect(() => {
        if (!open) return;
        requestAnimationFrame(() => focusAction(0));
    }, [open, permission, notifications.length]);

    const handlePanelKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
        const items = actionRefs.current.filter(Boolean);
        if (items.length === 0) return;

        const currentIndex = items.findIndex(item => item === document.activeElement);
        if (event.key === "ArrowDown") {
            event.preventDefault();
            focusAction(currentIndex + 1);
        } else if (event.key === "ArrowUp") {
            event.preventDefault();
            focusAction(currentIndex <= 0 ? items.length - 1 : currentIndex - 1);
        } else if (event.key === "Home") {
            event.preventDefault();
            focusAction(0);
        } else if (event.key === "End") {
            event.preventDefault();
            focusAction(items.length - 1);
        } else if (event.key === "Escape") {
            event.preventDefault();
            setOpen(false);
            triggerRef.current?.focus();
        }
    };

    return (
        <div className={`notification-center${mobile ? " mobile" : ""}`} ref={rootRef}>
            <button
                ref={triggerRef}
                className={`topbar-btn ${unreadCount > 0 ? "notification-bell-pulse" : ""}`}
                onClick={() => setOpen(prev => !prev)}
                onKeyDown={(event) => {
                    if (event.key === "ArrowDown") {
                        event.preventDefault();
                        setOpen(true);
                    } else if (event.key === "Escape") {
                        setOpen(false);
                    }
                }}
                title={permission === "default" ? "Enable notifications" : "Notifications"}
                aria-label="Notifications"
                aria-haspopup="menu"
                aria-expanded={open}
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
                <div className={`notification-panel${mobile ? " mobile" : ""}`} role="menu" aria-label="Notifications menu" onKeyDown={handlePanelKeyDown}>
                    <div className="notification-panel-head">
                        <div>
                            <div className="notification-title">Notifications</div>
                            <div className="notification-subtitle">
                                {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
                            </div>
                        </div>
                        <div className="notification-actions">
                            {permission !== "granted" && (
                                <button className="btn btn-secondary btn-sm" onClick={requestPermission} ref={node => { actionRefs.current[0] = node; }}>
                                    Enable Push
                                </button>
                            )}
                            <button className="btn btn-ghost btn-sm" onClick={clearAll} disabled={notifications.length === 0} ref={node => { actionRefs.current[permission !== "granted" ? 1 : 0] = node; }}>
                                Clear all
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
                                        role="menuitem"
                                        ref={node => { actionRefs.current[(permission !== "granted" ? 2 : 1) + notifications.findIndex(notification => notification.id === item.id)] = node; }}
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
