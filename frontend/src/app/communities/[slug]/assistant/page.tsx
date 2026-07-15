"use client";

import React, { useState, useEffect, useRef, use } from "react";
import Link from "next/link";
import { useAuth } from "../../../../hooks/useAuth";
import { useCommunity } from "../../../../hooks/useCommunities";
import { useAIAssistant } from "../../../../hooks/useAI";

export default function AIAssistantPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const resolvedParams = use(params);
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const { community, loading: communityLoading } = useCommunity(resolvedParams.slug);
  const { messages, loading: messagesLoading, sending, error, sendMessage } = useAIAssistant(resolvedParams.slug);

  const [text, setText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  // Scroll to bottom on initial load and message updates
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || sending) return;

    const query = text.trim();
    setText("");
    await sendMessage(query);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Basic parser to render formatted bold/italic and headers from markdown response
  const renderMarkdown = (content: string) => {
    return content.split("\n").map((line, lineIdx) => {
      let trimmed = line.trim();
      
      // Headers
      if (trimmed.startsWith("### ")) {
        return <h4 key={lineIdx} style={styles.mdH4}>{trimmed.substring(4)}</h4>;
      }
      if (trimmed.startsWith("## ")) {
        return <h3 key={lineIdx} style={styles.mdH3}>{trimmed.substring(3)}</h3>;
      }
      if (trimmed.startsWith("# ")) {
        return <h2 key={lineIdx} style={styles.mdH2}>{trimmed.substring(2)}</h2>;
      }

      // Bullet points
      if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
        return (
          <li key={lineIdx} style={styles.mdLi}>
            {parseInlineMarkdown(trimmed.substring(2))}
          </li>
        );
      }

      // Standard paragraph
      if (trimmed === "") {
        return <div key={lineIdx} style={{ height: "0.5rem" }} />;
      }

      return (
        <p key={lineIdx} style={styles.mdParagraph}>
          {parseInlineMarkdown(line)}
        </p>
      );
    });
  };

  const parseInlineMarkdown = (text: string) => {
    // Renders bold (**text**) and inline code (`code`)
    const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith("`") && part.endsWith("`")) {
        return <code key={i} style={styles.mdCode}>{part.slice(1, -1)}</code>;
      }
      return part;
    });
  };

  const stringToColor = (str: string): string => {
    const colors = [
      "#4a5c43", "#b05c42", "#3c6e47", "#5e4a7a",
      "#6b5b3e", "#2d6a6a", "#8b5e3c", "#4a6b8a",
    ];
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  if (authLoading || communityLoading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner} />
        <p style={styles.loadingText}>Opening AI core channel...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div style={styles.pageContainer}>
        <div style={styles.editorialFrame}>
          <div style={styles.errorState}>
            <h2>Authentication Required</h2>
            <p>Please log in to converse with the community AI assistant.</p>
            <Link href="/auth/login" className="btn btn-primary" style={{ textDecoration: "none", display: "inline-block", marginTop: "1rem" }}>
              Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!community) {
    return (
      <div style={styles.pageContainer}>
        <div style={styles.editorialFrame}>
          <div style={styles.errorState}>
            <h2>Community Not Found</h2>
            <p>The requested community slug is invalid or unavailable.</p>
            <Link href="/communities" className="btn btn-secondary">
              Return to Registry
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.pageContainer}>
      <div style={styles.editorialFrame}>
        {/* Header */}
        <header style={styles.header}>
          <div style={styles.headerTop}>
            <Link href={`/communities/${community.slug}`} style={styles.backLink}>
              ← Back to /{community.slug}
            </Link>
            <span style={styles.headerMeta}>
              Haven AI Assistant
            </span>
          </div>
          <div style={styles.headerTitleRow}>
            <h1 style={styles.titleText}>🤖 Assistant: {community.name}</h1>
            <p style={styles.subtitleText}>
              Ask questions about guides, FAQs, projects, and discussions inside this community.
            </p>
          </div>
        </header>

        {/* Chat Feed */}
        <div style={styles.chatArea}>
          {messagesLoading ? (
            <div style={styles.loadingFeed}>Loading past dialogue history...</div>
          ) : messages.length === 0 ? (
            <div style={styles.emptyFeedPlaceholder}>
              <div style={styles.emptyFeedIcon}>🤖</div>
              <h3>Start your conversation with the /{community.slug} AI Assistant</h3>
              <p>
                Try asking questions like: <br />
                <code>"What projects are currently active?"</code> or <code>"Explain community wiki guidelines"</code>
              </p>
            </div>
          ) : (
            <div style={styles.messagesList}>
              {messages.map((m) => {
                const isMe = m.sender === "user";
                return (
                  <div
                    key={m.id}
                    style={{
                      ...styles.messageRow,
                      flexDirection: isMe ? "row-reverse" : "row",
                      alignSelf: isMe ? "flex-end" : "flex-start",
                    }}
                  >
                    <div
                      style={{
                        ...styles.messageAvatar,
                        backgroundColor: isMe ? stringToColor(user?.username || "?") : "var(--primary)",
                        backgroundImage: isMe && user?.avatar_url ? `url(${user.avatar_url})` : "none",
                      }}
                    >
                      {isMe ? (user?.display_name || user?.username || "?").charAt(0).toUpperCase() : "AI"}
                    </div>
                    <div
                      style={{
                        ...styles.messageContentBlock,
                        alignItems: isMe ? "flex-end" : "flex-start",
                      }}
                    >
                      <div
                        style={{
                          ...styles.messageMetaRow,
                          flexDirection: isMe ? "row-reverse" : "row",
                        }}
                      >
                        <span style={styles.senderNameText}>
                          {isMe ? (user?.display_name || user?.username) : "Community Assistant"}
                        </span>
                        <span style={styles.messageTimeText}>
                          {new Date(m.created_at).toLocaleTimeString(undefined, {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <div
                        style={{
                          ...styles.messageBubble,
                          backgroundColor: isMe ? "var(--primary)" : "var(--bg-surface)",
                          color: isMe ? "var(--bg-main)" : "var(--text-main)",
                          border: isMe ? "none" : "1px solid var(--border-color)",
                          borderRadius: isMe ? "12px 0px 12px 12px" : "0px 12px 12px 12px",
                        }}
                      >
                        {isMe ? (
                          <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{m.content}</p>
                        ) : (
                          renderMarkdown(m.content)
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              
              {sending && (
                <div style={{ ...styles.messageRow, flexDirection: "row", alignSelf: "flex-start" }}>
                  <div style={{ ...styles.messageAvatar, backgroundColor: "var(--primary)" }}>AI</div>
                  <div style={styles.messageContentBlock}>
                    <div style={styles.messageMetaRow}>
                      <span style={styles.senderNameText}>Community Assistant</span>
                    </div>
                    <div style={styles.typingIndicator}>
                      <span className="dot" style={styles.typingDot}></span>
                      <span className="dot" style={{ ...styles.typingDot, animationDelay: "0.2s" }}></span>
                      <span className="dot" style={{ ...styles.typingDot, animationDelay: "0.4s" }}></span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} style={styles.inputArea}>
          <textarea
            placeholder="Ask assistant about posts, wikis or projects..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyPress}
            disabled={sending}
            rows={2}
            style={styles.messageInput}
          />
          <button
            type="submit"
            disabled={!text.trim() || sending}
            className="btn btn-primary"
            style={styles.sendButton}
          >
            {sending ? "Scanning Context..." : "Send Query"}
          </button>
        </form>

        {error && (
          <div style={styles.errorBanner}>
            ❌ {error}
          </div>
        )}
      </div>
      
      {/* Dynamic Keyframes Animation Injection */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes typing {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        .dot {
          animation: typing 1s infinite ease-in-out;
        }
      `}} />
    </div>
  );
}

// ── Styles ────────────────────────────────────────

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
    maxWidth: "960px",
    margin: "0 auto",
    backgroundColor: "var(--bg-surface)",
    border: "2px solid var(--text-main)",
    padding: "2.5rem",
    boxShadow: "var(--shadow-lg)",
    display: "flex",
    flexDirection: "column",
    flexGrow: 1,
    minHeight: "650px",
  },
  header: {
    borderBottom: "3px solid var(--text-main)",
    paddingBottom: "1.5rem",
    marginBottom: "1.5rem",
  },
  headerTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
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
  headerTitleRow: {
    marginTop: "0.5rem",
  },
  titleText: {
    fontFamily: "var(--font-serif)",
    fontSize: "2.2rem",
    fontWeight: 700,
    margin: 0,
    color: "var(--text-main)",
  },
  subtitleText: {
    fontSize: "0.95rem",
    color: "var(--text-muted)",
    margin: "0.5rem 0 0 0",
    lineHeight: 1.4,
  },
  chatArea: {
    flexGrow: 1,
    display: "flex",
    flexDirection: "column",
    justifyContent: "flex-end",
    minHeight: "350px",
    maxHeight: "500px",
    border: "1px solid var(--border-color)",
    backgroundColor: "var(--bg-main)",
    padding: "1.5rem",
    overflowY: "auto",
    marginBottom: "1rem",
  },
  loadingFeed: {
    textAlign: "center",
    color: "var(--text-light)",
    fontSize: "0.9rem",
    fontStyle: "italic",
    padding: "2rem 0",
  },
  emptyFeedPlaceholder: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    padding: "3rem 1.5rem",
    color: "var(--text-muted)",
    height: "100%",
  },
  emptyFeedIcon: {
    fontSize: "3rem",
    marginBottom: "1rem",
  },
  messagesList: {
    display: "flex",
    flexDirection: "column",
    gap: "1.2rem",
    width: "100%",
  },
  messageRow: {
    display: "flex",
    gap: "0.8rem",
    alignItems: "start",
    maxWidth: "80%",
  },
  messageAvatar: {
    width: "36px",
    height: "36px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "white",
    fontSize: "0.85rem",
    fontWeight: 700,
    backgroundSize: "cover",
    flexShrink: 0,
  },
  messageContentBlock: {
    display: "flex",
    flexDirection: "column",
    gap: "0.3rem",
  },
  messageMetaRow: {
    display: "flex",
    alignItems: "baseline",
    gap: "0.5rem",
  },
  senderNameText: {
    fontWeight: 600,
    fontSize: "0.85rem",
    color: "var(--text-main)",
  },
  messageTimeText: {
    fontSize: "0.7rem",
    color: "var(--text-muted)",
  },
  messageBubble: {
    padding: "0.6rem 1rem",
    boxShadow: "var(--shadow-sm)",
    lineHeight: 1.5,
    fontSize: "0.95rem",
  },
  typingIndicator: {
    display: "flex",
    gap: "0.25rem",
    padding: "0.6rem 1rem",
    backgroundColor: "var(--bg-surface)",
    border: "1px solid var(--border-color)",
    borderRadius: "0px 12px 12px 12px",
    width: "fit-content",
  },
  typingDot: {
    width: "6px",
    height: "6px",
    backgroundColor: "var(--text-muted)",
    borderRadius: "50%",
    display: "inline-block",
    animation: "typing 1.4s infinite ease-in-out",
  },
  inputArea: {
    display: "flex",
    gap: "1rem",
    alignItems: "end",
  },
  messageInput: {
    flexGrow: 1,
    padding: "0.75rem",
    border: "1px solid var(--border-color)",
    backgroundColor: "var(--bg-surface)",
    color: "var(--text-main)",
    borderRadius: "4px",
    fontSize: "0.95rem",
    fontFamily: "var(--font-sans)",
    resize: "none",
    outline: "none",
  },
  sendButton: {
    padding: "0.8rem 1.5rem",
    height: "100%",
    fontSize: "0.9rem",
    alignSelf: "stretch",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  errorBanner: {
    backgroundColor: "rgba(168, 61, 49, 0.1)",
    border: "1px solid var(--error)",
    color: "var(--error)",
    padding: "0.5rem 1rem",
    borderRadius: "4px",
    marginTop: "1rem",
    fontSize: "0.85rem",
  },
  errorState: {
    textAlign: "center",
    padding: "4rem 2rem",
    color: "var(--text-muted)",
  },
  // Markdown style overrides
  mdParagraph: {
    margin: "0 0 0.5rem 0",
  },
  mdH2: {
    fontSize: "1.2rem",
    fontWeight: 700,
    margin: "0.75rem 0 0.4rem 0",
    borderBottom: "1px solid var(--border-color)",
    paddingBottom: "0.2rem",
  },
  mdH3: {
    fontSize: "1.1rem",
    fontWeight: 600,
    margin: "0.6rem 0 0.3rem 0",
  },
  mdH4: {
    fontSize: "0.95rem",
    fontWeight: 600,
    margin: "0.5rem 0 0.25rem 0",
    color: "var(--primary)",
  },
  mdLi: {
    marginLeft: "1rem",
    marginBottom: "0.25rem",
  },
  mdCode: {
    fontFamily: "var(--font-mono)",
    backgroundColor: "var(--border-light)",
    padding: "0.1rem 0.3rem",
    borderRadius: "3px",
    fontSize: "0.85rem",
  },
};
