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

  const connect = useCallback(() => {
    if (typeof window === "undefined") return;

    const token = localStorage.getItem("haven_access_token");
    if (!token) {
      setConnected(false);
      return;
    }

    // Close existing connection if any
    if (socketRef.current) {
      socketRef.current.close();
    }

    const wsUrlWithToken = `${WS_URL}?token=${token}`;
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
          onFrame(frame);
        }
      } catch (err) {
        console.error("[WS] Failed to parse message frame:", err);
      }
    };

    ws.onclose = () => {
      setConnected(false);
      console.log("[WS] Disconnected, scheduling reconnect...");
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 3000);
    };

    ws.onerror = (err) => {
      console.error("[WS] Socket error:", err);
      ws.close();
    };
  }, [onFrame]);

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
