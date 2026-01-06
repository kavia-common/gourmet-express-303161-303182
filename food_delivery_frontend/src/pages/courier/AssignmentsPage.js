import React from "react";

/**
 * PUBLIC_INTERFACE
 * Courier Assignments/Queue placeholder.
 */
export function CourierAssignmentsPage() {
  return (
    <div className="ui-card">
      <h2 className="ui-cardTitle">Assignments / Queue</h2>
      <p className="ui-help">
        Placeholder. Courier actions use:
      </p>
      <ul className="ui-help">
        <li><code>/delivery/orders/&lt;order_id&gt;/accept</code></li>
        <li><code>/delivery/orders/&lt;order_id&gt;/picked-up</code></li>
        <li><code>/delivery/orders/&lt;order_id&gt;/delivered</code></li>
      </ul>
    </div>
  );
}
