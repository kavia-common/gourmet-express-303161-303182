import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { getOrderApi, listMyOrdersApi, updateOrderStatusApi } from "../../api/restaurant";
import { formatMoney, statusLabel } from "../../customer/format";

function normalizeError(err) {
  return err?.message || "Request failed.";
}

function isActiveRestaurantOrder(status) {
  return status !== "DELIVERED" && status !== "CANCELED";
}

function sortNewestFirst(a, b) {
  return a?.created_at < b?.created_at ? 1 : -1;
}

function allowedNextStatuses(status) {
  // Backend enforces role + transition rules. UI exposes the common restaurant flow.
  if (status === "PAID") return ["PREPARING", "CANCELED"];
  if (status === "PREPARING") return ["READY_FOR_PICKUP", "CANCELED"];
  if (status === "READY_FOR_PICKUP") return []; // Courier takes over.
  if (status === "CREATED") return []; // Customers are still checking out.
  if (status === "OUT_FOR_DELIVERY") return [];
  if (status === "DELIVERED") return [];
  if (status === "CANCELED") return [];
  return [];
}

/**
 * PUBLIC_INTERFACE
 * Restaurant Orders
 * - Lists orders visible to restaurant owner
 * - Shows order details and items
 * - Allows permitted status transitions (PAID -> PREPARING -> READY_FOR_PICKUP)
 */
