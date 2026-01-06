import React, { useMemo } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

function icon(letter) {
  return <span style={{ fontWeight: 900 }}>{letter}</span>;
}

function firstRole(roles) {
  // Prefer specific roles for landing decisions.
  if (roles.includes("restaurant_owner")) return "restaurant_owner";
  if (roles.includes("courier")) return "courier";
  if (roles.includes("customer")) return "customer";
  // fallback
  return roles?.[0] || "customer";
}

/**
 * PUBLIC_INTERFACE
 * AppShell provides the multi-role dashboard layout:
 * - left sidebar navigation
 * - topbar with user info and logout
 * - main outlet content
 */
export function AppShell() {
  const { user, roles, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const activeRole = useMemo(() => firstRole(roles || []), [roles]);

  const navGroups = useMemo(() => {
    const groups = [];

    // Customer
    if (roles?.includes("customer") || roles?.includes("admin")) {
      groups.push({
        title: "Customer",
        items: [
          { to: "/customer/browse", label: "Browse", icon: icon("B") },
          { to: "/customer/cart", label: "Cart / Checkout", icon: icon("C") },
          { to: "/customer/orders", label: "Orders / Tracker", icon: icon("O") }
        ]
      });
    }

    // Restaurant
    if (roles?.includes("restaurant_owner") || roles?.includes("admin")) {
      groups.push({
        title: "Restaurant",
        items: [
          { to: "/restaurant/menu", label: "Menu Management", icon: icon("M") },
          { to: "/restaurant/orders", label: "Orders", icon: icon("R") }
        ]
      });
    }

    // Courier
    if (roles?.includes("courier") || roles?.includes("admin")) {
      groups.push({
        title: "Courier",
        items: [{ to: "/courier/assignments", label: "Assignments / Queue", icon: icon("Q") }]
      });
    }

    return groups;
  }, [roles]);

  const title = useMemo(() => {
    // Basic title from path; can be enhanced later.
    const p = location.pathname;
    if (p.startsWith("/customer/browse")) return "Customer · Browse";
    if (p.startsWith("/customer/cart")) return "Customer · Cart / Checkout";
    if (p.startsWith("/customer/orders")) return "Customer · Orders / Tracker";
    if (p.startsWith("/restaurant/menu")) return "Restaurant · Menu Management";
    if (p.startsWith("/restaurant/orders")) return "Restaurant · Orders";
    if (p.startsWith("/courier/assignments")) return "Courier · Assignments / Queue";
    return "Dashboard";
  }, [location.pathname]);

  function rolePillText() {
    if (!roles?.length) return "No roles";
    if (activeRole === "restaurant_owner") return "Restaurant";
    if (activeRole === "courier") return "Courier";
    if (activeRole === "customer") return "Customer";
    return activeRole;
  }

  return (
    <div className="ui-shell">
      <aside className="ui-sidebar" aria-label="Sidebar">
        <div className="ui-sidebarBrand">
          <div className="ui-logoMark" aria-hidden="true" />
          <div className="ui-brandText">
            <p className="ui-brandTitle">Gourmet Express</p>
            <p className="ui-brandSubtitle">Multi-role console</p>
          </div>
        </div>

        {navGroups.length === 0 ? (
          <div className="ui-card" style={{ padding: 12 }}>
            <p className="ui-help" style={{ margin: 0 }}>
              No role navigation is available for this account.
            </p>
            <p className="ui-help" style={{ margin: "8px 0 0 0" }}>
              If you expected access, ask an admin to attach roles (e.g. <code>customer</code>,{" "}
              <code>restaurant_owner</code>, <code>courier</code>).
            </p>
          </div>
        ) : (
          navGroups.map((group) => (
            <div key={group.title}>
              <div className="ui-navGroupTitle">{group.title}</div>
              <nav className="ui-nav" aria-label={`${group.title} navigation`}>
                {group.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) => `ui-navLink ${isActive ? "ui-navLinkActive" : ""}`}
                  >
                    <span className="ui-navIcon" aria-hidden="true">
                      {item.icon}
                    </span>
                    <span style={{ fontWeight: 800 }}>{item.label}</span>
                  </NavLink>
                ))}
              </nav>
            </div>
          ))
        )}

        <div className="ui-navGroupTitle">Session</div>
        <button
          className="ui-btn ui-btnGhost"
          onClick={() => {
            logout();
            navigate("/login");
          }}
          style={{ width: "100%", justifyContent: "center" }}
        >
          Logout
        </button>
      </aside>

      <main className="ui-main">
        <header className="ui-topbar" aria-label="Top bar">
          <div className="ui-topbarLeft">
            <h1 className="ui-pageTitle">{title}</h1>
            <span className="ui-badge" title="Active role">
              <span
                aria-hidden="true"
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  background: "linear-gradient(135deg, var(--primary), var(--success))"
                }}
              />
              {rolePillText()}
            </span>
          </div>

          <div className="ui-topbarRight">
            <span className="ui-badge" title="Signed in user">
              {user?.email || "Unknown user"}
            </span>
            <button
              className="ui-btn ui-btnGhost"
              onClick={() => {
                logout();
                navigate("/login");
              }}
              title="Sign out"
              aria-label="Logout"
            >
              Logout
            </button>
          </div>
        </header>

        <div className="ui-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
