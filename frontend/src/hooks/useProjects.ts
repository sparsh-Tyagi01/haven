"use client";

import { useState, useEffect, useCallback } from "react";
import { request } from "../lib/api";

export interface Project {
  id: string;
  community_id: string;
  name: string;
  description: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  project_id: string;
  title: string;
  description: string;
  status: "todo" | "in_progress" | "review" | "done";
  priority: "low" | "medium" | "high" | "urgent";
  assignee_id?: string;
  created_by: string;
  due_date?: string;
  created_at: string;
  updated_at: string;
  assignee_username?: string;
  assignee_display_name?: string;
  assignee_avatar_url?: string;
}

// ── Hook: List Community Projects ────────────────

export function useProjects(communitySlug: string) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    if (!communitySlug) return;
    setLoading(true);
    setError(null);
    try {
      const res = await request(`/communities/${communitySlug}/projects`);
      setProjects(res || []);
    } catch (err: any) {
      setError(err.message || "Failed to load projects");
    } finally {
      setLoading(false);
    }
  }, [communitySlug]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  return { projects, loading, error, refetch: fetchProjects };
}

// ── Hook: Project Kanban Tasks ────────────────────

export function useProjectTasks(projectId: string) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await request(`/projects/${projectId}/tasks`);
      setTasks(res || []);
    } catch (err: any) {
      setError(err.message || "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  return { tasks, loading, error, refetch: fetchTasks, setTasks };
}

// ── Imperative API helpers ───────────────────────

export async function createProject(
  communityId: string,
  body: { name: string; description: string }
): Promise<Project> {
  return request(`/communities/${communityId}/projects`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function createTask(
  projectId: string,
  body: {
    title: string;
    description: string;
    status: string;
    priority: string;
    assignee_id?: string;
    due_date?: string;
  }
): Promise<Task> {
  return request(`/projects/${projectId}/tasks`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateTaskStatus(taskId: string, status: string): Promise<any> {
  return request(`/tasks/${taskId}/status`, {
    method: "PUT",
    body: JSON.stringify({ status }),
  });
}

export async function updateTaskDetails(
  taskId: string,
  body: {
    title: string;
    description: string;
    status: string;
    priority: string;
    assignee_id?: string;
    due_date?: string;
  }
): Promise<any> {
  return request(`/tasks/${taskId}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}
