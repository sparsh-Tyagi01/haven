"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../../../hooks/useAuth";
import { useWikiPage } from "../../../../../hooks/useWiki";
import { useCommunity, fetchMembers, type Membership } from "../../../../../hooks/useCommunities";

export default function WikiDetailPage({
  params,
}: {
  params: Promise<{ slug: string; pageSlug: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const { community } = useCommunity(resolvedParams.slug);
  const { page, loading, error } = useWikiPage(resolvedParams.slug, resolvedParams.pageSlug);

  const [communityMembers, setCommunityMembers] = useState<Membership[]>([]);
  const [userRole, setUserRole] = useState<string | null>(null);

  // Retrieve user role inside this community for editing permissions check
  useEffect(() => {
    if (!community || !user) return;
    fetchMembers(community.id)
      .then((res) => {
        setCommunityMembers(res.members || []);
        const myMem = (res.members || []).find((m) => m.user_id === user.id);
        if (myMem) {
          setUserRole(myMem.role);
        }
      })
      .catch(() => {});
  }, [community, user]);

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner} />
        <p style={styles.loadingText}>Fetching wiki article...</p>
      </div>
    );
  }

  if (error || !page || !community) {
    return (
      <div style={styles.pageContainer}>
        <div style={styles.editorialFrame}>
          <div style={styles.errorState}>
            <h2 style={styles.errorTitle}>Wiki Page Not Found</h2>
            <p style={styles.errorText}>
              {error || "The wiki page you requested does not exist or you do not have permission to read it."}
            </p>
            <Link href={`/communities/${resolvedParams.slug}`} className="btn btn-secondary">
              ← Return to Community Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const canEdit =
    userRole === "owner" ||
    userRole === "admin" ||
    userRole === "moderator" ||
    userRole === "expert";

  return (
    <div style={styles.pageContainer}>
      <div style={styles.editorialFrame}>
        {/* Header */}
        <header style={styles.header}>
          <div style={styles.headerTop}>
            <Link href={`/communities/${community.slug}`} style={styles.backLink}>
              ← Back to /{community.slug}
            </Link>
            <span style={styles.headerMeta}>Knowledge Base Directory</span>
          </div>
        </header>

        {/* Wiki Reader Article */}
        <article style={styles.article}>
          <div style={styles.metaRow}>
            <span style={styles.versionBadge}>Version {page.version}</span>
            <span style={styles.dateMeta}>
              Last modified {new Date(page.updated_at).toLocaleDateString()}
            </span>
          </div>

          <div style={styles.titleArea}>
            <h1 style={styles.title}>{page.title}</h1>
            {isAuthenticated && canEdit && (
              <Link
                href={`/communities/${community.slug}/wiki/${page.slug}/edit`}
                className="btn btn-secondary"
                style={styles.editBtn}
              >
                ✏️ Edit Article
              </Link>
            )}
          </div>

          {/* Author Audit */}
          <div style={styles.auditPassport}>
            <div
              style={{
                ...styles.avatar,
                backgroundColor: stringToColor(page.creator_username || "?"),
                backgroundImage: page.creator_avatar_url ? `url(${page.creator_avatar_url})` : "none",
                backgroundSize: "cover",
              }}
            >
              {!page.creator_avatar_url &&
                (page.creator_display_name || page.creator_username || "?").charAt(0).toUpperCase()}
            </div>
            <div>
              <span style={styles.auditLabel}>Last edited by:</span>
              <div style={styles.authorMeta}>
                <strong>{page.creator_display_name || page.creator_username}</strong>{" "}
                <span style={styles.handle}>@{page.creator_username}</span>
              </div>
            </div>
          </div>

          {/* Content Body */}
          <div style={styles.content}>
            {page.content.split("\n\n").map((para, i) => {
              if (para.startsWith("```") && para.endsWith("```")) {
                const code = para.slice(3, -3);
                return (
                  <pre key={i} style={styles.codeBlock}>
                    <code>{code}</code>
                  </pre>
                );
              }
              return (
                <p key={i} style={styles.paragraph}>
                  {para}
                </p>
              );
            })}
          </div>
        </article>

        {/* Footer */}
        <footer style={styles.footer}>
          <div style={styles.footerBorder} />
          <div style={styles.footerGrid}>
            <span>Wiki Article</span>
            <span style={styles.textCenter}>Haven Network</span>
            <span style={{ textAlign: "right" }}>Phase 4</span>
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
  },
  backLink: {
    color: "var(--primary)",
    textDecoration: "none",
    fontWeight: 600,
  },
  headerMeta: {
    letterSpacing: "0.05em",
  },
  article: {
    flexGrow: 1,
  },
  metaRow: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    marginBottom: "1rem",
  },
  versionBadge: {
    fontSize: "0.7rem",
    fontWeight: 700,
    textTransform: "uppercase",
    padding: "0.2rem 0.5rem",
    backgroundColor: "var(--primary-light)",
    color: "var(--primary)",
    border: "1px solid var(--border-color)",
    borderRadius: "2px",
  },
  dateMeta: {
    fontSize: "0.85rem",
    color: "var(--text-light)",
  },
  titleArea: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "2.5rem",
    marginBottom: "1.5rem",
    flexWrap: "wrap",
  },
  title: {
    fontFamily: "var(--font-serif)",
    fontSize: "3rem",
    lineHeight: 1.1,
    fontWeight: 800,
    letterSpacing: "-0.04em",
    margin: 0,
    padding: 0,
    border: "none",
    flex: 1,
  },
  editBtn: {
    padding: "0.5rem 1.25rem",
    fontSize: "0.85rem",
  },
  auditPassport: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    padding: "1rem",
    backgroundColor: "var(--bg-main)",
    border: "1px solid var(--border-light)",
    marginBottom: "2.5rem",
    maxWidth: "400px",
  },
  avatar: {
    width: "36px",
    height: "36px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "white",
    fontSize: "0.95rem",
    fontWeight: 600,
  },
  auditLabel: {
    fontSize: "0.75rem",
    color: "var(--text-light)",
    textTransform: "uppercase",
    letterSpacing: "0.03em",
  },
  authorMeta: {
    fontSize: "0.85rem",
    color: "var(--text-main)",
  },
  handle: {
    fontFamily: "var(--font-mono)",
    fontSize: "0.75rem",
    color: "var(--text-light)",
  },
  content: {
    fontSize: "1.1rem",
    lineHeight: 1.8,
    color: "var(--text-main)",
    maxWidth: "800px",
  },
  paragraph: {
    marginBottom: "1.5rem",
  },
  codeBlock: {
    backgroundColor: "var(--bg-main)",
    border: "1px solid var(--border-color)",
    padding: "1.25rem",
    fontFamily: "var(--font-mono)",
    fontSize: "0.9rem",
    overflowX: "auto",
    marginBottom: "1.5rem",
    borderRadius: "2px",
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
