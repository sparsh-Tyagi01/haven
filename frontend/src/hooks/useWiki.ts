"use client";

import { useState, useEffect, useCallback } from "react";
import { request } from "../lib/api";

export interface WikiPage {
  id: string;
  community_id: string;
  title: string;
  slug: string;
  content: string;
  created_by: string;
  version: number;
  created_at: string;
  updated_at: string;
  creator_username?: string;
  creator_display_name?: string;
  creator_avatar_url?: string;
}

// ── Hook: List Wiki Pages ────────────────────────

export function useWikiPages(communitySlug: string) {
  const [pages, setPages] = useState<WikiPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPages = useCallback(async () => {
    if (!communitySlug) return;
    setLoading(true);
    setError(null);
    try {
      const res = await request(`/communities/${communitySlug}/wiki`);
      setPages(res || []);
    } catch (err: any) {
      setError(err.message || "Failed to load wiki index");
    } finally {
      setLoading(false);
    }
  }, [communitySlug]);

  useEffect(() => {
    fetchPages();
  }, [fetchPages]);

  return { pages, loading, error, refetch: fetchPages };
}

// ── Hook: Single Wiki Page Details ────────────────

export function useWikiPage(communitySlug: string, pageSlug: string) {
  const [page, setPage] = useState<WikiPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPage = useCallback(async () => {
    if (!communitySlug || !pageSlug) return;
    setLoading(true);
    setError(null);
    try {
      const res = await request(`/communities/${communitySlug}/wiki/${pageSlug}`);
      setPage(res);
    } catch (err: any) {
      setError(err.message || "Failed to load wiki page");
    } finally {
      setLoading(false);
    }
  }, [communitySlug, pageSlug]);

  useEffect(() => {
    fetchPage();
  }, [fetchPage]);

  return { page, loading, error, refetch: fetchPage };
}

// ── Imperative API helpers ───────────────────────

export async function createWikiPage(
  communityId: string,
  body: { title: string; content: string }
): Promise<WikiPage> {
  return request(`/communities/${communityId}/wiki`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateWikiPage(
  communityId: string,
  pageId: string,
  body: { title: string; content: string }
): Promise<WikiPage> {
  return request(`/communities/${communityId}/wiki/${pageId}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}
