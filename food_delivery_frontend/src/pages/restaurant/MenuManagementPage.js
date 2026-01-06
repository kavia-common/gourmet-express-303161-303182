import React from "react";

/**
 * PUBLIC_INTERFACE
 * Restaurant Menu Management placeholder.
 */
export function RestaurantMenuManagementPage() {
  return (
    <div className="ui-grid2">
      <div className="ui-card">
        <h2 className="ui-cardTitle">Menus</h2>
        <p className="ui-help">
          Placeholder. This will call <code>/restaurants/&lt;restaurant_id&gt;/menus</code>.
        </p>
      </div>
      <div className="ui-card">
        <h2 className="ui-cardTitle">Menu Items</h2>
        <p className="ui-help">
          Placeholder. This will call <code>/restaurants/&lt;restaurant_id&gt;/menus/&lt;menu_id&gt;/items</code>.
        </p>
      </div>
    </div>
  );
}
