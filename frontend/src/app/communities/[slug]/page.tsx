"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import Navbar from "../../components/Navbar";
import { useAuth } from "../../../hooks/useAuth";
import {
  useCommunity,
  joinCommunity,
  leaveCommunity,
  fetchMembers,
  type Membership,
} from "../../../hooks/useCommunities";
import { useCommunityFeed, type Post } from "../../../hooks/usePosts";
import { useWikiPages, type WikiPage } from "../../../hooks/useWiki";
import { useProjects, type Project } from "../../../hooks/useProjects";
import { useEvents, rsvpEvent, type Event as CommunityEvent } from "../../../hooks/useEvents";

export default function CommunityDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const resolvedParams = use(params);
  const { user, isAuthenticated } = useAuth();
  const { community, loading, error, refetch } = useCommunity(resolvedParams.slug);
  const [members, setMembers] = useState<Membership[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [userMembership, setUserMembership] = useState<Membership | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [postTypeFilter, setPostTypeFilter] = useState("");

  const { data: feedData, loading: feedLoading } = useCommunityFeed(resolvedParams.slug, postTypeFilter);
  const { pages: wikiPages, loading: wikiLoading } = useWikiPages(resolvedParams.slug);
  const { projects, loading: projectsLoading } = useProjects(resolvedParams.slug);
  const { events: communityEvents, loading: eventsLoading, refetch: refetchEvents } = useEvents(resolvedParams.slug);

  const handleRSVP = async (eventId: string, status: string) => {
    if (!isAuthenticated) {
      alert("Please sign in to RSVP.");
      return;
    }
    try {
      await rsvpEvent(eventId, status);
      refetchEvents();
    } catch (err: any) {
      alert(err.message || "Failed to update RSVP");
    }
  };

  // Load members when community is available
  useEffect(() => {
    if (!community || community.is_proposal) return;
    setMembersLoading(true);
    fetchMembers(community.id)
      .then((res) => {
        setMembers(res.members || []);
        // Check if current user is a member
        if (user) {
          const myMembership = (res.members || []).find(
            (m: Membership) => m.user_id === user.id
          );
          setUserMembership(myMembership || null);
        }
      })
      .catch(() => {})
      .finally(() => setMembersLoading(false));
  }, [community, user]);

  const handleJoin = async () => {
    if (!community) return;
    setActionLoading(true);
    try {
      await joinCommunity(community.id);
      refetch();
      // Refresh members
      const res = await fetchMembers(community.id);
      setMembers(res.members || []);
      const myMembership = (res.members || []).find(
        (m: Membership) => m.user_id === user?.id
      );
      setUserMembership(myMembership || null);
    } catch (err: any) {
      alert(err.message || "Failed to join");
    } finally {
      setActionLoading(false);
    }
  };

  const handleLeave = async () => {
    if (!community) return;
    setActionLoading(true);
    try {
      await leaveCommunity(community.id);
      setUserMembership(null);
      refetch();
      const res = await fetchMembers(community.id);
      setMembers(res.members || []);
    } catch (err: any) {
      alert(err.message || "Failed to leave");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="page-wrapper">
        <Navbar />
        <div style={styles.loadingContainer}>
          <div style={styles.spinner} />
          <p style={styles.loadingText}>Loading community...</p>
        </div>
      </div>
    );
  }

  if (error || !community) {
    return (
      <div className="page-wrapper">
        <Navbar />
        <main className="page-content">
          <div className="container" style={styles.errorState}>
            <h2 style={styles.errorTitle}>Community Not Found</h2>
            <p style={styles.errorText}>
              {error || "The requested community does not exist or you do not have permission to view it."}
            </p>
            <Link href="/communities" className="btn btn-secondary">
              ← Back to Communities
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const roleLabel = (role: string) => {
    const labels: Record<string, string> = {
      owner: "Owner",
      admin: "Admin",
      moderator: "Moderator",
      expert: "Verified Expert",
      member: "Member",
      guest: "Guest",
    };
    return labels[role] || role;
  };

  const roleColor = (role: string) => {
    const colors: Record<string, string> = {
      owner: "var(--color-accent)",
      admin: "var(--color-primary)",
      moderator: "#5e4a7a",
      expert: "#2d6a6a",
      member: "var(--text-secondary)",
      guest: "var(--text-tertiary)",
    };
    return colors[role] || "var(--text-secondary)";
  };

  return (
    <div className="page-wrapper">
      <Navbar />
      <main className="page-content">
      <div className="container" style={styles.pageInner}>
        {/* Breadcrumb */}
        <div style={styles.breadcrumb}>
          <Link href="/communities" style={styles.breadcrumbLink}>
            Communities
          </Link>
          <span style={styles.breadcrumbSep}>›</span>
          <span style={styles.breadcrumbCurrent}>{community.name}</span>
        </div>

        {/* Community Banner */}
        <div
          style={{
            ...styles.banner,
            backgroundColor: community.banner_url
              ? "transparent"
              : stringToColor(community.name),
            backgroundImage: community.banner_url
              ? `url(${community.banner_url})`
              : "none",
          }}
        >
          <div style={styles.bannerOverlay}>
            <div
              style={{
                ...styles.largeLogo,
                backgroundColor: stringToColor(community.name),
                backgroundImage: community.logo_url
                  ? `url(${community.logo_url})`
                  : "none",
                backgroundSize: "cover",
              }}
            >
              {!community.logo_url && community.name.charAt(0).toUpperCase()}
            </div>
          </div>
        </div>

        {/* Community Info */}
        <div style={styles.infoSection}>
          <div style={styles.infoMain}>
            <h1 style={styles.communityName}>{community.name}</h1>
            <div style={styles.metaRow}>
              <span style={styles.categoryBadge}>{community.category}</span>
              <span style={styles.visibilityBadge}>
                {community.visibility === "public"
                  ? "🌐 Public"
                  : community.visibility === "private"
                  ? "🔒 Private"
                  : "🔑 Invite Only"}
              </span>
              <span style={styles.metaStat}>
                <strong>{community.member_count}</strong> members
              </span>
              <span style={styles.metaStat}>
                Est. {new Date(community.created_at).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "short",
                })}
              </span>
            </div>
            <p style={styles.description}>{community.description}</p>
            {community.tags && community.tags.length > 0 && (
              <div style={styles.tagRow}>
                {community.tags.map((tag, i) => (
                  <span key={i} style={styles.tag}>{tag}</span>
                ))}
              </div>
            )}
          </div>

          {/* Action Button */}
          <div style={styles.infoActions}>
            {isAuthenticated ? (
              userMembership ? (
                <div style={styles.membershipInfo}>
                  <span style={styles.roleLabel}>
                    Your Role: <strong>{roleLabel(userMembership.role)}</strong> {userMembership.reputation !== undefined && `(🏆 ${userMembership.reputation} Rep)`}
                  </span>
                  <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                    <Link
                      href={`/communities/${community.slug}/chat`}
                      className="btn btn-primary btn-sm"
                      style={{ textDecoration: "none" }}
                    >
                      💬 Chat
                    </Link>
                    <Link
                      href={`/communities/${community.slug}/assistant`}
                      className="btn btn-accent btn-sm"
                      style={{
                        textDecoration: "none",

                      }}
                    >
                      🤖 Assistant
                    </Link>
                    {userMembership.role !== "owner" && (
                      <button
                        onClick={handleLeave}
                        disabled={actionLoading}
                        className="btn btn-secondary btn-sm"
                      >
                        {actionLoading ? "Leaving..." : "Leave"}
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <button
                  onClick={handleJoin}
                  disabled={actionLoading}
                  className="btn btn-primary"
                  style={styles.actionBtn}
                >
                  {actionLoading ? "Joining..." : "Join Community"}
                </button>
              )
            ) : (
              <Link href="/auth/login" className="btn btn-primary" style={styles.actionBtn}>
                Sign In to Join
              </Link>
            )}
          </div>
        </div>

        {/* Two Column Layout */}
        <div style={styles.contentGrid}>
          {/* Main Content */}
          <div style={styles.mainCol}>
            {/* Discussion Feed Section */}
            <div style={styles.feedSection}>
              <div style={styles.feedSectionHeader}>
                <h3 style={styles.sectionHeader}>Discussion Feed</h3>
                {userMembership && (
                  <Link
                    href={`/communities/${community.slug}/posts/create`}
                    className="btn btn-primary"
                    style={{ padding: "0.4rem 1rem", fontSize: "0.85rem" }}
                  >
                    + Write Post
                  </Link>
                )}
              </div>

              {/* Feed Filter Tabs */}
              <div style={styles.feedFilters}>
                {[
                  { value: "", label: "All" },
                  { value: "discussion", label: "💬 Discussions" },
                  { value: "question", label: "❓ Questions" },
                  { value: "project", label: "🚀 Updates" },
                  { value: "event", label: "📅 Events" },
                  { value: "job", label: "💼 Jobs" },
                ].map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setPostTypeFilter(f.value)}
                    style={{
                      ...styles.feedFilterBtn,
                      ...(postTypeFilter === f.value ? styles.feedFilterBtnActive : {}),
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Feed Content */}
              {feedLoading ? (
                <p style={styles.loadingSmall}>Loading discussions...</p>
              ) : feedData && feedData.posts && feedData.posts.length > 0 ? (
                <div style={styles.postsList}>
                  {feedData.posts.map((p: Post) => (
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
                  <p>No posts published in this section yet.</p>
                </div>
              )}
            </div>

            {/* Knowledge Base / Wiki Section */}
            <div style={styles.wikiSection}>
              <div style={styles.wikiSectionHeader}>
                <h3 style={styles.sectionHeader}>Knowledge Base Wiki</h3>
                {userMembership && (
                  (userMembership.role === "owner" ||
                   userMembership.role === "admin" ||
                   userMembership.role === "moderator" ||
                   userMembership.role === "expert") && (
                    <Link
                      href={`/communities/${community.slug}/wiki/create`}
                      className="btn btn-primary"
                      style={{ padding: "0.4rem 1rem", fontSize: "0.85rem" }}
                    >
                      + Write Wiki Page
                    </Link>
                  )
                )}
              </div>

              {/* Wiki Index List */}
              {wikiLoading ? (
                <p style={styles.loadingSmall}>Loading wiki index...</p>
              ) : wikiPages && wikiPages.length > 0 ? (
                <div style={styles.wikiList}>
                  {wikiPages.map((page: WikiPage) => (
                    <div key={page.id} style={styles.wikiItem}>
                      <div style={styles.wikiBody}>
                        <div style={styles.wikiTitleRow}>
                          <Link
                            href={`/communities/${community.slug}/wiki/${page.slug}`}
                            style={styles.wikiLinkTitle}
                          >
                            📄 {page.title}
                          </Link>
                          <span style={styles.miniVersionBadge}>v{page.version}</span>
                        </div>
                        <div style={styles.wikiMeta}>
                          <span>Modified {new Date(page.updated_at).toLocaleDateString()}</span>
                          <span>·</span>
                          <span>by <strong>@{page.creator_username}</strong></span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={styles.noWikiCard}>
                  <p>No wiki articles have been published on this server yet.</p>
                </div>
              )}
            </div>

            {/* Projects / Kanban Section */}
            <div style={styles.projectsSection}>
              <div style={styles.projectsSectionHeader}>
                <h3 style={styles.sectionHeader}>Kanban Projects</h3>
                {userMembership && (
                  (userMembership.role === "owner" ||
                   userMembership.role === "admin" ||
                   userMembership.role === "moderator") && (
                    <Link
                      href={`/communities/${community.slug}/projects/create`}
                      className="btn btn-primary"
                      style={{ padding: "0.4rem 1rem", fontSize: "0.85rem" }}
                    >
                      + New Project Board
                    </Link>
                  )
                )}
              </div>

              {/* Projects List */}
              {projectsLoading ? (
                <p style={styles.loadingSmall}>Loading project boards...</p>
              ) : projects && projects.length > 0 ? (
                <div style={styles.projectsList}>
                  {projects.map((proj: Project) => (
                    <div key={proj.id} style={styles.projectItem}>
                      <div style={styles.projectBody}>
                        <Link
                          href={`/communities/${community.slug}/projects/${proj.id}`}
                          style={styles.projectLinkTitle}
                        >
                          💼 {proj.name}
                        </Link>
                        {proj.description && (
                          <p style={styles.projectDescriptionText}>{proj.description}</p>
                        )}
                        <span style={styles.projectMetaText}>
                          Created {new Date(proj.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={styles.noProjectsCard}>
                  <p>No project boards have been configured on this server yet.</p>
                </div>
              )}
            </div>

            {/* Events / Meetups Section */}
            <div style={styles.eventsSection}>
              <div style={styles.eventsSectionHeader}>
                <h3 style={styles.sectionHeader}>Events & Meetups</h3>
                {userMembership && (
                  (userMembership.role === "owner" ||
                   userMembership.role === "admin" ||
                   userMembership.role === "moderator") && (
                    <Link
                      href={`/communities/${community.slug}/events/create`}
                      className="btn btn-primary"
                      style={{ padding: "0.4rem 1rem", fontSize: "0.85rem" }}
                    >
                      + Schedule Event
                    </Link>
                  )
                )}
              </div>

              {/* Events List */}
              {eventsLoading ? (
                <p style={styles.loadingSmall}>Loading scheduled events...</p>
              ) : communityEvents && communityEvents.length > 0 ? (
                <div style={styles.eventsList}>
                  {communityEvents.map((ev: CommunityEvent) => (
                    <div key={ev.id} style={styles.eventItem}>
                      <div style={styles.eventBody}>
                        <div style={styles.eventHeaderRow}>
                          <h4 style={styles.eventTitleText}>📅 {ev.title}</h4>
                          <span style={styles.eventTimeBadge}>
                            {new Date(ev.start_time).toLocaleDateString()} @{" "}
                            {new Date(ev.start_time).toLocaleTimeString(undefined, {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>

                        {ev.description && (
                          <p style={styles.eventDescriptionText}>{ev.description}</p>
                        )}

                        {ev.location && (
                          <p style={styles.eventLocationText}>
                            📍 Location:{" "}
                            {ev.location.startsWith("http") ? (
                              <a href={ev.location} target="_blank" rel="noopener noreferrer" style={styles.eventLink}>
                                Join Stream Room
                              </a>
                            ) : (
                              ev.location
                            )}
                          </p>
                        )}

                        {/* RSVP Action Bar */}
                        <div style={styles.rsvpRow}>
                          <div style={styles.rsvpStats}>
                            <span>Going: <strong>{ev.going_count}</strong></span>
                            <span>Interested: <strong>{ev.interested_count}</strong></span>
                          </div>

                          <div style={styles.rsvpActions}>
                            <button
                              onClick={() => handleRSVP(ev.id, ev.user_rsvp_status === "going" ? "" : "going")}
                              style={{
                                ...styles.rsvpBtn,
                                ...(ev.user_rsvp_status === "going" ? styles.rsvpBtnActive : {}),
                              }}
                            >
                              Going
                            </button>
                            <button
                              onClick={() => handleRSVP(ev.id, ev.user_rsvp_status === "interested" ? "" : "interested")}
                              style={{
                                ...styles.rsvpBtn,
                                ...(ev.user_rsvp_status === "interested" ? styles.rsvpBtnActive : {}),
                              }}
                            >
                              Interested
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={styles.noEventsCard}>
                  <p>No upcoming meetups or hackathons scheduled yet.</p>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar — Members */}
          <div style={styles.sideCol}>
            <h3 style={styles.sectionHeader}>Members</h3>
            {membersLoading ? (
              <p style={styles.loadingSmall}>Loading members...</p>
            ) : members.length === 0 ? (
              <p style={styles.noMembers}>No members yet.</p>
            ) : (
              <div style={styles.memberList}>
                {members.map((m) => (
                  <div key={m.id} style={styles.memberItem}>
                    <div
                      style={{
                        ...styles.memberAvatar,
                        backgroundColor: stringToColor(m.username || m.display_name || "?"),
                        backgroundImage: m.avatar_url ? `url(${m.avatar_url})` : "none",
                        backgroundSize: "cover",
                      }}
                    >
                      {!m.avatar_url &&
                        (m.display_name || m.username || "?").charAt(0).toUpperCase()}
                    </div>
                    <div style={styles.memberInfo}>
                      <span style={styles.memberName}>
                        {m.display_name || m.username}
                      </span>
                      <span
                        style={{
                          ...styles.memberRole,
                          color: roleColor(m.role),
                        }}
                      >
                        {roleLabel(m.role)} {m.reputation !== undefined && m.reputation > 0 && `· 🏆 ${m.reputation}`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
      </main>
    </div>
  );
}

// ── Color helper ─────────────────────────────────

function stringToColor(str: string): string {
  const colors = [
    "#2d4a3e", "#8b3a3a", "#4a6b8a", "#6b5b3e",
    "#5e4a7a", "#2d6a6a", "#8b5e3c", "#3c6e47",
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

// ── Styles ───────────────────────────────────────

const styles: { [key: string]: React.CSSProperties } = {
  pageInner: {
    paddingTop: "1.5rem",
    paddingBottom: "3rem",
  },
  loadingContainer: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
  },
  spinner: {
    width: "28px",
    height: "28px",
    border: "2px solid var(--border-primary)",
    borderTop: "2px solid var(--color-primary)",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
    marginBottom: "1rem",
  },
  loadingText: {
    fontSize: "var(--text-sm)",
    color: "var(--text-tertiary)",
    fontStyle: "italic",
  },
  breadcrumb: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    marginBottom: "1.5rem",
    fontSize: "var(--text-sm)",
    color: "var(--text-tertiary)",
  },
  breadcrumbLink: {
    color: "var(--color-primary)",
    textDecoration: "none",
    fontWeight: 500,
  },
  breadcrumbSep: {
    color: "var(--text-tertiary)",
  },
  breadcrumbCurrent: {
    color: "var(--text-secondary)",
    fontWeight: 500,
  },
  // Banner
  banner: {
    height: "140px",
    width: "100%",
    backgroundSize: "cover",
    backgroundPosition: "center",
    position: "relative",
    marginBottom: "1.5rem",
    border: "1px solid var(--border-primary)",
    borderRadius: "var(--radius-lg)",
  },
  bannerOverlay: {
    position: "absolute",
    bottom: "-28px",
    left: "1.5rem",
  },
  largeLogo: {
    width: "64px",
    height: "64px",
    borderRadius: "var(--radius-md)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "white",
    fontSize: "1.75rem",
    fontWeight: 700,
    border: "3px solid var(--bg-surface)",
    boxShadow: "var(--shadow-md)",
  },
  // Info section
  infoSection: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "2rem",
    marginTop: "2rem",
    paddingBottom: "2rem",
    borderBottom: "1px solid var(--border-primary)",
    marginBottom: "2rem",
  },
  infoMain: {
    flex: 1,
  },
  communityName: {
    fontFamily: "var(--font-display)",
    fontSize: "var(--text-4xl)",
    fontWeight: 700,
    letterSpacing: "-0.03em",
    margin: 0,
    padding: 0,
    border: "none",
    lineHeight: 1.15,
  },
  metaRow: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    marginTop: "0.75rem",
    flexWrap: "wrap" as const,
  },
  categoryBadge: {
    fontSize: "var(--text-xs)",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    padding: "0.15rem 0.5rem",
    backgroundColor: "var(--color-primary-light)",
    color: "var(--color-primary)",
    borderRadius: "var(--radius-sm)",
  },
  visibilityBadge: {
    fontSize: "var(--text-sm)",
    color: "var(--text-secondary)",
  },
  metaStat: {
    fontSize: "var(--text-sm)",
    color: "var(--text-tertiary)",
  },
  description: {
    fontSize: "var(--text-md)",
    lineHeight: 1.7,
    color: "var(--text-secondary)",
    marginTop: "1rem",
    marginBottom: "0.75rem",
  },
  tagRow: {
    display: "flex",
    gap: "0.35rem",
    flexWrap: "wrap" as const,
  },
  tag: {
    fontSize: "var(--text-xs)",
    padding: "0.15rem 0.4rem",
    backgroundColor: "var(--bg-inset)",
    color: "var(--text-secondary)",
    borderRadius: "var(--radius-sm)",
    border: "1px solid var(--border-primary)",
  },
  infoActions: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: "0.5rem",
    flexShrink: 0,
  },
  membershipInfo: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: "0.5rem",
  },
  roleLabel: {
    fontSize: "var(--text-sm)",
    color: "var(--text-secondary)",
    fontFamily: "var(--font-mono)",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  actionBtn: {
    padding: "0.7rem 1.75rem",
    whiteSpace: "nowrap",
  },
  contentGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 280px",
    gap: "2rem",
    alignItems: "start",
  },
  mainCol: {
    display: "flex",
    flexDirection: "column",
    gap: "1.5rem",
    minWidth: 0,
  },
  sideCol: {
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
    position: "sticky" as const,
    top: "calc(var(--navbar-height) + 1rem)",
  },
  sectionHeader: {
    fontFamily: "var(--font-serif)",
    fontSize: "var(--text-lg)",
    fontWeight: 600,
    borderBottom: "1px solid var(--text-primary)",
    paddingBottom: "0.4rem",
    marginBottom: "0.75rem",
    textTransform: "uppercase" as const,
    letterSpacing: "0.02em",
  },
  comingSoonCard: {
    padding: "2rem",
    border: "1px dashed var(--border-primary)",
    backgroundColor: "var(--bg-inset)",
    textAlign: "center",
    borderRadius: "var(--radius-md)",
  },
  comingSoonText: {
    fontSize: "var(--text-sm)",
    color: "var(--text-tertiary)",
    lineHeight: 1.6,
    margin: 0,
  },
  // Members sidebar
  loadingSmall: {
    fontSize: "var(--text-sm)",
    color: "var(--text-tertiary)",
    fontStyle: "italic",
  },
  noMembers: {
    fontSize: "var(--text-sm)",
    color: "var(--text-tertiary)",
    fontStyle: "italic",
  },
  memberList: {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
  },
  memberItem: {
    display: "flex",
    alignItems: "center",
    gap: "0.6rem",
    padding: "0.4rem",
    borderBottom: "1px solid var(--border-primary)",
  },
  memberAvatar: {
    width: "30px",
    height: "30px",
    borderRadius: "var(--radius-sm)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "white",
    fontSize: "var(--text-xs)",
    fontWeight: 600,
    flexShrink: 0,
  },
  memberInfo: {
    display: "flex",
    flexDirection: "column",
  },
  memberName: {
    fontSize: "var(--text-sm)",
    fontWeight: 600,
    color: "var(--text-primary)",
  },
  memberRole: {
    fontSize: "var(--text-xs)",
    fontWeight: 500,
    textTransform: "uppercase",
    letterSpacing: "0.03em",
  },
  errorState: {
    textAlign: "center",
    padding: "5rem 2rem",
  },
  errorTitle: {
    fontFamily: "var(--font-display)",
    fontSize: "var(--text-3xl)",
    marginBottom: "1rem",
  },
  errorText: {
    color: "var(--text-secondary)",
    fontSize: "var(--text-md)",
    marginBottom: "2rem",
    lineHeight: 1.6,
  },
  // Phase 3: Community feed style tokens
  feedSection: {
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
    marginBottom: "2rem",
  },
  feedSectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  feedFilters: {
    display: "flex",
    gap: "0.35rem",
    flexWrap: "wrap",
    borderBottom: "1px solid var(--border-primary)",
    paddingBottom: "0.75rem",
  },
  feedFilterBtn: {
    padding: "0.3rem 0.7rem",
    fontSize: "var(--text-xs)",
    fontWeight: 500,
    border: "1px solid var(--border-primary)",
    borderRadius: "var(--radius-full)",
    backgroundColor: "var(--bg-surface)",
    color: "var(--text-tertiary)",
    cursor: "pointer",
    transition: "all 150ms ease",
    fontFamily: "var(--font-sans)",
  },
  feedFilterBtnActive: {
    backgroundColor: "var(--color-primary)",
    color: "var(--text-inverse)",
    border: "1px solid var(--color-primary)",
  },
  postsList: {
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
  },
  postFeedItem: {
    display: "flex",
    gap: "1rem",
    padding: "1rem 1.25rem",
    border: "1px solid var(--border-primary)",
    borderRadius: "var(--radius-md)",
    backgroundColor: "var(--bg-surface)",
    alignItems: "center",
    transition: "border-color 150ms ease",
  },
  postVoteScore: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    minWidth: "36px",
    color: "var(--color-primary)",
    fontSize: "var(--text-sm)",
  },
  postBodyInfo: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: "0.35rem",
  },
  postTitleRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "0.75rem",
    flexWrap: "wrap",
  },
  postLinkTitle: {
    fontFamily: "var(--font-serif)",
    fontSize: "var(--text-md)",
    fontWeight: 600,
    color: "var(--text-primary)",
    textDecoration: "none",
  },
  solvedTag: {
    fontSize: "var(--text-xs)",
    fontWeight: 700,
    padding: "0.15rem 0.45rem",
    borderRadius: "var(--radius-sm)",
    textTransform: "uppercase",
  },
  postMetaLine: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    fontSize: "var(--text-xs)",
    color: "var(--text-tertiary)",
  },
  itemTypeBadge: {
    fontSize: "var(--text-xs)",
    fontWeight: 600,
    textTransform: "uppercase",
    padding: "0.1rem 0.4rem",
    backgroundColor: "var(--bg-inset)",
    border: "1px solid var(--border-primary)",
    color: "var(--text-secondary)",
    borderRadius: "var(--radius-sm)",
  },
  noPostsCard: {
    padding: "3rem",
    border: "1px dashed var(--border-primary)",
    textAlign: "center",
    color: "var(--text-tertiary)",
    borderRadius: "var(--radius-md)",
  },
  // Phase 4: Wiki index styles
  wikiSection: {
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
    marginBottom: "2rem",
    borderTop: "1px solid var(--border-primary)",
    paddingTop: "2rem",
    marginTop: "2rem",
  },
  wikiSectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  wikiList: {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
  },
  wikiItem: {
    padding: "1rem 1.25rem",
    border: "1px solid var(--border-primary)",
    borderRadius: "var(--radius-md)",
    backgroundColor: "var(--bg-surface)",
  },
  wikiBody: {
    display: "flex",
    flexDirection: "column",
    gap: "0.3rem",
  },
  wikiTitleRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "0.75rem",
  },
  wikiLinkTitle: {
    fontFamily: "var(--font-serif)",
    fontSize: "var(--text-md)",
    fontWeight: 600,
    color: "var(--text-primary)",
    textDecoration: "none",
  },
  miniVersionBadge: {
    fontSize: "var(--text-xs)",
    fontWeight: 600,
    padding: "0.15rem 0.4rem",
    backgroundColor: "var(--color-primary-light)",
    color: "var(--color-primary)",
    borderRadius: "var(--radius-sm)",
  },
  wikiMeta: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    fontSize: "var(--text-xs)",
    color: "var(--text-tertiary)",
  },
  noWikiCard: {
    padding: "2.5rem",
    border: "1px dashed var(--border-primary)",
    textAlign: "center",
    color: "var(--text-tertiary)",
    borderRadius: "var(--radius-md)",
  },
  // Phase 5: Projects / Kanban list styles
  projectsSection: {
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
    marginBottom: "2rem",
    borderTop: "1px solid var(--border-primary)",
    paddingTop: "2rem",
    marginTop: "2rem",
  },
  projectsSectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  projectsList: {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
  },
  projectItem: {
    padding: "1rem 1.25rem",
    border: "1px solid var(--border-primary)",
    borderRadius: "var(--radius-md)",
    backgroundColor: "var(--bg-surface)",
  },
  projectBody: {
    display: "flex",
    flexDirection: "column",
    gap: "0.3rem",
  },
  projectLinkTitle: {
    fontFamily: "var(--font-serif)",
    fontSize: "var(--text-md)",
    fontWeight: 600,
    color: "var(--text-primary)",
    textDecoration: "none",
  },
  projectDescriptionText: {
    fontSize: "var(--text-sm)",
    color: "var(--text-secondary)",
    margin: 0,
  },
  projectMetaText: {
    fontSize: "var(--text-xs)",
    color: "var(--text-tertiary)",
  },
  noProjectsCard: {
    padding: "2.5rem",
    border: "1px dashed var(--border-primary)",
    textAlign: "center",
    color: "var(--text-tertiary)",
    borderRadius: "var(--radius-md)",
  },
  eventsSection: {
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
    marginBottom: "2rem",
    borderTop: "1px solid var(--border-primary)",
    paddingTop: "2rem",
    marginTop: "2rem",
  },
  eventsSectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  eventsList: {
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
  },
  eventItem: {
    padding: "1.25rem",
    border: "1px solid var(--border-primary)",
    borderRadius: "var(--radius-md)",
    backgroundColor: "var(--bg-surface)",
  },
  eventBody: {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
  },
  eventHeaderRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    flexWrap: "wrap",
    gap: "0.75rem",
  },
  eventTitleText: {
    fontFamily: "var(--font-serif)",
    fontSize: "var(--text-md)",
    fontWeight: 600,
    margin: 0,
    color: "var(--text-primary)",
  },
  eventTimeBadge: {
    fontSize: "var(--text-xs)",
    fontFamily: "var(--font-mono)",
    backgroundColor: "var(--color-primary-light)",
    color: "var(--color-primary)",
    padding: "0.15rem 0.4rem",
    borderRadius: "var(--radius-sm)",
  },
  eventDescriptionText: {
    fontSize: "var(--text-sm)",
    lineHeight: 1.5,
    margin: 0,
    color: "var(--text-secondary)",
  },
  eventLocationText: {
    fontSize: "var(--text-sm)",
    margin: 0,
    color: "var(--text-tertiary)",
  },
  eventLink: {
    color: "var(--color-primary)",
    fontWeight: 600,
    textDecoration: "underline",
  },
  rsvpRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderTop: "1px dashed var(--border-primary)",
    paddingTop: "0.75rem",
    marginTop: "0.25rem",
    flexWrap: "wrap",
    gap: "0.75rem",
  },
  rsvpStats: {
    display: "flex",
    gap: "1rem",
    fontSize: "var(--text-xs)",
    color: "var(--text-tertiary)",
  },
  rsvpActions: {
    display: "flex",
    gap: "0.4rem",
  },
  rsvpBtn: {
    padding: "0.25rem 0.7rem",
    fontSize: "var(--text-xs)",
    fontWeight: 500,
    border: "1px solid var(--border-primary)",
    borderRadius: "var(--radius-full)",
    backgroundColor: "var(--bg-surface)",
    color: "var(--text-secondary)",
    cursor: "pointer",
    transition: "all 150ms ease",
    fontFamily: "var(--font-sans)",
  },
  rsvpBtnActive: {
    backgroundColor: "var(--color-primary)",
    color: "var(--text-inverse)",
    border: "1px solid var(--color-primary)",
  },
  noEventsCard: {
    padding: "2.5rem",
    border: "1px dashed var(--border-primary)",
    textAlign: "center",
    color: "var(--text-tertiary)",
    borderRadius: "var(--radius-md)",
  },
};
