"use client";

import { useState, useEffect, useCallback } from "react";
import { request } from "../lib/api";

export interface Community {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  tags: string[];
  logo_url: string;
  banner_url: string;
  owner_id: string;
  visibility: string;
  is_proposal: boolean;
  upvotes_count: number;
  member_count: number;
  created_at: string;
  updated_at: string;
}

export interface CommunityListResponse {
  communities: Community[];
  total: number;
  page: number;
  per_page: number;
}

export interface Membership {
  id: string;
  user_id: string;
  community_id: string;
  role: string;
  reputation?: number;
  joined_at: string;
  username?: string;
  display_name?: string;
  avatar_url?: string;
}

export interface VoteResponse {
  voted: boolean;
  upvotes_count: number;
  provisioned: boolean;
}

// ── List active communities ──────────────────────

export function useCommunities(page = 1, search = "", category = "") {
  const [data, setData] = useState<CommunityListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCommunities = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), per_page: "20" });
      if (search) params.set("q", search);
      if (category) params.set("category", category);
      const res = await request(`/communities?${params.toString()}`);
      setData(res);
    } catch (err: any) {
      setError(err.message || "Failed to load communities");
    } finally {
      setLoading(false);
    }
  }, [page, search, category]);

  useEffect(() => {
    fetchCommunities();
  }, [fetchCommunities]);

  return { data, loading, error, refetch: fetchCommunities };
}

// ── List proposals ───────────────────────────────

export function useProposals(page = 1) {
  const [data, setData] = useState<CommunityListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProposals = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await request(`/proposals?page=${page}&per_page=20`);
      setData(res);
    } catch (err: any) {
      setError(err.message || "Failed to load proposals");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchProposals();
  }, [fetchProposals]);

  return { data, loading, error, refetch: fetchProposals };
}

// ── Single community by slug ─────────────────────

export function useCommunity(slug: string) {
  const [community, setCommunity] = useState<Community | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCommunity = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    try {
      const res = await request(`/communities/${slug}`);
      setCommunity(res);
    } catch (err: any) {
      setError(err.message || "Failed to load community");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchCommunity();
  }, [fetchCommunity]);

  return { community, loading, error, refetch: fetchCommunity };
}

// ── User's joined communities ────────────────────

export function useMyCommunities() {
  const [data, setData] = useState<CommunityListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMyCommunities = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await request("/users/communities");
      setData(res);
    } catch (err: any) {
      setError(err.message || "Failed to load your communities");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMyCommunities();
  }, [fetchMyCommunities]);

  return { data, loading, error, refetch: fetchMyCommunities };
}

// ── Imperative API helpers ───────────────────────

export async function createProposal(body: {
  name: string;
  description: string;
  category: string;
  tags: string[];
  logo_url?: string;
  banner_url?: string;
}): Promise<Community> {
  return request("/proposals", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function voteProposal(communityId: string): Promise<VoteResponse> {
  return request(`/proposals/${communityId}/vote`, {
    method: "POST",
  });
}

export async function joinCommunity(communityId: string): Promise<Membership> {
  return request(`/communities/${communityId}/join`, {
    method: "POST",
  });
}

export async function leaveCommunity(communityId: string): Promise<void> {
  return request(`/communities/${communityId}/leave`, {
    method: "POST",
  });
}

export async function fetchMembers(communityId: string): Promise<{ members: Membership[]; total: number }> {
  return request(`/communities/${communityId}/members`);
}
