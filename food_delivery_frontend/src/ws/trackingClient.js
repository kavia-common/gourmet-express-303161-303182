/**
 * WebSocket client helper for order tracking.
 *
 * Backend provides a streaming endpoint:
 *   ws://localhost:3001/api/tracking/stream
 *
 * This utility is intentionally generic for later integration:
 * - Connects with optional token (sent via query param for compatibility)
 * - Provides onMessage and lifecycle callbacks
 */

export const TRACKING_WS_URL = "ws://localhost:3001/api/tracking/stream";

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
