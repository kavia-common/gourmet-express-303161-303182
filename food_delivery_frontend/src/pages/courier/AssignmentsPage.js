import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { createTrackingSocket } from "../../ws/trackingClient";
import {
  courierAcceptAssignmentApi,
  courierMarkDeliveredApi,
  courierMarkPickedUpApi,
  getOrderApi,
  listCourierOrdersApi
} from "../../api/courier";
import { listTrackingEventsApi } from "../../api/customer";
import { formatMoney, statusLabel } from "../../customer/format";

function normalizeError(err) {
  return err?.message || "Request failed.";
}

function sortNewestFirst(a, b) {
  return a?.created_at < b?.created_at ? 1 : -1;
}

function isActiveCourierOrder(status) {
  return status !== "DELIVERED" && status !== "CANCELED";
}

function allowedCourierActions(order) {
  /**
   * Backend enforces final authority (role + transition rules).
   * UI offers the common courier flow:
   * - Accept assignment (anytime when assigned, but typically before pickup)
   * - Picked up: READY_FOR_PICKUP -> OUT_FOR_DELIVERY
   * - Delivered: OUT_FOR_DELIVERY -> DELIVERED
   */
  const status = order?.status;
  if (!status) return [];

  if (status === "READY_FOR_PICKUP") return ["ACCEPT", "PICKED_UP"];
  if (status === "OUT_FOR_DELIVERY") return ["DELIVERED"];
  // Other states are not actionable for courier in this simplified UI.
  return [];
}

/**
 * PUBLIC_INTERFACE
 * Courier Assignments / Queue
 *
 * - Lists orders visible to courier (typically assigned orders)
 * - Allows courier actions:
 *   - Accept assignment
 *   - Mark picked up
 *   - Mark delivered
 * - Loads tracking history (REST) and subscribes to WebSocket for live updates
 */
