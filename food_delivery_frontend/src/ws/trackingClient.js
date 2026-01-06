/**
 * WebSocket client helper for order tracking.
 *
 * Backend contract:
 * - WebSocket endpoint: ws(s)://<backend-host>/tracking/ws/orders/{order_id}?token=<jwt>
 * - Server messages are JSON strings (see TrackingMessage in backend services/tracking_broker.py)
 *
 * Env:
 * - REACT_APP_WS_URL (preferred) can be either:
 *     - ws://localhost:3001   (base)
 *     - ws://localhost:3001/tracking  (base path)
 *     - ws://localhost:3001/tracking/ws (base path)
 *   We will normalize it and append /orders/{orderId}.
 * - REACT_APP_BACKEND_URL / REACT_APP_API_BASE (http/https) will be converted to ws/wss.
 */

function toWsBaseFromHttp(base) {
  let wsBase = base;
  if (wsBase.startsWith("https://")) wsBase = wsBase.replace("https://", "wss://");
  else if (wsBase.startsWith("http://")) wsBase = wsBase.replace("http://", "ws://");
  return wsBase.replace(/\/$/, "");
}

function deriveWsBase() {
  const explicit = process.env.REACT_APP_WS_URL;
  if (explicit) return explicit.replace(/\/$/, "");

  const base = process.env.REACT_APP_BACKEND_URL || process.env.REACT_APP_API_BASE;
  if (base) return toWsBaseFromHttp(base);

  return "ws://localhost:3001";
}

export const TRACKING_WS_BASE = deriveWsBase();

function normalizeTrackingBase(wsBase) {
  // Accept values like:
  // - ws://host:3001
  // - ws://host:3001/tracking
  // - ws://host:3001/tracking/ws
  const cleaned = wsBase.replace(/\/$/, "");
  if (cleaned.endsWith("/tracking/ws")) return cleaned;
  if (cleaned.endsWith("/tracking")) return `${cleaned}/ws`;
  return `${cleaned}/tracking/ws`;
}

export function buildTrackingWsUrl(orderId, token = null) {
  const base = normalizeTrackingBase(TRACKING_WS_BASE);
  const url = `${base}/orders/${encodeURIComponent(orderId)}`;
  return token ? `${url}?token=${encodeURIComponent(token)}` : url;
}

/**
 * PUBLIC_INTERFACE
 * Create a tracking WebSocket connection for a specific order.
 *
 * @param {object} params
 * @param {string} params.orderId Order UUID to connect to.
 * @param {string|null} params.token Optional JWT token (appended as ?token=...).
 * @param {(event: MessageEvent) => void} params.onMessage Message handler.
 * @param {() => void} params.onOpen Open handler.
 * @param {(event: CloseEvent) => void} params.onClose Close handler.
 * @param {(event: Event) => void} params.onError Error handler.
 * @returns {{ socket: WebSocket, close: () => void }}
 */
export function createTrackingSocketForOrder({
  orderId,
  token = null,
  onMessage = () => {},
  onOpen = () => {},
  onClose = () => {},
  onError = () => {}
} = {}) {
  if (!orderId) throw new Error("orderId is required to create tracking socket");

  const url = buildTrackingWsUrl(orderId, token);
  const socket = new WebSocket(url);

  socket.onopen = onOpen;
  socket.onmessage = onMessage;
  socket.onclose = onClose;
  socket.onerror = onError;

  return {
    socket,
    close: () => {
      try {
        socket.close();
      } catch {
        // ignore
      }
    }
  };
}
