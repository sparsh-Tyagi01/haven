"use client";

import React, { useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../../../hooks/useAuth";
import { useCommunity } from "../../../../../hooks/useCommunities";
import { createPost } from "../../../../../hooks/usePosts";

const POST_TYPES = [
  { value: "discussion", label: "💬 Standard Discussion" },
  { value: "question", label: "❓ Question & Answer" },
  { value: "project", label: "🚀 Project / Roadmap Update" },
  { value: "event", label: "📅 Event Details" },
  { value: "job", label: "💼 Job Opportunity" },
];

export default function CreatePostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { community, loading: communityLoading } = useCommunity(resolvedParams.slug);

  const [form, setForm] = useState({
    title: "",
    content: "",
    postType: "discussion",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  if (authLoading || communityLoading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner} />
        <p style={styles.loadingText}>Loading workspace context...</p>
      </div>
    );
  }

  // Verify authentication
  if (!isAuthenticated) {
    return (
      <div style={styles.pageContainer}>
        <div style={styles.editorialFrame}>
          <div style={styles.errorState}>
            <h2 style={styles.errorTitle}>Authentication Required</h2>
            <p style={styles.errorText}>
              You must be signed in to publish posts in this community.
            </p>
            <Link href="/auth/login" className="btn btn-primary">
              Sign In to Continue
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!community) {
    return (
      <div style={styles.pageContainer}>
        <div style={styles.editorialFrame}>
          <div style={styles.errorState}>
            <h2 style={styles.errorTitle}>Community Not Found</h2>
            <p style={styles.errorText}>The community context you are trying to post to does not exist.</p>
            <Link href="/communities" className="btn btn-secondary">
              ← Return to Registry
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
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

    // Client validation
    const errors: Record<string, string> = {};
    if (form.title.length < 3 || form.title.length > 255) {
      errors.title = "Title must be between 3 and 255 characters";
    }
    if (form.content.length < 5) {
      errors.content = "Content must be at least 5 characters";
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setSubmitting(true);
    try {
      await createPost({
        community_id: community.id,
        title: form.title,
        content: form.content,
        post_type: form.postType,
      });
      router.push(`/communities/${community.slug}`);
    } catch (err: any) {
      if (err.data?.errors) {
        setFieldErrors(err.data.errors);
      } else {
        setError(err.message || "Failed to publish post. Ensure you have joined this community.");
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
            <span style={styles.headerMeta}>Publishing Desk</span>
          </div>
          <h1 style={styles.pageTitle}>CREATE A POST</h1>
          <p style={styles.pageSubtitle}>
            Publishing to <strong>{community.name}</strong>
          </p>
        </header>

        {/* Form Container */}
        <div style={styles.formContainer}>
          <form onSubmit={handleSubmit} style={styles.form}>
            {error && (
              <div style={styles.errorBanner}>
                <strong>Error:</strong> {error}
              </div>
            )}

            <div style={styles.formGrid}>
              {/* Left Column — Title and Editor */}
              <div style={styles.formCol}>
                <div className="form-group">
                  <label htmlFor="title">Post Title *</label>
                  <input
                    id="title"
                    name="title"
                    type="text"
                    value={form.title}
                    onChange={handleChange}
                    placeholder="Provide a clear, descriptive title..."
                    required
                  />
                  {fieldErrors.title && (
                    <p className="error-message">{fieldErrors.title}</p>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="content">Content *</label>
                  <textarea
                    id="content"
                    name="content"
                    value={form.content}
                    onChange={handleChange}
                    placeholder="Write your discussion post or question details. Markdown is supported (e.g., *italic*, **bold**, code blocks, links)."
                    rows={12}
                    required
                    style={styles.textarea}
                  />
                  {fieldErrors.content && (
                    <p className="error-message">{fieldErrors.content}</p>
                  )}
                </div>
              </div>

              {/* Right Column — Settings & Hints */}
              <div style={styles.formCol}>
                <div className="form-group">
                  <label htmlFor="postType">Post Classification</label>
                  <select
                    id="postType"
                    name="postType"
                    value={form.postType}
                    onChange={handleChange}
                    style={styles.select}
                  >
                    {POST_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={styles.editorialGuidance}>
                  <h3 style={styles.guidanceHeader}>Haven Writing Rules</h3>
                  <ul style={styles.guidanceList}>
                    <li>
                      <strong>Select appropriate classification:</strong> Classify as <em>Question</em> if you are seeking a solution so members can mark it solved.
                    </li>
                    <li>
                      <strong>Formatting:</strong> Use standard markdown structure. Double enter for paragraph breaks, backticks for code.
                    </li>
                    <li>
                      <strong>No spam or clickbait:</strong> Discussions should build long-term value for the community brain.
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
                {submitting ? "Publishing Post..." : "Publish Post"}
              </button>
            </div>
          </form>
        </div>

        {/* Footer */}
        <footer style={styles.footer}>
          <div style={styles.footerBorder} />
          <div style={styles.footerGrid}>
            <span>New Post Desk</span>
            <span style={styles.textCenter}>Haven Network</span>
            <span style={{ textAlign: "right" }}>Phase 3</span>
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
  textarea: {
    resize: "vertical",
    minHeight: "260px",
    fontFamily: "var(--font-sans)",
    lineHeight: 1.6,
  },
  select: {
    cursor: "pointer",
  },
  editorialGuidance: {
    backgroundColor: "var(--primary-light)",
    border: "1px solid var(--border-color)",
    padding: "1.5rem",
    fontSize: "0.9rem",
    lineHeight: 1.6,
  },
  guidanceHeader: {
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
