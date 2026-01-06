import React from "react";

/**
 * PUBLIC_INTERFACE
 * Restaurant Orders placeholder.
 */
export function RestaurantOrdersPage() {
  return (
    <div className="ui-card">
      <h2 className="ui-cardTitle">Restaurant Orders</h2>
      <p className="ui-help">
        Placeholder. This will use <code>/orders</code> and <code>/orders/&lt;id&gt;/status</code> transitions (PAID → PREPARING → READY_FOR_PICKUP).
      </p>
    </div>
  );
}
