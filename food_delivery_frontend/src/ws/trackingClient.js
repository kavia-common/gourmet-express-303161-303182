/**
 * WebSocket client helper for order tracking.
 *
 * Backend provides a streaming endpoint (see backend /docs/realtime):
 *   ws://<backend-host>/tracking/stream
 *
 * This utility is intentionally generic for later integration:
 * - Connects with optional token (sent via query param for compatibility)
 * - Provides onMessage and lifecycle callbacks
 *
 * Env:
 * - REACT_APP_WS_URL (preferred) e.g. ws://localhost:3001/tracking/stream
 * - REACT_APP_BACKEND_URL / REACT_APP_API_BASE (http/https) will be converted to ws/wss
 */

function deriveWsUrl() {
  const explicit = process.env.REACT_APP_WS_URL;
  if (explicit) return explicit;

  const httpBase = process.env.REACT_APP_BACKEND_URL || process.env.REACT_APP_API_BASE;
  if (httpBase) {
    const wsBase = httpBase.startsWith("https://")
      ? httpBase.replace("https://", "wss://")
      : httpBase.replace("http://", "ws://");
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
 * @returns {{ socket: WebSocket, close: () => void }}
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
