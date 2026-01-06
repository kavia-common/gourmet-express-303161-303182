import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { useCart } from "../../customer/CartContext";
import {
  confirmPaymentApi,
  createCartApi,
  createPaymentIntentApi,
  getOrderApi,
  placeOrderApi,
  removeCartItemApi,
  upsertCartItemApi
} from "../../api/customer";
import { formatMoney } from "../../customer/format";

function makeIdempotencyKey() {
  // Good-enough idempotency key for UI usage.
  return `ui_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

/**
 * PUBLIC_INTERFACE
 * Customer Cart/Checkout.
 *
 * Flow:
 * 1) Use local cart (from browse) as source of truth for item selection.
 * 2) Create server cart (/orders/cart) when starting checkout (requires restaurant_id).
 * 3) Sync items via /orders/{order_id}/cart/items (POST/DELETE).
 * 4) Payment stub: /payments/intent then /payments/confirm.
 * 5) Place order: /orders/{order_id}/place.
 * 6) Redirect to Orders/Tracker for real-time updates.
 */
export function CustomerCartPage() {
  const { getToken } = useAuth();
  const { cart, setItemQuantity, removeItem, totals, resetCart } = useCart();
  const navigate = useNavigate();

  const items = useMemo(() => Object.values(cart.items || {}), [cart.items]);
  const cartReady = Boolean(cart.restaurantId) && items.length > 0;

  const [serverOrder, setServerOrder] = useState(null);
  const [serverOrderLoading, setServerOrderLoading] = useState(false);

  const [paymentState, setPaymentState] = useState({
    intent: null,
    confirming: false,
    placing: false,
    error: "",
    success: ""
  });

  const [syncError, setSyncError] = useState("");

  async function ensureServerCartAndSync() {
    if (!cart.restaurantId) throw new Error("Select a restaurant first (browse and add items).");
    if (items.length === 0) throw new Error("Cart is empty.");

    setServerOrderLoading(true);
    setSyncError("");
    try {
      // Create new cart on server (CREATED).
      const created = await createCartApi(cart.restaurantId, getToken);
      let order = created;

      // Push items to server.
      for (const it of items) {
        order = await upsertCartItemApi(
          created.id,
          { menu_item_id: it.id, quantity: it.quantity },
          getToken
        );
      }

      // If local cart had items removed, server cart doesn't know; but we're creating fresh cart,
      // so no need to delete. (We keep delete functionality for per-line actions below.)
      setServerOrder(order);
      return order;
    } finally {
      setServerOrderLoading(false);
    }
  }

  async function refreshOrder(orderId) {
    const o = await getOrderApi(orderId, getToken);
    setServerOrder(o);
    return o;
  }

  async function onLineQuantityChange(menuItemId, nextQty) {
    setItemQuantity(
      { id: menuItemId, name: cart.items[menuItemId]?.name, price_cents: cart.items[menuItemId]?.price_cents },
      nextQty
    );

    // If we already have a server cart, sync immediately for better accuracy on totals.
    if (!serverOrder?.id) return;

    setSyncError("");
    try {
      if (nextQty <= 0) {
        const updated = await removeCartItemApi(serverOrder.id, { menu_item_id: menuItemId }, getToken);
        setServerOrder(updated);
      } else {
        const updated = await upsertCartItemApi(
          serverOrder.id,
          { menu_item_id: menuItemId, quantity: nextQty },
          getToken
        );
        setServerOrder(updated);
      }
    } catch (err) {
      setSyncError(err?.message || "Failed to sync cart item.");
    }
  }

  async function onRemove(menuItemId) {
    removeItem(menuItemId);
    if (!serverOrder?.id) return;

    setSyncError("");
    try {
      const updated = await removeCartItemApi(serverOrder.id, { menu_item_id: menuItemId }, getToken);
      setServerOrder(updated);
    } catch (err) {
      setSyncError(err?.message || "Failed to remove item from server cart.");
    }
  }

  async function onCheckout() {
    setPaymentState({ intent: null, confirming: false, placing: false, error: "", success: "" });

    try {
      const order = await ensureServerCartAndSync();

      // Create payment intent using server-calculated total (more accurate than UI estimate).
      const intent = await createPaymentIntentApi(
        { order_id: order.id, amount_cents: order.total_cents },
        getToken
      );

      setPaymentState((p) => ({ ...p, intent, success: "Payment intent created (stub). Confirm to pay." }));
      // refresh order after intent (no status change yet)
      await refreshOrder(order.id);
    } catch (err) {
      setPaymentState((p) => ({ ...p, error: err?.message || "Checkout failed." }));
    }
  }

  async function onConfirmPaymentAndPlace() {
    if (!serverOrder?.id) {
      setPaymentState((p) => ({ ...p, error: "Create a checkout session first." }));
      return;
    }
    if (!paymentState.intent?.client_secret) {
      setPaymentState((p) => ({ ...p, error: "Missing client_secret. Create intent again." }));
      return;
    }

    setPaymentState((p) => ({ ...p, confirming: true, error: "", success: "" }));
    try {
      await confirmPaymentApi(
        { order_id: serverOrder.id, client_secret: paymentState.intent.client_secret },
        getToken
      );

      setPaymentState((p) => ({ ...p, confirming: false, placing: true, success: "Payment succeeded. Placing order…" }));

      const idempotency_key = makeIdempotencyKey();
      await placeOrderApi(serverOrder.id, { idempotency_key }, getToken);

      const updated = await refreshOrder(serverOrder.id);
      setPaymentState((p) => ({
        ...p,
        placing: false,
        success: `Order placed. Status: ${updated.status}`
      }));

      // Clear local cart and send user to tracker page for the new order.
      resetCart();
      navigate(`/customer/orders?order=${encodeURIComponent(updated.id)}`);
    } catch (err) {
      setPaymentState((p) => ({
        ...p,
        confirming: false,
        placing: false,
        error: err?.message || "Payment/placement failed."
      }));
    }
  }

  // If local cart becomes empty, clear serverOrder to avoid confusion.
  useEffect(() => {
    if (items.length === 0) setServerOrder(null);
  }, [items.length]);

  const displayCurrency = serverOrder?.currency || totals.currency || "USD";

  return (
    <div className="ui-grid2" style={{ alignItems: "start" }}>
      <div className="ui-card">
        <div className="ui-cardHeader">
          <div>
            <h2 className="ui-cardTitle">Cart</h2>
            <p className="ui-cardSub">
              {cart.restaurantName ? `Restaurant: ${cart.restaurantName}` : "Add items from Browse to start."}
            </p>
          </div>
          <button className="ui-btn ui-btnGhost" onClick={() => navigate("/customer/browse")}>
            Back to browse
          </button>
        </div>

        {syncError ? (
          <div className="ui-alert" role="alert" style={{ marginBottom: 12 }}>
            {syncError}
          </div>
        ) : null}

        {items.length === 0 ? (
          <p className="ui-help" style={{ margin: 0 }}>
            Your cart is empty. Go to Browse to add items.
          </p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {items.map((it) => (
              <div key={it.id} className="ui-card" style={{ padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 900 }}>{it.name}</div>
                    <div className="ui-help" style={{ margin: "4px 0 0 0" }}>
                      Unit: {formatMoney(it.price_cents, it.currency || displayCurrency)}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <button
                      className="ui-btn ui-btnGhost"
                      onClick={() => onLineQuantityChange(it.id, (it.quantity || 0) - 1)}
                      aria-label={`Decrease ${it.name}`}
                      title="Decrease quantity"
                      style={{ boxShadow: "none" }}
                    >
                      −
                    </button>
                    <span className="ui-badge" style={{ minWidth: 44, justifyContent: "center" }}>
                      {it.quantity}
                    </span>
                    <button
                      className="ui-btn ui-btnGhost"
                      onClick={() => onLineQuantityChange(it.id, (it.quantity || 0) + 1)}
                      aria-label={`Increase ${it.name}`}
                      title="Increase quantity"
                      style={{ boxShadow: "none" }}
                    >
                      +
                    </button>

                    <button className="ui-btn" onClick={() => onRemove(it.id)} title="Remove item">
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 12 }}>
          <div className="ui-card" style={{ padding: 12, background: "var(--surface-2)" }}>
            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span className="ui-help" style={{ margin: 0 }}>
                  Subtotal (local)
                </span>
                <span style={{ fontWeight: 900 }}>{formatMoney(totals.subtotal_cents, displayCurrency)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span className="ui-help" style={{ margin: 0 }}>
                  Estimated delivery fee
                </span>
                <span style={{ fontWeight: 900 }}>
                  {formatMoney(totals.estimated_delivery_fee_cents, displayCurrency)}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontWeight: 900 }}>Estimated total</span>
                <span style={{ fontWeight: 900 }}>{formatMoney(totals.estimated_total_cents, displayCurrency)}</span>
              </div>
              <p className="ui-help" style={{ margin: "6px 0 0 0" }}>
                Final totals are computed by the backend during checkout.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="ui-card">
        <div className="ui-cardHeader">
          <div>
            <h2 className="ui-cardTitle">Checkout</h2>
            <p className="ui-cardSub">Payment is a stub (simulated) but uses real backend endpoints.</p>
          </div>
          {serverOrder?.id ? <span className="ui-badge">Cart ID: {serverOrder.id.slice(0, 8)}…</span> : null}
        </div>

        {paymentState.error ? (
          <div className="ui-alert" role="alert" style={{ marginBottom: 12 }}>
            {paymentState.error}
          </div>
        ) : null}

        {paymentState.success ? (
          <div
            className="ui-alert"
            role="status"
            style={{ marginBottom: 12, borderColor: "rgba(6,182,212,0.30)", background: "rgba(6,182,212,0.10)" }}
          >
            {paymentState.success}
          </div>
        ) : null}

        <div className="ui-card" style={{ padding: 12, marginBottom: 12 }}>
          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span className="ui-help" style={{ margin: 0 }}>
                Server status
              </span>
              <span style={{ fontWeight: 900 }}>{serverOrder?.status || "—"}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span className="ui-help" style={{ margin: 0 }}>
                Server total
              </span>
              <span style={{ fontWeight: 900 }}>
                {serverOrder ? formatMoney(serverOrder.total_cents, serverOrder.currency) : "—"}
              </span>
            </div>
          </div>
        </div>

        <button className="ui-btn ui-btnPrimary" disabled={!cartReady || serverOrderLoading} onClick={onCheckout}>
          {serverOrderLoading ? "Preparing checkout…" : cartReady ? "Create payment intent" : "Add items to checkout"}
        </button>

        <div style={{ height: 10 }} />

        <button
          className="ui-btn"
          disabled={!paymentState.intent?.client_secret || paymentState.confirming || paymentState.placing}
          onClick={onConfirmPaymentAndPlace}
        >
          {paymentState.confirming
            ? "Confirming payment…"
            : paymentState.placing
              ? "Placing order…"
              : "Confirm payment & place order"}
        </button>

        {paymentState.intent ? (
          <div className="ui-card" style={{ padding: 12, marginTop: 12 }}>
            <div style={{ fontWeight: 900, marginBottom: 6 }}>Payment intent (stub)</div>
            <div className="ui-help" style={{ margin: 0 }}>
              client_secret: <code>{paymentState.intent.client_secret}</code>
            </div>
            <div className="ui-help" style={{ margin: "6px 0 0 0" }}>
              amount: <code>{paymentState.intent.amount_cents}</code> cents · currency:{" "}
              <code>{paymentState.intent.currency}</code>
            </div>
          </div>
        ) : null}

        <div style={{ marginTop: 12 }}>
          <button className="ui-btn ui-btnGhost" onClick={() => navigate("/customer/orders")}>
            View orders / tracker
          </button>
        </div>
      </div>
    </div>
  );
}

