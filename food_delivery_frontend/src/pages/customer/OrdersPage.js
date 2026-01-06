import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { createTrackingSocket } from "../../ws/trackingClient";
import { getOrderApi, listMyOrdersApi, listTrackingEventsApi } from "../../api/customer";
import { formatMoney, statusLabel } from "../../customer/format";

/**
 * PUBLIC_INTERFACE
 * Customer Orders / Tracker
 *
 * - Lists user's orders
 * - Select an order to see details
 * - Loads persisted tracking events via REST
 * - Connects to WebSocket stream and subscribes to the selected order for live updates
 */
export function CustomerOrdersPage() {
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

  const orderCurrency = selectedOrder?.currency || "USD";

  const lastKnownLocation = useMemo(() => {
    const latestWithLoc = [...events].reverse().find((e) => e?.latitude != null && e?.longitude != null);
    if (!latestWithLoc) return null;
    return { latitude: latestWithLoc.latitude, longitude: latestWithLoc.longitude };
  }, [events]);

  // Load orders list.
  useEffect(() => {
    let cancelled = false;
    async function run() {
      setOrdersLoading(true);
      setOrdersError("");
      try {
        const res = await listMyOrdersApi({}, getToken);
        if (!cancelled) {
          const list = Array.isArray(res) ? res : [];
          // Sort newest first
          list.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
          setOrders(list);

          // If URL doesn't specify an order, pick the most recent active one.
          if (!selectedOrderId && list.length > 0) {
            const active = list.find((o) => o.status !== "DELIVERED" && o.status !== "CANCELED") || list[0];
            const next = new URLSearchParams(searchParams);
            next.set("order", active.id);
            setSearchParams(next, { replace: true });
          }
        }
      } catch (err) {
        if (!cancelled) setOrdersError(err?.message || "Failed to load orders.");
      } finally {
        if (!cancelled) setOrdersLoading(false);
      }
    }
    run();
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
        // Events already chronological, but ensure it.
        list.sort((a, b) => (a.created_at > b.created_at ? 1 : -1));
        setEvents(list);
      } catch (err) {
        if (!cancelled) {
          setOrderError(err?.message || "Failed to load order.");
          setEventsError(err?.message || "Failed to load tracking history.");
        }
      } finally {
        if (!cancelled) {
          setOrderLoading(false);
          setEventsLoading(false);
        }
      }
    }

    run();
  }, [selectedOrderId, getToken]);

  // WebSocket: connect once and re-subscribe whenever order selection changes.
  useEffect(() => {
    if (!token) return;

    // Always reset any existing socket on mount/cleanup
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
          // Backend is expected to send tracking events as objects.
          if (msg && typeof msg === "object" && (msg.order_id || msg.status)) {
            setEvents((prev) => {
              // Basic de-dup by id when available.
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
  }, [token]);

  // Subscribe when order changes and socket is present.
  useEffect(() => {
    if (!selectedOrderId) return;
    if (!socketRef.current?.subscribeToOrder) return;

    // If socket isn't open yet, we still try (server may queue); harmless if it fails.
    socketRef.current.subscribeToOrder(selectedOrderId);
  }, [selectedOrderId, wsState.status]);

  function selectOrder(orderId) {
    const next = new URLSearchParams(searchParams);
    if (orderId) next.set("order", orderId);
    else next.delete("order");
    setSearchParams(next);
  }

  return (
    <div className="ui-grid2" style={{ alignItems: "start" }}>
      <div className="ui-card">
        <div className="ui-cardHeader">
          <div>
            <h2 className="ui-cardTitle">My Orders</h2>
            <p className="ui-cardSub">Select an order to view tracking updates.</p>
          </div>
          <span className="ui-badge" title="WebSocket connection status">
            WS: {wsState.status}
          </span>
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
        ) : orders.length === 0 ? (
          <p className="ui-help" style={{ margin: 0 }}>
            No orders yet. Place an order from Cart / Checkout.
          </p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {orders.map((o) => {
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
                        {new Date(o.created_at).toLocaleString()}
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
            <h2 className="ui-cardTitle">Order Tracker</h2>
            <p className="ui-cardSub">Live status/location updates for the selected order.</p>
          </div>
          {selectedOrder ? (
            <span className="ui-badge" title="Selected order id">
              {selectedOrder.id.slice(0, 8)}…
            </span>
          ) : null}
        </div>

        {orderError ? (
          <div className="ui-alert" role="alert" style={{ marginBottom: 12 }}>
            {orderError}
          </div>
        ) : null}

        {!selectedOrderId ? (
          <p className="ui-help" style={{ margin: 0 }}>
            Select an order from the left to see details.
          </p>
        ) : orderLoading ? (
          <p className="ui-help" style={{ margin: 0 }}>
            Loading order details…
          </p>
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
                  <span style={{ fontWeight: 900 }}>{formatMoney(selectedOrder.total_cents, orderCurrency)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span className="ui-help" style={{ margin: 0 }}>
                    Courier
                  </span>
                  <span style={{ fontWeight: 900 }}>
                    {selectedOrder.courier_user_id ? `User #${selectedOrder.courier_user_id}` : "Not assigned yet"}
                  </span>
                </div>
                {lastKnownLocation ? (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span className="ui-help" style={{ margin: 0 }}>
                      Last location
                    </span>
                    <span style={{ fontWeight: 900 }}>
                      {lastKnownLocation.latitude.toFixed(5)}, {lastKnownLocation.longitude.toFixed(5)}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>

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
                No tracking events yet. Updates will appear here when the restaurant/courier publishes tracking.
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
          </>
        ) : null}
      </div>
    </div>
  );
}