export function RestaurantOrdersPage() {
  const { getToken } = useAuth();

  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState("");

  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderError, setOrderError] = useState("");

  const [actionState, setActionState] = useState({ busy: false, error: "", success: "" });

  const activeOrders = useMemo(() => {
    const list = orders.slice().sort(sortNewestFirst);
    return list;
  }, [orders]);

  const selectedAllowedTransitions = useMemo(
    () => allowedNextStatuses(selectedOrder?.status),
    [selectedOrder?.status]
  );

  async function refreshOrders({ keepSelection = true } = {}) {
    setOrdersLoading(true);
    setOrdersError("");
    try {
      const res = await listMyOrdersApi({}, getToken);
      const list = Array.isArray(res) ? res.slice() : [];
      list.sort(sortNewestFirst);
      setOrders(list);

      if (!keepSelection) return;

      // Auto-select an active order when none selected.
      if (!selectedOrderId && list.length > 0) {
        const firstActive = list.find((o) => isActiveRestaurantOrder(o.status)) || list[0];
        setSelectedOrderId(firstActive.id);
      }
    } catch (err) {
      setOrdersError(normalizeError(err));
    } finally {
      setOrdersLoading(false);
    }
  }

  // Initial load
  useEffect(() => {
    refreshOrders({ keepSelection: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getToken]);

  // Load selected order details
  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!selectedOrderId) {
        setSelectedOrder(null);
        setOrderError("");
        return;
      }
      setOrderLoading(true);
      setOrderError("");
      try {
        const o = await getOrderApi(selectedOrderId, getToken);
        if (!cancelled) setSelectedOrder(o);
      } catch (err) {
        if (!cancelled) setOrderError(normalizeError(err));
      } finally {
        if (!cancelled) setOrderLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [selectedOrderId, getToken]);

  async function onTransition(nextStatus) {
    if (!selectedOrder?.id) return;

    setActionState({ busy: true, error: "", success: "" });
    try {
      const updated = await updateOrderStatusApi(selectedOrder.id, nextStatus, getToken);
      setSelectedOrder(updated);

      // Update list cache in-place for a snappy UI.
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? { ...o, status: updated.status, updated_at: updated.updated_at } : o)));

      setActionState({ busy: false, error: "", success: `Order updated → ${statusLabel(updated.status)}` });

      // If order is no longer active, auto-select next active one.
      if (!isActiveRestaurantOrder(updated.status)) {
        const nextActive = activeOrders.find((o) => o.id !== updated.id && isActiveRestaurantOrder(o.status));
        if (nextActive?.id) setSelectedOrderId(nextActive.id);
      }

      // Re-fetch list for correctness (in case backend filters or additional fields changed).
      await refreshOrders({ keepSelection: true });
    } catch (err) {
      setActionState({ busy: false, error: normalizeError(err), success: "" });
    }
  }

  return (
    <div className="ui-grid2" style={{ alignItems: "start" }}>
      <div className="ui-card">
        <div className="ui-cardHeader">
          <div>
            <h2 className="ui-cardTitle">Incoming Orders</h2>
            <p className="ui-cardSub">Manage order preparation status for your restaurant.</p>
          </div>
          <button className="ui-btn ui-btnGhost" onClick={() => refreshOrders({ keepSelection: true })} style={{ boxShadow: "none" }}>
            Refresh
          </button>
        </div>

        {ordersError ? (
          <div className="ui-alert" role="alert" style={{ marginBottom: 12 }}>
            {ordersError}
          </div>
        ) : null}

        {ordersLoading ? (
          <p className="ui-help" style={{ margin: 0 }}>
            Loading orders…
          </p>
        ) : activeOrders.length === 0 ? (
          <p className="ui-help" style={{ margin: 0 }}>
            No orders yet. Orders will appear here after customers place them.
          </p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {activeOrders.map((o) => {
              const active = o.id === selectedOrderId;
              return (
                <button
                  key={o.id}
                  className="ui-btn"
                  onClick={() => setSelectedOrderId(o.id)}
                  style={{
                    textAlign: "left",
                    background: active ? "rgba(59,130,246,0.08)" : "var(--surface)"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 900 }}>
                        Order {o.id.slice(0, 8)}… · {statusLabel(o.status)}
                      </div>
                      <div className="ui-help" style={{ margin: "4px 0 0 0" }}>
                        Total: {formatMoney(o.total_cents, o.currency)} · Items: {(o.items || []).length} ·{" "}
                        {o.created_at ? new Date(o.created_at).toLocaleString() : "—"}
                      </div>
                    </div>
                    <span className="ui-badge">{o.status}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="ui-card">
        <div className="ui-cardHeader">
          <div>
            <h2 className="ui-cardTitle">Order Details</h2>
            <p className="ui-cardSub">Review items and advance the order when ready.</p>
          </div>
          {selectedOrder?.id ? <span className="ui-badge">{selectedOrder.id.slice(0, 8)}…</span> : <span className="ui-badge">No order</span>}
        </div>

        {actionState.error ? (
          <div className="ui-alert" role="alert" style={{ marginBottom: 12 }}>
            {actionState.error}
          </div>
        ) : null}
        {actionState.success ? (
          <div
            className="ui-alert"
            role="status"
            style={{ marginBottom: 12, borderColor: "rgba(6,182,212,0.30)", background: "rgba(6,182,212,0.10)" }}
          >
            {actionState.success}
          </div>
        ) : null}

        {!selectedOrderId ? (
          <p className="ui-help" style={{ margin: 0 }}>
            Select an order from the left to view details.
          </p>
        ) : orderLoading ? (
          <p className="ui-help" style={{ margin: 0 }}>
            Loading order details…
          </p>
        ) : orderError ? (
          <div className="ui-alert" role="alert">
            {orderError}
          </div>
        ) : selectedOrder ? (
          <>
            <div className="ui-card" style={{ padding: 12, marginBottom: 12, background: "var(--surface-2)" }}>
              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span className="ui-help" style={{ margin: 0 }}>
                    Status
                  </span>
                  <span style={{ fontWeight: 900 }}>{statusLabel(selectedOrder.status)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span className="ui-help" style={{ margin: 0 }}>
                    Total
                  </span>
                  <span style={{ fontWeight: 900 }}>{formatMoney(selectedOrder.total_cents, selectedOrder.currency)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span className="ui-help" style={{ margin: 0 }}>
                    Courier assigned
                  </span>
                  <span style={{ fontWeight: 900 }}>
                    {selectedOrder.courier_user_id ? `User #${selectedOrder.courier_user_id}` : "Not yet"}
                  </span>
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 900, marginBottom: 8 }}>Items</div>
              {(selectedOrder.items || []).length === 0 ? (
                <p className="ui-help" style={{ margin: 0 }}>
                  No items in order.
                </p>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {(selectedOrder.items || []).map((it) => (
                    <div key={it.id} className="ui-card" style={{ padding: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 900 }}>{it.name}</div>
                          <div className="ui-help" style={{ margin: "4px 0 0 0" }}>
                            Qty: {it.quantity} · Unit: {formatMoney(it.unit_price_cents, it.currency)}
                          </div>
                        </div>
                        <span className="ui-badge">{formatMoney(it.unit_price_cents * it.quantity, it.currency)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div style={{ fontWeight: 900, marginBottom: 8 }}>Actions</div>
              {selectedAllowedTransitions.length === 0 ? (
                <p className="ui-help" style={{ margin: 0 }}>
                  No actions available for this status.
                </p>
              ) : (
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {selectedAllowedTransitions.map((s) => (
                    <button
                      key={s}
                      className={`ui-btn ${s === "READY_FOR_PICKUP" || s === "PREPARING" ? "ui-btnPrimary" : ""}`}
                      disabled={actionState.busy}
                      onClick={() => onTransition(s)}
                      title={`Set status to ${s}`}
                    >
                      {actionState.busy ? "Updating…" : `Set ${s}`}
                    </button>
                  ))}
                </div>
              )}
              <p className="ui-help" style={{ margin: "10px 0 0 0" }}>
                Common flow: <code>PAID</code> → <code>PREPARING</code> → <code>READY_FOR_PICKUP</code>.
              </p>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

