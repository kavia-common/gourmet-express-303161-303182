/**
 * Restaurant-facing API helpers, aligned to backend OpenAPI.
 * All functions accept getToken to ensure auth is attached.
 */
import { apiFetch } from "./client";

/** PUBLIC_INTERFACE */
export async function listRestaurantsApi({ include_inactive = false, limit = 100, offset = 0 } = {}, getToken) {
  /** List restaurants (restaurant_owner will typically only see their own, per backend auth rules). */
  const params = new URLSearchParams();
  if (include_inactive) params.set("include_inactive", "true");
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
export async function listMenusByRestaurantApi(restaurantId, { include_inactive = true } = {}, getToken) {
  /** List menus for a restaurant. Default include_inactive=true for management screens. */
  const params = new URLSearchParams();
  if (include_inactive) params.set("include_inactive", "true");
  const qs = params.toString();
  return apiFetch(`/restaurants/${restaurantId}/menus${qs ? `?${qs}` : ""}`, { method: "GET" }, getToken);
}

/** PUBLIC_INTERFACE */
export async function createMenuApi(restaurantId, { name, description = null, is_active = true }, getToken) {
  /** Create a menu under a restaurant. */
  return apiFetch(
    `/restaurants/${restaurantId}/menus`,
    {
      method: "POST",
      body: JSON.stringify({ name, description, is_active })
    },
    getToken
  );
}

/** PUBLIC_INTERFACE */
export async function updateMenuApi(
  restaurantId,
  menuId,
  { name = null, description = null, is_active = null } = {},
  getToken
) {
  /** Update a menu. Fields are optional per backend MenuUpdate schema. */
  return apiFetch(
    `/restaurants/${restaurantId}/menus/${menuId}`,
    {
      method: "PUT",
      body: JSON.stringify({ name, description, is_active })
    },
    getToken
  );
}

/** PUBLIC_INTERFACE */
export async function deleteMenuApi(restaurantId, menuId, getToken) {
  /** Delete a menu. */
  return apiFetch(`/restaurants/${restaurantId}/menus/${menuId}`, { method: "DELETE" }, getToken);
}

/** PUBLIC_INTERFACE */
export async function listMenuItemsApi(
  restaurantId,
  menuId,
  { include_unavailable = true } = {},
  getToken
) {
  /** List items for a menu. Default include_unavailable=true for management screens. */
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
export async function createMenuItemApi(
  restaurantId,
  menuId,
  {
    name,
    description = null,
    price_cents,
    currency = "USD",
    image_url = null,
    is_available = true
  },
  getToken
) {
  /** Create a menu item under a menu. Backend requires menu_id. */
  return apiFetch(
    `/restaurants/${restaurantId}/menus/${menuId}/items`,
    {
      method: "POST",
      body: JSON.stringify({
        name,
        description,
        price_cents,
        currency,
        image_url,
        is_available,
        menu_id: menuId
      })
    },
    getToken
  );
}

/** PUBLIC_INTERFACE */
export async function updateMenuItemApi(
  restaurantId,
  menuId,
  itemId,
  {
    name = null,
    description = null,
    price_cents = null,
    currency = null,
    image_url = null,
    is_available = null
  } = {},
  getToken
) {
  /** Update a menu item. Fields are optional per backend MenuItemUpdate schema. */
  return apiFetch(
    `/restaurants/${restaurantId}/menus/${menuId}/items/${itemId}`,
    {
      method: "PUT",
      body: JSON.stringify({ name, description, price_cents, currency, image_url, is_available })
    },
    getToken
  );
}

/** PUBLIC_INTERFACE */
export async function deleteMenuItemApi(restaurantId, menuId, itemId, getToken) {
  /** Delete a menu item. */
  return apiFetch(`/restaurants/${restaurantId}/menus/${menuId}/items/${itemId}`, { method: "DELETE" }, getToken);
}

/** PUBLIC_INTERFACE */
export async function listMyOrdersApi({ status_filter = null } = {}, getToken) {
  /**
   * List orders visible to the current user. For restaurant_owner, backend should return restaurant-scoped orders.
   * (This reuses /orders which is also used by customers; backend applies role-based filtering.)
   */
  const params = new URLSearchParams();
  if (status_filter) params.set("status_filter", status_filter);
  const qs = params.toString();
  return apiFetch(`/orders${qs ? `?${qs}` : ""}`, { method: "GET" }, getToken);
}

/** PUBLIC_INTERFACE */
export async function getOrderApi(orderId, getToken) {
  /** Fetch an order by id. */
  return apiFetch(`/orders/${orderId}`, { method: "GET" }, getToken);
}

/** PUBLIC_INTERFACE */
export async function updateOrderStatusApi(orderId, status, getToken) {
  /** Transition an order to a new status using /orders/{order_id}/status. */
  return apiFetch(
    `/orders/${orderId}/status`,
    {
      method: "POST",
      body: JSON.stringify({ status })
    },
    getToken
  );
}

