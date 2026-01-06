import { apiFetch } from "./client";

/**
 * Customer-facing API helpers, aligned to backend OpenAPI.
 * All functions accept getToken to ensure auth is attached.
 */

/** PUBLIC_INTERFACE */
export async function listRestaurantsApi({ q = null, city = null, limit = 20, offset = 0 } = {}, getToken) {
  /** List restaurants (browse/search). */
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (city) params.set("city", city);
  if (limit !== null && limit !== undefined) params.set("limit", String(limit));
  if (offset !== null && offset !== undefined) params.set("offset", String(offset));
  const qs = params.toString();
  return apiFetch(`/restaurants${qs ? `?${qs}` : ""}`, { method: "GET" }, getToken);
}

/** PUBLIC_INTERFACE */
export async function getRestaurantApi(restaurantId, getToken) {
  /** Get a single restaurant by id. */
  return apiFetch(`/restaurants/${restaurantId}`, { method: "GET" }, getToken);
}

/** PUBLIC_INTERFACE */
export async function listMenusByRestaurantApi(restaurantId, { include_inactive = false } = {}, getToken) {
  /** List menus for a restaurant. */
  const params = new URLSearchParams();
  if (include_inactive) params.set("include_inactive", "true");
  const qs = params.toString();
  return apiFetch(`/restaurants/${restaurantId}/menus${qs ? `?${qs}` : ""}`, { method: "GET" }, getToken);
}

/** PUBLIC_INTERFACE */
export async function listMenuItemsApi(
  restaurantId,
  menuId,
  { include_unavailable = false } = {},
  getToken
) {
  /** List items for a menu. */
  const params = new URLSearchParams();
  if (include_unavailable) params.set("include_unavailable", "true");
  const qs = params.toString();
  return apiFetch(
    `/restaurants/${restaurantId}/menus/${menuId}/items${qs ? `?${qs}` : ""}`,
    { method: "GET" },
    getToken
  );
}

/** PUBLIC_INTERFACE */
export async function createCartApi(restaurantId, getToken) {
  /** Create a cart (order in CREATED status) for a restaurant. */
  return apiFetch(
    "/orders/cart",
    {
      method: "POST",
      body: JSON.stringify({ restaurant_id: restaurantId })
    },
    getToken
  );
}

/** PUBLIC_INTERFACE */
export async function getOrderApi(orderId, getToken) {
  /** Fetch an order/cart by id. */
  return apiFetch(`/orders/${orderId}`, { method: "GET" }, getToken);
}

/** PUBLIC_INTERFACE */
export async function upsertCartItemApi(orderId, { menu_item_id, quantity }, getToken) {
  /** Add/update a cart line item (idempotent). */
  return apiFetch(
    `/orders/${orderId}/cart/items`,
    {
      method: "POST",
      body: JSON.stringify({ menu_item_id, quantity })
    },
    getToken
  );
}

/** PUBLIC_INTERFACE */
export async function removeCartItemApi(orderId, { menu_item_id }, getToken) {
  /** Remove a cart line item (idempotent). */
  return apiFetch(
    `/orders/${orderId}/cart/items`,
    {
      method: "DELETE",
      body: JSON.stringify({ menu_item_id })
    },
    getToken
  );
}

/** PUBLIC_INTERFACE */
export async function createPaymentIntentApi({ order_id, amount_cents }, getToken) {
  /** Create a payment intent (stub). */
  return apiFetch(
    "/payments/intent",
    {
      method: "POST",
      body: JSON.stringify({ order_id, amount_cents })
    },
    getToken
  );
}

/** PUBLIC_INTERFACE */
export async function confirmPaymentApi({ order_id, client_secret }, getToken) {
  /** Confirm a payment (stub). */
  return apiFetch(
    "/payments/confirm",
    {
      method: "POST",
      body: JSON.stringify({ order_id, client_secret })
    },
    getToken
  );
}

/** PUBLIC_INTERFACE */
export async function placeOrderApi(orderId, { idempotency_key = null } = {}, getToken) {
  /** Place order (server validates cart and snapshots pricing). */
  return apiFetch(
    `/orders/${orderId}/place`,
    {
      method: "POST",
      body: JSON.stringify({ idempotency_key })
    },
    getToken
  );
}

/** PUBLIC_INTERFACE */
export async function listMyOrdersApi({ status_filter = null } = {}, getToken) {
  /** List current user's orders. */
  const params = new URLSearchParams();
  if (status_filter) params.set("status_filter", status_filter);
  const qs = params.toString();
  return apiFetch(`/orders${qs ? `?${qs}` : ""}`, { method: "GET" }, getToken);
}

/** PUBLIC_INTERFACE */
export async function listTrackingEventsApi(orderId, { limit = 50 } = {}, getToken) {
  /** Fetch persisted tracking events for an order. */
  const params = new URLSearchParams();
  if (limit !== null && limit !== undefined) params.set("limit", String(limit));
  const qs = params.toString();
  return apiFetch(`/tracking/orders/${orderId}/events${qs ? `?${qs}` : ""}`, { method: "GET" }, getToken);
}