export function CourierAssignmentsPage() {
  const { getToken, token } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedOrderId = searchParams.get("order") || "";

  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState("");

  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderError, setOrderError] = useState("");

  const [events, setEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState("");

  const [wsState, setWsState] = useState({ status: "disconnected", lastMessageAt: null, error: "" });
  const socketRef = useRef(null);

  const [note, setNote] = useState("");
  const [actionState, setActionState] = useState({ busy: false, error: "", success: "" });

  const activeOrders = useMemo(() => orders.slice().sort(sortNewestFirst), [orders]);

  const selectedActions = useMemo(() => allowedCourierActions(selectedOrder), [selectedOrder]);

  const lastKnownLocation = useMemo(() => {
    const latestWithLoc = [...events].reverse().find((e) => e?.latitude != null && e?.longitude != null);
    if (!latestWithLoc) return null;
    return { latitude: latestWithLoc.latitude, longitude: latestWithLoc.longitude };
  }, [events]);

  function selectOrder(orderId) {
    const next = new URLSearchParams(searchParams);
    if (orderId) next.set("order", orderId);
    else next.delete("order");
    setSearchParams(next);
  }

  async function refreshOrders({ keepSelection = true } = {}) {
    setOrdersLoading(true);
    setOrdersError("");
    try {
      const res = await listCourierOrdersApi({}, getToken);
      const list = Array.isArray(res) ? res.slice() : [];
      list.sort(sortNewestFirst);
      setOrders(list);

      if (!keepSelection) return;

      // If none selected, prefer first active order.
      if (!selectedOrderId && list.length > 0) {
        const firstActive = list.find((o) => isActiveCourierOrder(o.status)) || list[0];
        selectOrder(firstActive.id);
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

  // Load selected order + tracking history (REST)
  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!selectedOrderId) {
        setSelectedOrder(null);
        setEvents([]);
        setOrderError("");
        setEventsError("");
        return;
      }

      setOrderLoading(true);
      setOrderError("");
      setEventsLoading(true);
      setEventsError("");

      try {
        const [o, ev] = await Promise.all([
          getOrderApi(selectedOrderId, getToken),
          listTrackingEventsApi(selectedOrderId, { limit: 100 }, getToken)
        ]);
        if (cancelled) return;

        setSelectedOrder(o);
        const list = Array.isArray(ev) ? ev : [];
        list.sort((a, b) => (a.created_at > b.created_at ? 1 : -1));
        setEvents(list);
      } catch (err) {
        if (!cancelled) {
          setOrderError(normalizeError(err));
          setEventsError(normalizeError(err));
        }
      } finally {
        if (!cancelled) {
          setOrderLoading(false);
          setEventsLoading(false);
        }
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [selectedOrderId, getToken]);

  // WebSocket: connect once and resubscribe when order selection changes.
  useEffect(() => {
    if (!token) return;

    function cleanup() {
      try {
        socketRef.current?.close?.();
      } catch {
        // ignore
      }
      socketRef.current = null;
    }

    cleanup();

    const client = createTrackingSocket({
      token,
      onOpen: () => setWsState({ status: "connected", lastMessageAt: null, error: "" }),
      onClose: () => setWsState((p) => ({ ...p, status: "disconnected" })),
      onError: () => setWsState((p) => ({ ...p, status: "error", error: "WebSocket error" })),
      onMessage: (event) => {
        setWsState((p) => ({ ...p, lastMessageAt: new Date().toISOString() }));
        try {
          const msg = JSON.parse(event.data);
          if (msg && typeof msg === "object" && (msg.order_id || msg.status)) {
            // Only append events for the currently selected order (when order_id is provided).
            if (msg.order_id && selectedOrderId && msg.order_id !== selectedOrderId) return;

            setEvents((prev) => {
              if (msg.id && prev.some((x) => x.id === msg.id)) return prev;
              const next = [...prev, msg];
              next.sort((a, b) => (a.created_at > b.created_at ? 1 : -1));
              return next;
            });
          }
        } catch {
          // ignore non-json
        }
      }
    });

    socketRef.current = client;
    return () => cleanup();
  }, [token, selectedOrderId]);

  // Subscribe when order changes and socket is present.
  useEffect(() => {
    if (!selectedOrderId) return;
    if (!socketRef.current?.subscribeToOrder) return;
    socketRef.current.subscribeToOrder(selectedOrderId);
  }, [selectedOrderId, wsState.status]);

  async function runAction(kind) {
    if (!selectedOrder?.id) return;

    setActionState({ busy: true, error: "", success: "" });
    try {
      let updated;
      if (kind === "ACCEPT") updated = await courierAcceptAssignmentApi(selectedOrder.id, { note: note || null }, getToken);
      else if (kind === "PICKED_UP")
        updated = await courierMarkPickedUpApi(selectedOrder.id, { note: note || null }, getToken);
      else if (kind === "DELIVERED")
        updated = await courierMarkDeliveredApi(selectedOrder.id, { note: note || null }, getToken);
      else throw new Error("Unknown action");

      setSelectedOrder(updated);

      // Update list cache for snappy UI.
      setOrders((prev) =>
        prev.map((o) => (o.id === updated.id ? { ...o, status: updated.status, updated_at: updated.updated_at } : o))
      );

      setActionState({ busy: false, error: "", success: `Updated → ${statusLabel(updated.status)}` });

      // Refresh list for correctness.
      await refreshOrders({ keepSelection: true });

      // If this order is now inactive, auto-select another active order.
      if (!isActiveCourierOrder(updated.status)) {
        const nextActive = activeOrders.find((o) => o.id !== updated.id && isActiveCourierOrder(o.status));
        if (nextActive?.id) selectOrder(nextActive.id);
      }
    } catch (err) {
      setActionState({ busy: false, error: normalizeError(err), success: "" });
    }
  }

  return (
    <div className="ui-grid2" style={{ alignItems: "start" }}>
      <div className="ui-card">
        <div className="ui-cardHeader">
          <div>
            <h2 className="ui-cardTitle">My Delivery Queue</h2>
            <p className="ui-cardSub">Orders assigned to you (or visible to your courier role).</p>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <span className="ui-badge" title="WebSocket connection status">
              WS: {wsState.status}
            </span>
            <button
              className="ui-btn ui-btnGhost"
              onClick={() => refreshOrders({ keepSelection: true })}
              style={{ boxShadow: "none" }}
            >
              Refresh
            </button>
          </div>
        </div>

        {ordersError ? (
          <div className="ui-alert" role="alert" style={{ marginBottom: 12 }}>
            {ordersError}
          </div>
        ) : null}

        {ordersLoading ? (
          <p className="ui-help" style={{ margin: 0 }}>
            Loading deliveries…
          </p>
        ) : activeOrders.length === 0 ? (
          <p className="ui-help" style={{ margin: 0 }}>
            No deliveries found. Once a restaurant/admin assigns you an order, it will appear here.
          </p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {activeOrders.map((o) => {
              const active = o.id === selectedOrderId;
              return (
                <button
                  key={o.id}
                  className="ui-btn"
                  onClick={() => selectOrder(o.id)}
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
                      <div className="ui-help" style={{ margin: "6px 0 0 0" }}>
                        Courier: {o.courier_user_id ? `User #${o.courier_user_id}` : "Not assigned"}
                      </div>
                    </div>
                    <span className="ui-badge">{o.status}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <div style={{ marginTop: 12 }}>
          <p className="ui-help" style={{ margin: 0 }}>
            WS last message:{" "}
            <strong>{wsState.lastMessageAt ? new Date(wsState.lastMessageAt).toLocaleTimeString() : "—"}</strong>
          </p>
          {wsState.error ? (
            <p className="ui-help" style={{ margin: "6px 0 0 0", color: "var(--danger)" }}>
              {wsState.error}
            </p>
          ) : null}
        </div>
      </div>

      <div className="ui-card">
        <div className="ui-cardHeader">
          <div>
            <h2 className="ui-cardTitle">Delivery Details</h2>
            <p className="ui-cardSub">Take actions and watch live tracking updates.</p>
          </div>
          {selectedOrder?.id ? (
            <span className="ui-badge" title="Selected order id">
              {selectedOrder.id.slice(0, 8)}…
            </span>
          ) : (
            <span className="ui-badge">No order</span>
          )}
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
            Select a delivery from the left to view details.
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
                    Courier
                  </span>
                  <span style={{ fontWeight: 900 }}>
                    {selectedOrder.courier_user_id ? `User #${selectedOrder.courier_user_id}` : "Not assigned"}
                  </span>
                </div>
                {lastKnownLocation ? (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span className="ui-help" style={{ margin: 0 }}>
                      Last location
                    </span>
                    <span style={{ fontWeight: 900 }}>
                      {Number(lastKnownLocation.latitude).toFixed(5)}, {Number(lastKnownLocation.longitude).toFixed(5)}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 900, marginBottom: 8 }}>Courier note (optional)</div>
              <textarea
                className="ui-input"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder="e.g. Pickup at back entrance / Left at front desk"
                style={{ width: "100%", resize: "vertical" }}
              />
              <p className="ui-help" style={{ margin: "8px 0 0 0" }}>
                Notes are sent with courier actions (accept/pickup/delivered) when supported.
              </p>
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 900, marginBottom: 8 }}>Actions</div>
              {selectedActions.length === 0 ? (
                <p className="ui-help" style={{ margin: 0 }}>
                  No actions available for this status.
                </p>
              ) : (
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {selectedActions.includes("ACCEPT") ? (
                    <button
                      className="ui-btn ui-btnPrimary"
                      disabled={actionState.busy}
                      onClick={() => runAction("ACCEPT")}
                      title="Accept this assignment"
                    >
                      {actionState.busy ? "Working…" : "Accept assignment"}
                    </button>
                  ) : null}
                  {selectedActions.includes("PICKED_UP") ? (
                    <button
                      className="ui-btn ui-btnPrimary"
                      disabled={actionState.busy}
                      onClick={() => runAction("PICKED_UP")}
                      title="Mark as picked up"
                    >
                      {actionState.busy ? "Working…" : "Mark picked up"}
                    </button>
                  ) : null}
                  {selectedActions.includes("DELIVERED") ? (
                    <button
                      className="ui-btn ui-btnPrimary"
                      disabled={actionState.busy}
                      onClick={() => runAction("DELIVERED")}
                      title="Mark as delivered"
                    >
                      {actionState.busy ? "Working…" : "Mark delivered"}
                    </button>
                  ) : null}
                </div>
              )}
              <p className="ui-help" style={{ margin: "10px 0 0 0" }}>
                Common flow: <code>READY_FOR_PICKUP</code> → <code>OUT_FOR_DELIVERY</code> → <code>DELIVERED</code>.
              </p>
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
              <div style={{ fontWeight: 900, marginBottom: 8 }}>Tracking updates</div>

              {eventsError ? (
                <div className="ui-alert" role="alert" style={{ marginBottom: 12 }}>
                  {eventsError}
                </div>
              ) : null}

              {eventsLoading ? (
                <p className="ui-help" style={{ margin: 0 }}>
                  Loading tracking history…
                </p>
              ) : events.length === 0 ? (
                <p className="ui-help" style={{ margin: 0 }}>
                  No tracking events yet. New updates will appear here in real time.
                </p>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {events
                    .slice()
                    .reverse()
                    .map((e, idx) => (
                      <div key={e.id || `${e.created_at || idx}`} className="ui-card" style={{ padding: 12 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 900 }}>{e.status || "Update"}</div>
                            <div className="ui-help" style={{ margin: "4px 0 0 0" }}>
                              {e.note || "—"}
                            </div>
                            <div className="ui-help" style={{ margin: "6px 0 0 0" }}>
                              {e.created_at ? new Date(e.created_at).toLocaleString() : "Live update"}
                            </div>
                          </div>
                          {e.latitude != null && e.longitude != null ? (
                            <span className="ui-badge" title="Location">
                              {Number(e.latitude).toFixed(3)},{Number(e.longitude).toFixed(3)}
                            </span>
                          ) : (
                            <span className="ui-badge" title="No location payload">
                              —
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

