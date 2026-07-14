"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../../../hooks/useAuth";
import { useCommunity, fetchMembers } from "../../../../../hooks/useCommunities";
import { createEvent } from "../../../../../hooks/useEvents";

export default function CreateEventPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const { community, loading: communityLoading } = useCommunity(resolvedParams.slug);

  const [form, setForm] = useState({
    title: "",
    description: "",
    location: "",
    startTime: "",
    endTime: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [userRole, setUserRole] = useState<string | null>(null);
  const [checkingRole, setCheckingRole] = useState(true);

  useEffect(() => {
    if (!community || !user) {
      setCheckingRole(false);
      return;
    }
    setCheckingRole(true);
    fetchMembers(community.id)
      .then((res) => {
        const myMem = (res.members || []).find((m) => m.user_id === user.id);
        if (myMem) {
          setUserRole(myMem.role);
        }
      })
      .catch(() => {})
      .finally(() => setCheckingRole(false));
  }, [community, user]);

  if (authLoading || communityLoading || checkingRole) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner} />
        <p style={styles.loadingText}>Fetching community credentials...</p>
      </div>
    );
  }

  const isStaff =
    userRole === "owner" ||
    userRole === "admin" ||
    userRole === "moderator";

  if (!isAuthenticated || !isStaff || !community) {
    return (
      <div style={styles.pageContainer}>
        <div style={styles.editorialFrame}>
          <div style={styles.errorState}>
            <h2 style={styles.errorTitle}>Permissions Denied</h2>
            <p style={styles.errorText}>
              Event scheduling is limited to community owners, administrators, and moderators.
            </p>
            <Link href={`/communities/${resolvedParams.slug}`} className="btn btn-secondary">
              ← Return to Server Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    if (fieldErrors[e.target.name]) {
      setFieldErrors({ ...fieldErrors, [e.target.name]: "" });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    // Client side validation
    const errors: Record<string, string> = {};
    if (form.title.length < 3 || form.title.length > 100) {
      errors.title = "Title must be between 3 and 100 characters";
    }
    if (!form.startTime) {
      errors.startTime = "Start time is required";
    }
    if (form.endTime && new Date(form.endTime) < new Date(form.startTime)) {
      errors.endTime = "End time cannot be before start time";
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setSubmitting(true);
    try {
      await createEvent(community.id, {
        title: form.title,
        description: form.description,
        location: form.location,
        start_time: new Date(form.startTime).toISOString(),
        end_time: form.endTime ? new Date(form.endTime).toISOString() : undefined,
      });
      router.push(`/communities/${community.slug}`);
    } catch (err: any) {
      if (err.data?.errors) {
        setFieldErrors(err.data.errors);
      } else {
        setError(err.message || "Failed to schedule event.");
      }
    } finally {
      setSubmitting(false);
    }
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
            <span style={styles.headerMeta}>Event coordination desk</span>
          </div>
          <h1 style={styles.pageTitle}>SCHEDULE A MEETUP / EVENT</h1>
          <p style={styles.pageSubtitle}>
            Publishing calendar event to <strong>{community.name}</strong>
          </p>
        </header>

        {/* Form */}
        <div style={styles.formContainer}>
          <form onSubmit={handleSubmit} style={styles.form}>
            {error && (
              <div style={styles.errorBanner}>
                <strong>Error:</strong> {error}
              </div>
            )}

            <div style={styles.formGrid}>
              {/* Left Column — Details */}
              <div style={styles.formCol}>
                <div className="form-group">
                  <label htmlFor="title">Event Title *</label>
                  <input
                    id="title"
                    name="title"
                    type="text"
                    value={form.title}
                    onChange={handleChange}
                    placeholder="e.g., Weekly Developer Hangout or Hackathon Kickoff"
                    required
                  />
                  {fieldErrors.title && (
                    <p className="error-message">{fieldErrors.title}</p>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="description">Event Description</label>
                  <textarea
                    id="description"
                    name="description"
                    value={form.description}
                    onChange={handleChange}
                    placeholder="Provide details about topics, agenda, or hosts..."
                    rows={6}
                    style={styles.textarea}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="location">Location / Stream Link</label>
                  <input
                    id="location"
                    name="location"
                    type="text"
                    value={form.location}
                    onChange={handleChange}
                    placeholder="e.g., https://zoom.us/j/... or Discord voice channel"
                  />
                </div>

                <div style={styles.formRow}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label htmlFor="startTime">Start Date & Time *</label>
                    <input
                      id="startTime"
                      name="startTime"
                      type="datetime-local"
                      value={form.startTime}
                      onChange={handleChange}
                      required
                    />
                    {fieldErrors.startTime && (
                      <p className="error-message">{fieldErrors.startTime}</p>
                    )}
                  </div>

                  <div className="form-group" style={{ flex: 1 }}>
                    <label htmlFor="endTime">End Date & Time (Optional)</label>
                    <input
                      id="endTime"
                      name="endTime"
                      type="datetime-local"
                      value={form.endTime}
                      onChange={handleChange}
                    />
                    {fieldErrors.endTime && (
                      <p className="error-message">{fieldErrors.endTime}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column — Sidebar Guidance */}
              <div style={styles.formCol}>
                <div style={styles.eventsGuidance}>
                  <h3 style={styles.guidanceTitle}>Community Events</h3>
                  <ul style={styles.guidanceList}>
                    <li>
                      <strong>RSVP tracking:</strong> Scheduled events feature Going, Interested, and Declined tracking metrics so you can estimate server voice capacities.
                    </li>
                    <li>
                      <strong>Live stream links:</strong> Link video conference coordinates directly. The links are clickable for RSVP participants once the event starts.
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div style={styles.submitRow}>
              <Link
                href={`/communities/${community.slug}`}
                className="btn btn-secondary"
                style={styles.cancelBtn}
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={submitting}
                className="btn btn-primary"
                style={styles.submitBtn}
              >
                {submitting ? "Scheduling Event..." : "Schedule Event"}
              </button>
            </div>
          </form>
        </div>

        {/* Footer */}
        <footer style={styles.footer}>
          <div style={styles.footerBorder} />
          <div style={styles.footerGrid}>
            <span>Calendar Desk</span>
            <span style={styles.textCenter}>Haven Network</span>
            <span style={{ textAlign: "right" }}>Phase 6</span>
          </div>
        </footer>
      </div>
    </div>
  );
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
    textAlign: "center",
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
    border: "none",
    padding: 0,
    margin: 0,
    lineHeight: 0.95,
  },
  pageSubtitle: {
    fontFamily: "var(--font-sans)",
    fontSize: "0.9rem",
    fontWeight: 500,
    color: "var(--text-muted)",
    marginTop: "0.75rem",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  formContainer: {
    flexGrow: 1,
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "2rem",
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "1.5fr 1fr",
    gap: "2.5rem",
  },
  formCol: {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
  },
  formRow: {
    display: "flex",
    gap: "1rem",
  },
  textarea: {
    resize: "vertical",
    minHeight: "140px",
    fontFamily: "var(--font-sans)",
    lineHeight: 1.6,
  },
  eventsGuidance: {
    backgroundColor: "var(--primary-light)",
    border: "1px solid var(--border-color)",
    padding: "1.5rem",
    fontSize: "0.9rem",
    lineHeight: 1.6,
  },
  guidanceTitle: {
    fontFamily: "var(--font-serif)",
    fontSize: "1.1rem",
    marginBottom: "0.75rem",
    textTransform: "uppercase",
    border: "none",
  },
  guidanceList: {
    paddingLeft: "1.25rem",
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
    color: "var(--text-muted)",
  },
  submitRow: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "1rem",
    borderTop: "1px solid var(--border-color)",
    paddingTop: "1.5rem",
  },
  cancelBtn: {
    padding: "0.75rem 1.5rem",
  },
  submitBtn: {
    padding: "0.75rem 2rem",
  },
  errorBanner: {
    backgroundColor: "#fef2f2",
    border: "1px solid var(--error)",
    color: "var(--error)",
    padding: "1rem 1.5rem",
    fontSize: "0.9rem",
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
    marginTop: "auto",
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
