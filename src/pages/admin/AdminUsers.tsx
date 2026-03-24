import { useEffect, useState } from "react";
import { getAllUsers, updateUserProfile, updateResidentVerification } from "../../services/firestoreService";
import { deleteDoc, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../contexts/AuthContext";
import { logAudit } from "./AdminAuditLog";
import { getUserActivityLogs } from "../../services/activityService";
import type { ActivityLog } from "../../services/activityService";

type UserRow = Record<string, unknown>;
type FilterTab = "all" | "active" | "disabled" | "admins" | "pros" | "verification";

export default function AdminUsers() {
  const { userProfile } = useAuth();
  const adminId = userProfile?.uid || "unknown";
  const adminName = userProfile?.displayName || "Admin";

  const [users, setUsers] = useState<UserRow[]>([]);
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

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const load = async () => {
    setLoading(true);
    try { setUsers(await getAllUsers()); } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const counts = {
    all: users.length,
    active: users.filter(u => !u.disabled).length,
    disabled: users.filter(u => !!u.disabled).length,
    admins: users.filter(u => u.role === "admin").length,
    pros: users.filter(u => !!u.isServiceProvider).length,
    verification: users.filter(u => u.residentVerificationStatus === "pending").length,
  };

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      ((u.displayName as string) || "").toLowerCase().includes(q) ||
      ((u.email as string) || "").toLowerCase().includes(q) ||
      ((u.society as string) || "").toLowerCase().includes(q);
    const matchTab =
      tab === "all" ? true : tab === "active" ? !u.disabled :
      tab === "disabled" ? !!u.disabled : tab === "admins" ? u.role === "admin" :
      tab === "pros" ? !!u.isServiceProvider :
      tab === "verification" ? u.residentVerificationStatus === "pending" : true;
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

  const handleToggleDisable = (u: UserRow) => {
    const disabled = !u.disabled;
    const name = (u.displayName as string) || (u.email as string) || u.uid as string;
    doAction(
      u.uid as string, { disabled },
      disabled ? "User disabled" : "User enabled",
      disabled ? "user.disable" : "user.enable",
      `${disabled ? "Disabled" : "Enabled"} user: ${name}`
    );
  };

  const handleToggleRole = (u: UserRow) => {
    const role = u.role === "admin" ? "user" : "admin";
    const name = (u.displayName as string) || (u.email as string) || u.uid as string;
    doAction(
      u.uid as string, { role },
      role === "admin" ? "Elevated to Admin" : "Role reverted to User",
      "user.role_change",
      `Changed role of ${name} to "${role}"`
    );
  };

  const handleTogglePro = (u: UserRow) => {
    const isServiceProvider = !u.isServiceProvider;
    const name = (u.displayName as string) || (u.email as string) || u.uid as string;
    doAction(
      u.uid as string, { isServiceProvider },
      isServiceProvider ? "Marked as Service Pro" : "Pro status removed",
      "user.pro_change",
      `${isServiceProvider ? "Set" : "Removed"} Pro status for: ${name}`
    );
  };

  const handleVerifyResident = (u: UserRow, action: "verified" | "none") => {
    const name = (u.displayName as string) || (u.email as string) || u.uid as string;
    const doVerify = async () => {
      setActionLoading(u.uid as string);
      try {
        await updateResidentVerification(u.uid as string, action, action === "verified" ? "manual" : null);
        await logAudit(
          action === "verified" ? "user.verify_resident" : "user.reject_resident",
          adminId, adminName,
          `${action === "verified" ? "Verified" : "Rejected"} resident verification for: ${name}`,
          u.uid as string
        );
        showToast(action === "verified" ? "Resident verified" : "Verification rejected");
        await load();
      } catch { showToast("Action failed", "error"); }
      setActionLoading(null);
    };
    doVerify();
  };

  const handleDelete = async (u: UserRow) => {
    setActionLoading(u.uid as string);
    try {
      await deleteDoc(doc(db, "users", u.uid as string));
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

  return (
    <div>
      {toast && (
        <div style={{
          position: "fixed", top: 20, right: 24, zIndex: 9999,
          background: toast.type === "success" ? "var(--success)" : "var(--error)",
          color: "#fff", padding: "10px 20px", borderRadius: "var(--radius-sm)",
          fontWeight: 600, fontSize: 13, boxShadow: "var(--shadow-lg)", animation: "dropIn 0.2s ease",
        }}>{toast.msg}</div>
      )}

      <div className="page-header">
        <div>
          <h1 className="page-title">User Management</h1>
          <p className="page-subtitle">{users.length} registered users on platform</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => {
            const csv = ["Name,Email,Society,Role,Pro,Status"]
              .concat(users.map(u => `"${u.displayName}","${u.email}","${u.society || ""}","${u.role}","${u.isServiceProvider ? "Yes" : "No"}","${u.disabled ? "Disabled" : "Active"}"`))
              .join("\n");
            const a = document.createElement("a");
            a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
            a.download = "users.csv"; a.click();
          }}>⬇ Export CSV</button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAddModal(true)}>+ Add User</button>
        </div>
      </div>

      <div className="grid" style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: 16,
        marginBottom: 24
      }}>
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
        <input className="form-input" placeholder="Search name, email, society…" value={search}
          onChange={e => setSearch(e.target.value)} style={{ maxWidth: 280, padding: "8px 12px" }} />
      </div>
      <div style={{ borderBottom: "1px solid var(--border)", marginBottom: 20 }} />

      {loading ? (
        <div style={{ textAlign: "center", padding: 60 }}><div className="loader" style={{ margin: "0 auto" }} /></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state"><div className="empty-state-icon">👤</div><div className="empty-state-title">No users found</div></div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>User</th><th>Email</th><th>Locality</th><th>Role</th><th>Pro</th><th>Resident</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {filtered.map(u => {
                const uid = u.uid as string;
                const busy = actionLoading === uid;
                return (
                  <tr key={uid} style={{ opacity: busy ? 0.5 : 1, verticalAlign: "middle" }}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => openUserModal(u)}>
                        <div className="avatar avatar-sm" style={{ background: u.disabled ? "rgba(255,92,92,0.1)" : "var(--accent-dim)", color: u.disabled ? "var(--error)" : "var(--accent)" }}>
                          {(u.photoURL as string) ? <img src={u.photoURL as string} alt="" /> : initials(u)}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{(u.displayName as string) || "—"}</div>
                          <div style={{ fontSize: 12, color: "#6B7280" }}>uid: {uid.slice(0, 8)}…</div>
                        </div>
                      </div>
                    </td>
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
                        <div style={{ display: "flex", gap: 4 }}>
                          <button className="btn btn-success btn-sm" style={{ fontSize: 10, padding: "2px 8px" }} onClick={() => handleVerifyResident(u, "verified")} disabled={busy}>Verify</button>
                          <button className="btn btn-danger btn-sm" style={{ fontSize: 10, padding: "2px 8px" }} onClick={() => handleVerifyResident(u, "none")} disabled={busy}>Reject</button>
                        </div>
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
                        <button className="btn btn-danger btn-sm" onClick={() => setDeleteConfirm(u)} disabled={busy}>🗑</button>
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
        <div className="modal-overlay" onClick={() => setSelectedUser(null)}>
          <div className="modal" style={{ maxWidth: 580 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">User Profile</h3>
              <button className="modal-close" onClick={() => setSelectedUser(null)}>✕</button>
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
                  <div className="avatar avatar-xl">{(selectedUser.photoURL as string) ? <img src={selectedUser.photoURL as string} alt="" /> : initials(selectedUser)}</div>
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
              <button className="modal-close" onClick={() => setDeleteConfirm(null)}>✕</button>
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
  const [form, setForm] = useState({ displayName: "", email: "", society: "", role: "user", isServiceProvider: false });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.displayName.trim() || !form.email.trim()) { setError("Name and email are required"); return; }
    setSaving(true);
    try {
      const uid = `manual_${Date.now()}`;
      await setDoc(doc(db, "users", uid), {
        uid, displayName: form.displayName.trim(), email: form.email.trim(),
        society: form.society.trim(), role: form.role, isServiceProvider: form.isServiceProvider,
        photoURL: "", bio: "", skills: [], hourlyRate: 0, isFreeConsultation: true,
        rating: 0, reviewCount: 0, disabled: false, createdAt: serverTimestamp(),
      });
      await logAudit("user.create", adminId, adminName, `Created manual user record: ${form.displayName} (${form.email})`, uid);
      onDone();
    } catch (e: unknown) { setError((e as Error).message || "Failed"); }
    setSaving(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Add User Record</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 16 }}>Creates a Firestore profile stub. Firebase Auth account must be created separately.</p>
        {error && <div className="error-box">{error}</div>}
        {[
          { label: "Full Name *", key: "displayName", placeholder: "Rajesh Kumar" },
          { label: "Email *", key: "email", placeholder: "rajesh@example.com" },
          { label: "Society", key: "society", placeholder: "Sunflower Heights" },
        ].map(f => (
          <div className="form-group" key={f.key}>
            <label className="form-label">{f.label}</label>
            <input className="form-input" placeholder={f.placeholder} value={form[f.key as "displayName" | "email" | "society"]} onChange={e => set(f.key, e.target.value)} />
          </div>
        ))}
        <div className="form-group">
          <label className="form-label">Role</label>
          <select className="form-input" value={form.role} onChange={e => set("role", e.target.value)}>
            <option value="user">User</option><option value="admin">Admin</option>
          </select>
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

