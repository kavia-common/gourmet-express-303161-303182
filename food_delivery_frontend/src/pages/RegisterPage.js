import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { registerApi } from "../api/auth";

/**
 * PUBLIC_INTERFACE
 * Register page.
 */
export function RegisterPage() {
  const navigate = useNavigate();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    setSuccess(false);

    try {
      await registerApi(email, password, fullName || null);
      setSuccess(true);
      // Let user see success briefly then route to login.
      setTimeout(() => navigate("/login", { replace: true }), 600);
    } catch (err) {
      setError(err?.message || "Registration failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ maxWidth: 520, margin: "40px auto", padding: "0 16px" }}>
      <div className="ui-card">
        <div className="ui-cardHeader">
          <div>
            <h2 className="ui-cardTitle">Create account</h2>
            <p className="ui-cardSub">Registers as a customer by default.</p>
          </div>
          <span className="ui-badge">/auth/register</span>
        </div>

        {error ? <div className="ui-alert" role="alert">{error}</div> : null}
        {success ? (
          <div
            className="ui-alert"
            role="status"
            style={{ borderColor: "rgba(6,182,212,0.30)", background: "rgba(6,182,212,0.10)" }}
          >
            Account created. Redirecting to login…
          </div>
        ) : null}

        <form className="ui-form" onSubmit={onSubmit}>
          <div>
            <div className="ui-label">Full name (optional)</div>
            <input
              className="ui-input"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Jane Doe"
              autoComplete="name"
            />
          </div>

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
              placeholder="Min 8 characters"
              required
              autoComplete="new-password"
              minLength={8}
            />
            <p className="ui-help">Backend requires minimum 8 characters.</p>
          </div>

          <button className="ui-btn ui-btnPrimary" disabled={submitting} type="submit">
            {submitting ? "Creating…" : "Create account"}
          </button>

          <p className="ui-help" style={{ marginTop: 6 }}>
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
