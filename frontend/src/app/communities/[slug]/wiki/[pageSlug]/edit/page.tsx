"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../../../../hooks/useAuth";
import { useCommunity, fetchMembers } from "../../../../../../hooks/useCommunities";
import { useWikiPage, updateWikiPage } from "../../../../../../hooks/useWiki";

export default function EditWikiPage({
  params,
}: {
  params: Promise<{ slug: string; pageSlug: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const { community, loading: communityLoading } = useCommunity(resolvedParams.slug);
  const { page, loading: pageLoading, error: pageError } = useWikiPage(resolvedParams.slug, resolvedParams.pageSlug);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [userRole, setUserRole] = useState<string | null>(null);
  const [checkingRole, setCheckingRole] = useState(true);

  // Load existing page content into state when ready
  useEffect(() => {
    if (page) {
      setTitle(page.title);
      setContent(page.content);
    }
  }, [page]);

  // Check roles
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

  if (authLoading || communityLoading || pageLoading || checkingRole) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner} />
        <p style={styles.loadingText}>Loading wiki editor workspace...</p>
      </div>
    );
  }

  const isStaff =
    userRole === "owner" ||
    userRole === "admin" ||
    userRole === "moderator" ||
    userRole === "expert";

  if (!isAuthenticated || !isStaff || pageError || !page || !community) {
    return (
      <div style={styles.pageContainer}>
        <div style={styles.editorialFrame}>
          <div style={styles.errorState}>
            <h2 style={styles.errorTitle}>Permissions Denied</h2>
            <p style={styles.errorText}>
              {pageError || "You do not have permission to edit this wiki document."}
            </p>
            <Link href={`/communities/${resolvedParams.slug}`} className="btn btn-secondary">
              ← Return to Server Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    if (!community || !page) return;

    if (title.length < 3 || title.length > 100 || content.length < 10) {
      setError("Title must be between 3 and 100 characters, and content must be at least 10 characters.");
      return;
    }

    setSubmitting(true);
    try {
      const updated = await updateWikiPage(community.id, page.id, { title, content });
      router.push(`/communities/${community.slug}/wiki/${updated.slug}`);
    } catch (err: any) {
      setError(err.message || "Failed to update wiki page.");
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
            <Link href={`/communities/${community.slug}/wiki/${page.slug}`} style={styles.backLink}>
              ← Cancel & View Article
            </Link>
            <span style={styles.headerMeta}>Knowledge Editing desk</span>
          </div>
          <h1 style={styles.pageTitle}>EDIT WIKI ARTICLE</h1>
          <p style={styles.pageSubtitle}>
            Editing: <strong>{page.title}</strong> (Current version: {page.version})
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
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="content">Article Body *</label>
                  <textarea
                    id="content"
                    name="content"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={16}
                    required
                    style={styles.textarea}
                  />
                </div>
              </div>

              {/* Right Column — Sidebar Guidance */}
              <div style={styles.formCol}>
                <div style={styles.wikiGuidance}>
                  <h3 style={styles.guidanceTitle}>Wiki Revision Guidelines</h3>
                  <ul style={styles.guidanceList}>
                    <li>
                      <strong>Audit Trail:</strong> Saving updates will increment the article version number. All edits are permanently attributed to your user passport for workspace transparency.
                    </li>
                    <li>
                      <strong>Accuracy:</strong> Wiki pages are permanent reference guides. Ensure facts, configuration keys, or code snippets are fully verified.
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div style={styles.submitRow}>
              <Link
                href={`/communities/${community.slug}/wiki/${page.slug}`}
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
                {submitting ? "Saving Changes..." : "Publish Revision"}
              </button>
            </div>
          </form>
        </div>

        {/* Footer */}
        <footer style={styles.footer}>
          <div style={styles.footerBorder} />
          <div style={styles.footerGrid}>
            <span>Revision Desk</span>
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
