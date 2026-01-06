import { apiFetch } from "./client";

/**
 * PUBLIC_INTERFACE
 * Login user and return token response: { access_token, token_type }
 */
export async function loginApi(email, password) {
  return apiFetch(
    "/auth/login",
    {
      method: "POST",
      body: JSON.stringify({ email, password })
    },
    () => null
  );
}

/**
 * PUBLIC_INTERFACE
 * Register user and return created user object.
 */
export async function registerApi(email, password, full_name) {
  return apiFetch(
    "/auth/register",
    {
      method: "POST",
      body: JSON.stringify({ email, password, full_name })
    },
    () => null
  );
}

/**
 * PUBLIC_INTERFACE
 * Fetch current user from token.
 */
export async function meApi(getToken) {
  return apiFetch("/auth/me", { method: "GET" }, getToken);
}
