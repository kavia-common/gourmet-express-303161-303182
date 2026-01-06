import React from "react";

/**
 * PUBLIC_INTERFACE
 * Customer Orders/Tracker placeholder.
 */
export function CustomerOrdersPage() {
  return (
    <div className="ui-card">
      <h2 className="ui-cardTitle">Orders / Tracker</h2>
      <p className="ui-help">
        Placeholder. This will list <code>/orders</code> and show order details + tracking.
      </p>
      <p className="ui-help">
        WebSocket prepared: <code>ws://localhost:3001/api/tracking/stream</code>
      </p>
    </div>
  );
}
