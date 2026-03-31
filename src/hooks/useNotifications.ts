import { useEffect, useMemo, useState } from "react";
import {
    collection,
    limit,
    onSnapshot,
    orderBy,
    query,
    where,
    Timestamp,
    type Unsubscribe,
} from "firebase/firestore";
import { db } from "../firebase";
import type { UserProfile } from "../contexts/AuthContext";

export type NotificationKind =
    | "message"
    | "booking"
    | "wallet"
    | "ticket"
    | "broadcast"
    | "admin_action";

export interface AppNotification {
    id: string;
    kind: NotificationKind;
    title: string;
    body: string;
    createdAt: number;
    actionUrl: string;
    priority: "normal" | "high" | "urgent";
}

const READ_LIMIT = 500;

const readKey = (uid: string) => `pn_notification_reads_${uid}`;

const toMillis = (value: unknown): number => {
    if (value instanceof Timestamp) return value.toMillis();
    if (
        value &&
        typeof value === "object" &&
        "toDate" in value &&
        typeof (value as { toDate?: () => Date }).toDate === "function"
    ) {
        return (value as { toDate: () => Date }).toDate().getTime();
    }
    return Date.now();
};

const asString = (value: unknown, fallback = ""): string =>
    typeof value === "string" ? value : fallback;

const relevantAnnouncement = (data: Record<string, unknown>, profile: UserProfile | null) => {
    const target = asString(data.target, "All Users");
    if (target === "All Users") return true;
    if (target === "Admins Only") return profile?.role === "admin";
    if (target === "Service Professionals") return !!profile?.isServiceProvider;
    if (target === "Society-Specific") {
        const targetSociety = asString(data.targetSociety);
        if (!targetSociety) return false;
        return profile?.society === targetSociety || profile?.locality === targetSociety;
    }
    return true;
};

const bookingAlertFromStatus = (
    status: string,
    asRole: "client" | "pro"
): { title: string; priority: "normal" | "high" | "urgent" } | null => {
    if (asRole === "client") {
        if (status === "pending") return { title: "Booking request submitted", priority: "normal" };
        if (status === "confirmed") return { title: "Booking confirmed", priority: "high" };
        if (status === "cancelled") return { title: "Booking cancelled", priority: "high" };
        if (status === "completed") return { title: "Service marked complete", priority: "normal" };
        if (status === "reviewed") return { title: "Review submitted", priority: "normal" };
        return null;
    }

    if (status === "pending") return { title: "New booking request", priority: "urgent" };
    if (status === "confirmed") return { title: "Booking confirmed", priority: "normal" };
    if (status === "cancelled") return { title: "Booking cancelled", priority: "high" };
    if (status === "completed") return { title: "Booking completed", priority: "normal" };
    if (status === "reviewed") return { title: "Client submitted review", priority: "normal" };
    return null;
};

