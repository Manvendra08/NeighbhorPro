import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import Profile from "./Profile";

type Tab = "profile" | "transactions" | "activity";

export default function MyAccount() {
  const [tab, setTab] = useState<Tab>("profile");
  const { userProfile } = useAuth();

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">My Account</h1>
          <p className="page-subtitle">Manage your profile, view transactions, and track activity</p>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab${tab === "profile" ? " active" : ""}`} onClick={() => setTab("profile")}>Profile</button>
        <button className={`tab${tab === "transactions" ? " active" : ""}`} onClick={() => setTab("transactions")}>Transactions</button>
        <button className={`tab${tab === "activity" ? " active" : ""}`} onClick={() => setTab("activity")}>Activity</button>
      </div>

      {tab === "profile" && <Profile />}

      {tab === "transactions" && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Transaction History</h3>
          </div>
          <div className="empty-state">
            <div className="empty-state-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--muted)" }}>
                <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
              </svg>
            </div>
            <div className="empty-state-title">No transactions yet</div>
            <div className="empty-state-desc">
              Your booking and payment history will appear here once you start using ProNeighbor services.
            </div>
            <a href="/browse" className="btn btn-primary" style={{ marginTop: 16 }}>
              Browse Professionals
            </a>
          </div>
        </div>
      )}

      {tab === "activity" && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Recent Activity</h3>
          </div>

          {/* Activity feed */}
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            <ActivityItem
              icon="👤"
              title="Account created"
              desc={`Joined as ${userProfile?.role || "user"}`}
              time="Since registration"
            />
            {userProfile?.isServiceProvider && (
              <ActivityItem
                icon="🛠️"
                title="Service provider enabled"
                desc={`Listed ${userProfile.skills?.length || 0} skills`}
                time="Active"
              />
            )}
            {(userProfile?.reviewCount || 0) > 0 && (
              <ActivityItem
                icon="⭐"
                title="Reviews received"
                desc={`${userProfile?.reviewCount} reviews • ${userProfile?.rating?.toFixed(1)} avg rating`}
                time="Cumulative"
              />
            )}
            {userProfile?.society && (
              <ActivityItem
                icon="🏘️"
                title="Society linked"
                desc={userProfile.society}
                time="Active"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ActivityItem({ icon, title, desc, time }: { icon: string; title: string; desc: string; time: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 14, padding: "14px 0",
      borderBottom: "1px solid var(--border)"
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10, background: "var(--accent-dim)",
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0
      }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{title}</div>
        <div style={{ fontSize: 13, color: "var(--muted)" }}>{desc}</div>
      </div>
      <div style={{ fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap" }}>{time}</div>
    </div>
  );
}
