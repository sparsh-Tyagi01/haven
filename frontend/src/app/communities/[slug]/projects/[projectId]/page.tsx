"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../../../hooks/useAuth";
import { useCommunity, fetchMembers, type Membership } from "../../../../../hooks/useCommunities";
import {
  useProjectTasks,
  createTask,
  updateTaskStatus,
  updateTaskDetails,
  type Task,
} from "../../../../../hooks/useProjects";

const COLUMNS: { id: Task["status"]; label: string; icon: string }[] = [
  { id: "todo", label: "Backlog", icon: "📋" },
  { id: "in_progress", label: "In Progress", icon: "⚡" },
  { id: "review", label: "Review", icon: "👀" },
  { id: "done", label: "Done", icon: "✅" },
];

const PRIORITIES = ["low", "medium", "high", "urgent"];

export default function ProjectBoardPage({
  params,
}: {
  params: Promise<{ slug: string; projectId: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const { community } = useCommunity(resolvedParams.slug);
  const { tasks, loading, error, refetch, setTasks } = useProjectTasks(resolvedParams.projectId);

  // States
  const [members, setMembers] = useState<Membership[]>([]);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [quickCreateColumn, setQuickCreateColumn] = useState<Task["status"] | null>(null);
  const [quickTitle, setQuickTitle] = useState("");
  const [submittingTask, setSubmittingTask] = useState(false);

  // Edit Modal States
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    status: "todo",
    priority: "medium",
    assigneeId: "",
    dueDate: "",
  });

  // Fetch community members & user membership role
  useEffect(() => {
    if (!community || !user) return;
    fetchMembers(community.id)
      .then((res) => {
        setMembers(res.members || []);
        const myMem = (res.members || []).find((m) => m.user_id === user.id);
        if (myMem) {
          setUserRole(myMem.role);
        }
      })
      .catch(() => {});
  }, [community, user]);

  // Load selected task details into edit form
  useEffect(() => {
    if (selectedTask) {
      setEditForm({
        title: selectedTask.title,
        description: selectedTask.description || "",
        status: selectedTask.status,
        priority: selectedTask.priority,
        assigneeId: selectedTask.assignee_id || "",
        dueDate: selectedTask.due_date ? selectedTask.due_date.slice(0, 10) : "",
      });
    }
  }, [selectedTask]);

  if (loading || !community) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner} />
        <p style={styles.loadingText}>Loading project workspace...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.pageContainer}>
        <div style={styles.editorialFrame}>
          <div style={styles.errorState}>
            <h2 style={styles.errorTitle}>Project Workspace Error</h2>
            <p style={styles.errorText}>{error}</p>
            <Link href={`/communities/${resolvedParams.slug}`} className="btn btn-secondary">
              ← Return to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Perm guard: only logged-in members can add/edit tasks
  const isMember = userRole !== null;

  const handleQuickCreate = async (e: React.FormEvent, colId: Task["status"]) => {
    e.preventDefault();
    if (quickTitle.trim().length < 3) return;
    setSubmittingTask(true);
    try {
      await createTask(resolvedParams.projectId, {
        title: quickTitle,
        description: "",
        status: colId,
        priority: "medium",
      });
      setQuickTitle("");
      setQuickCreateColumn(null);
      refetch();
    } catch (err: any) {
      alert(err.message || "Failed to create task");
    } finally {
      setSubmittingTask(false);
    }
  };

  const handleStatusShift = async (taskId: string, currentStatus: Task["status"], direction: "left" | "right") => {
    if (!isMember) return;
    const colSequence: Task["status"][] = ["todo", "in_progress", "review", "done"];
    const idx = colSequence.indexOf(currentStatus);
    const targetIdx = direction === "left" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= colSequence.length) return;
    const nextStatus = colSequence[targetIdx];

    // Optimistic update
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: nextStatus } : t));

    try {
      await updateTaskStatus(taskId, nextStatus);
    } catch (err: any) {
      alert(err.message || "Failed to shift task status");
      refetch();
    }
  };

  const handleSaveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask) return;
    try {
      await updateTaskDetails(selectedTask.id, {
        title: editForm.title,
        description: editForm.description,
        status: editForm.status,
        priority: editForm.priority,
        assignee_id: editForm.assigneeId || undefined,
        due_date: editForm.dueDate ? new Date(editForm.dueDate).toISOString() : undefined,
      });
      setSelectedTask(null);
      refetch();
    } catch (err: any) {
      alert(err.message || "Failed to save details");
    }
  };

  const priorityColor = (pri: Task["priority"]) => {
    const colors: Record<string, string> = {
      low: "#4a6b8a",
      medium: "var(--text-light)",
      high: "#b05c42",
      urgent: "var(--error)",
    };
    return colors[pri] || "var(--text-light)";
  };

  return (
    <div style={styles.pageContainer}>
      <div style={styles.editorialFrame}>
        {/* Header */}
        <header style={styles.header}>
          <div style={styles.headerTop}>
            <Link href={`/communities/${community.slug}`} style={styles.backLink}>
              ← Return to /{community.slug}
            </Link>
            <span style={styles.headerMeta}>Kanban Workspace</span>
          </div>
          <h1 style={styles.pageTitle}>KANBAN PROJECT BOARD</h1>
        </header>

        {/* Board Columns Grid */}
        <div style={styles.boardGrid}>
          {COLUMNS.map((col) => {
            const colTasks = tasks.filter((t) => t.status === col.id);

            return (
              <div key={col.id} style={styles.columnCard}>
                <div style={styles.columnHeader}>
                  <div style={styles.colLabelRow}>
                    <span style={styles.colIcon}>{col.icon}</span>
                    <span style={styles.colLabel}>{col.label}</span>
                    <span style={styles.colTally}>{colTasks.length}</span>
                  </div>
                  {isMember && (
                    <button
                      onClick={() => setQuickCreateColumn(quickCreateColumn === col.id ? null : col.id)}
                      style={styles.colAddBtn}
                      title="Add task to column"
                    >
                      +
                    </button>
                  )}
                </div>

                {/* Inline Quick Add Form */}
                {quickCreateColumn === col.id && (
                  <form onSubmit={(e) => handleQuickCreate(e, col.id)} style={styles.quickForm}>
                    <input
                      type="text"
                      placeholder="Task title..."
                      value={quickTitle}
                      onChange={(e) => setQuickTitle(e.target.value)}
                      required
                      autoFocus
                      style={styles.quickInput}
                    />
                    <div style={styles.quickFormActions}>
                      <button
                        type="button"
                        onClick={() => setQuickCreateColumn(null)}
                        style={styles.quickCancelBtn}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={submittingTask}
                        style={styles.quickSubmitBtn}
                      >
                        Add
                      </button>
                    </div>
                  </form>
                )}

                {/* Task Cards Stack */}
                <div style={styles.cardsStack}>
                  {colTasks.length === 0 ? (
                    <div style={styles.emptyColPlaceholder}>
                      Empty Column
                    </div>
                  ) : (
                    colTasks.map((t) => (
                      <div key={t.id} style={styles.taskCard}>
                        {/* Shifting & Details Row */}
                        <div style={styles.cardHeaderRow}>
                          <span
                            style={{
                              ...styles.priorityIndicator,
                              color: priorityColor(t.priority),
                              border: `1px solid ${priorityColor(t.priority)}`,
                            }}
                          >
                            {t.priority}
                          </span>
                          <div style={styles.shiftActions}>
                            {col.id !== "todo" && (
                              <button
                                onClick={() => handleStatusShift(t.id, col.id, "left")}
                                style={styles.shiftBtn}
                                title="Move left"
                              >
                                ◀
                              </button>
                            )}
                            {col.id !== "done" && (
                              <button
                                onClick={() => handleStatusShift(t.id, col.id, "right")}
                                style={styles.shiftBtn}
                                title="Move right"
                              >
                                ▶
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Title (Click opens details) */}
                        <h4 onClick={() => setSelectedTask(t)} style={styles.taskCardTitle}>
                          {t.title}
                        </h4>

                        {/* Card Footer: Assignee & Date */}
                        <div style={styles.cardFooter}>
                          {t.assignee_id ? (
                            <div style={styles.miniAssignee}>
                              <div
                                style={{
                                  ...styles.avatarSmall,
                                  backgroundColor: stringToColor(t.assignee_username || "?"),
                                  backgroundImage: t.assignee_avatar_url ? `url(${t.assignee_avatar_url})` : "none",
                                }}
                              >
                                {!t.assignee_avatar_url &&
                                  (t.assignee_display_name || t.assignee_username || "?").charAt(0).toUpperCase()}
                              </div>
                              <span style={styles.miniUsername}>@{t.assignee_username}</span>
                            </div>
                          ) : (
                            <span style={styles.unassigned}>Unassigned</span>
                          )}
                          {t.due_date && (
                            <span style={styles.dueDateBadge}>
                              📅 {new Date(t.due_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Task Details Edit Modal */}
        {selectedTask && (
          <div style={styles.modalOverlay}>
            <div style={styles.modalContent}>
              <h3 style={styles.modalHeader}>Task Workspace Details</h3>
              <form onSubmit={handleSaveDetails} style={styles.modalForm}>
                <div className="form-group">
                  <label htmlFor="title">Title *</label>
                  <input
                    id="title"
                    type="text"
                    value={editForm.title}
                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="description">Description</label>
                  <textarea
                    id="description"
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    rows={4}
                  />
                </div>

                <div style={styles.modalFormRow}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label htmlFor="status">Status</label>
                    <select
                      id="status"
                      value={editForm.status}
                      onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                    >
                      <option value="todo">Backlog</option>
                      <option value="in_progress">In Progress</option>
                      <option value="review">Review</option>
                      <option value="done">Done</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ flex: 1 }}>
                    <label htmlFor="priority">Priority</label>
                    <select
                      id="priority"
                      value={editForm.priority}
                      onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}
                    >
                      {PRIORITIES.map((pri) => (
                        <option key={pri} value={pri}>
                          {pri.charAt(0).toUpperCase() + pri.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={styles.modalFormRow}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label htmlFor="assigneeId">Assignee</label>
                    <select
                      id="assigneeId"
                      value={editForm.assigneeId}
                      onChange={(e) => setEditForm({ ...editForm, assigneeId: e.target.value })}
                    >
                      <option value="">Unassigned</option>
                      {members.map((m) => (
                        <option key={m.user_id} value={m.user_id}>
                          {m.display_name || m.username} (@{m.username})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group" style={{ flex: 1 }}>
                    <label htmlFor="dueDate">Due Date</label>
                    <input
                      id="dueDate"
                      type="date"
                      value={editForm.dueDate}
                      onChange={(e) => setEditForm({ ...editForm, dueDate: e.target.value })}
                    />
                  </div>
                </div>

                <div style={styles.modalActions}>
                  <button
                    type="button"
                    onClick={() => setSelectedTask(null)}
                    className="btn btn-secondary"
                  >
                    Close
                  </button>
                  {isMember && (
                    <button type="submit" className="btn btn-primary">
                      Save Changes
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer style={styles.footer}>
          <div style={styles.footerBorder} />
          <div style={styles.footerGrid}>
            <span>Linear Board</span>
            <span style={styles.textCenter}>Haven Network</span>
            <span style={{ textAlign: "right" }}>Phase 5</span>
          </div>
        </footer>
      </div>
    </div>
  );
}

// ── Color helper ─────────────────────────────────

function stringToColor(str: string): string {
  const colors = [
    "#4a5c43", "#b05c42", "#3c6e47", "#5e4a7a",
    "#6b5b3e", "#2d6a6a", "#8b5e3c", "#4a6b8a",
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

// ── Styles ───────────────────────────────────────

const styles: { [key: string]: React.CSSProperties } = {
  pageContainer: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    padding: "2rem 1.5rem",
    backgroundColor: "var(--bg-main)",
  },
  loadingContainer: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "var(--bg-main)",
  },
  spinner: {
    width: "40px",
    height: "40px",
    border: "3px solid var(--border-light)",
    borderTop: "3px solid var(--primary)",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
    marginBottom: "1rem",
  },
  loadingText: {
    fontFamily: "var(--font-serif)",
    fontStyle: "italic",
    fontSize: "1.1rem",
    color: "var(--text-muted)",
  },
  editorialFrame: {
    width: "100%",
    maxWidth: "1200px",
    margin: "0 auto",
    backgroundColor: "var(--bg-surface)",
    border: "2px solid var(--text-main)",
    padding: "2.5rem",
    boxShadow: "var(--shadow-lg)",
    display: "flex",
    flexDirection: "column",
    flexGrow: 1,
  },
  header: {
    borderBottom: "3px solid var(--text-main)",
    paddingBottom: "1.5rem",
    marginBottom: "2rem",
  },
  headerTop: {
    display: "flex",
    justifyContent: "space-between",
    fontFamily: "var(--font-mono)",
    fontSize: "0.75rem",
    color: "var(--text-light)",
    textTransform: "uppercase",
    borderBottom: "1px solid var(--border-color)",
    paddingBottom: "0.5rem",
    marginBottom: "1rem",
  },
  backLink: {
    color: "var(--primary)",
    textDecoration: "none",
    fontWeight: 600,
  },
  headerMeta: {
    letterSpacing: "0.05em",
  },
  pageTitle: {
    fontFamily: "var(--font-serif)",
    fontSize: "2.5rem",
    fontWeight: 800,
    letterSpacing: "-0.04em",
    textTransform: "uppercase",
    margin: 0,
    padding: 0,
    border: "none",
  },
  boardGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
    gap: "1.25rem",
    flexGrow: 1,
    alignItems: "start",
  },
  columnCard: {
    border: "1px solid var(--border-color)",
    backgroundColor: "var(--bg-main)",
    display: "flex",
    flexDirection: "column",
    padding: "1rem",
  },
  columnHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottom: "2px solid var(--text-main)",
    paddingBottom: "0.5rem",
    marginBottom: "1rem",
  },
  colLabelRow: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  },
  colIcon: {
    fontSize: "1rem",
  },
  colLabel: {
    fontFamily: "var(--font-serif)",
    fontWeight: 700,
    fontSize: "1rem",
    textTransform: "uppercase",
    letterSpacing: "0.02em",
  },
  colTally: {
    fontSize: "0.75rem",
    fontFamily: "var(--font-mono)",
    backgroundColor: "var(--border-light)",
    padding: "0.1rem 0.35rem",
    borderRadius: "2px",
    fontWeight: 600,
  },
  colAddBtn: {
    background: "none",
    border: "none",
    fontSize: "1.25rem",
    cursor: "pointer",
    fontWeight: 700,
    color: "var(--primary)",
  },
  quickForm: {
    border: "1px dashed var(--border-color)",
    padding: "0.75rem",
    backgroundColor: "var(--bg-surface)",
    marginBottom: "1rem",
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
  },
  quickInput: {
    width: "100%",
    padding: "0.4rem",
    fontSize: "0.85rem",
  },
  quickFormActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "0.5rem",
  },
  quickCancelBtn: {
    border: "none",
    background: "none",
    fontSize: "0.75rem",
    color: "var(--text-light)",
    cursor: "pointer",
  },
  quickSubmitBtn: {
    backgroundColor: "var(--primary)",
    color: "var(--bg-surface)",
    border: "none",
    padding: "0.2rem 0.6rem",
    fontSize: "0.75rem",
    fontWeight: 600,
    cursor: "pointer",
  },
  cardsStack: {
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
  },
  emptyColPlaceholder: {
    textAlign: "center",
    fontSize: "0.75rem",
    color: "var(--text-light)",
    fontStyle: "italic",
    padding: "2rem 0",
    border: "1px dashed var(--border-light)",
  },
  taskCard: {
    backgroundColor: "var(--bg-surface)",
    border: "1px solid var(--border-color)",
    padding: "1rem",
    display: "flex",
    flexDirection: "column",
    gap: "0.65rem",
  },
  cardHeaderRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  priorityIndicator: {
    fontSize: "0.6rem",
    fontWeight: 700,
    textTransform: "uppercase",
    border: "1px solid",
    padding: "0.1rem 0.35rem",
    borderRadius: "2px",
  },
  shiftActions: {
    display: "flex",
    gap: "0.25rem",
  },
  shiftBtn: {
    background: "none",
    border: "none",
    fontSize: "0.7rem",
    cursor: "pointer",
    color: "var(--text-light)",
  },
  taskCardTitle: {
    fontSize: "0.95rem",
    fontWeight: 600,
    margin: 0,
    lineHeight: 1.4,
    cursor: "pointer",
  },
  cardFooter: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderTop: "1px dashed var(--border-light)",
    paddingTop: "0.5rem",
    fontSize: "0.75rem",
  },
  miniAssignee: {
    display: "flex",
    alignItems: "center",
    gap: "0.35rem",
  },
  avatarSmall: {
    width: "20px",
    height: "20px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "white",
    fontSize: "0.6rem",
    fontWeight: 700,
    backgroundSize: "cover",
  },
  miniUsername: {
    color: "var(--text-light)",
    fontFamily: "var(--font-mono)",
    fontSize: "0.7rem",
  },
  unassigned: {
    color: "var(--text-light)",
    fontStyle: "italic",
  },
  dueDateBadge: {
    color: "var(--text-muted)",
    fontSize: "0.7rem",
  },
  // Modal Edit Task
  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    backgroundColor: "rgba(0,0,0,0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
  },
  modalContent: {
    backgroundColor: "var(--bg-surface)",
    border: "2px solid var(--text-main)",
    padding: "2rem",
    width: "100%",
    maxWidth: "500px",
    boxShadow: "var(--shadow-lg)",
  },
  modalHeader: {
    fontFamily: "var(--font-serif)",
    fontSize: "1.25rem",
    borderBottom: "2px solid var(--text-main)",
    paddingBottom: "0.5rem",
    marginBottom: "1.25rem",
    textTransform: "uppercase",
    border: "none",
    borderBottomWidth: "2px",
    borderBottomStyle: "solid",
    borderBottomColor: "var(--text-main)",
  },
  modalForm: {
    display: "flex",
    flexDirection: "column",
    gap: "1.25rem",
  },
  modalFormRow: {
    display: "flex",
    gap: "1rem",
  },
  modalActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "0.75rem",
    borderTop: "1px solid var(--border-color)",
    paddingTop: "1.25rem",
  },
  errorState: {
    textAlign: "center",
    padding: "4rem 2rem",
  },
  errorTitle: {
    fontFamily: "var(--font-serif)",
    fontSize: "2rem",
    marginBottom: "1rem",
  },
  errorText: {
    color: "var(--text-muted)",
    fontSize: "1rem",
    marginBottom: "2rem",
    lineHeight: 1.6,
  },
  footer: {
    marginTop: "2.5rem",
    paddingTop: "2.5rem",
  },
  footerBorder: {
    height: "4px",
    borderTop: "1px solid var(--text-main)",
    borderBottom: "1px solid var(--text-main)",
    marginBottom: "0.75rem",
  },
  footerGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    fontFamily: "var(--font-mono)",
    fontSize: "0.75rem",
    color: "var(--text-light)",
    textTransform: "uppercase",
  },
  textCenter: {
    textAlign: "center",
  },
};
