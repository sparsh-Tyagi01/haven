"use client";

import React from "react";
import Link from "next/link";
import Navbar from "./components/Navbar";
import { useAuth } from "../hooks/useAuth";
import { useMyCommunities, type Community } from "../hooks/useCommunities";
import { useHomeFeed, type Post } from "../hooks/usePosts";

export default function HomePage() {
  const { user, isAuthenticated, loading } = useAuth();
  const { data: myCommunitiesData, loading: communitiesLoading } =
    useMyCommunities();
  const { data: homeFeedData, loading: feedLoading } = useHomeFeed();

  if (loading) {
    return (
      <div className="page-wrapper">
        <Navbar />
        <div style={styles.loadingScreen}>
          <div style={styles.spinner} />
          <p style={styles.loadingText}>Loading Haven...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrapper">
      <Navbar />
      <main className="page-content">
        {!isAuthenticated ? <LandingPage /> : <Dashboard />}
      </main>
      <Footer />
    </div>
  );

  /* ─────────────────────────────────────────────────────────
     Landing Page (Unauthenticated)
     ───────────────────────────────────────────────────────── */
  function LandingPage() {
    return (
      <>
        {/* Hero */}
        <section style={styles.hero}>
          <div className="container" style={styles.heroInner}>
            <p style={styles.heroEyebrow}>Community-First Knowledge Network</p>
            <h1 style={styles.heroTitle}>
              Where communities build
              <br />
              lasting knowledge
            </h1>
            <p style={styles.heroDescription}>
              Haven is a platform for communities that value thoughtful
              discussion, permanent documentation, and meaningful collaboration
              — without the noise of algorithmic feeds.
            </p>
            <div style={styles.heroCtas}>
              <Link href="/auth/register" className="btn btn-primary btn-lg">
                Join Haven
              </Link>
              <Link href="/auth/login" className="btn btn-secondary btn-lg">
                Sign In
              </Link>
            </div>
          </div>
        </section>

        {/* Thin decorative rule */}
        <div className="container">
          <div style={styles.rule} />
        </div>

        {/* Features */}
        <section style={styles.featuresSection}>
          <div className="container">
            <div style={styles.featuresGrid}>
              <div style={styles.featureCard}>
                <span style={styles.featureIcon}>⬡</span>
                <h3 style={styles.featureTitle}>Community-First</h3>
                <p style={styles.featureDesc}>
                  All discussions live inside focused communities. No global
                  follower feeds — your experience is shaped by the groups you
                  choose to join.
                </p>
              </div>
              <div style={styles.featureCard}>
                <span style={styles.featureIcon}>◈</span>
                <h3 style={styles.featureTitle}>Knowledge Preserved</h3>
                <p style={styles.featureDesc}>
                  Important discussions are synthesized into a structured wiki
                  that grows over time. Communities become smarter as they age.
                </p>
              </div>
              <div style={styles.featureCard}>
                <span style={styles.featureIcon}>▣</span>
                <h3 style={styles.featureTitle}>Built-in Tools</h3>
                <p style={styles.featureDesc}>
                  Project boards, events, real-time chat, and AI-assisted
                  moderation — everything a community needs, in one place.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Bottom CTA */}
        <section style={styles.bottomCta}>
          <div className="container" style={{ textAlign: "center" }}>
            <h2 style={styles.bottomCtaTitle}>
              Ready to build something meaningful?
            </h2>
            <p style={styles.bottomCtaDesc}>
              Join Haven and be part of communities that value substance over
              noise.
            </p>
            <Link href="/auth/register" className="btn btn-primary btn-lg">
              Get Started — It&apos;s Free
            </Link>
          </div>
        </section>
      </>
    );
  }

  /* ─────────────────────────────────────────────────────────
     Dashboard (Authenticated)
     ───────────────────────────────────────────────────────── */
  function Dashboard() {
    return (
      <div className="container" style={styles.dashboardContainer}>
        {/* Welcome */}
        <div style={styles.welcomeBar}>
          <h2 style={styles.welcomeTitle}>
            Welcome back, {user?.display_name || user?.username}
          </h2>
        </div>

        <div style={styles.dashboardGrid}>
          {/* ── Main Column: Feed ─────────────── */}
          <div style={styles.mainColumn}>
            <div style={styles.sectionHeader}>
              <h3 style={styles.sectionTitle}>Your Feed</h3>
            </div>

            {feedLoading ? (
              <FeedSkeleton />
            ) : homeFeedData?.posts && homeFeedData.posts.length > 0 ? (
              <div style={styles.feedList}>
                {homeFeedData.posts.map((post: Post) => (
                  <FeedCard key={post.id} post={post} />
                ))}
              </div>
            ) : (
              <div style={styles.emptyState}>
                <span style={styles.emptyIcon}>◉</span>
                <h4 style={styles.emptyTitle}>Your feed is empty</h4>
                <p style={styles.emptyDesc}>
                  Join some communities to see posts here.
                </p>
                <Link
                  href="/communities"
                  className="btn btn-primary"
                >
                  Browse Communities
                </Link>
              </div>
            )}
          </div>

          {/* ── Sidebar ───────────────────────── */}
          <aside style={styles.sidebar}>
            {/* Profile Card */}
            <div className="card" style={styles.profileCard}>
              <div style={styles.profileHeader}>
                <div style={styles.profileAvatar}>
                  {user?.display_name?.charAt(0).toUpperCase() ||
                    user?.username.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={styles.profileName}>{user?.display_name}</div>
                  <div style={styles.profileUsername}>@{user?.username}</div>
                </div>
              </div>
              <div style={styles.profileStats}>
                <div style={styles.profileStat}>
                  <span style={styles.statValue}>{user?.reputation || 0}</span>
                  <span style={styles.statLabel}>Reputation</span>
                </div>
                <div style={styles.profileStat}>
                  <span style={styles.statValue}>
                    {myCommunitiesData?.communities?.length || 0}
                  </span>
                  <span style={styles.statLabel}>Communities</span>
                </div>
              </div>
              {user?.skills && user.skills.length > 0 && (
                <div style={styles.skillsList}>
                  {user.skills.map((skill, idx) => (
                    <span key={idx} className="badge">
                      {skill}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="card" style={styles.quickActions}>
              <Link
                href="/communities"
                className="btn btn-primary"
                style={{ width: "100%", textDecoration: "none" }}
              >
                Explore Communities
              </Link>
              <Link
                href="/messages"
                className="btn btn-secondary"
                style={{ width: "100%", textDecoration: "none" }}
              >
                ✉ Messages
              </Link>
            </div>

            {/* Communities List */}
            <div className="card" style={styles.communitiesSidebar}>
              <div style={styles.sidebarSectionHeader}>
                <h4 style={styles.sidebarSectionTitle}>Your Communities</h4>
                <Link href="/communities" style={styles.seeAllLink}>
                  See all
                </Link>
              </div>

              {communitiesLoading ? (
                <p style={styles.loadingSmall}>Loading...</p>
              ) : myCommunitiesData?.communities &&
                myCommunitiesData.communities.length > 0 ? (
                <div style={styles.communityList}>
                  {myCommunitiesData.communities.map((c: Community) => (
                    <Link
                      key={c.id}
                      href={`/communities/${c.slug}`}
                      style={styles.communityItem}
                    >
                      <span
                        style={{
                          ...styles.communityDot,
                          backgroundColor: stringToColor(c.name),
                        }}
                      >
                        {c.name.charAt(0).toUpperCase()}
                      </span>
                      <span style={styles.communityItemInfo}>
                        <span style={styles.communityItemName}>{c.name}</span>
                        <span style={styles.communityItemMeta}>
                          {c.member_count} members
                        </span>
                      </span>
                    </Link>
                  ))}
                </div>
              ) : (
                <p style={styles.emptySidebar}>
                  You haven&apos;t joined any communities yet.
                </p>
              )}
            </div>
          </aside>
        </div>
      </div>
    );
  }
}

/* ═══════════════════════════════════════════════════════════
   Feed Card Component
   ═══════════════════════════════════════════════════════════ */

function FeedCard({ post }: { post: Post }) {
  return (
    <article className="card card-hover" style={styles.feedCard}>
      <div style={styles.feedCardTop}>
        <Link
          href={`/communities/${post.community_slug}`}
          style={styles.feedCommunity}
        >
          <span
            style={{
              ...styles.feedCommunityDot,
              backgroundColor: stringToColor(post.community_name || ""),
            }}
          />
          {post.community_name}
        </Link>
        <span style={styles.feedDot}>·</span>
        <span style={styles.feedTimestamp}>
          {formatTimeAgo(post.created_at)}
        </span>
      </div>

      <Link href={`/posts/${post.id}`} style={styles.feedTitle}>
        {post.title}
      </Link>

      <div style={styles.feedCardBottom}>
        <div style={styles.feedMeta}>
          <span style={styles.feedAuthor}>
            by <strong>@{post.author_username}</strong>
          </span>
          {post.post_type !== "discussion" && (
            <span className="badge" style={styles.feedTypeBadge}>
              {post.post_type}
            </span>
          )}
          {post.post_type === "question" && (
            <span
              className="badge"
              style={{
                backgroundColor: post.is_solved
                  ? "var(--color-success-light)"
                  : "var(--color-warning-light)",
                color: post.is_solved
                  ? "var(--color-success)"
                  : "var(--color-warning)",
              }}
            >
              {post.is_solved ? "✓ Solved" : "Open"}
            </span>
          )}
        </div>
        <div style={styles.feedVotes}>
          <span style={styles.voteArrow}>▲</span>
          <span style={styles.voteCount}>{post.upvotes_count}</span>
        </div>
      </div>
    </article>
  );
}

/* ═══════════════════════════════════════════════════════════
   Feed Skeleton Loader
   ═══════════════════════════════════════════════════════════ */

function FeedSkeleton() {
  return (
    <div style={styles.feedList}>
      {[1, 2, 3].map((i) => (
        <div key={i} className="card" style={styles.skeletonCard}>
          <div
            className="animate-pulse"
            style={{ ...styles.skeletonLine, width: "40%" }}
          />
          <div
            className="animate-pulse"
            style={{ ...styles.skeletonLine, width: "80%", height: "1.25rem" }}
          />
          <div
            className="animate-pulse"
            style={{ ...styles.skeletonLine, width: "60%" }}
          />
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Footer
   ═══════════════════════════════════════════════════════════ */

function Footer() {
  return (
    <footer style={styles.footer}>
      <div className="container">
        <div style={styles.footerRule} />
        <div style={styles.footerInner}>
          <span style={styles.footerBrand}>Haven</span>
          <span style={styles.footerText}>
            Community-First Knowledge Network
          </span>
          <span style={styles.footerText}>
            © {new Date().getFullYear()} Haven
          </span>
        </div>
      </div>
    </footer>
  );
}

/* ═══════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════ */

function stringToColor(str: string): string {
  const colors = [
    "#2d4a3e",
    "#8b3a3a",
    "#4a6b8a",
    "#6b5b3e",
    "#5e4a7a",
    "#2d6a6a",
    "#8b5e3c",
    "#3c6e47",
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function formatTimeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

/* ═══════════════════════════════════════════════════════════
   Styles
   ═══════════════════════════════════════════════════════════ */

const styles: { [key: string]: React.CSSProperties } = {
  /* ── Loading ─────────────────────────────── */
  loadingScreen: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "1rem",
  },
  spinner: {
    width: "28px",
    height: "28px",
    border: "2px solid var(--border-primary)",
    borderTop: "2px solid var(--color-primary)",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  loadingText: {
    fontSize: "var(--text-sm)",
    color: "var(--text-tertiary)",
    fontStyle: "italic",
    margin: 0,
  },

  /* ── Hero ─────────────────────────────────── */
  hero: {
    paddingTop: "5rem",
    paddingBottom: "4rem",
  },
  heroInner: {
    maxWidth: "680px",
    textAlign: "center" as const,
    margin: "0 auto",
  },
  heroEyebrow: {
    fontSize: "var(--text-sm)",
    fontWeight: 600,
    textTransform: "uppercase" as const,
    letterSpacing: "0.08em",
    color: "var(--color-primary)",
    marginBottom: "1rem",
  },
  heroTitle: {
    fontFamily: "var(--font-display)",
    fontSize: "3.25rem",
    fontWeight: 700,
    letterSpacing: "-0.03em",
    lineHeight: 1.1,
    color: "var(--text-primary)",
    marginBottom: "1.5rem",
  },
  heroDescription: {
    fontSize: "var(--text-lg)",
    color: "var(--text-secondary)",
    lineHeight: 1.7,
    maxWidth: "540px",
    margin: "0 auto 2.5rem",
  },
  heroCtas: {
    display: "flex",
    gap: "0.75rem",
    justifyContent: "center",
  },

  /* ── Rule ─────────────────────────────────── */
  rule: {
    height: "1px",
    background:
      "linear-gradient(to right, transparent, var(--border-secondary), transparent)",
  },

  /* ── Features ────────────────────────────── */
  featuresSection: {
    padding: "4rem 0",
  },
  featuresGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "2rem",
  },
  featureCard: {
    padding: "2rem 1.5rem",
    textAlign: "center" as const,
  },
  featureIcon: {
    display: "block",
    fontSize: "1.75rem",
    color: "var(--color-primary)",
    marginBottom: "1rem",
  },
  featureTitle: {
    fontFamily: "var(--font-serif)",
    fontSize: "var(--text-xl)",
    fontWeight: 600,
    marginBottom: "0.75rem",
    color: "var(--text-primary)",
  },
  featureDesc: {
    fontSize: "var(--text-base)",
    color: "var(--text-secondary)",
    lineHeight: 1.6,
    margin: 0,
  },

  /* ── Bottom CTA ──────────────────────────── */
  bottomCta: {
    padding: "4rem 0 5rem",
    borderTop: "1px solid var(--border-primary)",
  },
  bottomCtaTitle: {
    fontFamily: "var(--font-display)",
    fontSize: "var(--text-3xl)",
    fontWeight: 700,
    marginBottom: "0.75rem",
  },
  bottomCtaDesc: {
    fontSize: "var(--text-lg)",
    color: "var(--text-secondary)",
    marginBottom: "2rem",
  },

  /* ── Dashboard ───────────────────────────── */
  dashboardContainer: {
    paddingTop: "2rem",
    paddingBottom: "3rem",
  },
  welcomeBar: {
    marginBottom: "2rem",
    paddingBottom: "1.25rem",
    borderBottom: "1px solid var(--border-primary)",
  },
  welcomeTitle: {
    fontFamily: "var(--font-serif)",
    fontSize: "var(--text-2xl)",
    fontWeight: 600,
    margin: 0,
  },
  dashboardGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 340px",
    gap: "2rem",
    alignItems: "start",
  },

  /* ── Main Column ─────────────────────────── */
  mainColumn: {
    minWidth: 0,
  },
  sectionHeader: {
    marginBottom: "1rem",
  },
  sectionTitle: {
    fontFamily: "var(--font-serif)",
    fontSize: "var(--text-lg)",
    fontWeight: 600,
    margin: 0,
    textTransform: "uppercase" as const,
    letterSpacing: "0.03em",
    borderBottom: "1px solid var(--text-primary)",
    paddingBottom: "0.4rem",
    display: "inline-block",
  },

  /* ── Feed ─────────────────────────────────── */
  feedList: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "0.75rem",
  },
  feedCard: {
    padding: "1.25rem 1.5rem",
    display: "flex",
    flexDirection: "column" as const,
    gap: "0.5rem",
    cursor: "pointer",
    transition: "all 200ms ease",
  },
  feedCardTop: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    fontSize: "var(--text-sm)",
  },
  feedCommunity: {
    display: "flex",
    alignItems: "center",
    gap: "0.35rem",
    fontWeight: 600,
    color: "var(--text-secondary)",
    textDecoration: "none",
    fontSize: "var(--text-sm)",
  },
  feedCommunityDot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    flexShrink: 0,
  },
  feedDot: {
    color: "var(--text-tertiary)",
  },
  feedTimestamp: {
    color: "var(--text-tertiary)",
    fontSize: "var(--text-xs)",
  },
  feedTitle: {
    fontFamily: "var(--font-serif)",
    fontSize: "var(--text-lg)",
    fontWeight: 600,
    color: "var(--text-primary)",
    textDecoration: "none",
    lineHeight: 1.35,
  },
  feedCardBottom: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "1rem",
  },
  feedMeta: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    fontSize: "var(--text-sm)",
    color: "var(--text-tertiary)",
    flexWrap: "wrap" as const,
  },
  feedAuthor: {
    color: "var(--text-tertiary)",
    fontSize: "var(--text-sm)",
  },
  feedTypeBadge: {
    fontSize: "var(--text-xs)",
  },
  feedVotes: {
    display: "flex",
    alignItems: "center",
    gap: "0.3rem",
    color: "var(--color-primary)",
    fontSize: "var(--text-sm)",
    fontWeight: 600,
  },
  voteArrow: {
    fontSize: "0.7rem",
  },
  voteCount: {
    fontSize: "var(--text-sm)",
  },

  /* ── Skeleton ─────────────────────────────── */
  skeletonCard: {
    padding: "1.5rem",
    display: "flex",
    flexDirection: "column" as const,
    gap: "0.75rem",
  },
  skeletonLine: {
    height: "0.875rem",
    backgroundColor: "var(--bg-inset)",
    borderRadius: "var(--radius-sm)",
  },

  /* ── Empty State ─────────────────────────── */
  emptyState: {
    textAlign: "center" as const,
    padding: "3rem 2rem",
    border: "1px dashed var(--border-primary)",
    borderRadius: "var(--radius-md)",
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    gap: "0.75rem",
  },
  emptyIcon: {
    fontSize: "2rem",
    color: "var(--text-tertiary)",
  },
  emptyTitle: {
    fontFamily: "var(--font-serif)",
    fontSize: "var(--text-xl)",
    margin: 0,
  },
  emptyDesc: {
    color: "var(--text-tertiary)",
    fontSize: "var(--text-base)",
    margin: 0,
    maxWidth: "320px",
  },

  /* ── Sidebar ─────────────────────────────── */
  sidebar: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "1rem",
    position: "sticky" as const,
    top: "calc(var(--navbar-height) + 1rem)",
  },

  /* ── Profile Card ────────────────────────── */
  profileCard: {
    padding: "1.25rem",
  },
  profileHeader: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    marginBottom: "1rem",
  },
  profileAvatar: {
    width: "44px",
    height: "44px",
    borderRadius: "50%",
    backgroundColor: "var(--color-primary)",
    color: "var(--text-inverse)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "var(--text-lg)",
    fontWeight: 600,
    flexShrink: 0,
  },
  profileName: {
    fontSize: "var(--text-base)",
    fontWeight: 600,
    color: "var(--text-primary)",
  },
  profileUsername: {
    fontSize: "var(--text-sm)",
    color: "var(--text-tertiary)",
    fontFamily: "var(--font-mono)",
  },
  profileStats: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "0.5rem",
    padding: "0.75rem 0",
    borderTop: "1px solid var(--border-primary)",
  },
  profileStat: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    gap: "0.15rem",
  },
  statValue: {
    fontSize: "var(--text-xl)",
    fontWeight: 700,
    color: "var(--text-primary)",
  },
  statLabel: {
    fontSize: "var(--text-xs)",
    color: "var(--text-tertiary)",
    textTransform: "uppercase" as const,
    letterSpacing: "0.04em",
  },
  skillsList: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: "0.35rem",
    paddingTop: "0.75rem",
    borderTop: "1px solid var(--border-primary)",
  },

  /* ── Quick Actions ───────────────────────── */
  quickActions: {
    padding: "1rem",
    display: "flex",
    flexDirection: "column" as const,
    gap: "0.5rem",
  },

  /* ── Communities Sidebar ─────────────────── */
  communitiesSidebar: {
    padding: "1.25rem",
  },
  sidebarSectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "0.75rem",
  },
  sidebarSectionTitle: {
    fontSize: "var(--text-sm)",
    fontWeight: 600,
    textTransform: "uppercase" as const,
    letterSpacing: "0.04em",
    color: "var(--text-secondary)",
    margin: 0,
  },
  seeAllLink: {
    fontSize: "var(--text-xs)",
    fontWeight: 500,
    color: "var(--color-primary)",
    textDecoration: "none",
  },
  communityList: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "0.25rem",
  },
  communityItem: {
    display: "flex",
    alignItems: "center",
    gap: "0.6rem",
    padding: "0.5rem 0.4rem",
    borderRadius: "var(--radius-sm)",
    textDecoration: "none",
    color: "inherit",
    transition: "background-color 150ms ease",
  },
  communityDot: {
    width: "28px",
    height: "28px",
    borderRadius: "var(--radius-sm)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "white",
    fontSize: "var(--text-xs)",
    fontWeight: 700,
    flexShrink: 0,
  },
  communityItemInfo: {
    display: "flex",
    flexDirection: "column" as const,
    minWidth: 0,
  },
  communityItemName: {
    fontSize: "var(--text-sm)",
    fontWeight: 500,
    color: "var(--text-primary)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  },
  communityItemMeta: {
    fontSize: "var(--text-xs)",
    color: "var(--text-tertiary)",
  },
  loadingSmall: {
    fontSize: "var(--text-sm)",
    color: "var(--text-tertiary)",
    fontStyle: "italic",
    margin: 0,
  },
  emptySidebar: {
    fontSize: "var(--text-sm)",
    color: "var(--text-tertiary)",
    fontStyle: "italic",
    margin: 0,
  },

  /* ── Footer ──────────────────────────────── */
  footer: {
    paddingTop: "2rem",
    paddingBottom: "2rem",
    marginTop: "auto",
  },
  footerRule: {
    height: "1px",
    backgroundColor: "var(--border-primary)",
    marginBottom: "1.25rem",
  },
  footerInner: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: "var(--text-xs)",
    color: "var(--text-tertiary)",
  },
  footerBrand: {
    fontFamily: "var(--font-display)",
    fontSize: "var(--text-sm)",
    fontWeight: 600,
    color: "var(--text-secondary)",
  },
  footerText: {
    letterSpacing: "0.02em",
  },
};
