import { getWsProvider, WsEvent, type StatusChange } from "@polkadot-api/ws-provider/web";

/**
 * Creates a WebSocket provider with automatic fallback to alternative endpoints.
 * If the primary endpoint fails, it will automatically try the next endpoint in the list.
 *
 * @param endpoints - Array of WebSocket endpoint URLs to try in order
 * @returns A WebSocket provider that automatically falls back to alternative endpoints
 */
export function getFallbackProvider(endpoints: string[]) {
  if (endpoints.length === 0) {
    throw new Error("At least one endpoint must be provided");
  }

  // Status change callback to log connection events
  const onStatusChanged = (status: StatusChange) => {
    switch (status.type) {
      case WsEvent.CONNECTING:
        console.log(`[RPC] Connecting to: ${status.uri}`);
        break;
      case WsEvent.CONNECTED:
        console.log(`[RPC] Successfully connected to: ${status.uri}`);
        break;
      case WsEvent.ERROR:
        console.error(`[RPC] Connection error:`, status.event);
        break;
      case WsEvent.CLOSE:
        console.warn(`[RPC] Connection closed:`, status.event);
        break;
    }
  };

  // Create provider with built-in fallback support
  // The getWsProvider function natively supports multiple endpoints and will
  // automatically try the next endpoint if the current one fails
  return getWsProvider({
    endpoints,
    onStatusChanged,
    timeout: 30000, // 30 second timeout per connection attempt
  });
}
