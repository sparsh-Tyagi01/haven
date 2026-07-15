"use client";

import React, { useState, useEffect, use, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "../../../../../hooks/useAuth";
import { useCommunity, fetchMembers } from "../../../../../hooks/useCommunities";
import { createWikiPage } from "../../../../../hooks/useWiki";

function CreateWikiPageContent({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const { community, loading: communityLoading } = useCommunity(resolvedParams.slug);

  const [form, setForm] = useState({ title: "", content: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [userRole, setUserRole] = useState<string | null>(null);
  const [checkingRole, setCheckingRole] = useState(true);

  // Pre-fill query params (e.g. from AI wiki draft)
  useEffect(() => {
    const preTitle = searchParams.get("title") || "";
    const preContent = searchParams.get("content") || "";
    if (preTitle || preContent) {
      setForm({ title: preTitle, content: preContent });
    }
  }, [searchParams]);

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
    userRole === "moderator" ||
    userRole === "expert";

  // Enforce authentication & editing rights
  if (!isAuthenticated || !isStaff || !community) {
    return (
      <div style={styles.pageContainer}>
        <div style={styles.editorialFrame}>
          <div style={styles.errorState}>
            <h2 style={styles.errorTitle}>Permissions Denied</h2>
            <p style={styles.errorText}>
              Wiki generation is limited to community owners, administrators, moderators, and verified experts.
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

    if (!community) return;

    // Client side validation
    const errors: Record<string, string> = {};
    if (form.title.length < 3 || form.title.length > 100) {
      errors.title = "Title must be between 3 and 100 characters";
    }
    if (form.content.length < 10) {
      errors.content = "Content must be at least 10 characters";
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setSubmitting(true);
    try {
      const page = await createWikiPage(community.id, form);
      router.push(`/communities/${community.slug}/wiki/${page.slug}`);
    } catch (err: any) {
      if (err.data?.errors) {
        setFieldErrors(err.data.errors);
      } else {
        setError(err.message || "Failed to submit wiki page.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const previewSlug = form.title
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
            <Link href={`/communities/${community.slug}`} style={styles.backLink}>
              ← Return to /{community.slug}
            </Link>
            <span style={styles.headerMeta}>Knowledge Authoring desk</span>
          </div>
          <h1 style={styles.pageTitle}>CREATE WIKI ARTICLE</h1>
          <p style={styles.pageSubtitle}>
            Publishing to the <strong>{community.name}</strong> Wiki Database
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
              {/* Left Column — Title & Content */}
              <div style={styles.formCol}>
                <div className="form-group">
                  <label htmlFor="title">Document Title *</label>
                  <input
                    id="title"
                    name="title"
                    type="text"
                    value={form.title}
                    onChange={handleChange}
                    placeholder="e.g., Development environment setup guide"
                    required
                  />
                  {fieldErrors.title && (
                    <p className="error-message">{fieldErrors.title}</p>
                  )}
                  {previewSlug && (
                    <p style={styles.slugPreview}>
                      Permanent slug: <code>/wiki/{previewSlug}</code>
                    </p>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="content">Article Body *</label>
                  <textarea
                    id="content"
                    name="content"
                    value={form.content}
                    onChange={handleChange}
                    placeholder="Write detailed guide content using Markdown format. Guides are long-term knowledge sources."
                    rows={16}
                    required
                    style={styles.textarea}
                  />
                  {fieldErrors.content && (
                    <p className="error-message">{fieldErrors.content}</p>
                  )}
                </div>
              </div>

              {/* Right Column — Sidebar Guidance */}
              <div style={styles.formCol}>
                <div style={styles.wikiGuidance}>
                  <h3 style={styles.guidanceTitle}>Wiki Standards</h3>
                  <ul style={styles.guidanceList}>
                    <li>
                      <strong>Collaborative versioning:</strong> Wiki pages are version-tracked. Subsequent edits increment version codes for complete accountability.
                    </li>
                    <li>
                      <strong>Clear Structure:</strong> Break up long text using markdown headers (`## H2`, `### H3`) for readable guides.
                    </li>
                    <li>
                      <strong>Verify details:</strong> Ensure guides do not duplicate existing topics. Maintain accuracy.
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
                {submitting ? "Publishing Wiki..." : "Publish Wiki Page"}
              </button>
            </div>
          </form>
        </div>

        {/* Footer */}
        <footer style={styles.footer}>
          <div style={styles.footerBorder} />
          <div style={styles.footerGrid}>
            <span>Wiki Desk</span>
            <span style={styles.textCenter}>Haven Network</span>
            <span style={{ textAlign: "right" }}>Phase 4</span>
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
    minHeight: "340px",
    fontFamily: "var(--font-sans)",
    lineHeight: 1.6,
  },
  slugPreview: {
    fontSize: "0.75rem",
    color: "var(--text-light)",
    fontFamily: "var(--font-mono)",
    marginTop: "0.25rem",
  },
  wikiGuidance: {
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

export default function CreateWikiPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return (
    <Suspense fallback={
      <div style={styles.loadingContainer}>
        <div style={styles.spinner} />
        <p style={styles.loadingText}>Loading Wiki Curation Workspace...</p>
      </div>
    }>
      <CreateWikiPageContent params={params} />
    </Suspense>
  );
}
