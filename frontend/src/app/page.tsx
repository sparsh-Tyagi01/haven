"use client";

import React from "react";
import Link from "next/link";
import { useAuth } from "../hooks/useAuth";
import { useMyCommunities, type Community } from "../hooks/useCommunities";
import { useHomeFeed, type Post } from "../hooks/usePosts";

export default function HomePage() {
  const { user, isAuthenticated, loading, logout } = useAuth();
  const { data: myCommunitiesData, loading: communitiesLoading } = useMyCommunities();
  const { data: homeFeedData, loading: feedLoading } = useHomeFeed();

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner}></div>
        <p style={styles.loadingText}>Fetching Haven session...</p>
      </div>
    );
  }

  return (
    <div style={styles.pageContainer}>
      <div style={styles.editorialFrame}>
        {/* Header Block */}
        <header style={styles.header}>
          <div style={styles.headerTop}>
            <span style={styles.headerMeta}>No. 1 — Monthly Circulation</span>
            <span style={styles.headerMeta}>{new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
          </div>
          <h1 style={styles.brandTitle}>THE HAVEN</h1>
          <p style={styles.brandSub}>An Independent Knowledge Network and Social Operating System</p>
        </header>

        {/* Auth Dependent Contents */}
        {!isAuthenticated ? (
          /* Unauthenticated Editorial Landing */
          <div style={styles.landingGrid}>
            <div style={styles.mainFeature}>
              <h2 style={styles.featureTitle}>The Algorithmic Outrage Model Has Failed.</h2>
              <p style={styles.paragraph}>
                Existing platforms organize around global feeds, optimized for metrics like screen-time, click velocity, and advertising margins. The outcome is the degradation of collective knowledge and a default state of constant outrage.
              </p>
              <p style={styles.paragraph}>
                <strong>Haven</strong> proposes a structural redirection. By centering all network interactions inside self-contained <strong>Communities (Servers)</strong>, it creates spaces for cooperative thinking, permanent documentation, and structured workflows.
              </p>
              <div style={styles.landingCtas}>
                <Link href="/auth/register" className="btn btn-primary" style={styles.ctaBtn}>
                  Establish Citizenship
                </Link>
                <Link href="/auth/login" className="btn btn-secondary" style={styles.ctaBtn}>
                  Sign In to Registry
                </Link>
              </div>
            </div>

            <div style={styles.sideFeature}>
              <h3 style={styles.sideTitle}>The Foundations of Haven</h3>
              <ul style={styles.foundationList}>
                <li style={styles.foundationItem}>
                  <strong>No Global Followers</strong>
                  <p style={styles.foundationDesc}>All discussions happen in server channels. Followers do not determine credibility; helpful contributions do.</p>
                </li>
                <li style={styles.foundationItem}>
                  <strong>Permanent Memory</strong>
                  <p style={styles.foundationDesc}>Important discussions are synthesized by AI and verified by the community to construct structured wiki documentation.</p>
                </li>
                <li style={styles.foundationItem}>
                  <strong>Integrated Workflows</strong>
                  <p style={styles.foundationDesc}>Lightweight project Kanban boards and events are built right into the server, removing external tool sprawl.</p>
                </li>
              </ul>
            </div>
          </div>
        ) : (
          /* Authenticated Dashboard */
          <div style={styles.dashboardContainer}>
            <div style={styles.welcomeBanner}>
              <h2 style={styles.welcomeTitle}>Welcome back, {user?.display_name || user?.username}</h2>
              <p style={styles.welcomeSub}>Identity verified. Current workspace environment is active.</p>
            </div>

            <div style={styles.dashboardGrid}>
              {/* Profile Card */}
              <div style={styles.profileCard}>
                <h3 style={styles.cardHeader}>Citizenship Passport</h3>
                <div style={styles.avatarRow}>
                  <div style={styles.avatarPlaceholder}>
                    {user?.display_name?.charAt(0).toUpperCase() || user?.username.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h4 style={styles.profileName}>{user?.display_name}</h4>
                    <span style={styles.profileUsername}>@{user?.username}</span>
                  </div>
                </div>

                <div style={styles.profileMetaList}>
                  <div style={styles.profileMetaItem}>
                    <span style={styles.metaLabel}>Reputation Score</span>
                    <span style={styles.metaValue}>{user?.reputation} Badge Points</span>
                  </div>
                  <div style={styles.profileMetaItem}>
                    <span style={styles.metaLabel}>Profile Visibility</span>
                    <span style={{ ...styles.metaValue, textTransform: "capitalize" } as React.CSSProperties}>{user?.privacy}</span>
                  </div>
                  <div style={styles.profileMetaItem}>
                    <span style={styles.metaLabel}>Verified Skills</span>
                    <div style={styles.skillsContainer}>
                      {user?.skills && user.skills.length > 0 ? (
                        user.skills.map((skill, idx) => (
                          <span key={idx} style={styles.skillTag}>{skill}</span>
                        ))
                      ) : (
                        <span style={styles.noSkillsText}>No skills documented yet.</span>
                      )}
                    </div>
                  </div>
                </div>

                <button onClick={logout} className="btn btn-secondary" style={styles.logoutBtn}>
                  Revoke Session
                </button>
              </div>

              {/* Status Board */}
              <div style={styles.statusBoard}>
                <h3 style={styles.cardHeader}>Workspace Diagnostics</h3>
                <p style={styles.paragraph}>
                  You are successfully authenticated against the Haven modular monolith backend.
                </p>
                <div style={styles.statusList}>
                  <div style={styles.statusItem}>
                    <div style={styles.statusIndicatorActive}></div>
                    <span>API Gateway: Online (Port 8080)</span>
                  </div>
                  <div style={styles.statusItem}>
                    <div style={styles.statusIndicatorActive}></div>
                    <span>PostgreSQL Database: Connected</span>
                  </div>
                  <div style={styles.statusItem}>
                    <div style={styles.statusIndicatorActive}></div>
                    <span>Redis Cache Store: Connected</span>
                  </div>
                  <div style={styles.statusItem}>
                    <div style={styles.statusIndicatorActive}></div>
                    <span>Community Module: Active (Phase 2)</span>
                  </div>
                  <div style={styles.statusItem}>
                    <div style={styles.statusIndicatorPending}></div>
                    <span>WebSockets (Presence & Chat): Pending Phase 5</span>
                  </div>
                </div>
                <div style={styles.infoAlert}>
                  <strong>Phase 2 Accomplished:</strong> Community proposals, server provisioning, membership management, and RBAC are now fully operational. Next up: Phase 3 — Posts & Comment System!
                </div>
              </div>
            </div>

            {/* Your Communities Section */}
            <div style={styles.communitiesSection}>
              <div style={styles.communitiesSectionHeader}>
                <h3 style={styles.cardHeader}>Your Communities</h3>
                <Link href="/communities" style={styles.exploreLink}>
                  Explore Registry →
                </Link>
              </div>
              {communitiesLoading ? (
                <p style={styles.loadingSmallText}>Loading communities...</p>
              ) : myCommunitiesData && myCommunitiesData.communities && myCommunitiesData.communities.length > 0 ? (
                <div style={styles.communityMiniGrid}>
                  {myCommunitiesData.communities.map((c: Community) => (
                    <Link key={c.id} href={`/communities/${c.slug}`} style={styles.communityMiniCard}>
                      <div style={{ ...styles.miniLogo, backgroundColor: stringToColor(c.name) }}>
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <div style={styles.miniInfo}>
                        <span style={styles.miniName}>{c.name}</span>
                        <span style={styles.miniMeta}>{c.member_count} members · {c.category}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div style={styles.noCommunitiesState}>
                  <p style={styles.noCommunitiesText}>You haven&apos;t joined any communities yet.</p>
                  <Link href="/communities" className="btn btn-primary" style={{ padding: '0.6rem 1.25rem', fontSize: '0.85rem' }}>
                    Explore Communities
                  </Link>
                </div>
              )}
            </div>

            {/* Personalized Timeline (Home Feed) Section */}
            <div style={styles.feedSection}>
              <h3 style={styles.cardHeader}>Personalized Timeline</h3>
              {feedLoading ? (
                <p style={styles.loadingSmallText}>Aggregating your community feeds...</p>
              ) : homeFeedData && homeFeedData.posts && homeFeedData.posts.length > 0 ? (
                <div style={styles.postsList}>
                  {homeFeedData.posts.map((p: Post) => (
                    <div key={p.id} style={styles.postFeedItem}>
                      <div style={styles.postVoteScore}>
                        <span>▲</span>
                        <strong>{p.upvotes_count}</strong>
                      </div>
                      <div style={styles.postBodyInfo}>
                        <div style={styles.postTitleRow}>
                          <Link href={`/posts/${p.id}`} style={styles.postLinkTitle}>
                            {p.title}
                          </Link>
                          {p.post_type === "question" && (
                            <span
                              style={{
                                ...styles.solvedTag,
                                backgroundColor: p.is_solved ? "var(--success)" : "var(--primary-light)",
                                color: p.is_solved ? "white" : "var(--primary)",
                              }}
                            >
                              {p.is_solved ? "✓ Solved" : "Unresolved"}
                            </span>
                          )}
                        </div>
                        <div style={styles.postMetaLine}>
                          <span style={styles.itemTypeBadge}>{p.post_type}</span>
                          <span>
                            in <Link href={`/communities/${p.community_slug}`}><strong>{p.community_name}</strong></Link>
                          </span>
                          <span>by <strong>@{p.author_username}</strong></span>
                          <span>·</span>
                          <span>{new Date(p.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={styles.noPostsCard}>
                  <p style={styles.noPostsText}>No discussions have been published in your joined communities yet.</p>
                  <Link href="/communities" className="btn btn-secondary" style={{ marginTop: '0.5rem', padding: '0.4rem 1rem', fontSize: '0.8rem' }}>
                    Browse Communities Registry
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <footer style={styles.footer}>
          <div style={styles.footerBorder}></div>
          <div style={styles.footerGrid}>
            <span>No. 1 — Combined Edition</span>
            <span style={styles.textCenter}>Independent Social OS</span>
            <span style={{ textAlign: "right" }}>Haven © {new Date().getFullYear()}</span>
          </div>
        </footer>
      </div>
    </div>
  );
}

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
    marginBottom: "2.5rem",
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
  headerMeta: {
    letterSpacing: "0.05em",
  },
  brandTitle: {
    fontFamily: "var(--font-serif)",
    fontSize: "4.5rem",
    fontWeight: 800,
    letterSpacing: "-0.04em",
    textTransform: "uppercase",
    border: "none",
    padding: 0,
    margin: 0,
    lineHeight: 0.9,
  },
  brandSub: {
    fontFamily: "var(--font-sans)",
    fontSize: "0.9rem",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    color: "var(--text-muted)",
    marginTop: "0.75rem",
  },
  landingGrid: {
    display: "grid",
    gridTemplateColumns: "1.5fr 1fr",
    gap: "3.5rem",
    flexGrow: 1,
  },
  mainFeature: {
    borderRight: "1px solid var(--border-color)",
    paddingRight: "3.5rem",
  },
  featureTitle: {
    fontFamily: "var(--font-serif)",
    fontSize: "2.5rem",
    fontWeight: 600,
    letterSpacing: "-0.02em",
    lineHeight: 1.2,
    marginBottom: "1.5rem",
  },
  paragraph: {
    fontSize: "1.05rem",
    color: "var(--text-main)",
    lineHeight: 1.7,
    marginBottom: "1.25rem",
  },
  landingCtas: {
    display: "flex",
    gap: "1rem",
    marginTop: "2.5rem",
  },
  ctaBtn: {
    padding: "1rem 2rem",
  },
  sideFeature: {
    display: "flex",
    flexDirection: "column",
  },
  sideTitle: {
    fontFamily: "var(--font-serif)",
    fontSize: "1.5rem",
    fontWeight: 600,
    fontStyle: "italic",
    marginBottom: "1.5rem",
    borderBottom: "1px solid var(--text-main)",
    paddingBottom: "0.5rem",
  },
  foundationList: {
    listStyle: "none",
    display: "flex",
    flexDirection: "column",
    gap: "1.5rem",
  },
  foundationItem: {
    borderBottom: "1px dashed var(--border-color)",
    paddingBottom: "1.25rem",
  },
  foundationDesc: {
    fontSize: "0.92rem",
    color: "var(--text-muted)",
    marginTop: "0.25rem",
    lineHeight: 1.5,
  },
  dashboardContainer: {
    flexGrow: 1,
    display: "flex",
    flexDirection: "column",
    gap: "2.5rem",
  },
  welcomeBanner: {
    backgroundColor: "var(--primary-light)",
    borderLeft: "4px solid var(--primary)",
    padding: "1.5rem 2rem",
  },
  welcomeTitle: {
    fontSize: "1.8rem",
    border: "none",
    margin: 0,
    padding: 0,
  },
  welcomeSub: {
    fontFamily: "var(--font-mono)",
    fontSize: "0.8rem",
    color: "var(--text-muted)",
    textTransform: "uppercase",
    marginTop: "0.25rem",
  },
  dashboardGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1.5fr",
    gap: "3rem",
  },
  profileCard: {
    border: "1px solid var(--border-color)",
    padding: "2rem",
    backgroundColor: "var(--bg-surface)",
    display: "flex",
    flexDirection: "column",
  },
  cardHeader: {
    fontFamily: "var(--font-serif)",
    fontSize: "1.35rem",
    borderBottom: "1px solid var(--text-main)",
    paddingBottom: "0.5rem",
    marginBottom: "1.5rem",
    textTransform: "uppercase",
    letterSpacing: "0.02em",
  },
  avatarRow: {
    display: "flex",
    alignItems: "center",
    gap: "1.25rem",
    marginBottom: "1.5rem",
  },
  avatarPlaceholder: {
    width: "60px",
    height: "60px",
    borderRadius: "50%",
    backgroundColor: "var(--primary)",
    color: "var(--bg-surface)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "1.75rem",
    fontWeight: 600,
  },
  profileName: {
    fontFamily: "var(--font-serif)",
    fontSize: "1.35rem",
    margin: 0,
  },
  profileUsername: {
    fontFamily: "var(--font-mono)",
    fontSize: "0.85rem",
    color: "var(--text-light)",
  },
  profileMetaList: {
    display: "flex",
    flexDirection: "column",
    gap: "1.25rem",
    marginBottom: "2rem",
  },
  profileMetaItem: {
    display: "flex",
    flexDirection: "column",
    gap: "0.25rem",
  },
  metaLabel: {
    fontSize: "0.8rem",
    fontWeight: 600,
    color: "var(--text-light)",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  metaValue: {
    fontSize: "1.05rem",
    color: "var(--text-main)",
    fontWeight: 500,
  },
  skillsContainer: {
    display: "flex",
    flexWrap: "wrap",
    gap: "0.5rem",
    marginTop: "0.25rem",
  },
  skillTag: {
    backgroundColor: "var(--primary-light)",
    color: "var(--primary)",
    fontSize: "0.8rem",
    fontWeight: 600,
    padding: "0.25rem 0.6rem",
    borderRadius: "2px",
    border: "1px solid var(--border-color)",
  },
  noSkillsText: {
    fontSize: "0.9rem",
    color: "var(--text-light)",
    fontStyle: "italic",
  },
  logoutBtn: {
    width: "100%",
    marginTop: "auto",
  },
  statusBoard: {
    display: "flex",
    flexDirection: "column",
  },
  statusList: {
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
    margin: "1.5rem 0",
    padding: "1rem 1.5rem",
    border: "1px solid var(--border-color)",
    backgroundColor: "var(--bg-surface-hover)",
  },
  statusItem: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    fontSize: "0.95rem",
  },
  statusIndicatorActive: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    backgroundColor: "var(--success)",
  },
  statusIndicatorPending: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    backgroundColor: "var(--accent)",
  },
  infoAlert: {
    backgroundColor: "var(--primary-light)",
    border: "1px solid var(--border-color)",
    padding: "1.25rem",
    fontSize: "0.95rem",
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
  // Phase 2: Community dashboard styles
  communitiesSection: {
    borderTop: "1px solid var(--border-color)",
    paddingTop: "2rem",
  },
  communitiesSectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "1.5rem",
  },
  exploreLink: {
    fontFamily: "var(--font-sans)",
    fontSize: "0.85rem",
    fontWeight: 600,
    color: "var(--primary)",
    textDecoration: "none",
    textTransform: "uppercase" as const,
    letterSpacing: "0.04em",
  },
  communityMiniGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
    gap: "1rem",
  },
  communityMiniCard: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    padding: "1rem",
    border: "1px solid var(--border-color)",
    backgroundColor: "var(--bg-surface)",
    textDecoration: "none",
    color: "inherit",
    transition: "all 0.15s ease",
  },
  miniLogo: {
    width: "40px",
    height: "40px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "white",
    fontSize: "1.1rem",
    fontWeight: 700,
    flexShrink: 0,
  },
  miniInfo: {
    display: "flex",
    flexDirection: "column" as const,
  },
  miniName: {
    fontSize: "0.95rem",
    fontWeight: 600,
    color: "var(--text-main)",
  },
  miniMeta: {
    fontSize: "0.75rem",
    color: "var(--text-light)",
    fontFamily: "var(--font-mono)",
  },
  noCommunitiesState: {
    textAlign: "center" as const,
    padding: "2.5rem",
    border: "1px dashed var(--border-color)",
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    gap: "1rem",
  },
  noCommunitiesText: {
    fontSize: "0.9rem",
    color: "var(--text-light)",
    fontStyle: "italic",
    margin: 0,
  },
  loadingSmallText: {
    fontSize: "0.85rem",
    color: "var(--text-light)",
    fontStyle: "italic",
  },
  // Phase 3: Home feed style tokens
  feedSection: {
    display: "flex",
    flexDirection: "column",
    gap: "1.25rem",
    borderTop: "1px solid var(--border-color)",
    paddingTop: "2rem",
    marginTop: "2rem",
  },
  postsList: {
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
  },
  postFeedItem: {
    display: "flex",
    gap: "1.25rem",
    padding: "1.25rem",
    border: "1px solid var(--border-color)",
    backgroundColor: "var(--bg-surface)",
    alignItems: "center",
  },
  postVoteScore: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    minWidth: "40px",
    color: "var(--primary)",
    fontSize: "0.85rem",
  },
  postBodyInfo: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: "0.4rem",
  },
  postTitleRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "1rem",
    flexWrap: "wrap",
  },
  postLinkTitle: {
    fontFamily: "var(--font-serif)",
    fontSize: "1.15rem",
    fontWeight: 600,
    color: "var(--text-main)",
    textDecoration: "none",
  },
  solvedTag: {
    fontSize: "0.65rem",
    fontWeight: 700,
    padding: "0.2rem 0.5rem",
    borderRadius: "2px",
    textTransform: "uppercase",
  },
  postMetaLine: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    fontSize: "0.75rem",
    color: "var(--text-light)",
  },
  itemTypeBadge: {
    fontSize: "0.65rem",
    fontWeight: 600,
    textTransform: "uppercase",
    padding: "0.1rem 0.4rem",
    backgroundColor: "var(--bg-main)",
    border: "1px solid var(--border-light)",
    color: "var(--text-muted)",
  },
  noPostsCard: {
    padding: "2.5rem",
    border: "1px dashed var(--border-color)",
    textAlign: "center",
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    gap: "0.5rem",
  },
};

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
