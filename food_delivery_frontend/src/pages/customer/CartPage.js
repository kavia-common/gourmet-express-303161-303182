import React from "react";

/**
 * PUBLIC_INTERFACE
 * Customer Cart/Checkout placeholder.
 */
export function CustomerCartPage() {
  return (
    <div className="ui-grid2">
      <div className="ui-card">
        <h2 className="ui-cardTitle">Cart</h2>
        <p className="ui-help">
          Placeholder. This will use <code>/orders/cart</code> and <code>/orders/&lt;id&gt;/cart/items</code>.
        </p>
      </div>
      <div className="ui-card">
        <h2 className="ui-cardTitle">Checkout</h2>
        <p className="ui-help">
          Placeholder. This will call <code>/payments/intent</code> then <code>/payments/confirm</code>, and finally <code>/orders/&lt;id&gt;/place</code>.
        </p>
      </div>
    </div>
  );
}
