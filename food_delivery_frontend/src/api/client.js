/**
 * Central API client for the frontend.
 * - Base URL is centralized here.
 * - Automatically attaches Authorization: Bearer <token> when present.
 */

export const API_BASE_URL =
  process.env.REACT_APP_API_BASE ||
  process.env.REACT_APP_BACKEND_URL ||
  "http://localhost:3001";

function buildUrl(path) {
  if (!path.startsWith("/")) return `${API_BASE_URL}/${path}`;
  return `${API_BASE_URL}${path}`;
}

/**
 * PUBLIC_INTERFACE
 * apiFetch wraps fetch() with:
 * - JSON request/response helpers
 * - auth header injection from token getter
 * - normalized errors
 *
 * @param {string} path API path (e.g. "/auth/me")
 * @param {object} options fetch options
 * @param {() => (string|null)} getToken function to read current JWT
 * @returns {Promise<any>} parsed JSON response (or null for 204)
 */
export async function apiFetch(path, options = {}, getToken = () => null) {
  const token = getToken?.();
  const headers = new Headers(options.headers || {});
  headers.set("Accept", "application/json");

  // Set JSON content-type only when body is not FormData and not already set.
  const hasBody = options.body !== undefined && options.body !== null;
  const isFormData = hasBody && typeof FormData !== "undefined" && options.body instanceof FormData;
  if (hasBody && !isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(buildUrl(path), {
    ...options,
    headers
  });

  // Attempt to parse response body (may be empty).
  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const data = isJson ? await res.json().catch(() => null) : await res.text().catch(() => "");

  if (!res.ok) {
    const message =
      (data && typeof data === "object" && (data.detail || data.message)) ||
      (typeof data === "string" && data) ||
      `Request failed with ${res.status}`;
    const err = new Error(message);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  if (res.status === 204) return null;
  return data;
}
