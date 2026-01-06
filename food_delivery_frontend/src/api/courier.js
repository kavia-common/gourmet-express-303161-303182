/**
 * Courier-facing API helpers, aligned to backend OpenAPI.
 *
 * Courier workflow endpoints:
 * - POST /delivery/orders/{order_id}/accept
 * - POST /delivery/orders/{order_id}/picked-up
 * - POST /delivery/orders/{order_id}/delivered
 *
 * Courier order listing:
 * - GET /orders (backend filters based on role; courier should see assigned orders)
 */
import { apiFetch } from "./client";

/** PUBLIC_INTERFACE */
export async function listCourierOrdersApi({ status_filter = null } = {}, getToken) {
  /**
   * List orders visible to the current courier.
   * Backend applies role-based filtering and should return courier-assigned orders.
   */
  const params = new URLSearchParams();
  if (status_filter) params.set("status_filter", status_filter);
  const qs = params.toString();
  return apiFetch(`/orders${qs ? `?${qs}` : ""}`, { method: "GET" }, getToken);
}

/** PUBLIC_INTERFACE */
export async function getOrderApi(orderId, getToken) {
  /** Fetch an order by id (must be authorized for current courier). */
  return apiFetch(`/orders/${orderId}`, { method: "GET" }, getToken);
}

/** PUBLIC_INTERFACE */
export async function courierAcceptAssignmentApi(orderId, { note = null } = {}, getToken) {
  /** Courier accepts a delivery assignment (does not change order status). */
  return apiFetch(
    `/delivery/orders/${orderId}/accept`,
    { method: "POST", body: JSON.stringify({ note }) },
    getToken
  );
}

/** PUBLIC_INTERFACE */
export async function courierMarkPickedUpApi(orderId, { note = null } = {}, getToken) {
  /** Courier marks order as picked up (READY_FOR_PICKUP -> OUT_FOR_DELIVERY). */
  return apiFetch(
    `/delivery/orders/${orderId}/picked-up`,
    { method: "POST", body: JSON.stringify({ note }) },
    getToken
  );
}

/** PUBLIC_INTERFACE */
export async function courierMarkDeliveredApi(orderId, { note = null } = {}, getToken) {
  /** Courier marks order as delivered (OUT_FOR_DELIVERY -> DELIVERED). */
  return apiFetch(
    `/delivery/orders/${orderId}/delivered`,
    { method: "POST", body: JSON.stringify({ note }) },
    getToken
  );
}

