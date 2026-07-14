"use client";

import { useState, useEffect, useCallback } from "react";
import { request } from "../lib/api";

export interface Event {
  id: string;
  community_id: string;
  title: string;
  description: string;
  location: string;
  start_time: string;
  end_time?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  going_count: number;
  interested_count: number;
  declined_count: number;
  user_rsvp_status?: "going" | "interested" | "declined" | "";
}

// ── Hook: List Community Events ──────────────────

export function useEvents(communitySlug: string) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    if (!communitySlug) return;
    setLoading(true);
    setError(null);
    try {
      const res = await request(`/communities/${communitySlug}/events`);
      setEvents(res || []);
    } catch (err: any) {
      setError(err.message || "Failed to load events");
    } finally {
      setLoading(false);
    }
  }, [communitySlug]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  return { events, loading, error, refetch: fetchEvents };
}

// ── Imperative API helpers ───────────────────────

export async function createEvent(
  communityId: string,
  body: {
    title: string;
    description: string;
    location: string;
    start_time: string;
    end_time?: string;
  }
): Promise<Event> {
  return request(`/communities/${communityId}/events`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateEvent(
  eventId: string,
  body: {
    title: string;
    description: string;
    location: string;
    start_time: string;
    end_time?: string;
  }
): Promise<Event> {
  return request(`/events/${eventId}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function rsvpEvent(eventId: string, status: string): Promise<any> {
  return request(`/events/${eventId}/rsvp`, {
    method: "POST",
    body: JSON.stringify({ status }),
  });
}
