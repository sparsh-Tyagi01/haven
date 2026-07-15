"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { request } from "../lib/api";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8080/api/v1/ws";

export interface Message {
  id: string;
  channel_id?: string;
  recipient_user_id?: string;
  sender_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  sender_username: string;
  sender_display_name: string;
  sender_avatar_url: string;
}

export interface Channel {
  id: string;
  community_id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
}

// ── WebSocket Manager Hook ───────────────────────
export function useWebSocket(onFrame: (frame: { event: string; topic: string; payload: any }) => void) {
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<any>(null);
  const [connected, setConnected] = useState(false);
  const onFrameRef = useRef(onFrame);

  // Keep the ref updated with the latest callback
  useEffect(() => {
    onFrameRef.current = onFrame;
  }, [onFrame]);

  const connect = useCallback(() => {
    if (typeof window === "undefined") return;

    const token = localStorage.getItem("haven_access_token");
    if (!token) {
      setConnected(false);
      return;
    }

    // Check expiration and try refresh if expired
    const parts = token.split(".");
    if (parts.length === 3) {
      try {
        const payload = JSON.parse(atob(parts[1]));
        const EXPIRY_BUFFER_MS = 60_000; // refresh if token expires within 60 seconds
        if (payload.exp && Date.now() + EXPIRY_BUFFER_MS >= payload.exp * 1000) {
          console.warn("[WS] Stored access token is expired. Attempting token refresh...");
          const refreshToken = localStorage.getItem("haven_refresh_token");
          if (refreshToken) {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8080/api/v1";
            fetch(`${apiUrl}/auth/refresh`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ refresh_token: refreshToken }),
            })
            .then(res => {
              if (res.ok) return res.json();
              throw new Error(`Refresh failed with status ${res.status}`);
            })
            .then(res => {
              // Store BOTH tokens — refresh tokens are rotated on each use,
              // so failing to update the stored refresh_token causes the next
              // refresh attempt to fail with 401 (revoked token).
              localStorage.setItem("haven_access_token", res.access_token);
              if (res.refresh_token) {
                localStorage.setItem("haven_refresh_token", res.refresh_token);
              }
              setTimeout(connect, 500);
            })
            .catch((refreshErr) => {
              console.error("[WS] Failed to refresh token — clearing credentials:", refreshErr.message);
              // Clear stale/revoked tokens so the user is prompted to log in again
              localStorage.removeItem("haven_access_token");
              localStorage.removeItem("haven_refresh_token");
              localStorage.removeItem("haven_user");
              setConnected(false);
            });
          } else {
            console.error("[WS] No refresh token in storage. User must log in again.");
            localStorage.removeItem("haven_access_token");
            localStorage.removeItem("haven_user");
            setConnected(false);
          }
          return;
        }
      } catch (e) {
        // ignore decoding errors
      }
    }

    // Close existing connection if any
    if (socketRef.current) {
      socketRef.current.close();
    }

    let wsUrl = WS_URL;
    if (typeof window !== "undefined") {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = window.location.hostname;
      const envUrl = process.env.NEXT_PUBLIC_WS_URL;
      if (envUrl && !envUrl.includes("localhost") && !envUrl.includes("127.0.0.1")) {
        wsUrl = envUrl;
      } else {
        wsUrl = `${protocol}//${host}:8080/ws`;
      }
    }

    const wsUrlWithToken = `${wsUrl}?token=${token}`;
    console.log("[WS] Attempting connection to:", wsUrl);
    const ws = new WebSocket(wsUrlWithToken);
    socketRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      console.log("[WS] Connected to Haven Real-Time Service");
    };

    ws.onmessage = (event) => {
      try {
        const frames = event.data.split("\n");
        for (const f of frames) {
          if (!f.trim()) continue;
          const frame = JSON.parse(f);
          onFrameRef.current(frame);
        }
      } catch (err) {
        console.error("[WS] Failed to parse message frame:", err);
      }
    };

    ws.onclose = (event) => {
      setConnected(false);
      console.error(`[WS] Disconnected. Code: ${event.code}, Reason: ${event.reason || "None"}, Clean: ${event.wasClean}`);
      console.error("[WS] Checking token validity before reconnect...");
      
      const token = localStorage.getItem("haven_access_token");
      if (token) {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8080/api/v1";
        fetch(`${apiUrl}/users/communities`, {
          headers: {
            "Authorization": `Bearer ${token}`
          }
        })
        .then(res => {
          if (res.status === 401) {
            console.error("[WS] Unauthorized token detected. Clearing tokens and stopping reconnect.");
            localStorage.removeItem("haven_access_token");
            localStorage.removeItem("haven_refresh_token");
            localStorage.removeItem("haven_user");
            window.location.reload();
            return;
          }
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, 3000);
        })
        .catch(() => {
          // Network error or fetch failed -> schedule reconnect anyway
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, 5000);
        });
      } else {
        console.error("[WS] No token found in storage. Stopping reconnect.");
      }
    };

    ws.onerror = (err) => {
      console.error("[WS] Socket error event:", err);
      console.error("[WS] Socket readyState on error:", ws.readyState);
      ws.close();
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (socketRef.current) {
        // Remove onclose listener so it doesn't try to reconnect when we unmount
        socketRef.current.onclose = null;
        socketRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connect]);

  const sendFrame = useCallback((event: string, topic: string, payload?: any) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      console.warn("[WS] Cannot send message: WebSocket is not open");
      return false;
    }
    socketRef.current.send(JSON.stringify({ event, topic, payload }));
    return true;
  }, []);

  return { connected, sendFrame };
}

// ── REST API functions ────────────────────────────

export async function createChannel(
  communityId: string,
  body: { name: string; description: string }
): Promise<Channel> {
  return request(`/communities/${communityId}/channels`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function fetchChannels(communitySlug: string): Promise<Channel[]> {
  return request(`/communities/${communitySlug}/channels`);
}

export async function fetchChannelMessages(channelId: string): Promise<Message[]> {
  return request(`/channels/${channelId}/messages`);
}

export async function fetchDirectMessages(userId: string): Promise<Message[]> {
  return request(`/direct/messages/${userId}`);
}
