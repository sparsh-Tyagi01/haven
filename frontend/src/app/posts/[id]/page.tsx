"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navbar from "../../components/Navbar";
import { useAuth } from "../../../hooks/useAuth";
import {
  usePost,
  usePostComments,
  createComment,
  votePost,
  voteComment,
  solveQuestion,
  type Post,
  type Comment,
} from "../../../hooks/usePosts";
import { fetchMembers, type Membership } from "../../../hooks/useCommunities";
import { usePostSummary, generateWikiDraft } from "../../../hooks/useAI";

interface CommentNode extends Comment {
  replies: CommentNode[];
}

export default function PostDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const { post, loading: postLoading, error: postError, refetch: refetchPost } = usePost(resolvedParams.id);
  const { comments, loading: commentsLoading, refetch: refetchComments } = usePostComments(resolvedParams.id);
  const { summary, loading: summaryLoading, error: summaryError, generateSummary } = usePostSummary(resolvedParams.id);

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

  const [commentContent, setCommentContent] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);

  const handleProposeWiki = async () => {
    if (!post) return;
    try {
      const res = await generateWikiDraft(post.id);
      const searchParams = new URLSearchParams();
      searchParams.set("title", res.title);
      searchParams.set("content", res.content);
      router.push(`/communities/${post.community_slug}/wiki/create?${searchParams.toString()}`);
    } catch (err: any) {
      alert(err.message || "Failed to generate AI wiki draft");
    }
  };
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [submittingReply, setSubmittingReply] = useState(false);
  const [communityMembers, setCommunityMembers] = useState<Membership[]>([]);
  const [userRole, setUserRole] = useState<string | null>(null);

  const authorMembership = post ? communityMembers.find((m) => m.user_id === post.author_id) : null;
  const authorRep = authorMembership?.reputation;

  // Load community membership role to verify QA solving permissions
  useEffect(() => {
    if (!post || !user) return;
    fetchMembers(post.community_id)
      .then((res) => {
        setCommunityMembers(res.members || []);
        const myMem = (res.members || []).find((m) => m.user_id === user.id);
        if (myMem) {
          setUserRole(myMem.role);
        }
      })
      .catch(() => {});
  }, [post, user]);

  const handlePostVote = async (type: string) => {
    if (!isAuthenticated || !post) return;
    const newType = post.user_vote_type === type ? "" : type; // toggle off if clicked again
    try {
      await votePost(post.id, newType);
      refetchPost();
    } catch (err: any) {
      alert(err.message || "Failed to register vote");
    }
  };

  const handleCommentVote = async (commentId: string, currentVote: string | undefined, type: string) => {
    if (!isAuthenticated) return;
    const newType = currentVote === type ? "" : type;
    try {
      await voteComment(commentId, newType);
      refetchComments();
    } catch (err: any) {
      alert(err.message || "Failed to register vote");
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!post || commentContent.trim().length < 2) return;
    setSubmittingComment(true);
    try {
      await createComment(post.id, { content: commentContent });
      setCommentContent("");
      refetchComments();
      refetchPost(); // update vote/comment stats if any
    } catch (err: any) {
      alert(err.message || "Failed to publish comment");
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleAddReply = async (e: React.FormEvent, parentId: string) => {
    e.preventDefault();
    if (!post || replyContent.trim().length < 2) return;
    setSubmittingReply(true);
    try {
      await createComment(post.id, { content: replyContent, parent_id: parentId });
      setReplyContent("");
      setReplyToId(null);
      refetchComments();
    } catch (err: any) {
      alert(err.message || "Failed to publish reply");
    } finally {
      setSubmittingReply(false);
    }
  };

  const handleSolve = async (commentId: string) => {
    if (!post) return;
    if (!confirm("Mark this comment as the accepted solution?")) return;
    try {
      await solveQuestion(post.id, commentId);
      refetchPost();
      refetchComments();
    } catch (err: any) {
      alert(err.message || "Failed to mark as solved");
    }
  };

  if (postLoading) {
    return (
      <div className="page-wrapper">
        <Navbar />
        <div style={styles.loadingContainer}>
          <div style={styles.spinner} />
          <p style={styles.loadingText}>Loading post...</p>
        </div>
      </div>
    );
  }

  if (postError || !post) {
    return (
      <div className="page-wrapper">
        <Navbar />
        <main className="page-content">
          <div className="container" style={{ textAlign: 'center', padding: '5rem 2rem' }}>
            <h2 style={styles.errorTitle}>Post Not Found</h2>
            <p style={styles.errorText}>
              {postError || "This post does not exist or you do not have permission to view it."}
            </p>
            <Link href="/communities" className="btn btn-secondary">
              ← Back to Communities
            </Link>
          </div>
        </main>
      </div>
    );
  }

  // Build comments tree
  const buildTree = (list: Comment[]): CommentNode[] => {
    const map: Record<string, CommentNode> = {};
    const roots: CommentNode[] = [];
    list.forEach((c) => {
      map[c.id] = { ...c, replies: [] };
    });
    list.forEach((c) => {
      const node = map[c.id];
      if (c.parent_id && map[c.parent_id]) {
        map[c.parent_id].replies.push(node);
      } else {
        roots.push(node);
      }
    });
    return roots;
  };

  const commentTree = buildTree(comments);

  // Check if current user is community owner/admin or the post author
  const canAcceptAnswer =
    post.post_type === "question" &&
    !post.is_solved &&
    (post.author_id === user?.id || userRole === "owner" || userRole === "admin");

  const postTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      discussion: "💬 Discussion",
      question: "❓ Question",
      project: "🚀 Project Update",
      event: "📅 Event",
      job: "💼 Job Opportunity",
    };
    return labels[type] || type;
  };

  // Render a single comment node recursively
  const renderComment = (node: CommentNode, depth = 0) => {
    const isAcceptedSolution = post.accepted_comment_id === node.id;
    const isReplying = replyToId === node.id;

    return (
      <div
        key={node.id}
        style={{
          ...styles.commentWrapper,
          marginLeft: depth > 0 ? `${Math.min(depth * 1.5, 6)}rem` : "0",
          borderLeft: depth > 0 ? "2px dashed var(--border-color)" : "none",
          paddingLeft: depth > 0 ? "1rem" : "0",
        }}
      >
        <div style={{
          ...styles.commentCard,
          border: isAcceptedSolution ? "1px solid var(--success)" : "1px solid var(--border-color)",
          backgroundColor: isAcceptedSolution ? "rgba(60, 110, 71, 0.03)" : "var(--bg-surface)",
        }}>
          {isAcceptedSolution && (
            <div style={styles.solutionBanner}>
              ✓ ACCEPTED SOLUTION
            </div>
          )}
          <div style={styles.commentHeader}>
            <div style={styles.authorRow}>
              <div
                style={{
                  ...styles.avatarSmall,
                  backgroundColor: stringToColor(node.author_username || "?"),
                  backgroundImage: node.author_avatar_url ? `url(${node.author_avatar_url})` : "none",
                  backgroundSize: "cover",
                }}
              >
                {!node.author_avatar_url &&
                  (node.author_display_name || node.author_username || "?").charAt(0).toUpperCase()}
              </div>
              <div style={styles.authorMeta}>
                <span style={styles.authorName}>
                  {node.author_display_name || node.author_username}
                  {(() => {
                    const cMem = communityMembers.find((m) => m.user_id === node.author_id);
                    if (!cMem) return null;
                    return (
                      <span
                        style={{
                          fontSize: "0.6rem",
                          marginLeft: "0.4rem",
                          color: roleColor(cMem.role),
                          border: `1px solid ${roleColor(cMem.role)}`,
                          padding: "0.05rem 0.25rem",
                          borderRadius: "2px",
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                          fontFamily: "var(--font-mono)",
                        }}
                      >
                        {roleLabel(cMem.role)}
                      </span>
                    );
                  })()}
                </span>
                <span style={styles.authorUsername}>
                  @{node.author_username}
                  {(() => {
                    const cMem = communityMembers.find((m) => m.user_id === node.author_id);
                    return cMem && cMem.reputation !== undefined && cMem.reputation > 0
                      ? ` · 🏆 ${cMem.reputation}`
                      : "";
                  })()}
                </span>
              </div>
            </div>
            <span style={styles.commentDate}>
              {new Date(node.created_at).toLocaleDateString()}
            </span>
          </div>

          <div style={styles.commentBody}>
            <p style={styles.textParagraph}>{node.content}</p>
          </div>

          {/* Comment Actions: Votes & Reply */}
          <div style={styles.commentFooter}>
            <div style={styles.reactionGrid}>
              <button
                onClick={() => handleCommentVote(node.id, node.user_vote_type, "upvote")}
                disabled={!isAuthenticated}
                style={{
                  ...styles.reactBtn,
                  ...(node.user_vote_type === "upvote" ? styles.reactBtnActive : {}),
                }}
              >
                👍 Upvote ({node.upvotes_count})
              </button>
              <button
                onClick={() => handleCommentVote(node.id, node.user_vote_type, "helpful")}
                disabled={!isAuthenticated}
                style={{
                  ...styles.reactBtn,
                  ...(node.user_vote_type === "helpful" ? styles.reactBtnActive : {}),
                }}
              >
                💡 Helpful ({node.helpful_count})
              </button>
              <button
                onClick={() => handleCommentVote(node.id, node.user_vote_type, "insightful")}
                disabled={!isAuthenticated}
                style={{
                  ...styles.reactBtn,
                  ...(node.user_vote_type === "insightful" ? styles.reactBtnActive : {}),
                }}
              >
                🧠 Insightful ({node.insightful_count})
              </button>
              <button
                onClick={() => handleCommentVote(node.id, node.user_vote_type, "funny")}
                disabled={!isAuthenticated}
                style={{
                  ...styles.reactBtn,
                  ...(node.user_vote_type === "funny" ? styles.reactBtnActive : {}),
                }}
              >
                😆 Funny ({node.funny_count})
              </button>
            </div>

            <div style={styles.utilityActions}>
              {isAuthenticated && (
                <button
                  onClick={() => {
                    setReplyToId(isReplying ? null : node.id);
                    setReplyContent("");
                  }}
                  style={styles.replyLinkBtn}
                >
                  {isReplying ? "Cancel Reply" : "Reply"}
                </button>
              )}
              {canAcceptAnswer && !isAcceptedSolution && (
                <button onClick={() => handleSolve(node.id)} style={styles.solveBtn}>
                  Accept Solution
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Inline Reply Form */}
        {isReplying && (
          <form
            onSubmit={(e) => handleAddReply(e, node.id)}
            style={{
              ...styles.replyForm,
              marginLeft: "1rem",
            }}
          >
            <textarea
              placeholder="Write a reply..."
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              rows={3}
              required
              style={styles.replyTextarea}
            />
            <div style={styles.replyFormActions}>
              <button
                type="button"
                onClick={() => setReplyToId(null)}
                className="btn btn-secondary"
                style={{ padding: "0.4rem 1rem", fontSize: "0.8rem" }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingReply}
                className="btn btn-primary"
                style={{ padding: "0.4rem 1.25rem", fontSize: "0.8rem" }}
              >
                {submittingReply ? "Replying..." : "Post Reply"}
              </button>
            </div>
          </form>
        )}

        {/* Render child replies recursively */}
        {node.replies.map((reply) => renderComment(reply, depth + 1))}
      </div>
    );
  };

  return (
    <div className="page-wrapper">
      <Navbar />
      <main className="page-content">
        <div className="container-narrow" style={styles.pageInner}>
          {/* Breadcrumb */}
          <div style={styles.breadcrumb}>
            <Link href={`/communities/${post.community_slug}`} style={styles.breadcrumbLink}>
              /{post.community_slug}
            </Link>
            <span style={styles.breadcrumbSep}>›</span>
            <span style={styles.breadcrumbCurrent}>Post Detail</span>
          </div>

          {/* Main Post Section */}
          <article style={styles.postArticle}>
          {post.is_solved && (
            <div style={styles.solvedAlert}>
              <span style={styles.checkIcon}>✓</span>
              <div>
                <strong>QUESTION SOLVED:</strong> Members have vetted and accepted a solution in this thread.
              </div>
            </div>
          )}

          {post.moderation_status === "flagged" && (
            <div style={styles.moderationBanner}>
              ⚠️ <strong>Auto-Moderation Warning:</strong> This post has been flagged by AI for containing potential toxicity or spam.
            </div>
          )}

          <div style={styles.postMetaRow}>
            <span style={styles.typeBadge}>{postTypeLabel(post.post_type)}</span>
            <span style={styles.postDate}>
              Published in <Link href={`/communities/${post.community_slug}`}><strong>{post.community_name}</strong></Link> on {new Date(post.created_at).toLocaleDateString()}
            </span>
          </div>

          <h1 style={styles.postTitle}>{post.title}</h1>

          {/* Author Passport */}
          <div style={styles.authorPassport}>
            <div
              style={{
                ...styles.passportAvatar,
                backgroundColor: stringToColor(post.author_username || "?"),
                backgroundImage: post.author_avatar_url ? `url(${post.author_avatar_url})` : "none",
                backgroundSize: "cover",
              }}
            >
              {!post.author_avatar_url &&
                (post.author_display_name || post.author_username || "?").charAt(0).toUpperCase()}
            </div>
            <div>
              <h4 style={styles.authorDisplayName}>
                {post.author_display_name || post.author_username}
                {authorMembership && (
                  <span
                    style={{
                      fontSize: "0.7rem",
                      marginLeft: "0.5rem",
                      color: roleColor(authorMembership.role),
                      border: `1px solid ${roleColor(authorMembership.role)}`,
                      padding: "0.1rem 0.4rem",
                      borderRadius: "3px",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    {roleLabel(authorMembership.role)}
                  </span>
                )}
              </h4>
              <span style={styles.authorHandle}>
                @{post.author_username}
                {authorRep !== undefined && authorRep > 0 && ` · 🏆 ${authorRep} reputation`}
              </span>
            </div>
          </div>

          <div style={styles.postContent}>
            {post.content.split("\n\n").map((para, i) => {
              // Standard markdown parser placeholders
              if (para.startsWith("```") && para.endsWith("```")) {
                const code = para.slice(3, -3);
                return (
                  <pre key={i} style={styles.codeBlock}>
                    <code>{code}</code>
                  </pre>
                );
              }
              return (
                <p key={i} style={styles.paragraphText}>
                  {para}
                </p>
              );
            })}
          </div>

          {/* AI Helper Desk */}
          <div style={styles.aiHelperDesk}>
            <div style={styles.aiDeskHeader}>
              <h4 style={styles.aiDeskTitle}>🤖 Haven AI Workspace</h4>
              <div style={styles.aiDeskActions}>
                <button onClick={generateSummary} disabled={summaryLoading} style={styles.aiBtn}>
                  {summaryLoading ? "Summarizing..." : summary ? "Regenerate Summary" : "Generate Summary"}
                </button>
                {userRole && (
                  (userRole === "owner" ||
                   userRole === "admin" ||
                   userRole === "moderator" ||
                   userRole === "expert") && (
                    <button onClick={handleProposeWiki} style={styles.aiBtn}>
                      ✍️ Draft Wiki Page
                    </button>
                  )
                )}
              </div>
            </div>

            {summaryError && <p style={styles.aiError}>{summaryError}</p>}
            {summary && (
              <div style={styles.aiSummaryContent}>
                {summary.split("\n").map((line, idx) => (
                  <p key={idx} style={{ margin: "0.25rem 0", fontSize: "0.85rem", lineHeight: 1.5 }}>
                    {line}
                  </p>
                ))}
              </div>
            )}
          </div>

          {/* Post Reactions */}
          <div style={styles.postReactions}>
            <span style={styles.reactionsTitle}>React to this Discussion:</span>
            <div style={styles.reactionsRow}>
              <button
                onClick={() => handlePostVote("upvote")}
                disabled={!isAuthenticated}
                style={{
                  ...styles.postReactBtn,
                  ...(post.user_vote_type === "upvote" ? styles.postReactBtnActive : {}),
                }}
              >
                👍 Upvote ({post.upvotes_count})
              </button>
              <button
                onClick={() => handlePostVote("helpful")}
                disabled={!isAuthenticated}
                style={{
                  ...styles.postReactBtn,
                  ...(post.user_vote_type === "helpful" ? styles.postReactBtnActive : {}),
                }}
              >
                💡 Helpful ({post.helpful_count})
              </button>
              <button
                onClick={() => handlePostVote("insightful")}
                disabled={!isAuthenticated}
                style={{
                  ...styles.postReactBtn,
                  ...(post.user_vote_type === "insightful" ? styles.postReactBtnActive : {}),
                }}
              >
                🧠 Insightful ({post.insightful_count})
              </button>
              <button
                onClick={() => handlePostVote("funny")}
                disabled={!isAuthenticated}
                style={{
                  ...styles.postReactBtn,
                  ...(post.user_vote_type === "funny" ? styles.postReactBtnActive : {}),
                }}
              >
                😆 Funny ({post.funny_count})
              </button>
            </div>
          </div>
        </article>

        {/* Threaded Comments Section */}
        <section style={styles.commentsSection}>
          <h2 style={styles.commentsHeading}>
            Discussion Thread ({comments.length} responses)
          </h2>

          {/* Add Root Comment Form */}
          {isAuthenticated ? (
            <form onSubmit={handleAddComment} style={styles.commentForm}>
              <label htmlFor="commentContent">Write a Response</label>
              <textarea
                id="commentContent"
                placeholder="Share your thoughts, document resources, or answer questions..."
                value={commentContent}
                onChange={(e) => setCommentContent(e.target.value)}
                rows={4}
                required
                style={styles.commentTextarea}
              />
              <div style={styles.commentFormActions}>
                <button
                  type="submit"
                  disabled={submittingComment}
                  className="btn btn-primary"
                  style={styles.commentSubmitBtn}
                >
                  {submittingComment ? "Publishing..." : "Publish Response"}
                </button>
              </div>
            </form>
          ) : (
            <div style={styles.authPromptCard}>
              <p>You must be logged in to participate in this discussion.</p>
              <Link href="/auth/login" className="btn btn-primary" style={{ marginTop: "0.5rem" }}>
                Sign In to Registry
              </Link>
            </div>
          )}

          {/* Comments List */}
          {commentsLoading ? (
            <p style={styles.commentsLoadingText}>Loading responses...</p>
          ) : comments.length === 0 ? (
            <div style={styles.noCommentsCard}>
              <p>No responses have been posted to this thread yet.</p>
            </div>
          ) : (
            <div style={styles.commentsList}>
              {commentTree.map((rootNode) => renderComment(rootNode))}
            </div>
          )}
        </section>
      </div>
      </main>
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
  postArticle: {
    paddingBottom: "2.5rem",
    borderBottom: "1px solid var(--border-primary)",
    marginBottom: "2.5rem",
  },
  solvedAlert: {
    backgroundColor: "var(--color-success-light)",
    border: "1px solid var(--color-success)",
    padding: "1rem 1.25rem",
    display: "flex",
    alignItems: "center",
    gap: "1rem",
    fontSize: "var(--text-base)",
    color: "var(--color-success)",
    marginBottom: "1.5rem",
    borderRadius: "var(--radius-sm)",
  },
  checkIcon: {
    fontSize: "1.25rem",
    fontWeight: 700,
  },
  postMetaRow: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    marginBottom: "1rem",
  },
  typeBadge: {
    fontSize: "var(--text-xs)",
    fontWeight: 600,
    textTransform: "uppercase",
    padding: "0.15rem 0.5rem",
    backgroundColor: "var(--color-primary-light)",
    color: "var(--color-primary)",
    border: "1px solid var(--border-primary)",
    borderRadius: "var(--radius-sm)",
  },
  postDate: {
    fontSize: "var(--text-sm)",
    color: "var(--text-tertiary)",
  },
  postTitle: {
    fontFamily: "var(--font-display)",
    fontSize: "var(--text-3xl)",
    lineHeight: 1.2,
    fontWeight: 700,
    letterSpacing: "-0.02em",
    margin: 0,
    padding: 0,
    border: "none",
    marginBottom: "1.5rem",
  },
  authorPassport: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    marginBottom: "2rem",
    paddingBottom: "1rem",
    borderBottom: "1px solid var(--border-primary)",
  },
  passportAvatar: {
    width: "44px",
    height: "44px",
    borderRadius: "var(--radius-sm)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "white",
    fontSize: "var(--text-lg)",
    fontWeight: 700,
  },
  authorDisplayName: {
    fontFamily: "var(--font-serif)",
    fontSize: "var(--text-md)",
    margin: 0,
    fontWeight: 600,
  },
  authorHandle: {
    fontFamily: "var(--font-mono)",
    fontSize: "var(--text-xs)",
    color: "var(--text-tertiary)",
  },
  postContent: {
    fontSize: "var(--text-base)",
    lineHeight: 1.7,
    color: "var(--text-secondary)",
    marginBottom: "2rem",
  },
  paragraphText: {
    marginBottom: "1.25rem",
  },
  codeBlock: {
    backgroundColor: "var(--bg-inset)",
    border: "1px solid var(--border-primary)",
    padding: "1rem",
    fontFamily: "var(--font-mono)",
    fontSize: "var(--text-sm)",
    overflowX: "auto",
    marginBottom: "1.5rem",
    borderRadius: "var(--radius-sm)",
  },
  postReactions: {
    backgroundColor: "var(--bg-surface-hover)",
    border: "1px solid var(--border-primary)",
    padding: "1.25rem 1.5rem",
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
    borderRadius: "var(--radius-md)",
  },
  reactionsTitle: {
    fontSize: "var(--text-xs)",
    fontWeight: 700,
    textTransform: "uppercase",
    color: "var(--text-secondary)",
    letterSpacing: "0.04em",
  },
  reactionsRow: {
    display: "flex",
    gap: "0.4rem",
    flexWrap: "wrap",
  },
  postReactBtn: {
    padding: "0.4rem 0.85rem",
    fontSize: "var(--text-xs)",
    fontWeight: 600,
    border: "1px solid var(--border-primary)",
    backgroundColor: "var(--bg-surface)",
    cursor: "pointer",
    borderRadius: "var(--radius-full)",
    color: "var(--text-secondary)",
    transition: "all 150ms ease",
    fontFamily: "var(--font-sans)",
  },
  postReactBtnActive: {
    backgroundColor: "var(--color-primary)",
    color: "var(--text-inverse)",
    borderColor: "var(--color-primary)",
  },
  commentsSection: {
    display: "flex",
    flexDirection: "column",
    gap: "1.5rem",
    marginTop: "2.5rem",
  },
  commentsHeading: {
    fontFamily: "var(--font-serif)",
    fontSize: "var(--text-lg)",
    border: "none",
    margin: 0,
    fontWeight: 600,
  },
  commentForm: {
    border: "1px solid var(--border-primary)",
    padding: "1.5rem",
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
    borderRadius: "var(--radius-md)",
    backgroundColor: "var(--bg-surface)",
  },
  commentTextarea: {
    resize: "vertical",
    minHeight: "100px",
  },
  commentFormActions: {
    display: "flex",
    justifyContent: "flex-end",
  },
  commentSubmitBtn: {},
  authPromptCard: {
    padding: "1.5rem",
    border: "1px dashed var(--border-primary)",
    textAlign: "center",
    backgroundColor: "var(--bg-inset)",
    borderRadius: "var(--radius-md)",
  },
  commentsLoadingText: {
    fontSize: "var(--text-sm)",
    color: "var(--text-tertiary)",
    fontStyle: "italic",
  },
  noCommentsCard: {
    padding: "2rem",
    border: "1px dashed var(--border-primary)",
    textAlign: "center",
    color: "var(--text-tertiary)",
    borderRadius: "var(--radius-md)",
  },
  commentsList: {
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
    marginTop: "1rem",
  },
  commentWrapper: {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
    marginTop: "0.5rem",
  },
  commentCard: {
    border: "1px solid var(--border-primary)",
    padding: "1.25rem",
    borderRadius: "var(--radius-md)",
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
    position: "relative",
  },
  solutionBanner: {
    position: "absolute",
    top: "-10px",
    right: "1.5rem",
    backgroundColor: "var(--color-success)",
    color: "white",
    fontSize: "var(--text-xs)",
    fontWeight: 700,
    padding: "0.2rem 0.6rem",
    borderRadius: "var(--radius-sm)",
    letterSpacing: "0.05em",
  },
  commentHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  authorRow: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  },
  avatarSmall: {
    width: "26px",
    height: "26px",
    borderRadius: "var(--radius-sm)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "white",
    fontSize: "var(--text-xs)",
    fontWeight: 600,
  },
  authorMeta: {
    display: "flex",
    alignItems: "baseline",
    gap: "0.35rem",
  },
  authorName: {
    fontSize: "var(--text-sm)",
    fontWeight: 600,
  },
  authorUsername: {
    fontFamily: "var(--font-mono)",
    fontSize: "var(--text-xs)",
    color: "var(--text-tertiary)",
  },
  commentDate: {
    fontSize: "var(--text-xs)",
    color: "var(--text-tertiary)",
  },
  commentBody: {
    fontSize: "var(--text-base)",
    lineHeight: 1.6,
    color: "var(--text-secondary)",
  },
  commentFooter: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "0.75rem",
    borderTop: "1px dashed var(--border-primary)",
    paddingTop: "0.5rem",
  },
  reactionGrid: {
    display: "flex",
    gap: "0.3rem",
    flexWrap: "wrap",
  },
  reactBtn: {
    padding: "0.25rem 0.55rem",
    fontSize: "var(--text-xs)",
    border: "1px solid var(--border-primary)",
    backgroundColor: "var(--bg-surface)",
    cursor: "pointer",
    borderRadius: "var(--radius-full)",
    color: "var(--text-secondary)",
    transition: "all 150ms ease",
    fontFamily: "var(--font-sans)",
  },
  reactBtnActive: {
    backgroundColor: "var(--color-primary-light)",
    color: "var(--color-primary)",
    borderColor: "var(--color-primary)",
  },
  utilityActions: {
    display: "flex",
    gap: "0.75rem",
    alignItems: "center",
  },
  replyLinkBtn: {
    fontSize: "var(--text-xs)",
    fontWeight: 600,
    color: "var(--color-primary)",
    background: "none",
    border: "none",
    cursor: "pointer",
  },
  solveBtn: {
    fontSize: "var(--text-xs)",
    fontWeight: 600,
    color: "var(--color-success)",
    background: "none",
    border: "none",
    cursor: "pointer",
  },
  replyForm: {
    border: "1px solid var(--border-primary)",
    padding: "1rem",
    backgroundColor: "var(--bg-inset)",
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
    borderRadius: "var(--radius-md)",
  },
  replyTextarea: {
    resize: "vertical",
    width: "100%",
    padding: "0.5rem",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--text-sm)",
  },
  replyFormActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "0.5rem",
  },
  // Error state
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
    textTransform: "uppercase",
  },
  textCenter: {
    textAlign: "center",
  },
  // Phase 8: AI & Moderation styles
  moderationBanner: {
    backgroundColor: "#fffbeb",
    border: "1px solid #d97706",
    color: "#b45309",
    padding: "0.75rem 1.25rem",
    marginBottom: "1.25rem",
    fontSize: "0.85rem",
    lineHeight: 1.5,
  },
  aiHelperDesk: {
    border: "1px solid var(--border-primary)",
    backgroundColor: "var(--bg-inset)",
    padding: "1.25rem",
    marginBottom: "2rem",
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
    borderRadius: "var(--radius-md)",
  },
  aiDeskHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "0.75rem",
    borderBottom: "1px dashed var(--border-primary)",
    paddingBottom: "0.5rem",
  },
  aiDeskTitle: {
    fontFamily: "var(--font-serif)",
    fontSize: "var(--text-sm)",
    fontWeight: 700,
    margin: 0,
    textTransform: "uppercase",
    letterSpacing: "0.02em",
  },
  aiDeskActions: {
    display: "flex",
    gap: "0.5rem",
  },
  aiBtn: {
    padding: "0.25rem 0.75rem",
    fontSize: "var(--text-xs)",
    fontWeight: 600,
    fontFamily: "var(--font-mono)",
    backgroundColor: "var(--bg-surface)",
    border: "1px solid var(--border-primary)",
    cursor: "pointer",
    borderRadius: "var(--radius-sm)",
  },
  aiError: {
    color: "var(--color-error)",
    fontSize: "var(--text-xs)",
    margin: 0,
  },
  aiSummaryContent: {
    backgroundColor: "var(--bg-surface)",
    padding: "0.75rem 1rem",
    borderLeft: "2px solid var(--color-primary)",
    maxHeight: "250px",
    overflowY: "auto",
  },
};