export function useNotifications(uid: string | undefined, userProfile: UserProfile | null) {
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [loading, setLoading] = useState(true);
    const [readIds, setReadIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (!uid) {
            setReadIds(new Set());
            return;
        }

        try {
            const raw = localStorage.getItem(readKey(uid));
            if (!raw) {
                setReadIds(new Set());
                return;
            }
            const parsed = JSON.parse(raw) as string[];
            setReadIds(new Set(Array.isArray(parsed) ? parsed.slice(0, READ_LIMIT) : []));
        } catch {
            setReadIds(new Set());
        }
    }, [uid]);

    const persistReadIds = (next: Set<string>) => {
        if (!uid) return;
        const limited = [...next].slice(-READ_LIMIT);
        localStorage.setItem(readKey(uid), JSON.stringify(limited));
    };

    const markRead = (id: string) => {
        setReadIds(prev => {
            const next = new Set(prev);
            next.add(id);
            persistReadIds(next);
            return next;
        });
    };

    const markAllRead = () => {
        setReadIds(prev => {
            const next = new Set(prev);
            for (const item of notifications) next.add(item.id);
            persistReadIds(next);
            return next;
        });
    };

    useEffect(() => {
        if (!uid) {
            setNotifications([]);
            setLoading(false);
            return;
        }

        let active = true;
        const buckets: Record<string, AppNotification[]> = {};
        const unsubs: Unsubscribe[] = [];

        const emit = () => {
            if (!active) return;
            const merged = Object.values(buckets).flat();
            const sorted = merged.sort((a, b) => b.createdAt - a.createdAt).slice(0, 50);
            setNotifications(sorted);
            setLoading(false);
        };

        const setBucket = (key: string, items: AppNotification[]) => {
            buckets[key] = items;
            emit();
        };

        const safeSubscribe = (key: string, subscribe: () => Unsubscribe) => {
            try {
                const unsub = subscribe();
                unsubs.push(unsub);
            } catch (err) {
                console.warn(`Notification subscription failed [${key}]`, err);
                setBucket(key, []);
            }
        };

        safeSubscribe("messages", () =>
            onSnapshot(
                query(
                    collection(db, "messages"),
                    where("participants", "array-contains", uid),
                    orderBy("lastMessageAt", "desc"),
                    limit(20)
                ),
                snap => {
                    const list: AppNotification[] = snap.docs.flatMap(docSnap => {
                        const data = docSnap.data() as Record<string, unknown>;
                        const lastMessage = asString(data.lastMessage);
                        const lastMessageAt = data.lastMessageAt;
                        const lastSenderId = asString(data.lastSenderId);
                        const lastReadAt = (data.lastReadAt as Record<string, unknown> | undefined)?.[uid];

                        if (!lastMessage || !lastMessageAt || !lastSenderId || lastSenderId === uid) return [];
                        const unread = !lastReadAt || toMillis(lastMessageAt) > toMillis(lastReadAt);
                        if (!unread) return [];

                        const createdAt = toMillis(lastMessageAt);
                        return [{
                            id: `msg-${docSnap.id}-${createdAt}`,
                            kind: "message",
                            title: "New message",
                            body: lastMessage,
                            createdAt,
                            actionUrl: `/messages?conv=${docSnap.id}`,
                            priority: "high",
                        }];
                    });

                    setBucket("messages", list);
                },
                () => setBucket("messages", [])
            )
        );

        const watchBookings = (asRole: "client" | "pro", field: "clientId" | "proId") => {
            safeSubscribe(`bookings-${asRole}`, () =>
                onSnapshot(
                    query(
                        collection(db, "bookings"),
                        where(field, "==", uid),
                        orderBy("createdAt", "desc"),
                        limit(20)
                    ),
                    snap => {
                        const list: AppNotification[] = snap.docs.flatMap(docSnap => {
                            const data = docSnap.data() as Record<string, unknown>;
                            const status = asString(data.status);
                            const alert = bookingAlertFromStatus(status, asRole);
                            if (!alert) return [];

                            const serviceName = asString(data.serviceName, asString(data.serviceCategory, "Booking"));
                            const counterpart = asRole === "client"
                                ? asString(data.proName, "Professional")
                                : asString(data.clientName, "Client");
                            const createdAt = toMillis(data.updatedAt ?? data.createdAt);

                            return [{
                                id: `booking-${asRole}-${docSnap.id}-${status}-${createdAt}`,
                                kind: "booking",
                                title: alert.title,
                                body: `${serviceName} · ${counterpart}`,
                                createdAt,
                                actionUrl: `/bookings/${docSnap.id}`,
                                priority: alert.priority,
                            }];
                        });
                        setBucket(`bookings-${asRole}`, list);
                    },
                    () => setBucket(`bookings-${asRole}`, [])
                )
            );
        };

        watchBookings("client", "clientId");
        watchBookings("pro", "proId");

        safeSubscribe("wallet-purchases", () =>
            onSnapshot(query(collection(db, "coinPurchases"), where("uid", "==", uid), limit(15)), snap => {
                const list: AppNotification[] = snap.docs.flatMap(docSnap => {
                    const data = docSnap.data() as Record<string, unknown>;
                    const status = asString(data.status);
                    if (status !== "completed" && status !== "failed") return [];

                    const coinsGranted = typeof data.coinsGranted === "number" ? data.coinsGranted : 0;
                    const packLabel = asString(data.packLabel, "Coins");
                    const createdAt = toMillis(data.completedAt ?? data.createdAt);

                    return [{
                        id: `purchase-${docSnap.id}-${status}-${createdAt}`,
                        kind: "wallet",
                        title: status === "completed" ? "Wallet top-up successful" : "Wallet top-up failed",
                        body: status === "completed"
                            ? `${packLabel} pack credited · +${coinsGranted} NC`
                            : `${packLabel} pack payment failed`,
                        createdAt,
                        actionUrl: "/wallet",
                        priority: status === "failed" ? "high" : "normal",
                    }];
                });
                setBucket("wallet-purchases", list);
            }, () => setBucket("wallet-purchases", []))
        );

        safeSubscribe("wallet-payouts", () =>
            onSnapshot(query(collection(db, "coinPayouts"), where("uid", "==", uid), limit(15)), snap => {
                const list: AppNotification[] = snap.docs.flatMap(docSnap => {
                    const data = docSnap.data() as Record<string, unknown>;
                    const status = asString(data.status);
                    if (!["pending", "processed", "failed"].includes(status)) return [];

                    const amountRs = typeof data.amountRs === "number" ? data.amountRs : 0;
                    const createdAt = toMillis(data.processedAt ?? data.createdAt);
                    const title = status === "pending"
                        ? "Payout request submitted"
                        : status === "processed"
                            ? "Payout processed"
                            : "Payout request failed";

                    return [{
                        id: `payout-${docSnap.id}-${status}-${createdAt}`,
                        kind: "wallet",
                        title,
                        body: `Amount ₹${amountRs.toLocaleString("en-IN")}`,
                        createdAt,
                        actionUrl: "/wallet",
                        priority: status === "failed" ? "high" : "normal",
                    }];
                });
                setBucket("wallet-payouts", list);
            }, () => setBucket("wallet-payouts", []))
        );

        safeSubscribe("wallet-ledger", () =>
            onSnapshot(
                query(collection(db, "coinLedger", uid, "entries"), orderBy("createdAt", "desc"), limit(15)),
                snap => {
                    const list: AppNotification[] = snap.docs.flatMap(docSnap => {
                        const data = docSnap.data() as Record<string, unknown>;
                        const type = asString(data.type);
                        if (!["booking_refund", "admin_credit", "admin_debit", "topup", "payout"].includes(type)) {
                            return [];
                        }

                        const amount = typeof data.amount === "number" ? data.amount : 0;
                        const description = asString(data.description, "Wallet activity");
                        const createdAt = toMillis(data.createdAt);

                        return [{
                            id: `ledger-${docSnap.id}`,
                            kind: "wallet",
                            title: type === "booking_refund"
                                ? "Booking refund credited"
                                : type === "admin_credit"
                                    ? "Wallet credited by admin"
                                    : type === "admin_debit"
                                        ? "Wallet debited by admin"
                                        : type === "payout"
                                            ? "Payout debit recorded"
                                            : "Wallet top-up credited",
                            body: `${description} · ${amount > 0 ? "+" : ""}${amount} NC`,
                            createdAt,
                            actionUrl: "/wallet",
                            priority: type === "admin_debit" ? "high" : "normal",
                        }];
                    });
                    setBucket("wallet-ledger", list);
                },
                () => setBucket("wallet-ledger", [])
            )
        );

        safeSubscribe("tickets", () =>
            onSnapshot(
                query(collection(db, "tickets"), where("uid", "==", uid), orderBy("createdAt", "desc"), limit(15)),
                snap => {
                    const list: AppNotification[] = snap.docs.flatMap(docSnap => {
                        const data = docSnap.data() as Record<string, unknown>;
                        const status = asString(data.status);
                        if (!["in_progress", "resolved", "closed"].includes(status)) return [];

                        const subject = asString(data.subject, "Support ticket");
                        const createdAt = toMillis(data.updatedAt ?? data.createdAt);

                        return [{
                            id: `ticket-${docSnap.id}-${status}-${createdAt}`,
                            kind: "ticket",
                            title: `Ticket ${status.replace("_", " ")}`,
                            body: subject,
                            createdAt,
                            actionUrl: "/support",
                            priority: status === "resolved" ? "normal" : "high",
                        }];
                    });
                    setBucket("tickets", list);
                },
                () => setBucket("tickets", [])
            )
        );

        safeSubscribe("announcements", () =>
            onSnapshot(
                query(collection(db, "announcements"), where("status", "==", "active"), orderBy("createdAt", "desc"), limit(10)),
                snap => {
                    const list: AppNotification[] = snap.docs
                        .filter(d => relevantAnnouncement(d.data() as Record<string, unknown>, userProfile))
                        .map(d => {
                            const data = d.data() as Record<string, unknown>;
                            const createdAt = toMillis(data.createdAt);
                            const priorityRaw = asString(data.priority, "normal");
                            const priority: "normal" | "high" | "urgent" =
                                priorityRaw === "high" || priorityRaw === "urgent" ? priorityRaw : "normal";

                            return {
                                id: `broadcast-${d.id}-${createdAt}`,
                                kind: "broadcast" as const,
                                title: asString(data.title, "Announcement"),
                                body: asString(data.body),
                                createdAt,
                                actionUrl: userProfile?.role === "admin" ? "/admin/broadcast" : "/dashboard",
                                priority,
                            };
                        });
                    setBucket("announcements", list);
                },
                () => setBucket("announcements", [])
            )
        );

        if (userProfile?.role === "admin") {
            safeSubscribe("admin-verifications", () =>
                onSnapshot(query(collection(db, "users"), where("residentVerificationStatus", "==", "pending"), limit(10)), snap => {
                    const list: AppNotification[] = snap.docs.map(d => {
                        const data = d.data() as Record<string, unknown>;
                        const updatedAt = toMillis(data.updatedAt);
                        const name = asString(data.displayName || data.email, "New User");
                        return {
                            id: `admin-verify-${d.id}-${updatedAt}`,
                            kind: "admin_action",
                            title: "Verification Pending",
                            body: `${name} uploaded residency proof`,
                            createdAt: updatedAt,
                            actionUrl: "/admin/verifications",
                            priority: "high",
                        };
                    });
                    setBucket("admin-verifications", list);
                }, () => setBucket("admin-verifications", []))
            );

            safeSubscribe("admin-payouts", () =>
                onSnapshot(
                    query(collection(db, "coinPayouts"), where("status", "==", "pending"), orderBy("createdAt", "desc"), limit(10)),
                    snap => {
                        const list: AppNotification[] = snap.docs.map(d => {
                            const data = d.data() as Record<string, unknown>;
                            const createdAt = toMillis(data.createdAt);
                            const amount = typeof data.amountRs === "number" ? data.amountRs : 0;
                            return {
                                id: `admin-payout-${d.id}-${createdAt}`,
                                kind: "admin_action",
                                title: "Pending Payout",
                                body: `Cash out request: ₹${amount.toLocaleString("en-IN")}`,
                                createdAt,
                                actionUrl: "/admin/wallet",
                                priority: "urgent",
                            };
                        });
                        setBucket("admin-payouts", list);
                    },
                    () => setBucket("admin-payouts", [])
                )
            );

            safeSubscribe("admin-tickets", () =>
                onSnapshot(
                    query(collection(db, "tickets"), where("status", "==", "open"), orderBy("createdAt", "desc"), limit(10)),
                    snap => {
                        const list: AppNotification[] = snap.docs.map(d => {
                            const data = d.data() as Record<string, unknown>;
                            const createdAt = toMillis(data.createdAt);
                            const subject = asString(data.subject, "Support query");
                            return {
                                id: `admin-ticket-${d.id}-${createdAt}`,
                                kind: "admin_action",
                                title: "New Support Ticket",
                                body: subject,
                                createdAt,
                                actionUrl: "/admin/tickets",
                                priority: "high",
                            };
                        });
                        setBucket("admin-tickets", list);
                    },
                    () => setBucket("admin-tickets", [])
                )
            );

            safeSubscribe("admin-disputes", () =>
                onSnapshot(
                    query(collection(db, "disputes"), where("status", "==", "raised"), orderBy("createdAt", "desc"), limit(10)),
                    snap => {
                        const list: AppNotification[] = snap.docs.map(d => {
                            const data = d.data() as Record<string, unknown>;
                            const createdAt = toMillis(data.createdAt);
                            const reason = asString(data.reason, "Payment dispute");
                            return {
                                id: `admin-dispute-${d.id}-${createdAt}`,
                                kind: "admin_action",
                                title: "Dispute Raised",
                                body: reason,
                                createdAt,
                                actionUrl: "/admin/tickets",
                                priority: "urgent",
                            };
                        });
                        setBucket("admin-disputes", list);
                    },
                    () => setBucket("admin-disputes", [])
                )
            );
        }

        return () => {
            active = false;
            unsubs.forEach(unsub => unsub());
        };
    }, [uid, userProfile]);

    const unreadCount = useMemo(
        () => notifications.filter(item => !readIds.has(item.id)).length,
        [notifications, readIds]
    );

    return {
        notifications,
        loading,
        unreadCount,
        isRead: (id: string) => readIds.has(id),
        markRead,
        markAllRead,
    };
}
