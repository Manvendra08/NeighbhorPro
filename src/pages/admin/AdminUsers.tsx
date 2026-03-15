import { useEffect, useState } from "react";
import { getAllUsers, updateUserProfile } from "../../services/firestoreService";

export default function AdminUsers() {
  const [users, setUsers] = useState<Record<string, unknown>[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getAllUsers();
      setUsers(data);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = users.filter((u) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      ((u.displayName as string) || "").toLowerCase().includes(q) ||
      ((u.email as string) || "").toLowerCase().includes(q) ||
      ((u.society as string) || "").toLowerCase().includes(q)
    );
  });

  const toggleRole = async (uid: string, currentRole: string) => {
    const newRole = currentRole === "admin" ? "user" : "admin";
    await updateUserProfile(uid, { role: newRole });
    load();
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Manage Users</h1>
          <p className="page-subtitle">{users.length} registered users</p>
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <input
          className="form-input"
          placeholder="Search users by name, email, or society…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: 420 }}
          id="admin-users-search"
        />
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 60 }}><div className="loader" style={{ margin: "0 auto" }} /></div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Society</th>
                <th>Skills</th>
                <th>Rating</th>
                <th>Role</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.uid as string}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div className="avatar avatar-sm">
                        {(u.photoURL as string) ? (
                          <img src={u.photoURL as string} alt="" />
                        ) : (
                          ((u.displayName as string) || "?").slice(0, 2).toUpperCase()
                        )}
                      </div>
                      <span style={{ fontWeight: 500 }}>{(u.displayName as string) || "—"}</span>
                    </div>
                  </td>
                  <td className="text-muted">{(u.email as string)}</td>
                  <td>{(u.society as string) || "—"}</td>
                  <td>
                    {((u.skills as string[]) || []).slice(0, 2).map((s: string) => (
                      <span className="skill-tag" key={s} style={{ marginRight: 4 }}>{s}</span>
                    ))}
                    {((u.skills as string[]) || []).length > 2 && (
                      <span className="text-muted text-xs">+{(u.skills as string[]).length - 2}</span>
                    )}
                  </td>
                  <td>
                    <span style={{ color: "var(--warning)" }}>★ {(u.rating as number) || 0}</span>
                  </td>
                  <td>
                    <span className={`badge ${(u.role as string) === "admin" ? "badge-accent" : "badge-muted"}`}>
                      {(u.role as string) || "user"}
                    </span>
                  </td>
                  <td>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => toggleRole(u.uid as string, (u.role as string) || "user")}
                    >
                      {(u.role as string) === "admin" ? "Remove Admin" : "Make Admin"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
