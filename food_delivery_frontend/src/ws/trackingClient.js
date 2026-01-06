/**
 * WebSocket client helper for order tracking.
 *
 * Backend:
 * - WebSocket endpoint:  ws(s)://<backend-host>/tracking/stream
 *
 * Protocol (lightweight):
 * - Client connects and then sends a JSON message to subscribe:
 *     { "action": "subscribe", "order_id": "<uuid>" }
 * - Server publishes tracking events for subscribed order as JSON objects.
 *
 * Env:
 * - REACT_APP_WS_URL (preferred) e.g. ws://localhost:3001  or ws://localhost:3001/tracking/stream
 * - REACT_APP_BACKEND_URL / REACT_APP_API_BASE (http/https) will be converted to ws/wss
 */

function deriveWsUrl() {
  const explicit = process.env.REACT_APP_WS_URL;
  if (explicit) {
    if (explicit.includes("/tracking/stream")) return explicit;
    return `${explicit.replace(/\/$/, "")}/tracking/stream`;
  }

  const base = process.env.REACT_APP_BACKEND_URL || process.env.REACT_APP_API_BASE;
  if (base) {
    let wsBase = base;
    if (wsBase.startsWith("https://")) wsBase = wsBase.replace("https://", "wss://");
    else if (wsBase.startsWith("http://")) wsBase = wsBase.replace("http://", "ws://");
    return `${wsBase.replace(/\/$/, "")}/tracking/stream`;
  }

  return "ws://localhost:3001/tracking/stream";
}

export const TRACKING_WS_URL = deriveWsUrl();

/**
 * PUBLIC_INTERFACE
 * Create a tracking WebSocket connection.
 *
 * @param {object} params
 * @param {string|null} params.token Optional JWT token. If provided, appended as ?token=<token>.
 * @param {(event: MessageEvent) => void} params.onMessage Message handler.
 * @param {() => void} params.onOpen Open handler.
 * @param {(event: CloseEvent) => void} params.onClose Close handler.
 * @param {(event: Event) => void} params.onError Error handler.
 * @returns {{ socket: WebSocket, close: () => void, subscribeToOrder: (orderId: string) => void }}
 */
export function createTrackingSocket({
  token = null,
  onMessage = () => {},
  onOpen = () => {},
  onClose = () => {},
  onError = () => {}
} = {}) {
  const url = token ? `${TRACKING_WS_URL}?token=${encodeURIComponent(token)}` : TRACKING_WS_URL;

  const socket = new WebSocket(url);
  socket.onopen = onOpen;
  socket.onmessage = onMessage;
  socket.onclose = onClose;
  socket.onerror = onError;

  function subscribeToOrder(orderId) {
    try {
      socket.send(JSON.stringify({ action: "subscribe", order_id: orderId }));
    } catch {
      // ignore (socket not ready or closed)
    }
  }

  return {
    socket,
    subscribeToOrder,
    close: () => {
      try {
        socket.close();
      } catch {
        // ignore
      }
    }
  };
}

