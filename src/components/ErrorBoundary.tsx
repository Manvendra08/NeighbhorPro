import { Component, ErrorInfo, ReactNode } from "react";
import { auth } from "../firebase";
import { logErrorBoundaryActivity } from "../services/activityService";

type Props = {
  children: ReactNode;
  fallback?: ReactNode;
};

type State = {
  hasError: boolean;
  error?: Error;
};

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: unknown, errorInfo: ErrorInfo) {
    console.error("Unhandled UI error", error, errorInfo);
    void logErrorBoundaryActivity(auth.currentUser?.uid, error, {
      componentStack: errorInfo.componentStack ?? undefined,
    });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      const isDev = import.meta.env.DEV;
      const referenceId = this.state.error
        ? `ERR-${this.state.error.name.toUpperCase()}-${this.state.error.message.length}`
        : "ERR-UNKNOWN";

      return (
        this.props.fallback || (
          <div className="flex flex-col items-center justify-center min-h-screen bg-red-50 p-4">
            <div className="max-w-md text-center">
              <h1 className="text-3xl font-bold text-red-600 mb-4">Oops! Something went wrong</h1>
              <p className="text-gray-700 mb-6">
                {isDev
                  ? (this.state.error?.message || "An unexpected error occurred")
                  : `An error occurred. Reference ID: ${referenceId}`}
              </p>
              {isDev && this.state.error?.stack && (
                <details className="mb-6 text-left bg-red-100 p-3 rounded text-sm max-h-40 overflow-y-auto">
                  <summary className="cursor-pointer font-semibold text-red-800">Error details</summary>
                  <pre className="mt-2 text-xs whitespace-pre-wrap">{this.state.error.stack}</pre>
                </details>
              )}
              <button
                onClick={this.handleReset}
                className="px-6 py-2 bg-red-600 text-white rounded font-semibold hover:bg-red-700 transition"
              >
                Try Again
              </button>
              <p className="mt-4 text-sm text-gray-600">
                If the problem persists, please refresh the page or contact support.
              </p>
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
