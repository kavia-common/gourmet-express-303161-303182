import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

/**
 * PUBLIC_INTERFACE
 * Login page.
 */
export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(email, password);
      const next = location.state?.from || "/";
      navigate(next, { replace: true });
    } catch (err) {
      setError(err?.message || "Login failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ maxWidth: 520, margin: "40px auto", padding: "0 16px" }}>
      <div className="ui-card">
        <div className="ui-cardHeader">
          <div>
            <h2 className="ui-cardTitle">Sign in</h2>
            <p className="ui-cardSub">Use your Gourmet Express account to continue.</p>
          </div>
          <span className="ui-badge">JWT Session</span>
        </div>

        {error ? <div className="ui-alert" role="alert">{error}</div> : null}

        <form className="ui-form" onSubmit={onSubmit}>
          <div>
            <div className="ui-label">Email</div>
            <input
              className="ui-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
          </div>

          <div>
            <div className="ui-label">Password</div>
            <input
              className="ui-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
              minLength={1}
            />
          </div>

          <button className="ui-btn ui-btnPrimary" disabled={submitting} type="submit">
            {submitting ? "Signing in…" : "Sign in"}
          </button>

          <p className="ui-help" style={{ marginTop: 6 }}>
            New here? <Link to="/register">Create an account</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
