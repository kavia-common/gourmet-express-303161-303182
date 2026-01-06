import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

function pickDefaultPath(roles) {
  if (roles.includes("restaurant_owner") || roles.includes("admin")) return "/restaurant/menu";
  if (roles.includes("courier")) return "/courier/assignments";
  return "/customer/browse";
}

/**
 * PUBLIC_INTERFACE
 * Landing decides where to send an authenticated user.
 */
export function Landing() {
  const { token, roles, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!token) {
      navigate("/login", { replace: true });
      return;
    }
    navigate(pickDefaultPath(roles || []), { replace: true });
  }, [token, roles, loading, navigate]);

  return (
    <div className="ui-card">
      <h3 className="ui-cardTitle">Preparing your dashboard…</h3>
      <p className="ui-help">Routing you to the right role experience.</p>
    </div>
  );
}
