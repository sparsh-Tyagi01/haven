"use client";

import React, { useState } from "react";
import Link from "next/link";
import Navbar from "../components/Navbar";
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
  } = useCommunities(
    1,
    search,
    selectedCategory === "all" ? "" : selectedCategory
  );

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
    <div className="page-wrapper">
      <Navbar />
      <main className="page-content">
        <div className="container" style={styles.pageInner}>
          {/* Header */}
          <header style={styles.header}>
            <div>
              <h1 style={styles.pageTitle}>Communities</h1>
              <p style={styles.pageSubtitle}>
                Discover active communities or propose new ones
              </p>
            </div>
            {isAuthenticated && (
              <Link
                href="/communities/create"
                className="btn btn-primary"
              >
                + New Proposal
              </Link>
            )}
          </header>

          {/* Tabs */}
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

          {/* Search & Filters (active tab only) */}
          {activeTab === "active" && (
            <div style={styles.filterBar}>
              <input
                type="text"
                placeholder="Search communities..."
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
                      ...(selectedCategory === cat
                        ? styles.categoryChipActive
                        : {}),
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
        </div>
      </main>

      {/* Footer */}
      <footer style={styles.footer}>
        <div className="container">
          <div style={styles.footerRule} />
          <div style={styles.footerInner}>
            <span style={styles.footerBrand}>Haven</span>
            <span style={styles.footerText}>
              © {new Date().getFullYear()} Haven
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ── Active Communities List ──────────────────────── */

function ActiveCommunitiesList({
  communities,
  loading,
}: {
  communities: Community[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div style={styles.emptyState}>
        <p style={styles.emptyText}>Loading communities...</p>
      </div>
    );
  }

  if (communities.length === 0) {
    return (
      <div style={styles.emptyState}>
        <span style={styles.emptyIcon}>⬡</span>
        <h3 style={styles.emptyTitle}>No communities yet</h3>
        <p style={styles.emptyText}>
          Be the first to propose a community and gather support.
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
          className="card card-hover"
          style={styles.communityCard}
        >
          {/* Banner strip */}
          <div
            style={{
              ...styles.cardBanner,
              backgroundColor: c.banner_url
                ? "transparent"
                : stringToColor(c.name),
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
              <span className="badge">{c.category}</span>
              <span style={styles.metaStat}>
                <strong>{c.member_count}</strong> members
              </span>
            </div>
            {c.tags && c.tags.length > 0 && (
              <div style={styles.tagRow}>
                {c.tags.slice(0, 3).map((tag, i) => (
                  <span key={i} style={styles.tag}>
                    {tag}
                  </span>
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

/* ── Proposals List ───────────────────────────────── */

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
    return (
      <div style={styles.emptyState}>
        <p style={styles.emptyText}>Loading proposals...</p>
      </div>
    );
  }

  if (proposals.length === 0) {
    return (
      <div style={styles.emptyState}>
        <span style={styles.emptyIcon}>◈</span>
        <h3 style={styles.emptyTitle}>No open proposals</h3>
        <p style={styles.emptyText}>
          All proposals have been provisioned or are awaiting submission.
        </p>
      </div>
    );
  }

  return (
    <div style={styles.proposalList}>
      {proposals.map((p) => (
        <div key={p.id} className="card" style={styles.proposalCard}>
          <div style={styles.proposalVoteCol}>
            <button
              onClick={() => onVote(p.id)}
              disabled={!isAuthenticated}
              style={styles.voteBtn}
              title={
                isAuthenticated ? "Upvote this proposal" : "Sign in to vote"
              }
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
              <span className="badge">{p.category}</span>
              {p.tags &&
                p.tags.map((tag, i) => (
                  <span key={i} style={styles.tag}>
                    {tag}
                  </span>
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

/* ── Helpers ──────────────────────────────────────── */

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

/* ── Styles ───────────────────────────────────────── */

const styles: { [key: string]: React.CSSProperties } = {
  pageInner: {
    paddingTop: "2rem",
    paddingBottom: "3rem",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "2rem",
  },
  pageTitle: {
    fontFamily: "var(--font-display)",
    fontSize: "var(--text-3xl)",
    fontWeight: 700,
    letterSpacing: "-0.02em",
    margin: 0,
    border: "none",
  },
  pageSubtitle: {
    fontSize: "var(--text-base)",
    color: "var(--text-tertiary)",
    margin: "0.25rem 0 0",
  },

  /* Tabs */
  tabBar: {
    display: "flex",
    gap: 0,
    borderBottom: "1px solid var(--border-primary)",
    marginBottom: "1.5rem",
  },
  tab: {
    padding: "0.65rem 1.25rem",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--text-sm)",
    fontWeight: 500,
    cursor: "pointer",
    border: "none",
    borderBottom: "2px solid transparent",
    backgroundColor: "transparent",
    color: "var(--text-tertiary)",
    transition: "all 150ms ease",
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    marginBottom: "-1px",
  },
  tabActive: {
    color: "var(--text-primary)",
    fontWeight: 600,
    borderBottom: "2px solid var(--color-primary)",
  },
  tabBadge: {
    fontSize: "var(--text-xs)",
    fontWeight: 600,
    padding: "0.1rem 0.4rem",
    borderRadius: "var(--radius-sm)",
    backgroundColor: "var(--bg-inset)",
    color: "var(--text-tertiary)",
  },

  /* Filters */
  filterBar: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "0.75rem",
    marginBottom: "1.5rem",
  },
  searchInput: {
    maxWidth: "400px",
  },
  categoryScroll: {
    display: "flex",
    gap: "0.35rem",
    flexWrap: "wrap" as const,
  },
  categoryChip: {
    padding: "0.3rem 0.7rem",
    fontSize: "var(--text-xs)",
    fontWeight: 500,
    border: "1px solid var(--border-primary)",
    borderRadius: "var(--radius-full)",
    cursor: "pointer",
    backgroundColor: "var(--bg-surface)",
    color: "var(--text-tertiary)",
    transition: "all 150ms ease",
    fontFamily: "var(--font-sans)",
    textTransform: "capitalize" as const,
  },
  categoryChipActive: {
    backgroundColor: "var(--color-primary)",
    color: "var(--text-inverse)",
    border: "1px solid var(--color-primary)",
  },
  content: {
    minHeight: "300px",
  },

  /* Community cards */
  cardGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
    gap: "1rem",
  },
  communityCard: {
    textDecoration: "none",
    color: "inherit",
    display: "flex",
    flexDirection: "column" as const,
    cursor: "pointer",
    overflow: "hidden",
    padding: 0,
  },
  cardBanner: {
    height: "4px",
    width: "100%",
    borderRadius: "var(--radius-md) var(--radius-md) 0 0",
  },
  cardBody: {
    padding: "1.25rem",
    display: "flex",
    flexDirection: "column" as const,
    gap: "0.65rem",
    flexGrow: 1,
  },
  cardHeader: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
  },
  logoCircle: {
    width: "36px",
    height: "36px",
    borderRadius: "var(--radius-sm)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "white",
    fontSize: "var(--text-sm)",
    fontWeight: 700,
    flexShrink: 0,
  },
  cardTitle: {
    fontFamily: "var(--font-serif)",
    fontSize: "var(--text-md)",
    fontWeight: 600,
    margin: 0,
    padding: 0,
    lineHeight: 1.3,
    border: "none",
  },
  cardSlug: {
    fontFamily: "var(--font-mono)",
    fontSize: "var(--text-xs)",
    color: "var(--text-tertiary)",
  },
  cardDescription: {
    fontSize: "var(--text-sm)",
    color: "var(--text-secondary)",
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
  metaStat: {
    fontSize: "var(--text-sm)",
    color: "var(--text-tertiary)",
  },
  tagRow: {
    display: "flex",
    gap: "0.3rem",
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
  tagMore: {
    fontSize: "var(--text-xs)",
    color: "var(--text-tertiary)",
    padding: "0.15rem 0.3rem",
  },

  /* Proposals */
  proposalList: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "0.75rem",
  },
  proposalCard: {
    display: "flex",
    gap: "1.25rem",
    padding: "1.25rem",
    alignItems: "flex-start",
  },
  proposalVoteCol: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    gap: "0.2rem",
    minWidth: "45px",
  },
  voteBtn: {
    width: "32px",
    height: "32px",
    border: "1px solid var(--border-primary)",
    borderRadius: "var(--radius-sm)",
    backgroundColor: "var(--bg-surface)",
    cursor: "pointer",
    fontSize: "0.85rem",
    color: "var(--color-primary)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 150ms ease",
    fontFamily: "var(--font-sans)",
  },
  voteCount: {
    fontSize: "var(--text-lg)",
    fontWeight: 700,
    color: "var(--text-primary)",
  },
  voteLabel: {
    fontSize: "var(--text-xs)",
    textTransform: "uppercase" as const,
    color: "var(--text-tertiary)",
    letterSpacing: "0.03em",
  },
  proposalBody: {
    flex: 1,
    display: "flex",
    flexDirection: "column" as const,
    gap: "0.4rem",
  },
  proposalTitle: {
    fontFamily: "var(--font-serif)",
    fontSize: "var(--text-lg)",
    fontWeight: 600,
    margin: 0,
    padding: 0,
    border: "none",
  },
  proposalDesc: {
    fontSize: "var(--text-sm)",
    color: "var(--text-secondary)",
    lineHeight: 1.5,
    margin: 0,
  },
  proposalMeta: {
    display: "flex",
    gap: "0.4rem",
    flexWrap: "wrap" as const,
    marginTop: "0.25rem",
  },
  proposalProgress: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "flex-end",
    gap: "0.3rem",
    minWidth: "110px",
  },
  progressBarOuter: {
    width: "100%",
    height: "5px",
    backgroundColor: "var(--bg-inset)",
    borderRadius: "var(--radius-full)",
    overflow: "hidden",
  },
  progressBarInner: {
    height: "100%",
    backgroundColor: "var(--color-primary)",
    borderRadius: "var(--radius-full)",
    transition: "width 0.3s ease",
  },
  progressLabel: {
    fontSize: "var(--text-xs)",
    color: "var(--text-tertiary)",
    fontFamily: "var(--font-mono)",
  },

  /* Empty states */
  emptyState: {
    textAlign: "center" as const,
    padding: "4rem 2rem",
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
    border: "none",
  },
  emptyText: {
    color: "var(--text-tertiary)",
    fontSize: "var(--text-base)",
    maxWidth: "400px",
    margin: 0,
    lineHeight: 1.6,
  },

  /* Footer */
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
