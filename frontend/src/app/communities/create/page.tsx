"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../hooks/useAuth";
import { createProposal } from "../../../hooks/useCommunities";

const CATEGORIES = [
  "general",
  "technology",
  "science",
  "gaming",
  "arts",
  "music",
  "education",
  "business",
  "health",
  "sports",
];

export default function CreateProposalPage() {
  const router = useRouter();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [form, setForm] = useState({
    name: "",
    description: "",
    category: "general",
    tagsInput: "",
    logo_url: "",
    banner_url: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Redirect if not authenticated
  if (!authLoading && !isAuthenticated) {
    return (
      <div style={styles.pageContainer}>
        <div style={styles.editorialFrame}>
          <div style={styles.errorState}>
            <h2 style={styles.errorTitle}>Authentication Required</h2>
            <p style={styles.errorText}>
              You must be signed in to submit a community proposal.
            </p>
            <Link href="/auth/login" className="btn btn-primary">
              Sign In to Continue
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
    // Clear field error on change
    if (fieldErrors[e.target.name]) {
      setFieldErrors({ ...fieldErrors, [e.target.name]: "" });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    // Client-side validation
    const errors: Record<string, string> = {};
    if (form.name.length < 3 || form.name.length > 100) {
      errors.name = "Name must be between 3 and 100 characters";
    }
    if (form.description.length < 10) {
      errors.description = "Description must be at least 10 characters";
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    // Parse tags
    const tags = form.tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    setSubmitting(true);
    try {
      await createProposal({
        name: form.name,
        description: form.description,
        category: form.category,
        tags,
        logo_url: form.logo_url || undefined,
        banner_url: form.banner_url || undefined,
      });
      router.push("/communities");
    } catch (err: any) {
      if (err.data?.errors) {
        setFieldErrors(err.data.errors);
      } else {
        setError(err.message || "Failed to create proposal");
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Generate preview slug
  const previewSlug = form.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);

  return (
    <div style={styles.pageContainer}>
      <div style={styles.editorialFrame}>
        {/* Header */}
        <header style={styles.header}>
          <div style={styles.headerTop}>
            <Link href="/communities" style={styles.backLink}>
              ← Community Registry
            </Link>
            <span style={styles.headerMeta}>Proposal Submission</span>
          </div>
          <h1 style={styles.pageTitle}>PROPOSE A NEW COMMUNITY</h1>
          <p style={styles.pageSubtitle}>
            Describe the community you envision. Once your proposal gathers enough support,
            it will be automatically provisioned as an active server.
          </p>
        </header>

        {/* Form */}
        <div style={styles.formContainer}>
          <form onSubmit={handleSubmit} style={styles.form}>
            {error && (
              <div style={styles.errorBanner}>
                <strong>Submission Failed:</strong> {error}
              </div>
            )}

            <div style={styles.formGrid}>
              {/* Left Column — Core Fields */}
              <div style={styles.formCol}>
                <div className="form-group">
                  <label htmlFor="name">Community Name *</label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    value={form.name}
                    onChange={handleChange}
                    placeholder="e.g., Rust Systems Programming"
                    required
                  />
                  {fieldErrors.name && (
                    <p className="error-message">{fieldErrors.name}</p>
                  )}
                  {previewSlug && (
                    <p style={styles.slugPreview}>
                      Slug preview: <code>/{previewSlug}</code>
                    </p>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="description">Description *</label>
                  <textarea
                    id="description"
                    name="description"
                    value={form.description}
                    onChange={handleChange}
                    placeholder="Describe the purpose, goals, and ideal audience for this community. What will members discuss, build, or learn together?"
                    rows={6}
                    required
                    style={styles.textarea}
                  />
                  {fieldErrors.description && (
                    <p className="error-message">{fieldErrors.description}</p>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="category">Category</label>
                  <select
                    id="category"
                    name="category"
                    value={form.category}
                    onChange={handleChange}
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat.charAt(0).toUpperCase() + cat.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="tagsInput">Tags</label>
                  <input
                    id="tagsInput"
                    name="tagsInput"
                    type="text"
                    value={form.tagsInput}
                    onChange={handleChange}
                    placeholder="rust, systems, programming (comma-separated)"
                  />
                  <p style={styles.fieldHint}>
                    Separate tags with commas. Tags help discoverability.
                  </p>
                  {form.tagsInput && (
                    <div style={styles.tagPreview}>
                      {form.tagsInput
                        .split(",")
                        .map((t) => t.trim())
                        .filter((t) => t)
                        .map((tag, i) => (
                          <span key={i} style={styles.previewTag}>
                            {tag}
                          </span>
                        ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column — Optional & Preview */}
              <div style={styles.formCol}>
                <div style={styles.previewCard}>
                  <h3 style={styles.previewTitle}>Proposal Preview</h3>
                  <div style={styles.previewContent}>
                    <div
                      style={{
                        ...styles.previewBanner,
                        backgroundColor: form.name
                          ? stringToColor(form.name)
                          : "var(--border-color)",
                      }}
                    />
                    <div style={styles.previewBody}>
                      <h4 style={styles.previewName}>
                        {form.name || "Community Name"}
                      </h4>
                      <p style={styles.previewDesc}>
                        {form.description || "Your community description will appear here..."}
                      </p>
                      <div style={styles.previewMeta}>
                        <span style={styles.previewCategory}>
                          {form.category}
                        </span>
                        <span style={styles.previewVotes}>1 vote</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="logo_url">Logo URL (optional)</label>
                  <input
                    id="logo_url"
                    name="logo_url"
                    type="url"
                    value={form.logo_url}
                    onChange={handleChange}
                    placeholder="https://example.com/logo.png"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="banner_url">Banner URL (optional)</label>
                  <input
                    id="banner_url"
                    name="banner_url"
                    type="url"
                    value={form.banner_url}
                    onChange={handleChange}
                    placeholder="https://example.com/banner.jpg"
                  />
                </div>

                <div style={styles.infoBox}>
                  <strong>How Proposals Work</strong>
                  <ul style={styles.infoList}>
                    <li>Your proposal starts with 1 upvote (yours)</li>
                    <li>Other users can discover and vote for it</li>
                    <li>
                      Once 3 votes are reached, the community auto-provisions
                    </li>
                    <li>You become the server owner automatically</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Submit */}
            <div style={styles.submitRow}>
              <Link
                href="/communities"
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
                {submitting ? "Submitting Proposal..." : "Submit Community Proposal"}
              </button>
            </div>
          </form>
        </div>

        {/* Footer */}
        <footer style={styles.footer}>
          <div style={styles.footerBorder} />
          <div style={styles.footerGrid}>
            <span>Proposal Submission</span>
            <span style={styles.textCenter}>Haven Network</span>
            <span style={{ textAlign: "right" }}>Phase 2</span>
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
    maxWidth: "600px",
    margin: "0.75rem auto 0",
    lineHeight: 1.5,
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
    gridTemplateColumns: "1.2fr 1fr",
    gap: "3rem",
  },
  formCol: {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
  },
  textarea: {
    resize: "vertical" as const,
    minHeight: "140px",
    fontFamily: "var(--font-sans)",
  },
  slugPreview: {
    fontSize: "0.75rem",
    color: "var(--text-light)",
    fontFamily: "var(--font-mono)",
    marginTop: "0.25rem",
  },
  fieldHint: {
    fontSize: "0.75rem",
    color: "var(--text-light)",
    marginTop: "0.25rem",
  },
  tagPreview: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: "0.35rem",
    marginTop: "0.5rem",
  },
  previewTag: {
    fontSize: "0.7rem",
    padding: "0.15rem 0.4rem",
    backgroundColor: "var(--primary-light)",
    color: "var(--primary)",
    borderRadius: "2px",
    border: "1px solid var(--border-color)",
  },
  // Preview card
  previewCard: {
    border: "1px solid var(--border-color)",
    padding: "1.5rem",
    marginBottom: "1rem",
  },
  previewTitle: {
    fontFamily: "var(--font-serif)",
    fontSize: "1rem",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.03em",
    marginBottom: "1rem",
    paddingBottom: "0.4rem",
    borderBottom: "1px solid var(--text-main)",
    border: "none",
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: "var(--text-main)",
  },
  previewContent: {
    border: "1px solid var(--border-light)",
    overflow: "hidden",
  },
  previewBanner: {
    height: "6px",
    width: "100%",
  },
  previewBody: {
    padding: "1rem",
  },
  previewName: {
    fontFamily: "var(--font-serif)",
    fontSize: "1.1rem",
    fontWeight: 600,
    margin: 0,
    marginBottom: "0.5rem",
    border: "none",
  },
  previewDesc: {
    fontSize: "0.85rem",
    color: "var(--text-muted)",
    lineHeight: 1.5,
    margin: 0,
    marginBottom: "0.5rem",
  },
  previewMeta: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  previewCategory: {
    fontSize: "0.65rem",
    fontWeight: 600,
    textTransform: "uppercase",
    padding: "0.15rem 0.4rem",
    backgroundColor: "var(--primary-light)",
    color: "var(--primary)",
    borderRadius: "2px",
  },
  previewVotes: {
    fontSize: "0.75rem",
    color: "var(--text-light)",
    fontFamily: "var(--font-mono)",
  },
  // Info box
  infoBox: {
    backgroundColor: "var(--primary-light)",
    border: "1px solid var(--border-color)",
    padding: "1.25rem",
    fontSize: "0.9rem",
    lineHeight: 1.6,
    marginTop: "0.5rem",
  },
  infoList: {
    marginTop: "0.5rem",
    paddingLeft: "1.25rem",
    display: "flex",
    flexDirection: "column" as const,
    gap: "0.25rem",
    fontSize: "0.85rem",
    color: "var(--text-muted)",
  },
  // Submit row
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
  // Error states
  errorBanner: {
    backgroundColor: "#fef2f2",
    border: "1px solid var(--error)",
    color: "var(--error)",
    padding: "1rem 1.5rem",
    fontSize: "0.9rem",
  },
  errorState: {
    textAlign: "center" as const,
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
  // Footer
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
    textTransform: "uppercase" as const,
  },
  textCenter: {
    textAlign: "center" as const,
  },
};
