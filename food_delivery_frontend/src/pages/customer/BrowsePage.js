import React from "react";

/**
 * PUBLIC_INTERFACE
 * Customer Browse placeholder.
 */
export function CustomerBrowsePage() {
  return (
    <div className="ui-grid2">
      <div className="ui-card">
        <h2 className="ui-cardTitle">Browse Restaurants</h2>
        <p className="ui-help">
          Placeholder. This will call <code>/restaurants</code> and allow filtering/search.
        </p>
      </div>
      <div className="ui-card">
        <h2 className="ui-cardTitle">Restaurant Details</h2>
        <p className="ui-help">
          Placeholder. Selecting a restaurant will show menus and items.
        </p>
      </div>
    </div>
  );
}
