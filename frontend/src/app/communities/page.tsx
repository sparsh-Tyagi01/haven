"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useAuth } from "../../hooks/useAuth";
import {
  useCommunities,
  useProposals,
  voteProposal,
  type Community,
} from "../../hooks/useCommunities";

const CATEGORIES = [
  "all",
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

export default function CommunitiesPage() {
  const { isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState<"active" | "proposals">("active");
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  const {
    data: communitiesData,
    loading: communitiesLoading,
    refetch: refetchCommunities,
  } = useCommunities(1, search, selectedCategory === "all" ? "" : selectedCategory);

  const {
    data: proposalsData,
    loading: proposalsLoading,
    refetch: refetchProposals,
  } = useProposals(1);

  const handleVote = async (communityId: string) => {
    try {
      const result = await voteProposal(communityId);
      if (result.provisioned) {
        refetchCommunities();
      }
      refetchProposals();
    } catch (err: any) {
      alert(err.message || "Failed to vote");
    }
  };

  return (
    <div style={styles.pageContainer}>
      <div style={styles.editorialFrame}>
        {/* Header */}
        <header style={styles.header}>
          <div style={styles.headerTop}>
            <Link href="/" style={styles.backLink}>
              ← Return to Haven
            </Link>
            <span style={styles.headerMeta}>Community Registry</span>
          </div>
          <h1 style={styles.pageTitle}>THE COMMUNITY REGISTRY</h1>
          <p style={styles.pageSubtitle}>
            Discover active communities or propose new ones for the Haven network
          </p>
        </header>

        {/* Action Bar */}
        <div style={styles.actionBar}>
          <div style={styles.tabBar}>
            <button
              onClick={() => setActiveTab("active")}
              style={{
                ...styles.tab,
                ...(activeTab === "active" ? styles.tabActive : {}),
              }}
            >
              Active Communities
              {communitiesData && (
                <span style={styles.tabBadge}>{communitiesData.total}</span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("proposals")}
              style={{
                ...styles.tab,
                ...(activeTab === "proposals" ? styles.tabActive : {}),
              }}
            >
              Open Proposals
              {proposalsData && (
                <span style={styles.tabBadge}>{proposalsData.total}</span>
              )}
            </button>
          </div>
          {isAuthenticated && (
            <Link href="/communities/create" className="btn btn-primary" style={styles.createBtn}>
              + Submit Proposal
            </Link>
          )}
        </div>

        {/* Search & Filters (active tab only) */}
        {activeTab === "active" && (
          <div style={styles.filterBar}>
            <input
              type="text"
              placeholder="Search communities by name or description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={styles.searchInput}
            />
            <div style={styles.categoryScroll}>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  style={{
                    ...styles.categoryChip,
                    ...(selectedCategory === cat ? styles.categoryChipActive : {}),
                  }}
                >
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Content */}
        <div style={styles.content}>
          {activeTab === "active" ? (
            <ActiveCommunitiesList
              communities={communitiesData?.communities || []}
              loading={communitiesLoading}
              total={communitiesData?.total || 0}
            />
          ) : (
            <ProposalsList
              proposals={proposalsData?.communities || []}
              loading={proposalsLoading}
              onVote={handleVote}
              isAuthenticated={isAuthenticated}
            />
          )}
        </div>

        {/* Footer */}
        <footer style={styles.footer}>
          <div style={styles.footerBorder} />
          <div style={styles.footerGrid}>
            <span>Community Registry</span>
            <span style={styles.textCenter}>Haven Network</span>
            <span style={{ textAlign: "right" }}>Phase 2</span>
          </div>
        </footer>
      </div>
    </div>
  );
}

// ── Active Communities List ──────────────────────

function ActiveCommunitiesList({
  communities,
  loading,
  total,
}: {
  communities: Community[];
  loading: boolean;
  total: number;
}) {
  if (loading) {
    return <div style={styles.emptyState}><p style={styles.emptyText}>Loading communities...</p></div>;
  }

  if (communities.length === 0) {
    return (
      <div style={styles.emptyState}>
        <h3 style={styles.emptyTitle}>No Communities Yet</h3>
        <p style={styles.emptyText}>
          The Haven network is waiting to be built. Submit the first community proposal
          and gather support to establish your server.
        </p>
      </div>
    );
  }

  return (
    <div style={styles.cardGrid}>
      {communities.map((c) => (
        <Link
          key={c.id}
          href={`/communities/${c.slug}`}
          style={styles.communityCard}
        >
          {/* Banner strip */}
          <div
            style={{
              ...styles.cardBanner,
              backgroundColor: c.banner_url ? "transparent" : stringToColor(c.name),
              backgroundImage: c.banner_url ? `url(${c.banner_url})` : "none",
            }}
          />
          <div style={styles.cardBody}>
            <div style={styles.cardHeader}>
              <div
                style={{
                  ...styles.logoCircle,
                  backgroundColor: stringToColor(c.name),
                  backgroundImage: c.logo_url ? `url(${c.logo_url})` : "none",
                  backgroundSize: "cover",
                }}
              >
                {!c.logo_url && c.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 style={styles.cardTitle}>{c.name}</h3>
                <span style={styles.cardSlug}>/{c.slug}</span>
              </div>
            </div>
            <p style={styles.cardDescription}>
              {c.description.length > 120
                ? c.description.slice(0, 120) + "..."
                : c.description}
            </p>
            <div style={styles.cardMeta}>
              <span style={styles.metaChip}>{c.category}</span>
              <span style={styles.metaStat}>
                <strong>{c.member_count}</strong> members
              </span>
            </div>
            {c.tags && c.tags.length > 0 && (
              <div style={styles.tagRow}>
                {c.tags.slice(0, 3).map((tag, i) => (
                  <span key={i} style={styles.tag}>{tag}</span>
                ))}
                {c.tags.length > 3 && (
                  <span style={styles.tagMore}>+{c.tags.length - 3}</span>
                )}
              </div>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}

// ── Proposals List ───────────────────────────────

function ProposalsList({
  proposals,
  loading,
  onVote,
  isAuthenticated,
}: {
  proposals: Community[];
  loading: boolean;
  onVote: (id: string) => void;
  isAuthenticated: boolean;
}) {
  if (loading) {
    return <div style={styles.emptyState}><p style={styles.emptyText}>Loading proposals...</p></div>;
  }

  if (proposals.length === 0) {
    return (
      <div style={styles.emptyState}>
        <h3 style={styles.emptyTitle}>No Open Proposals</h3>
        <p style={styles.emptyText}>
          All current proposals have either been provisioned or are awaiting submission.
          Be the first to propose a new community.
        </p>
      </div>
    );
  }

  return (
    <div style={styles.proposalList}>
      {proposals.map((p) => (
        <div key={p.id} style={styles.proposalCard}>
          <div style={styles.proposalVoteCol}>
            <button
              onClick={() => onVote(p.id)}
              disabled={!isAuthenticated}
              style={styles.voteBtn}
              title={isAuthenticated ? "Upvote this proposal" : "Sign in to vote"}
            >
              ▲
            </button>
            <span style={styles.voteCount}>{p.upvotes_count}</span>
            <span style={styles.voteLabel}>votes</span>
          </div>
          <div style={styles.proposalBody}>
            <h3 style={styles.proposalTitle}>{p.name}</h3>
            <p style={styles.proposalDesc}>{p.description}</p>
            <div style={styles.proposalMeta}>
              <span style={styles.metaChip}>{p.category}</span>
              {p.tags && p.tags.map((tag, i) => (
                <span key={i} style={styles.tag}>{tag}</span>
              ))}
            </div>
          </div>
          <div style={styles.proposalProgress}>
            <div style={styles.progressBarOuter}>
              <div
                style={{
                  ...styles.progressBarInner,
                  width: `${Math.min((p.upvotes_count / 3) * 100, 100)}%`,
                }}
              />
            </div>
            <span style={styles.progressLabel}>
              {p.upvotes_count}/3 to provision
            </span>
          </div>
        </div>
      ))}
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
    fontSize: "3rem",
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
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    color: "var(--text-muted)",
    marginTop: "0.75rem",
  },
  actionBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "2rem",
    gap: "1rem",
    flexWrap: "wrap" as const,
  },
  tabBar: {
    display: "flex",
    gap: "0",
    border: "1px solid var(--border-color)",
  },
  tab: {
    padding: "0.65rem 1.5rem",
    fontFamily: "var(--font-sans)",
    fontSize: "0.85rem",
    fontWeight: 600,
    textTransform: "uppercase" as const,
    letterSpacing: "0.04em",
    cursor: "pointer",
    border: "none",
    backgroundColor: "var(--bg-surface)",
    color: "var(--text-muted)",
    transition: "all 0.15s ease",
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  },
  tabActive: {
    backgroundColor: "var(--primary)",
    color: "var(--bg-surface)",
  },
  tabBadge: {
    fontSize: "0.7rem",
    fontWeight: 700,
    padding: "0.1rem 0.4rem",
    borderRadius: "2px",
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  createBtn: {
    padding: "0.65rem 1.5rem",
    fontSize: "0.85rem",
  },
  filterBar: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "1rem",
    marginBottom: "2rem",
    paddingBottom: "1.5rem",
    borderBottom: "1px solid var(--border-color)",
  },
  searchInput: {
    maxWidth: "500px",
  },
  categoryScroll: {
    display: "flex",
    gap: "0.5rem",
    flexWrap: "wrap" as const,
  },
  categoryChip: {
    padding: "0.35rem 0.75rem",
    fontSize: "0.75rem",
    fontWeight: 600,
    textTransform: "uppercase" as const,
    letterSpacing: "0.04em",
    border: "1px solid var(--border-color)",
    borderRadius: "2px",
    cursor: "pointer",
    backgroundColor: "var(--bg-surface)",
    color: "var(--text-muted)",
    transition: "all 0.15s ease",
    fontFamily: "var(--font-sans)",
  },
  categoryChipActive: {
    backgroundColor: "var(--primary)",
    color: "var(--bg-surface)",
    borderColor: "var(--primary)",
  },
  content: {
    flexGrow: 1,
    minHeight: "300px",
  },
  // Community cards
  cardGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
    gap: "1.5rem",
  },
  communityCard: {
    border: "1px solid var(--border-color)",
    backgroundColor: "var(--bg-surface)",
    textDecoration: "none",
    color: "inherit",
    display: "flex",
    flexDirection: "column" as const,
    transition: "all 0.2s ease",
    cursor: "pointer",
    overflow: "hidden",
  },
  cardBanner: {
    height: "6px",
    width: "100%",
  },
  cardBody: {
    padding: "1.5rem",
    display: "flex",
    flexDirection: "column" as const,
    gap: "0.75rem",
    flexGrow: 1,
  },
  cardHeader: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
  },
  logoCircle: {
    width: "42px",
    height: "42px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "white",
    fontSize: "1.1rem",
    fontWeight: 700,
    flexShrink: 0,
  },
  cardTitle: {
    fontFamily: "var(--font-serif)",
    fontSize: "1.15rem",
    fontWeight: 600,
    margin: 0,
    padding: 0,
    lineHeight: 1.3,
    border: "none",
  },
  cardSlug: {
    fontFamily: "var(--font-mono)",
    fontSize: "0.7rem",
    color: "var(--text-light)",
  },
  cardDescription: {
    fontSize: "0.9rem",
    color: "var(--text-muted)",
    lineHeight: 1.5,
    margin: 0,
  },
  cardMeta: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: "auto",
    paddingTop: "0.5rem",
  },
  metaChip: {
    fontSize: "0.7rem",
    fontWeight: 600,
    textTransform: "uppercase" as const,
    letterSpacing: "0.04em",
    padding: "0.2rem 0.5rem",
    backgroundColor: "var(--primary-light)",
    color: "var(--primary)",
    borderRadius: "2px",
  },
  metaStat: {
    fontSize: "0.8rem",
    color: "var(--text-light)",
  },
  tagRow: {
    display: "flex",
    gap: "0.35rem",
    flexWrap: "wrap" as const,
  },
  tag: {
    fontSize: "0.7rem",
    padding: "0.15rem 0.4rem",
    backgroundColor: "var(--bg-surface-hover)",
    color: "var(--text-muted)",
    borderRadius: "2px",
    border: "1px solid var(--border-light)",
  },
  tagMore: {
    fontSize: "0.7rem",
    color: "var(--text-light)",
    padding: "0.15rem 0.3rem",
  },
  // Proposals
  proposalList: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "1rem",
  },
  proposalCard: {
    display: "flex",
    gap: "1.5rem",
    padding: "1.5rem",
    border: "1px solid var(--border-color)",
    backgroundColor: "var(--bg-surface)",
    alignItems: "flex-start",
  },
  proposalVoteCol: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    gap: "0.25rem",
    minWidth: "50px",
  },
  voteBtn: {
    width: "36px",
    height: "36px",
    border: "1px solid var(--border-color)",
    borderRadius: "2px",
    backgroundColor: "var(--bg-surface)",
    cursor: "pointer",
    fontSize: "1rem",
    color: "var(--primary)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.15s ease",
    fontFamily: "var(--font-sans)",
  },
  voteCount: {
    fontSize: "1.25rem",
    fontWeight: 700,
    color: "var(--text-main)",
  },
  voteLabel: {
    fontSize: "0.65rem",
    textTransform: "uppercase" as const,
    color: "var(--text-light)",
    letterSpacing: "0.04em",
  },
  proposalBody: {
    flex: 1,
    display: "flex",
    flexDirection: "column" as const,
    gap: "0.5rem",
  },
  proposalTitle: {
    fontFamily: "var(--font-serif)",
    fontSize: "1.2rem",
    fontWeight: 600,
    margin: 0,
    padding: 0,
    border: "none",
  },
  proposalDesc: {
    fontSize: "0.9rem",
    color: "var(--text-muted)",
    lineHeight: 1.5,
    margin: 0,
  },
  proposalMeta: {
    display: "flex",
    gap: "0.5rem",
    flexWrap: "wrap" as const,
    marginTop: "0.25rem",
  },
  proposalProgress: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "flex-end",
    gap: "0.35rem",
    minWidth: "120px",
  },
  progressBarOuter: {
    width: "100%",
    height: "6px",
    backgroundColor: "var(--border-light)",
    borderRadius: "3px",
    overflow: "hidden",
  },
  progressBarInner: {
    height: "100%",
    backgroundColor: "var(--primary)",
    borderRadius: "3px",
    transition: "width 0.3s ease",
  },
  progressLabel: {
    fontSize: "0.7rem",
    color: "var(--text-light)",
    fontFamily: "var(--font-mono)",
  },
  // Empty states
  emptyState: {
    textAlign: "center" as const,
    padding: "4rem 2rem",
    border: "1px dashed var(--border-color)",
  },
  emptyTitle: {
    fontFamily: "var(--font-serif)",
    fontSize: "1.5rem",
    marginBottom: "0.75rem",
    border: "none",
  },
  emptyText: {
    color: "var(--text-muted)",
    fontSize: "0.95rem",
    maxWidth: "500px",
    margin: "0 auto",
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
