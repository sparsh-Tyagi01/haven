"use client";

import { useState, useEffect, useCallback } from "react";
import { request } from "../lib/api";

export interface Post {
  id: string;
  community_id: string;
  author_id: string;
  title: string;
  content: string;
  post_type: "discussion" | "question" | "project" | "event" | "job";
  is_solved: boolean;
  accepted_comment_id?: string;
  created_at: string;
  updated_at: string;
  author_username?: string;
  author_display_name?: string;
  author_avatar_url?: string;
  community_name?: string;
  community_slug?: string;
  upvotes_count: number;
  helpful_count: number;
  funny_count: number;
  insightful_count: number;
  user_vote_type?: string;
  moderation_status?: string;
  moderation_reason?: string;
}

export interface Comment {
  id: string;
  post_id: string;
  parent_id?: string;
  author_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  author_username?: string;
  author_display_name?: string;
  author_avatar_url?: string;
  upvotes_count: number;
  helpful_count: number;
  funny_count: number;
  insightful_count: number;
  user_vote_type?: string;
  moderation_status?: string;
  moderation_reason?: string;
}

export interface FeedResponse {
  posts: Post[];
  total: number;
  page: number;
  per_page: number;
}

// ── Hook: Community Feed ─────────────────────────

export function useCommunityFeed(slug: string, postType = "") {
  const [data, setData] = useState<FeedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFeed = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (postType) params.set("type", postType);
      const queryStr = params.toString() ? `?${params.toString()}` : "";
      const res = await request(`/feed/community/${slug}${queryStr}`);
      setData(res);
    } catch (err: any) {
      setError(err.message || "Failed to load feed");
    } finally {
      setLoading(false);
    }
  }, [slug, postType]);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  return { data, loading, error, refetch: fetchFeed };
}

// ── Hook: Home Feed ──────────────────────────────

export function useHomeFeed(page = 1) {
  const [data, setData] = useState<FeedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFeed = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await request(`/feed/home?page=${page}&per_page=20`);
      setData(res);
    } catch (err: any) {
      setError(err.message || "Failed to load feed");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  return { data, loading, error, refetch: fetchFeed };
}

// ── Hook: Single Post details ────────────────────

export function usePost(id: string) {
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPost = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await request(`/posts/${id}`);
      setPost(res);
    } catch (err: any) {
      setError(err.message || "Failed to load post details");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchPost();
  }, [fetchPost]);

  return { post, loading, error, refetch: fetchPost };
}

// ── Hook: Post Comments ──────────────────────────

export function usePostComments(postId: string) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchComments = useCallback(async () => {
    if (!postId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await request(`/posts/${postId}/comments`);
      setComments(res || []);
    } catch (err: any) {
      setError(err.message || "Failed to load comments");
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  return { comments, loading, error, refetch: fetchComments };
}

// ── Imperative API helpers ───────────────────────

export async function createPost(body: {
  community_id: string;
  title: string;
  content: string;
  post_type: string;
}): Promise<Post> {
  return request("/posts", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function createComment(
  postId: string,
  body: { content: string; parent_id?: string }
): Promise<Comment> {
  return request(`/posts/${postId}/comments`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function votePost(postId: string, voteType: string): Promise<any> {
  return request(`/posts/${postId}/vote`, {
    method: "POST",
    body: JSON.stringify({ vote_type: voteType }),
  });
}

export async function voteComment(commentId: string, voteType: string): Promise<any> {
  return request(`/comments/${commentId}/vote`, {
    method: "POST",
    body: JSON.stringify({ vote_type: voteType }),
  });
}

export async function solveQuestion(postId: string, acceptedCommentId: string): Promise<any> {
  return request(`/posts/${postId}/solve`, {
    method: "PUT",
    body: JSON.stringify({ accepted_comment_id: acceptedCommentId }),
  });
}
