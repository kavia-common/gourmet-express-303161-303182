import React, { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import "./App.css";
import { AuthProvider } from "./auth/AuthContext";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { AppShell } from "./layout/AppShell";
import { Landing } from "./pages/Landing";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { UnauthorizedPage } from "./pages/UnauthorizedPage";

import { CustomerBrowsePage } from "./pages/customer/BrowsePage";
import { CustomerCartPage } from "./pages/customer/CartPage";
import { CustomerOrdersPage } from "./pages/customer/OrdersPage";

import { RestaurantMenuManagementPage } from "./pages/restaurant/MenuManagementPage";
import { RestaurantOrdersPage } from "./pages/restaurant/RestaurantOrdersPage";

import { CourierAssignmentsPage } from "./pages/courier/AssignmentsPage";

// PUBLIC_INTERFACE
function App() {
  // Keep theme toggle capability from template, but default to light per style guide.
  const [theme, setTheme] = useState("light");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // PUBLIC_INTERFACE
  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/unauthorized" element={<UnauthorizedPage />} />

            {/* Protected app shell */}
            <Route element={<ProtectedRoute />}>
              <Route element={<AppShell />}>
                <Route path="/" element={<Landing />} />

                {/* Customer */}
                <Route element={<ProtectedRoute allowedRoles={["customer", "admin"]} />}>
                  <Route path="/customer/browse" element={<CustomerBrowsePage />} />
                  <Route path="/customer/cart" element={<CustomerCartPage />} />
                  <Route path="/customer/orders" element={<CustomerOrdersPage />} />
                </Route>

                {/* Restaurant */}
                <Route element={<ProtectedRoute allowedRoles={["restaurant_owner", "admin"]} />}>
                  <Route path="/restaurant/menu" element={<RestaurantMenuManagementPage />} />
                  <Route path="/restaurant/orders" element={<RestaurantOrdersPage />} />
                </Route>

                {/* Courier */}
                <Route element={<ProtectedRoute allowedRoles={["courier", "admin"]} />}>
                  <Route path="/courier/assignments" element={<CourierAssignmentsPage />} />
                </Route>
              </Route>
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>

          {/* Optional theme toggle (kept small and out of the way) */}
          <button
            className="ui-btn ui-btnGhost"
            onClick={toggleTheme}
            style={{
              position: "fixed",
              right: 14,
              bottom: 14,
              zIndex: 50
            }}
            aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
            title="Toggle theme"
          >
            {theme === "light" ? "Dark" : "Light"}
          </button>
        </BrowserRouter>
      </AuthProvider>
    </div>
  );
}

export default App;
