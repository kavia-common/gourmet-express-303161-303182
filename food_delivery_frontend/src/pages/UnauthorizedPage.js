import React from "react";
import { Link } from "react-router-dom";

/**
 * PUBLIC_INTERFACE
 * Unauthorized page.
 */
export function UnauthorizedPage() {
  return (
    <div className="ui-card" style={{ maxWidth: 720, margin: "20px auto" }}>
      <h2 className="ui-cardTitle">Unauthorized</h2>
      <p className="ui-help">
        Your account does not have permission to access this page.
      </p>
      <p className="ui-help">
        Go back to <Link to="/">dashboard</Link>.
      </p>
    </div>
  );
}
