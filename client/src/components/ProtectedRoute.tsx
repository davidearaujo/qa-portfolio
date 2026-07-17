import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// Redirects unauthenticated visitors to /login. Also useful as a distinct,
// testable "gate" for E2E tests that check unauthorized access is blocked.
export function ProtectedRoute() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
