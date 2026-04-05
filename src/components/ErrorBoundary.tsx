import { Component, ErrorInfo, ReactNode } from "react";
import { auth } from "../firebase";
import { logErrorBoundaryActivity } from "../services/activityService";

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
};

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, errorInfo: ErrorInfo) {
    console.error("Unhandled UI error", error, errorInfo);
    void logErrorBoundaryActivity(auth.currentUser?.uid, error, {
      componentStack: errorInfo.componentStack ?? undefined,
    });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = "/dashboard";
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "var(--surface)" }}>
          <div style={{ maxWidth: 520, width: "100%", background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: 20, boxShadow: "var(--shadow-md)" }}>
            <h2 style={{ margin: 0, marginBottom: 8 }}>Something went wrong</h2>
            <p style={{ margin: 0, marginBottom: 16, color: "var(--muted)", lineHeight: 1.5 }}>
              We hit an unexpected error. Please reload this page. If the issue continues, try returning to Dashboard.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn btn-primary" onClick={this.handleReload}>Reload</button>
              <button className="btn btn-secondary" onClick={this.handleGoHome}>Go to Dashboard</button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
