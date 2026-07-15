"use client";

import { useState, useEffect, useCallback } from "react";
import { request } from "../lib/api";

export interface SummaryResponse {
  post_id: string;
  summary: string;
}

export interface WikiDraftResponse {
  title: string;
  content: string;
}

// ── Hook: Fetch or Generate Thread Summary ───────

export function usePostSummary(postId: string) {
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = useCallback(async () => {
    if (!postId) return;
    setLoading(true);
    setError(null);
    try {
      const res: SummaryResponse = await request(`/posts/${postId}/summarize`, {
        method: "POST",
      });
      setSummary(res.summary);
    } catch (err: any) {
      setError(err.message || "Failed to generate AI summary.");
    } finally {
      setLoading(false);
    }
  }, [postId]);

  return { summary, loading, error, generateSummary: fetchSummary };
}

// ── Utility: Generate Wiki Draft ─────────────────

export async function generateWikiDraft(postId: string): Promise<WikiDraftResponse> {
  return request(`/posts/${postId}/wiki-draft`, {
    method: "POST",
  });
}

// ── Hook: Community AI Assistant (RAG Chatbot) ───

export interface AIMessage {
  id: string;
  sender: "user" | "assistant";
  content: string;
  created_at: string;
}

export function useAIAssistant(communitySlug: string) {
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    if (!communitySlug) return;
    setLoading(true);
    setError(null);
    try {
      const res = await request(`/communities/${communitySlug}/ai-assistant/history`);
      setMessages(res.messages || []);
    } catch (err: any) {
      setError(err.message || "Failed to load chat history.");
    } finally {
      setLoading(false);
    }
  }, [communitySlug]);

  const sendMessage = useCallback(async (text: string) => {
    if (!communitySlug || !text.trim()) return;
    setSending(true);
    setError(null);
    try {
      const res = await request(`/communities/${communitySlug}/ai-assistant/chat`, {
        method: "POST",
        body: JSON.stringify({ message: text }),
      });
      // Append user's sent message and the assistant's reply
      setMessages((prev) => [...prev, res.user_message, res.assistant_message]);
    } catch (err: any) {
      setError(err.message || "Failed to send message.");
    } finally {
      setSending(false);
    }
  }, [communitySlug]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return { messages, loading, sending, error, sendMessage, refetch: fetchHistory };
}
