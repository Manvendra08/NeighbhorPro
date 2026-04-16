import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  getAllUserRows, 
  getPendingVerifications,
  updateUserProfile, 
  updateResidentVerification,
  getOrCreateConversation,
  mirrorPublicProfile
} from "../../services/firestoreService";
import { deleteDoc, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, updateProfile, signOut } from "firebase/auth";
import { db, app } from "../../firebase";
import { useAuth } from "../../contexts/AuthContext";
import { logAudit } from "./AdminAuditLog";
import { getUserActivityLogs } from "../../services/activityService";
import type { ActivityLog } from "../../services/activityService";

type UserRow = Record<string, unknown>;
type FilterTab = "all" | "active" | "disabled" | "admins" | "pros" | "verification";

export default function AdminUsers() {
  const { userProfile, user } = useAuth();
  const navigate = useNavigate();
  const adminId = userProfile?.uid || user?.uid || "unknown";
  const adminName = userProfile?.displayName || "Admin";

  const [users, setUsers] = useState<UserRow[]>([]);
  const [verificationQueue, setVerificationQueue] = useState<UserRow[]>([]);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<FilterTab>("all");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [showActivity, setShowActivity] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<UserRow | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [roleModalUser, setRoleModalUser] = useState<UserRow | null>(null);

  const [roleUnderstandsWarning, setRoleUnderstandsWarning] = useState(false);
  const [roleNameConfirmation, setRoleNameConfirmation] = useState("");

  const [queueRefreshTime, setQueueRefreshTime] = useState<Date | null>(null);
  const [queueLoading, setQueueLoading] = useState(false);
  const [openMenuUid, setOpenMenuUid] = useState<string | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const load = async () => {
    setLoading(true);
    try {
      const [rows, pendingRows] = await Promise.all([
        getAllUserRows(300),
        getPendingVerifications(),
      ]);
      setUsers(rows);
      setVerificationQueue(pendingRows as UserRow[]);
    } catch { /* ignore */ }
    setLoading(false);
  };


  // Refresh verification queue when tab changes to verification
  useEffect(() => {
    if (tab === "verification") {
      refreshQueue();
    }
  }, [tab]);

  const refreshQueue = async () => {
    setQueueLoading(true);
    try {
      const pendingRows = await getPendingVerifications();
      setVerificationQueue(pendingRows as UserRow[]);
      setQueueRefreshTime(new Date());
    } catch (error) {
      showToast("Failed to refresh verification queue", "error");
    } finally {
      setQueueLoading(false);
    }
  };

  useEffect(() => {
    void load();
    if (tab === "verification") {
      void refreshQueue();
    }
  }, []);

  useEffect(() => {
    if (!openMenuUid) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (!(event.target instanceof HTMLElement)) return;
      if (event.target.closest(`[data-au-menu="${openMenuUid}"]`)) return;
      setOpenMenuUid(null);
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openMenuUid]);

  const counts = {
    all: users.length,
    active: users.filter((u: UserRow) => !u.disabled).length,
    disabled: users.filter((u: UserRow) => !!u.disabled).length,
    admins: users.filter((u: UserRow) => u.role === "admin").length,
    pros: users.filter((u: UserRow) => !!u.isServiceProvider).length,
    verification: verificationQueue.length,
  };

  const sourceRows = tab === "verification" ? verificationQueue : users;

  const filtered = sourceRows.filter((u: UserRow) => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      ((u.displayName as string) || "").toLowerCase().includes(q) ||
      ((u.email as string) || "").toLowerCase().includes(q) ||
      ((u.society as string) || "").toLowerCase().includes(q) ||
      ((u.locality as string) || "").toLowerCase().includes(q);
    const matchTab =
      tab === "all" ? true : tab === "active" ? !u.disabled :
      tab === "disabled" ? !!u.disabled : tab === "admins" ? u.role === "admin" :
      tab === "pros" ? !!u.isServiceProvider :
      tab === "verification" ? (u.residentVerificationStatus as string) === "pending" : true;
    return matchSearch && matchTab;
  });

  const doAction = async (
    uid: string, patch: Record<string, unknown>, successMsg: string,
    auditAction: string, auditDetails: string
  ) => {
    setActionLoading(uid);
    try {
      await updateUserProfile(uid, patch);
      await logAudit(auditAction, adminId, adminName, auditDetails, uid);
      showToast(successMsg);
      await load();
    } catch { showToast("Action failed", "error"); }
    setActionLoading(null);
  };

  const getActiveAdminCount = () =>
    users.filter((u: UserRow) => u.role === "admin" && !u.disabled).length;

  const isSelfUser = (u: UserRow) => (u.uid as string) === adminId;

  const handleToggleDisable = (u: UserRow) => {
    if (isSelfUser(u)) {
      showToast("You cannot disable your own admin account", "error");
      return;
    }
    const disabled = !u.disabled;
    const name = (u.displayName as string) || (u.email as string) || u.uid as string;
    const ok = window.confirm(
      `${disabled ? "Disable" : "Enable"} ${name}? ${disabled ? "They will lose access immediately." : "They can log in again immediately."}`
    );
    if (!ok) return;

    doAction(
      u.uid as string, { disabled },
      disabled ? "User disabled" : "User enabled",
      disabled ? "user.disable" : "user.enable",
      `${disabled ? "Disabled" : "Enabled"} user: ${name}`
    );
  };

  const handleToggleRole = (u: UserRow) => {
    const newRole = u.role === "admin" ? "user" : "admin";
    const name = (u.displayName as string) || (u.email as string) || u.uid as string;

    if (u.role === "admin" && getActiveAdminCount() <= 1) {
      showToast("At least one active admin must remain", "error");
      return;
    }

    if (isSelfUser(u) && u.role === "admin") {
      showToast("You cannot demote your own admin account", "error");
      return;
    }

    // For escalation to admin, show modal; for demotion, use simple confirm
    if (newRole === "admin") {
      // Show modal for escalation
      setRoleModalUser(u);
      setShowRoleModal(true);
      setRoleUnderstandsWarning(false);
      setRoleNameConfirmation("");
    } else {
      // Simple confirm for demotion
      const ok = window.confirm(`Demote ${name} to regular user?`);
      if (!ok) return;

      doAction(
        u.uid as string, { role: newRole },
        "Role reverted to User",
        "user.role_change",
        `Changed role of ${name} to "user"`
      );
    }
  };

  const handleTogglePro = (u: UserRow) => {
    const isServiceProvider = !u.isServiceProvider;
    const name = (u.displayName as string) || (u.email as string) || u.uid as string;

    if (isServiceProvider && u.residentVerificationStatus !== "verified") {
      showToast("User must be residency verified before Pro status can be granted", "error");
      return;
    }

    const ok = window.confirm(
      `${isServiceProvider ? "Set" : "Remove"} Pro status for ${name}?`
    );
    if (!ok) return;

    doAction(
      u.uid as string, { isServiceProvider },
      isServiceProvider ? "Marked as Service Pro" : "Pro status removed",
      "user.pro_change",
      `${isServiceProvider ? "Set" : "Removed"} Pro status for: ${name}`
    );
  };

  const handleVerifyResident = (u: UserRow, action: "verified" | "none") => {
    const name = (u.displayName as string) || (u.email as string) || u.uid as string;
    if (action === "verified") {
      const ok = window.confirm(`Approve residency verification for ${name}?`);
      if (!ok) return;
    }

    let reviewNote = "";
    if (action === "none") {
      const noteInput = window.prompt("Add rejection note (required):", "Proof is unclear or invalid");
      if (noteInput === null) return;
      reviewNote = noteInput.trim();
      if (!reviewNote) {
        showToast("Rejection note is required", "error");
        return;
      }
      const ok = window.confirm(`Reject residency verification for ${name}?`);
      if (!ok) return;
    }

    const doVerify = async () => {
      setActionLoading(u.uid as string);
      try {
        await updateResidentVerification(
          u.uid as string,
          action,
          action === "verified" ? "manual" : null,
          adminId,
          reviewNote || undefined
        );
        await logAudit(
          action === "verified" ? "user.verify_resident" : "user.reject_resident",
          adminId, adminName,
          `${action === "verified" ? "Verified" : "Rejected"} resident verification for: ${name}${reviewNote ? ` | Note: ${reviewNote}` : ""}`,
          u.uid as string
        );
        showToast(action === "verified" ? "Resident verified" : "Verification rejected");
        // Refresh verification queue after action if on verification tab
        if (tab === "verification") {
          await refreshQueue();
        } else {
          await load();
        }
      } catch { showToast("Action failed", "error"); }
      setActionLoading(null);
    };
    doVerify();
  };

  const handleApproveEmailByMobile = (u: UserRow) => {
    const name = (u.displayName as string) || (u.email as string) || (u.uid as string);
    const phone = ((u.phoneNumber as string) || "").trim();
    if (!phone) {
      showToast("User must have a mobile number to use admin approval", "error");
      return;
    }
    if ((u.emailVerified as boolean) === true) {
      showToast("Email is already marked as verified");
      return;
    }

    const ok = window.confirm(`Approve ${name} for app access without email validation based on mobile number ${phone}?`);
    if (!ok) return;

    doAction(
      u.uid as string,
      {
        emailVerified: true,
        emailVerificationMethod: "admin_mobile_override",
        emailVerificationOverrideBy: adminId,
        emailVerificationOverrideAt: serverTimestamp(),
      },
      "User approved via mobile verification",
      "user.email_mobile_approve",
      `Approved email verification bypass by mobile for: ${name} (${phone})`
    );
  };

  const handleDelete = async (u: UserRow) => {
    if (isSelfUser(u)) {
      showToast("You cannot delete your own admin account", "error");
      return;
    }
    if (u.role === "admin" && getActiveAdminCount() <= 1) {
      showToast("Cannot delete the last active admin", "error");
      return;
    }

    setActionLoading(u.uid as string);
    try {
      await deleteDoc(doc(db, "users", u.uid as string));
      await deleteDoc(doc(db, "publicProfiles", u.uid as string));
      await logAudit(
        "user.delete", adminId, adminName,
        `Deleted profile of: ${(u.displayName as string) || u.email as string}`,
        u.uid as string
      );
      showToast("User profile removed");
      setDeleteConfirm(null);
      await load();
    } catch { showToast("Delete failed", "error"); }
    setActionLoading(null);
  };

  const handleLoginAs = (u: UserRow) => {
    navigate("/account?viewAsUid=" + u.uid);
  };

  const tabs = [
    { key: "all" as const, label: "All Users", shortLabel: "All", icon: "👥", accent: "var(--accent)", description: "Platform base" },
    { key: "active" as const, label: "Active Users", shortLabel: "Active", icon: "✅", accent: "var(--success)", description: "Can sign in now" },
    { key: "disabled" as const, label: "Disabled", shortLabel: "Disabled", icon: "⛔", accent: "var(--error)", description: "Blocked accounts" },
    { key: "admins" as const, label: "Admins", shortLabel: "Admins", icon: "🛡", accent: "var(--warning)", description: "Full control access" },
    { key: "pros" as const, label: "Service Pros", shortLabel: "Pros", icon: "⭐", accent: "var(--accent2)", description: "Marketplace professionals" },
    { key: "verification" as const, label: "Verification Queue", shortLabel: "Verification", icon: "📋", accent: "#1d7499", description: "Pending residency proof" },
  ];

  const openUserModal = (u: UserRow) => {
    setSelectedUser(u);
    setShowActivity(false);
    setActivityLogs([]);
  };

  const loadActivityLogs = async (uid: string) => {
    setActivityLoading(true);
    try {
      const logs = await getUserActivityLogs(uid, 30);
      setActivityLogs(logs);
    } catch { /* ignore */ }
    setActivityLoading(false);
  };

  const initials = (u: UserRow) => ((u.displayName as string) || (u.email as string) || "?").slice(0, 2).toUpperCase();

  const eventIcon: Record<string, string> = {
    "user.login": "🔑", "user.logout": "🚪", "user.signup": "🎉", "user.profile_update": "✏️",
    "booking.created": "📅", "booking.cancelled": "❌", "booking.completed": "✅",
    "payment.initiated": "💳", "payment.success": "💰", "message.sent": "💬",
    "review.submitted": "⭐", "wallet.topup": "⬆️", "wallet.withdrawal": "⬇️",
    "support.ticket_created": "🎫", "verification.submitted": "📋", "verification.approved": "✔️",
    "admin.action": "🛡",
  };

  const formatTs = (ts: unknown): string => {
    if (!ts) return "—";
    const d = (ts as { toDate?: () => Date }).toDate?.();
    if (!d) return "—";
    return d.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const exportUsers = () => {
    const csv = ["Name,Email,Society,Role,Pro,Status"]
      .concat(users.map((u: UserRow) => `"${u.displayName}","${u.email}","${u.society || ""}","${u.role}","${u.isServiceProvider ? "Yes" : "No"}","${u.disabled ? "Disabled" : "Active"}"`))
      .join("\n");
    const a = document.createElement("a");
    a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
    a.download = "users.csv";
    a.click();
  };

  const getProofUrl = (u: UserRow) => (u.residencyProofUrl as string) || "";
  const isPdfUrl = (url: string) => /\.pdf($|[?#])/i.test(url) || url.toLowerCase().includes("application/pdf");

  const closeRoleModal = () => {
    setShowRoleModal(false);
    setRoleModalUser(null);
    setRoleUnderstandsWarning(false);
    setRoleNameConfirmation("");
  };

  const handleConfirmRoleEscalation = async () => {
    if (!roleModalUser) return;
    
    const targetName = (roleModalUser.displayName as string) || (roleModalUser.email as string) || roleModalUser.uid as string;
    const expectedConfirmation = targetName;
    
    if (!roleUnderstandsWarning) {
      showToast("You must acknowledge the warning to proceed", "error");
      return;
    }
    
    if (roleNameConfirmation.trim() !== expectedConfirmation) {
      showToast(`Name does not match. Please type: "${expectedConfirmation}"`, "error");
      return;
    }
    
    // Close modal first
    closeRoleModal();
    
    // Now perform the escalation
    await doAction(
      roleModalUser.uid as string, { role: "admin" },
      "Elevated to Admin",
      "user.role_change",
      `Changed role of ${targetName} to "admin"`
    );
  };

  const totalUsers = users.length || 1;

  return (
    <div className="au-page">
      {toast && (
        <div className={`au-toast au-toast--${toast.type}`} role="status" aria-live="polite" aria-atomic="true">
          {toast.msg}
        </div>
      )}

      {showRoleModal && roleModalUser && (
        <div className="au-role-modal-overlay" onClick={closeRoleModal}>
          <div className="card au-role-modal" onClick={e => e.stopPropagation()}>
            <h2>Grant Admin Access</h2>
            <div className="au-role-modal__warning">
              <div className="au-role-modal__warning-title">Warning: Full Platform Access</div>
              <div>Admins can modify any user account, disable access, approve financial transactions, and access sensitive data. Grant carefully.</div>
            </div>
            <div className="form-group">
              <label className="au-role-modal__checkbox">
                <input type="checkbox" checked={roleUnderstandsWarning} onChange={e => setRoleUnderstandsWarning(e.target.checked)} />
                <span>I understand risks and want to proceed</span>
              </label>
            </div>
            <div className="form-group">
              <label className="form-label">
                Type user name to confirm:
                {" "}
                <strong>{((roleModalUser.displayName as string) || (roleModalUser.email as string) || roleModalUser.uid as string)}</strong>
              </label>
              <input
                type="text"
                className="form-input"
                placeholder={((roleModalUser.displayName as string) || (roleModalUser.email as string) || roleModalUser.uid as string)}
                value={roleNameConfirmation}
                onChange={e => setRoleNameConfirmation(e.target.value)}
              />
            </div>
            <div className="au-role-modal__actions">
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  closeRoleModal();
                }}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleConfirmRoleEscalation}
                disabled={!roleUnderstandsWarning || roleNameConfirmation.trim() === ""}
                style={{ opacity: (!roleUnderstandsWarning || roleNameConfirmation.trim() === "") ? 0.5 : 1 }}
              >
                Grant Admin Access
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="page-header au-page-header">
        <div>
          <h1 className="page-title">User Management</h1>
          <p className="page-subtitle">{users.length} registered users across admin, resident, pro, and verification flows</p>
        </div>
      </div>

      <div className="au-stat-grid">
        {tabs.map(card => {
          const value = counts[card.key];
          const pct = card.key === "all" ? 100 : Math.round((value / totalUsers) * 100);
          return (
            <button
              key={card.key}
              type="button"
              className={`au-stat-card au-stat-card--clickable${tab === card.key ? " au-stat-card--active" : ""}`}
              onClick={() => setTab(card.key)}
            >
              <div className="au-stat-card__top">
                <div className="au-stat-card__icon" style={{ color: card.accent }}>{card.icon}</div>
                <div className="au-stat-card__pct">{pct}%</div>
              </div>
              <div className="au-stat-card__value">{value}</div>
              <div className="au-stat-card__label">{card.label}</div>
              <div className="au-stat-card__meta">{card.description}</div>
              <div className="au-stat-card__progress" aria-hidden="true">
                <div className="au-stat-card__progress-bar" style={{ width: `${pct}%` }} />
              </div>
            </button>
          );
        })}
      </div>

      <div className="au-toolbar">
        <div className="au-toolbar__tabs" role="tablist" aria-label="User filters">
          {tabs.map(t => (
            <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={`tab${tab === t.key ? " active" : ""}`} onClick={() => setTab(t.key)}>
              {t.shortLabel}
              <span className="au-tab-count">{counts[t.key]}</span>
            </button>
          ))}
        </div>
        <div className="au-toolbar__actions">
          {tab === "verification" && (
            <button className="btn btn-ghost btn-sm" onClick={() => refreshQueue()} disabled={queueLoading} style={{ opacity: queueLoading ? 0.5 : 1 }}>
              {queueLoading ? "Refreshing..." : "Refresh Queue"}
            </button>
          )}
          <button className="btn btn-secondary btn-sm" onClick={exportUsers}>Export CSV</button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAddModal(true)}>Add User</button>
        </div>
        <div className="au-toolbar__search">
          <input className="form-input" placeholder="Search name, email, society, locality..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>
      <div className="au-toolbar__divider" />

      {tab === "verification" && (
        <div className="au-verify-info">
          <div>Pending queue includes users with submitted proof and status set to pending. Approve or reject each request with same audit handlers.</div>
          {queueRefreshTime && <div className="au-verify-time">Last refreshed: {queueRefreshTime.toLocaleTimeString("en-IN")}</div>}
        </div>
      )}

      {loading ? (
        <div className="au-loading"><div className="loader" /></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">👤</div>
          <div className="empty-state-title">{tab === "verification" ? "No pending verification requests" : "No users found"}</div>
        </div>
      ) : tab === "verification" ? (
        <div className="au-verify-grid">
          {filtered.map((u: UserRow) => {
            const uid = u.uid as string;
            const proofUrl = getProofUrl(u);
            const proofIsPdf = isPdfUrl(proofUrl);
            const busy = actionLoading === uid;
            return (
              <article key={uid} className="au-verify-card" style={{ opacity: busy ? 0.55 : 1 }}>
                <button type="button" className="au-verify-card__header" onClick={() => openUserModal(u)}>
                  <div className={`avatar avatar-lg${u.disabled ? " avatar--disabled" : ""}`}>
                    {(u.photoURL as string) ? <img src={u.photoURL as string} alt="" loading="lazy" /> : initials(u)}
                  </div>
                  <div className="au-user-cell__info">
                    <div className="au-user-cell__name">{(u.displayName as string) || "—"}</div>
                    <div className="au-user-cell__uid">uid: {uid.slice(0, 8)}...</div>
                  </div>
                </button>
                <div className="au-verify-card__location">{(u.society as string) || (u.locality as string) || "No locality provided"}</div>
                <div className="au-verify-card__location-sub">
                  {[u.tower ? `Tower ${u.tower}` : "", u.flatNumber ? `Flat ${u.flatNumber}` : ""].filter(Boolean).join(" • ") || "Address detail unavailable"}
                </div>
                <div className="au-verify-card__meta">
                  <span className="badge badge-muted">{((u.verificationMethod as string) || "manual").toUpperCase()}</span>
                  <span>{formatTs((u.verificationSubmittedAt as unknown) || (u.updatedAt as unknown) || (u.createdAt as unknown))}</span>
                </div>
                <div className="au-verify-card__proof">
                  {proofUrl ? (
                    <a href={proofUrl} target="_blank" rel="noopener noreferrer" className="au-verify-card__proof-thumb">
                      {proofIsPdf ? (
                        <div className="au-verify-card__proof-file">
                          <strong>PDF</strong>
                          <span>Open residency document</span>
                        </div>
                      ) : (
                        <>
                          <img
                            src={proofUrl}
                            alt={`Proof for ${(u.displayName as string) || "user"}`}
                            loading="lazy"
                            onError={event => {
                              event.currentTarget.style.display = "none";
                              const fallback = event.currentTarget.nextElementSibling as HTMLElement | null;
                              if (fallback) fallback.style.display = "flex";
                            }}
                          />
                          <div className="au-verify-card__proof-fallback">Preview unavailable</div>
                        </>
                      )}
                    </a>
                  ) : (
                    <div className="au-verify-card__proof-thumb">
                      <div className="au-verify-card__proof-file">
                        <strong>No File</strong>
                        <span>Document missing</span>
                      </div>
                    </div>
                  )}
                </div>
                <div className="au-verify-card__actions">
                  <button className="btn btn-success btn-sm" onClick={() => handleVerifyResident(u, "verified")} disabled={busy}>Approve</button>
                  <button className="btn btn-danger btn-sm" onClick={() => handleVerifyResident(u, "none")} disabled={busy}>Reject</button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="au-table-container">
          <table className="au-table au-table--striped">
            <thead>
              <tr>
                <th className="au-col-user">User</th>
                <th className="au-col-email">Email</th>
                <th className="au-col-locality">Locality</th>
                <th className="au-col-role">Role</th>
                <th className="au-col-pro">Pro</th>
                <th className="au-col-resident">Resident</th>
                <th className="au-col-status">Status</th>
                <th className="au-col-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u: UserRow) => {
                const uid = u.uid as string;
                const busy = actionLoading === uid;
                const menuIsOpen = openMenuUid === uid;
                return (
                  <tr key={uid} style={{ opacity: busy ? 0.5 : 1 }}>
                    <td>
                      <button type="button" className="au-user-cell" onClick={() => openUserModal(u)}>
                        <div className={`avatar avatar-sm${u.disabled ? " avatar--disabled" : ""}`}>
                          {(u.photoURL as string) ? <img src={u.photoURL as string} alt="" loading="lazy" /> : initials(u)}
                        </div>
                        <div className="au-user-cell__info">
                          <div className="au-user-cell__name">{(u.displayName as string) || "—"}</div>
                          <div className="au-user-cell__uid">uid: {uid.slice(0, 8)}...</div>
                        </div>
                      </button>
                    </td>
                    <td className="text-muted">{(u.email as string) || "—"}</td>
                    <td>
                      <div className="au-locality-main">
                        {(u.society as string) || (u.locality as string) || "—"}
                        {(u.tower as string) ? `, ${u.tower}` : ""}
                      </div>
                      <div className="au-locality-sub">{(u.flatNumber as string) ? `Flat ${u.flatNumber}` : "—"}</div>
                    </td>
                    <td><span className={`badge ${u.role === "admin" ? "badge-warning" : "badge-muted"}`}>{u.role === "admin" ? "Admin" : "User"}</span></td>
                    <td>{u.isServiceProvider ? <span className="badge badge-accent">Pro</span> : <span className="text-muted">—</span>}</td>
                    <td>
                      {u.residentVerificationStatus === "verified" ? (
                        <div className="au-status-pill">
                          <span className="au-status-dot au-status-dot--active" />
                          <span className="badge badge-success">Verified</span>
                        </div>
                      ) : u.residentVerificationStatus === "pending" ? (
                        <button className="btn btn-warning btn-sm" onClick={() => setTab("verification")}>Pending</button>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td>
                      <div className="au-status-pill">
                        <span className={`au-status-dot ${u.disabled ? "au-status-dot--disabled" : "au-status-dot--active"}`} />
                        <span className={`badge ${u.disabled ? "badge-error" : "badge-success"}`}>{u.disabled ? "Disabled" : "Active"}</span>
                      </div>
                    </td>
                    <td>
                      <div className="au-actions" data-au-menu={uid}>
                        <button className="btn btn-secondary btn-sm" onClick={() => handleLoginAs(u)} disabled={busy}>Login As</button>
                        <div className={`au-actions__menu${menuIsOpen ? " au-actions__menu--open" : ""}`} data-au-menu={uid}>
                          <button
                            type="button"
                            className="au-actions__trigger"
                            aria-label={`Open actions for ${(u.displayName as string) || (u.email as string) || "user"}`}
                            aria-haspopup="menu"
                            aria-expanded={menuIsOpen}
                            onClick={event => {
                              event.stopPropagation();
                              setOpenMenuUid(menuIsOpen ? null : uid);
                            }}
                          >
                            ⋯
                          </button>
                          <div className="au-actions__dropdown" role="menu">
                            <button type="button" className="au-actions__dropdown-item" role="menuitem" onClick={() => { setOpenMenuUid(null); handleToggleRole(u); }} disabled={busy}>
                              {u.role === "admin" ? "Demote to User" : "Make Admin"}
                            </button>
                            <button type="button" className="au-actions__dropdown-item" role="menuitem" onClick={() => { setOpenMenuUid(null); handleTogglePro(u); }} disabled={busy}>
                              {u.isServiceProvider ? "Remove Pro" : "Set Pro"}
                            </button>
                            {!u.emailVerified && !!u.phoneNumber && (
                              <button type="button" className="au-actions__dropdown-item" role="menuitem" onClick={() => { setOpenMenuUid(null); handleApproveEmailByMobile(u); }} disabled={busy}>
                                Approve by Mobile
                              </button>
                            )}
                            <div className="au-actions__dropdown-divider" />
                            <button type="button" className={`au-actions__dropdown-item${u.disabled ? "" : " au-actions__dropdown-item--danger"}`} role="menuitem" onClick={() => { setOpenMenuUid(null); handleToggleDisable(u); }} disabled={busy}>
                              {u.disabled ? "Enable User" : "Disable User"}
                            </button>
                            <button type="button" className="au-actions__dropdown-item au-actions__dropdown-item--danger" role="menuitem" onClick={() => { setOpenMenuUid(null); setDeleteConfirm(u); }} disabled={busy}>
                              Delete User
                            </button>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selectedUser && (
        <div className="au-drawer-overlay" onClick={() => setSelectedUser(null)}>
          <aside className="au-drawer" onClick={e => e.stopPropagation()}>
            <div className="au-drawer__header">
              <div>
                <div className="au-drawer__eyebrow">User detail</div>
                <h3>User Profile</h3>
              </div>
              <button className="modal-close" onClick={() => setSelectedUser(null)} aria-label="Close user profile drawer">✕</button>
            </div>
            <div className="au-drawer__body">
              <div className="tabs">
                <button className={`tab${!showActivity ? " active" : ""}`} onClick={() => setShowActivity(false)}>Profile</button>
                <button
                  className={`tab${showActivity ? " active" : ""}`}
                  onClick={() => {
                    setShowActivity(true);
                    if (activityLogs.length === 0) void loadActivityLogs(selectedUser.uid as string);
                  }}
                >
                  Activity Log
                </button>
              </div>

              {!showActivity ? (
                <>
                  <div className="au-drawer__profile">
                    <div className={`avatar avatar-xl${selectedUser.disabled ? " avatar--disabled" : ""}`}>
                      {(selectedUser.photoURL as string) ? <img src={selectedUser.photoURL as string} alt="" loading="lazy" /> : initials(selectedUser)}
                    </div>
                    <div className="au-drawer__profile-info">
                      <div className="au-drawer__profile-name">{(selectedUser.displayName as string) || "—"}</div>
                      <div className="au-drawer__profile-email">{selectedUser.email as string}</div>
                      <div className="au-drawer__profile-badges">
                        <span className={`badge ${selectedUser.role === "admin" ? "badge-warning" : "badge-muted"}`}>{selectedUser.role as string || "user"}</span>
                        <span className={`badge ${selectedUser.disabled ? "badge-error" : "badge-success"}`}>{selectedUser.disabled ? "Disabled" : "Active"}</span>
                        {!!selectedUser.isServiceProvider && <span className="badge badge-accent">Service Pro</span>}
                      </div>
                    </div>
                  </div>

                  {[
                    { label: "Locality", val: (selectedUser.locality as string) || (selectedUser.society as string) || "—" },
                    { label: "Tower/Flat", val: [(selectedUser.tower as string), (selectedUser.flatNumber as string)].filter(Boolean).join(", ") || "—" },
                    { label: "Verification", val: (selectedUser.residentVerificationStatus as string) || "none" },
                    { label: "Rating", val: `★ ${(selectedUser.rating as number) || 0} (${(selectedUser.reviewCount as number) || 0} reviews)` },
                    { label: "Hourly Rate", val: (selectedUser.hourlyRate as number) ? `₹${selectedUser.hourlyRate}` : "Free consultation" },
                    { label: "Skills", val: ((selectedUser.skills as string[]) || []).join(", ") || "—" },
                  ].map(r => (
                    <div key={r.label} className="au-drawer__detail-row">
                      <span className="au-drawer__detail-label">{r.label}</span>
                      <span className="au-drawer__detail-value">{r.val}</span>
                    </div>
                  ))}

                  {(selectedUser.bio as string) && <div className="au-drawer__bio">{selectedUser.bio as string}</div>}
                </>
              ) : (
                <div className="au-drawer__activity-wrap">
                  {activityLoading ? (
                    <div className="au-loading"><div className="loader" /></div>
                  ) : activityLogs.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-state-icon">📋</div>
                      <div className="empty-state-title">No activity recorded yet</div>
                    </div>
                  ) : (
                    <table className="au-table">
                      <thead>
                        <tr><th className="au-col-icon"></th><th>Event</th><th>Details</th><th>When</th></tr>
                      </thead>
                      <tbody>
                        {activityLogs.map(log => (
                          <tr key={log.id}>
                            <td className="au-event-icon">{eventIcon[log.event] ?? "📌"}</td>
                            <td><span className="badge badge-muted">{log.event}</span></td>
                            <td className="text-muted">{log.details}</td>
                            <td className="text-muted">{formatTs(log.timestamp)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
            <div className="au-drawer__footer">
              {showActivity ? (
                <>
                  <button className="btn btn-ghost btn-sm" onClick={() => void loadActivityLogs(selectedUser.uid as string)} disabled={activityLoading}>Refresh</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => setSelectedUser(null)}>Close</button>
                </>
              ) : (
                <>
                  <button className="btn btn-primary btn-sm" onClick={() => { handleLoginAs(selectedUser); setSelectedUser(null); }}>Login As</button>
                  <button className={`btn ${selectedUser.disabled ? "btn-success" : "btn-danger"} btn-sm`} onClick={() => { handleToggleDisable(selectedUser); setSelectedUser(null); }}>
                    {selectedUser.disabled ? "Enable User" : "Disable User"}
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={async () => {
                      if (!user) return;
                      const convId = await getOrCreateConversation(user.uid, selectedUser.uid as string, { allowUnlinked: true });
                      setSelectedUser(null);
                      navigate(`/messages?conv=${convId}`);
                    }}
                  >
                    Message
                  </button>
                </>
              )}
            </div>
          </aside>
        </div>
      )}

      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal au-delete-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Delete User</h3>
              <button className="modal-close" onClick={() => setDeleteConfirm(null)} aria-label="Close delete confirmation dialog">✕</button>
            </div>
            <p>
              Permanently remove <strong>{deleteConfirm.displayName as string || deleteConfirm.email as string}</strong>'s profile?
              This cannot be undone.
            </p>
            <div className="modal-actions">
              <button className="btn btn-secondary btn-sm" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button className="btn btn-danger btn-sm" onClick={() => handleDelete(deleteConfirm)}>Yes, Delete</button>
            </div>
          </div>
        </div>
      )}

      {showAddModal && (
        <AddUserModal
          adminId={adminId} adminName={adminName}
          onClose={() => setShowAddModal(false)}
          onDone={() => { setShowAddModal(false); void load(); showToast("User record created"); }}
        />
      )}
    </div>
  );
}

function AddUserModal({ adminId, adminName, onClose, onDone }: { adminId: string; adminName: string; onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({ displayName: "", email: "", password: "", society: "", role: "user", isServiceProvider: false });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.displayName.trim() || !form.email.trim() || !form.password) { setError("Name, email, and password are required"); return; }
    if (form.password.length < 6) { setError("Password must be at least 6 characters"); return; }
    if (form.role !== "user") { setError("New users can only be created as role: user."); return; }
    setSaving(true);
    let secondaryApp;
    try {
      secondaryApp = initializeApp(app.options, "SecondaryAdminApp");
      const secondaryAuth = getAuth(secondaryApp);
      
      const userCred = await createUserWithEmailAndPassword(secondaryAuth, form.email.trim(), form.password);
      const uid = userCred.user.uid;
      
      await updateProfile(userCred.user, { displayName: form.displayName.trim() });
      await signOut(secondaryAuth);

      const profileData = {
        uid, displayName: form.displayName.trim(), email: form.email.trim(),
        society: form.society.trim(), role: form.role, isServiceProvider: form.isServiceProvider,
        photoURL: "", bio: "", skills: [], hourlyRate: 0, isFreeConsultation: true,
        rating: 0, reviewCount: 0, disabled: false, createdAt: serverTimestamp(),
        residentVerificationStatus: "none",
      };
      await setDoc(doc(db, "users", uid), profileData);
      await mirrorPublicProfile(uid, profileData);
      await logAudit("user.create", adminId, adminName, `Created user record and Auth: ${form.displayName} (${form.email})`, uid);
      onDone();
    } catch (e: unknown) { 
      setError((e as Error).message || "Failed"); 
    } finally {
      if (secondaryApp) {
        deleteApp(secondaryApp).catch(() => {});
      }
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal au-add-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Add User Record</h3>
          <button className="modal-close" onClick={onClose} aria-label="Close add user dialog">✕</button>
        </div>
        <p className="text-muted text-xs">Creates a fully functional Firebase Auth account and Firestore profile.</p>
        {error && <div className="error-box">{error}</div>}
        <div className="form-group">
          <label className="form-label">Full Name *</label>
          <input className="form-input" placeholder="Rajesh Kumar" value={form.displayName} onChange={e => set("displayName", e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Email *</label>
          <input className="form-input" placeholder="rajesh@example.com" value={form.email} onChange={e => set("email", e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Temporary Password *</label>
          <input className="form-input" placeholder="Min 6 chars" type="password" value={form.password} onChange={e => set("password", e.target.value)} />
          <span className="form-hint">User should change this password after first login.</span>
        </div>
        <div className="form-group">
          <label className="form-label">Society</label>
          <input className="form-input" placeholder="Sunflower Heights" value={form.society} onChange={e => set("society", e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Role</label>
          <select className="form-input" value={form.role} onChange={e => set("role", e.target.value)}>
            <option value="user">User</option>
          </select>
          <span className="form-hint">Admin elevation must be done separately via protected role-change flow.</span>
        </div>
        <label className="au-add-modal__toggle" htmlFor="ispro">
          <input type="checkbox" id="ispro" checked={form.isServiceProvider} onChange={e => set("isServiceProvider", e.target.checked)} />
          <span>Mark as Service Professional</span>
        </label>
        <div className="modal-actions">
          <button className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary btn-sm" onClick={handleSubmit} disabled={saving}>{saving ? "Creating..." : "Create User"}</button>
        </div>
      </div>
    </div>
  );
}

