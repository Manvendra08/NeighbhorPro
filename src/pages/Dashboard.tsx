import { useAuth } from "../contexts/AuthContext";
import { useDashboardData } from "../hooks/useDashboardData";
import { useIsMobile } from "../hooks/useIsMobile";
import DesktopDashboard from "../components/dashboard/DesktopDashboard";
import MobileDashboard from "../components/dashboard/MobileDashboard";
import "../components/dashboard/Dashboard.css";

export default function Dashboard() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const dashboardData = useDashboardData(user?.uid);

  if (!user) return null;

  return (
    <div className="page-container db-shell">
      {isMobile ? (
        <MobileDashboard user={user} {...dashboardData} />
      ) : (
        <DesktopDashboard user={user} {...dashboardData} />
      )}
    </div>
  );
}
