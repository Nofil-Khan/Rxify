/**
 * useDispensaryWebSocket Hook
 * =============================================================================
 * REAL-TIME EVENT-DRIVEN WEBSOCKET CLIENT
 *
 * HOW THIS WORKS:
 * 1. Handshake:
 *    When the dispensary dashboard mounts, this hook opens a persistent
 *    WebSocket connection to FastAPI:
 *      ws://<host>/api/dispensary/ws/<dispensaryId>?token=<jwt>
 *
 * 2. Idle Connection (Zero DB Load):
 *    Unlike HTTP polling (which spams the server every 30 seconds), this socket
 *    sits completely silent. It sends a tiny 4-byte 'ping' every 25 seconds
 *    only to prevent load balancers/proxies from timing out the TCP socket.
 *
 * 3. Instant Reactive Wakeup:
 *    The exact millisecond a patient places an order or a doctor issues a
 *    prescription, the backend emits a lightweight event:
 *      {"type": "QUEUE_UPDATED", "event": "NEW_TICKET", "request_id": 1042}
 *    Upon receiving this, the hook triggers `onQueueUpdate()` to immediately
 *    pull the new record from the database.
 *
 * 4. Automatic Reconnection:
 *    If the network drops or the server restarts, this hook uses exponential
 *    backoff (1s -> 2s -> 4s -> max 15s) to reconnect cleanly.
 * =============================================================================
 */

import * as React from 'react';
import { useAuthStore } from '@/lib/auth';

interface UseDispensaryWebSocketOptions {
  onQueueUpdate: () => void;
}

export function useDispensaryWebSocket({ onQueueUpdate }: UseDispensaryWebSocketOptions) {
  const token = useAuthStore((s) => s.token);
  const dispensaryId = useAuthStore((s) => s.dispensaryId);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const socketRef = React.useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const retryCountRef = React.useRef<number>(0);
  const isMountedRef = React.useRef<boolean>(true);

  const callbackRef = React.useRef(onQueueUpdate);
  callbackRef.current = onQueueUpdate;

  React.useEffect(() => {
    isMountedRef.current = true;

    if (!token || !dispensaryId || !isAuthenticated) {
      return;
    }

    function connect() {
      // Clean up previous socket if any
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }

      // Determine WS protocol based on current page location (ws:// for http, wss:// for https)
      const isHttps = window.location.protocol === 'https:';
      const wsProtocol = isHttps ? 'wss:' : 'ws:';
      const backendHost = import.meta.env.VITE_API_BASE_URL
        ? new URL(import.meta.env.VITE_API_BASE_URL).host
        : window.location.host;

      const wsUrl = `${wsProtocol}//${backendHost}/api/dispensary/ws/${dispensaryId}?token=${encodeURIComponent(token!)}`;

      try {
        const ws = new WebSocket(wsUrl);
        socketRef.current = ws;

        ws.onopen = () => {
          if (!isMountedRef.current) return;
          retryCountRef.current = 0; // Reset retry counter on successful connection

          // Keep-alive heartbeat: ping every 25 seconds
          if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send('ping');
            }
          }, 25000);
        };

        ws.onmessage = (event) => {
          if (!isMountedRef.current) return;
          if (event.data === 'pong') return;

          try {
            const data = JSON.parse(event.data);
            if (data.type === 'QUEUE_UPDATED') {
              // Trigger reactive fetch from DB
              callbackRef.current();
            }
          } catch {
            /* ignore non-json messages */
          }
        };

        ws.onclose = () => {
          if (!isMountedRef.current) return;
          if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);

          // Exponential backoff reconnect
          const backoff = Math.min(1000 * Math.pow(2, retryCountRef.current), 15000);
          retryCountRef.current += 1;
          reconnectTimeoutRef.current = setTimeout(connect, backoff);
        };

        ws.onerror = () => {
          ws.close();
        };
      } catch {
        // Fallback retry if initial construction fails
        reconnectTimeoutRef.current = setTimeout(connect, 3000);
      }
    }

    connect();

    return () => {
      isMountedRef.current = false;
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
    };
  }, [token, dispensaryId, isAuthenticated]);
}

export default useDispensaryWebSocket;
