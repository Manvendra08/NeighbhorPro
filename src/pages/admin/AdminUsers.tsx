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

  const tabs: { key: FilterTab; label: string }[] = [
    { key: "all", label: "All" }, { key: "active", label: "Active" },
    { key: "disabled", label: "Disabled" }, { key: "admins", label: "Admins" },
    { key: "pros", label: "Service Pros" }, { key: "verification", label: "📋 Verification" },
  ];

  const openUserModal = async (u: UserRow) => {
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
    setShowRoleModal(false);
    setRoleModalUser(null);
    setRoleUnderstandsWarning(false);
    setRoleNameConfirmation("");
    
    // Now perform the escalation
    await doAction(
      roleModalUser.uid as string, { role: "admin" },
      "Elevated to Admin",
      "user.role_change",
      `Changed role of ${targetName} to "admin"`
    );
  };

  const columnGroup = tab === "verification"
    ? (
      <colgroup>
        <col style={{ width: "22%" }} />
        <col style={{ width: "18%" }} />
        <col style={{ width: "14%" }} />
        <col style={{ width: "12%" }} />
        <col style={{ width: "14%" }} />
        <col style={{ width: "20%" }} />
      </colgroup>
    )
    : (
      <colgroup>
        <col style={{ width: "18%" }} />
        <col style={{ width: "18%" }} />
        <col style={{ width: "14%" }} />
        <col style={{ width: "10%" }} />
        <col style={{ width: "8%" }} />
        <col style={{ width: "12%" }} />
        <col style={{ width: "10%" }} />
        <col style={{ width: "10%" }} />
      </colgroup>
    );

  return (
    <div>
      {toast && (
        <div style={{
          position: "fixed", top: 20, right: 24, zIndex: 9999,
          background: toast.type === "success" ? "var(--success)" : "var(--error)",
          color: "#fff", padding: "10px 20px", borderRadius: "var(--radius-sm)",
          fontWeight: 600, fontSize: 13, boxShadow: "var(--shadow-lg)", animation: "dropIn 0.2s ease",
        }} role="status" aria-live="polite" aria-atomic="true">{toast.msg}</div>
      )}


      {showRoleModal && roleModalUser && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 9998,
        }}>
          <div className="card" style={{ maxWidth: 420, padding: 20, borderRadius: "var(--radius-lg)" }}>
            <h2 style={{ marginTop: 0, marginBottom: 12, fontSize: 18, fontWeight: 700 }}>Grant Admin Access</h2>
            <div style={{ backgroundColor: "var(--warning-dim)", padding: 12, borderRadius: "var(--radius-sm)", marginBottom: 16, fontSize: 13 }}>
              <div style={{ fontWeight: 600, marginBottom: 6, color: "var(--warning)" }}>⚠ Warning: Full Platform Access</div>
              <div style={{ color: "var(--text)" }}>Admins can modify any user account, disable access, approve financial transactions, and access sensitive data. Grant carefully.</div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13 }}>
                <input type="checkbox" checked={roleUnderstandsWarning} onChange={e => setRoleUnderstandsWarning(e.target.checked)} />
                I understand the risks and want to proceed
              </label>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 500 }}>
                Type user's name to confirm: <strong>{((roleModalUser.displayName as string) || (roleModalUser.email as string) || roleModalUser.uid as string)}</strong>
              </label>
              <input
                type="text"
                className="form-input"
                placeholder={((roleModalUser.displayName as string) || (roleModalUser.email as string) || roleModalUser.uid as string)}
                value={roleNameConfirmation}
                onChange={e => setRoleNameConfirmation(e.target.value)}
                style={{ width: "100%", padding: "8px 12px", fontSize: 13 }}
              />
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setShowRoleModal(false);
                  setRoleModalUser(null);
                  setRoleUnderstandsWarning(false);
                  setRoleNameConfirmation("");
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

      <div className="page-header">
        <div>
          <h1 className="page-title">User Management</h1>
          <p className="page-subtitle">{users.length} registered users on platform</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => {
            const csv = ["Name,Email,Society,Role,Pro,Status"]
              .concat(users.map((u: UserRow) => `"${u.displayName}","${u.email}","${u.society || ""}","${u.role}","${u.isServiceProvider ? "Yes" : "No"}","${u.disabled ? "Disabled" : "Active"}"`))
              .join("\n");
            const a = document.createElement("a");
            a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
            a.download = "users.csv"; a.click();
          }}>⬇ Export CSV</button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAddModal(true)}>+ Add User</button>
        </div>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 24 }}>
        {[
          { label: "Total Users", val: counts.all, icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>, color: "var(--accent)" },
          { label: "Active Users", val: counts.active, icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>, color: "var(--success)" },
          { label: "Disabled", val: counts.disabled, icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>, color: "var(--error)" },
          { label: "Admins", val: counts.admins, icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>, color: "var(--warning)" },
        ].map(c => (
          <div className="stat-card" key={c.label} style={{ padding: "20px" }}>
            <div className="stat-icon" style={{ background: c.color, color: "white", marginBottom: 8 }}>{c.icon}</div>
            <div className="stat-value" style={{ fontSize: 24 }}>{c.val}</div>
            <div className="stat-label">{c.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4, flexWrap: "wrap", gap: 8 }}>
        <div className="tabs" style={{ marginBottom: 0, border: "none" }}>
          {tabs.map(t => (
            <button key={t.key} className={`tab${tab === t.key ? " active" : ""}`} onClick={() => setTab(t.key)}>
              {t.label} <span style={{ marginLeft: 6, fontSize: 11, opacity: 0.7 }}>({counts[t.key]})</span>
            </button>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {tab === "verification" && (
            <button className="btn btn-ghost btn-sm" onClick={() => refreshQueue()} disabled={queueLoading} style={{ opacity: queueLoading ? 0.5 : 1 }}>
              {queueLoading ? "↻ Loading..." : "↻ Refresh"}
            </button>
          )}
          <input className="form-input" placeholder="Search name, email, society…" value={search}
            onChange={e => setSearch(e.target.value)} style={{ maxWidth: 280, padding: "8px 12px" }} />
        </div>
      </div>
      <div style={{ borderBottom: "1px solid var(--border)", marginBottom: 20 }} />

      {tab === "verification" && (
        <>
          <div className="card" style={{ marginBottom: 8, padding: "10px 14px", fontSize: 13, color: "var(--muted)" }}>
            Pending queue includes only users with uploaded proof and status set to pending. Approve or reject each request with an audit trail.
          </div>
          {queueRefreshTime && (
            <div style={{ marginBottom: 14, fontSize: 12, color: "var(--muted)" }}>
              Last refreshed: {queueRefreshTime.toLocaleTimeString("en-IN")}
            </div>
          )}
        </>
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: 60 }}><div className="loader" style={{ margin: "0 auto" }} /></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">👤</div>
          <div className="empty-state-title">{tab === "verification" ? "No pending verification requests" : "No users found"}</div>
        </div>
      ) : (
        <div className="table-wrap">
          <div style={{ maxHeight: "min(68vh, 720px)", overflowY: "auto", overflowX: "hidden" }}>
            <table className="table" style={{ tableLayout: "fixed", width: "100%" }}>
              {columnGroup}
              <thead>
                {tab === "verification" ? (
                  <tr><th style={{ position: "sticky", top: 0, zIndex: 2 }}>User</th><th style={{ position: "sticky", top: 0, zIndex: 2 }}>Society / Flat</th><th style={{ position: "sticky", top: 0, zIndex: 2 }}>Submitted</th><th style={{ position: "sticky", top: 0, zIndex: 2 }}>Method</th><th style={{ position: "sticky", top: 0, zIndex: 2 }}>Proof Document</th><th style={{ position: "sticky", top: 0, zIndex: 2 }}>Actions</th></tr>
                ) : (
                  <tr><th style={{ position: "sticky", top: 0, zIndex: 2 }}>User</th><th style={{ position: "sticky", top: 0, zIndex: 2 }}>Email</th><th style={{ position: "sticky", top: 0, zIndex: 2 }}>Locality</th><th style={{ position: "sticky", top: 0, zIndex: 2 }}>Role</th><th style={{ position: "sticky", top: 0, zIndex: 2 }}>Pro</th><th style={{ position: "sticky", top: 0, zIndex: 2 }}>Resident</th><th style={{ position: "sticky", top: 0, zIndex: 2 }}>Status</th><th style={{ position: "sticky", top: 0, zIndex: 2 }}>Actions</th></tr>
                )}
              </thead>
              <tbody>
              {filtered.map((u: UserRow) => {
                const uid = u.uid as string;
                const busy = actionLoading === uid;
                return (
                  <tr
                    key={uid}
                    style={{
                      opacity: busy ? 0.5 : 1,
                      verticalAlign: "middle",
                    }}
                  >
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => openUserModal(u)}>
                        <div className="avatar avatar-sm" style={{ background: u.disabled ? "rgba(255,92,92,0.1)" : "var(--accent-dim)", color: u.disabled ? "var(--error)" : "var(--accent)" }}>
                          {(u.photoURL as string) ? <img src={u.photoURL as string} alt="" loading="lazy" /> : initials(u)}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{(u.displayName as string) || "—"}</div>
                          <div style={{ fontSize: 12, color: "#6B7280" }}>uid: {uid.slice(0, 8)}…</div>
                        </div>
                      </div>
                    </td>

                    {tab === "verification" ? (
                      <>
                        <td>
                          <div style={{ fontWeight: 500 }}>{(u.society as string) || (u.locality as string) || "—"}</div>
                          <div style={{ fontSize: 12, color: "var(--muted)" }}>
                            {u.tower ? `Tower ${u.tower}` : ""} {u.flatNumber ? `Flat ${u.flatNumber}` : ""}
                          </div>
                        </td>
                        <td>{formatTs((u.verificationSubmittedAt as unknown) || (u.updatedAt as unknown) || (u.createdAt as unknown))}</td>
                        <td>
                          <span className="badge badge-muted" style={{ fontSize: 10 }}>
                            {((u.verificationMethod as string) || "manual").toUpperCase()}
                          </span>
                        </td>
                        <td>
                          {u.residencyProofUrl ? (
                            <a 
                              href={u.residencyProofUrl as string} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="btn btn-ghost btn-sm"
                              style={{ color: "var(--accent)", textDecoration: "none", fontSize: 12 }}
                            >
                              📎 View Proof
                            </a>
                          ) : (
                            <span className="text-muted" style={{ fontSize: 12 }}>No document</span>
                          )}
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button className="btn btn-success btn-sm" onClick={() => handleVerifyResident(u, "verified")} disabled={busy}>Approve</button>
                            <button className="btn btn-danger btn-sm" onClick={() => handleVerifyResident(u, "none")} disabled={busy}>Reject</button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="text-muted">{u.email as string}</td>
                        <td>{(u.locality as string) || (u.society as string) || <span className="text-muted">—</span>}{(u.tower as string) ? `, ${u.tower}` : ""}</td>
                        <td>
                          <span className={`badge ${u.role === "admin" ? "badge-warning" : "badge-muted"}`}>
                            {u.role === "admin" ? "🛡 Admin" : "User"}
                          </span>
                        </td>
                        <td>{u.isServiceProvider ? <span className="badge badge-accent">✓ Pro</span> : <span className="text-muted" style={{ fontSize: 12 }}>—</span>}</td>
                        <td>
                          {u.residentVerificationStatus === "verified" ? (
                            <span className="badge badge-success">✓ Verified</span>
                          ) : u.residentVerificationStatus === "pending" ? (
                            <button className="btn btn-warning btn-sm" style={{ fontSize: 10, padding: "2px 8px" }} onClick={() => setTab("verification")}>Pending</button>
                          ) : (
                            <span className="text-muted" style={{ fontSize: 12 }}>—</span>
                          )}
                        </td>
                        <td><span className={`badge ${u.disabled ? "badge-error" : "badge-success"}`}>{u.disabled ? "Disabled" : "Active"}</span></td>
                        <td>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            <button className={`btn btn-sm ${u.disabled ? "btn-success" : "btn-danger"}`} onClick={() => handleToggleDisable(u)} disabled={busy}>{u.disabled ? "Enable" : "Disable"}</button>
                            <button className="btn btn-ghost btn-sm" onClick={() => handleToggleRole(u)} disabled={busy}>{u.role === "admin" ? "Demote" : "Make Admin"}</button>
                            <button className="btn btn-ghost btn-sm" onClick={() => handleTogglePro(u)} disabled={busy} style={{ color: u.isServiceProvider ? "var(--warning)" : "var(--accent)" }}>{u.isServiceProvider ? "Remove Pro" : "Set Pro"}</button>
                            {!u.emailVerified && !!u.phoneNumber && (
                              <button className="btn btn-warning btn-sm" onClick={() => handleApproveEmailByMobile(u)} disabled={busy}>Approve by Mobile</button>
                            )}
                            <button className="btn btn-danger btn-sm" onClick={() => setDeleteConfirm(u)} disabled={busy} aria-label={`Delete ${(u.displayName as string) || (u.email as string) || "user"}`}>🗑</button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        </div>
      )}

      {selectedUser && (
        <div className="modal-overlay" onClick={() => setSelectedUser(null)}>
          <div className="modal" style={{ maxWidth: 580 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">User Profile</h3>
              <button className="modal-close" onClick={() => setSelectedUser(null)} aria-label="Close user profile dialog">✕</button>
            </div>

            {/* Tab switcher */}
            <div className="tabs" style={{ marginBottom: 16, borderBottom: "1px solid var(--border)" }}>
              <button className={`tab${!showActivity ? " active" : ""}`} onClick={() => setShowActivity(false)}>Profile</button>
              <button
                className={`tab${showActivity ? " active" : ""}`}
                onClick={() => {
                  setShowActivity(true);
                  if (activityLogs.length === 0) loadActivityLogs(selectedUser.uid as string);
                }}
              >📋 Activity Log</button>
            </div>

            {!showActivity ? (
              <>
                <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                  <div className="avatar avatar-xl">{(selectedUser.photoURL as string) ? <img src={selectedUser.photoURL as string} alt="" loading="lazy" /> : initials(selectedUser)}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "var(--font-heading)", marginBottom: 4 }}>{(selectedUser.displayName as string) || "—"}</div>
                    <div style={{ color: "var(--muted)", fontSize: 13, marginBottom: 12 }}>{selectedUser.email as string}</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
                      <span className={`badge ${selectedUser.role === "admin" ? "badge-warning" : "badge-muted"}`}>{selectedUser.role as string || "user"}</span>
                      <span className={`badge ${selectedUser.disabled ? "badge-error" : "badge-success"}`}>{selectedUser.disabled ? "Disabled" : "Active"}</span>
                      {!!selectedUser.isServiceProvider && <span className="badge badge-accent">Service Pro</span>}
                    </div>
                    {[
                      { label: "Locality", val: (selectedUser.locality as string) || (selectedUser.society as string) || "—" },
                      { label: "Tower/Flat", val: [(selectedUser.tower as string), (selectedUser.flatNumber as string)].filter(Boolean).join(", ") || "—" },
                      { label: "Verification", val: (selectedUser.residentVerificationStatus as string) || "none" },
                      { label: "Rating", val: `★ ${(selectedUser.rating as number) || 0} (${(selectedUser.reviewCount as number) || 0} reviews)` },
                      { label: "Hourly Rate", val: (selectedUser.hourlyRate as number) ? `₹${selectedUser.hourlyRate}` : "Free consultation" },
                      { label: "Skills", val: ((selectedUser.skills as string[]) || []).join(", ") || "—" },
                    ].map(r => (
                      <div key={r.label} style={{ display: "flex", gap: 12, marginBottom: 6, fontSize: 13 }}>
                        <span style={{ color: "var(--muted)", minWidth: 90 }}>{r.label}</span>
                        <span style={{ fontWeight: 500 }}>{r.val}</span>
                      </div>
                    ))}
                    {(selectedUser.bio as string) && <div style={{ marginTop: 10, fontSize: 13, color: "var(--muted)", borderTop: "1px solid var(--border)", paddingTop: 10 }}>{selectedUser.bio as string}</div>}
                  </div>
                </div>
                <div className="modal-actions">
                  <button className={`btn ${selectedUser.disabled ? "btn-success" : "btn-danger"} btn-sm`} onClick={() => { handleToggleDisable(selectedUser); setSelectedUser(null); }}>
                    {selectedUser.disabled ? "Enable User" : "Disable User"}
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={async () => {
                    if (!user) return;
                    const convId = await getOrCreateConversation(user.uid, selectedUser.uid as string, { allowUnlinked: true });
                    navigate(`/messages?conv=${convId}`);
                  }}>💬 Message</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => setSelectedUser(null)}>Close</button>
                </div>
              </>
            ) : (
              <>
                <div style={{ maxHeight: 380, overflowY: "auto" }}>
                  {activityLoading ? (
                    <div style={{ textAlign: "center", padding: 40 }}><div className="loader" style={{ margin: "0 auto" }} /></div>
                  ) : activityLogs.length === 0 ? (
                    <div className="empty-state" style={{ padding: "30px 20px" }}>
                      <div className="empty-state-icon">📋</div>
                      <div className="empty-state-title">No activity recorded yet</div>
                    </div>
                  ) : (
                    <table className="table" style={{ fontSize: 12 }}>
                      <thead>
                        <tr><th style={{ width: 28 }}></th><th>Event</th><th>Details</th><th>When</th></tr>
                      </thead>
                      <tbody>
                        {activityLogs.map(log => (
                          <tr key={log.id}>
                            <td style={{ fontSize: 16, textAlign: "center" }}>{eventIcon[log.event] ?? "📌"}</td>
                            <td><span className="badge badge-muted" style={{ fontSize: 10, fontFamily: "monospace" }}>{log.event}</span></td>
                            <td style={{ color: "var(--muted)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{log.details}</td>
                            <td style={{ color: "var(--muted)", whiteSpace: "nowrap" }}>{formatTs(log.timestamp)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
                <div className="modal-actions">
                  <button className="btn btn-ghost btn-sm" onClick={() => loadActivityLogs(selectedUser.uid as string)} disabled={activityLoading}>↻ Refresh</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => setSelectedUser(null)}>Close</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ color: "var(--error)" }}>⚠ Delete User</h3>
              <button className="modal-close" onClick={() => setDeleteConfirm(null)} aria-label="Close delete confirmation dialog">✕</button>
            </div>
            <p style={{ fontSize: 14, color: "var(--muted)", marginBottom: 16 }}>
              Permanently remove <strong style={{ color: "var(--text)" }}>{deleteConfirm.displayName as string || deleteConfirm.email as string}</strong>'s profile?
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
          onDone={() => { setShowAddModal(false); load(); showToast("User record created"); }}
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
      <div className="modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Add User Record</h3>
          <button className="modal-close" onClick={onClose} aria-label="Close add user dialog">✕</button>
        </div>
        <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 16 }}>Creates a fully functional Firebase Auth account and Firestore profile.</p>
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
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <input type="checkbox" id="ispro" checked={form.isServiceProvider} onChange={e => set("isServiceProvider", e.target.checked)} style={{ width: 16, height: 16 }} />
          <label htmlFor="ispro" style={{ fontSize: 14, cursor: "pointer" }}>Mark as Service Professional</label>
        </div>
        <div className="modal-actions">
          <button className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary btn-sm" onClick={handleSubmit} disabled={saving}>{saving ? "Creating…" : "Create User"}</button>
        </div>
      </div>
    </div>
  );
}

