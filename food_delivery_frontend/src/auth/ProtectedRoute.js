import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";

/**
 * PUBLIC_INTERFACE
 * ProtectedRoute blocks access when unauthenticated or lacking required roles.
 *
 * Usage:
 * <Route element={<ProtectedRoute allowedRoles={['customer']} />}>
 *   <Route path="/customer" element={<CustomerHome/>} />
 * </Route>
 */
export function ProtectedRoute({ allowedRoles = null }) {
  const { token, roles, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ padding: 22 }}>
        <div className="ui-card">
          <h3 className="ui-cardTitle">Loading session…</h3>
          <p className="ui-help">Checking your login status.</p>
        </div>
      </div>
    );
  }

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (Array.isArray(allowedRoles) && allowedRoles.length > 0) {
    const ok = allowedRoles.some((r) => roles.includes(r));
    if (!ok) return <Navigate to="/unauthorized" replace />;
  }

  return <Outlet />;
}
