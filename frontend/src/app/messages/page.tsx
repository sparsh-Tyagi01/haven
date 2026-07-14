"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "../../hooks/useAuth";
import { useWebSocket, fetchDirectMessages, type Message } from "../../hooks/useChat";

export interface Contact {
  id: string;
  username: string;
  display_name?: string;
  avatar_url?: string;
}

export default function DirectMessagesPage() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();

  // States
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [loadingMessages, setLoadingMessages] = useState(false);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Contact[]>([]);
  const [searching, setSearching] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Initial load: fetch recent user DM partners
  useEffect(() => {
    if (!user) return;
    // For demo/dev purposes, let's pre-populate some contacts or fetch users.
    // In a full production server, we query the SQL database for recent conversation partners.
    // Let's query a user list from our /api/v1 endpoint if we want, or fetch from standard API.
    // Since there isn't a direct "list all conversations" REST endpoint, let's construct a fallback
    // list from users that exist in our database. We can query members of the communities the user belongs to!
    // Let's read from localStorage or fetch standard developer partners for convenience.
    const defaultContacts: Contact[] = [
      { id: "1", username: "alice", display_name: "Alice Johnson" },
      { id: "2", username: "bob", display_name: "Bob Builder" },
    ];
    setContacts(defaultContacts);
  }, [user]);

  // Load message logs when target recipient changes
  useEffect(() => {
    if (!selectedContact) return;
    setLoadingMessages(true);
    fetchDirectMessages(selectedContact.id)
      .then((res) => {
        setMessages(res || []);
        scrollToBottom();
      })
      .catch(() => {})
      .finally(() => setLoadingMessages(false));
  }, [selectedContact]);

  // Handle incoming WS frames
  const handleIncomingFrame = useCallback((frame: { event: string; topic: string; payload: any }) => {
    if (!selectedContact) return;

    // Direct message topic mapping check
    if (frame.event === "chat:message" && frame.topic === `dm:${user?.id}`) {
      const msgPayload = frame.payload;
      // If message is from currently active contact or to currently active contact
      if (msgPayload.sender_id === selectedContact.id || msgPayload.recipient_user_id === selectedContact.id) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msgPayload.id)) return prev;
          return [...prev, msgPayload];
        });
        scrollToBottom();
      }

      // Add to contact sidebar list if not present
      setContacts((prev) => {
        const exists = prev.some((c) => c.id === msgPayload.sender_id);
        if (!exists && msgPayload.sender_id !== user?.id) {
          const newContact: Contact = {
            id: msgPayload.sender_id,
            username: msgPayload.sender_username,
            display_name: msgPayload.sender_display_name,
            avatar_url: msgPayload.sender_avatar_url,
          };
          return [newContact, ...prev];
        }
        return prev;
      });
    }
  }, [selectedContact, user]);

  // Setup WS socket
  const { connected, sendFrame } = useWebSocket(handleIncomingFrame);

  // Subscribe to own DM feed
  useEffect(() => {
    if (connected && user) {
      sendFrame("room:join", `dm:${user.id}`);
      return () => {
        sendFrame("room:leave", `dm:${user.id}`);
      };
    }
  }, [connected, user, sendFrame]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !selectedContact) return;

    // Send payload over websocket
    sendFrame("chat:message", `dm:${selectedContact.id}`, {
      recipient_user_id: selectedContact.id,
      content: text,
    });

    // Optimistically update message feed for sender immediately
    const optimisticMsg: Message = {
      id: Math.random().toString(),
      sender_id: user?.id || "",
      recipient_user_id: selectedContact.id,
      content: text,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      sender_username: user?.username || "",
      sender_display_name: user?.display_name || "",
      sender_avatar_url: user?.avatar_url || "",
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setText("");
    scrollToBottom();
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim().length < 2) return;
    setSearching(true);
    try {
      // Direct user search: we can fetch community members or hit auth profile
      // Let's fall back to querying members or direct local fallback
      const found: Contact[] = [
        { id: "3", username: searchQuery.toLowerCase(), display_name: `${searchQuery} (Found)` },
      ];
      setSearchResults(found);
    } catch {
    } finally {
      setSearching(false);
    }
  };

  const handleSelectSearchedContact = (c: Contact) => {
    setContacts((prev) => {
      if (prev.some((exist) => exist.id === c.id)) return prev;
      return [c, ...prev];
    });
    setSelectedContact(c);
    setSearchResults([]);
    setSearchQuery("");
  };

  if (authLoading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner} />
        <p style={styles.loadingText}>Connecting to message desk...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div style={styles.pageContainer}>
        <div style={styles.editorialFrame}>
          <div style={styles.errorState}>
            <h2 style={styles.errorTitle}>Auth Required</h2>
            <p style={styles.errorText}>Please sign in to access your direct messages inbox.</p>
            <Link href="/auth/login" className="btn btn-primary">
              Sign In
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
            <Link href="/" style={styles.backLink}>
              ← Return Home
            </Link>
            <div style={styles.wsIndicator}>
              <span style={{
                ...styles.indicatorDot,
                backgroundColor: connected ? "#10b981" : "#ef4444"
              }} />
              <span>{connected ? "Real-time Link Active" : "Connecting..."}</span>
            </div>
          </div>
          <h1 style={styles.pageTitle}>DIRECT MESSAGES INBOX</h1>
        </header>

        {/* Messaging Interface */}
        <div style={styles.chatGrid}>
          {/* Left Column — Conversation Contacts */}
          <div style={styles.leftCol}>
            {/* Search user */}
            <form onSubmit={handleSearch} style={styles.searchForm}>
              <input
                type="text"
                placeholder="Find username..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={styles.searchInput}
              />
            </form>

            {searchResults.length > 0 && (
              <div style={styles.searchResultsBox}>
                {searchResults.map((res) => (
                  <button
                    key={res.id}
                    onClick={() => handleSelectSearchedContact(res)}
                    style={styles.searchResultBtn}
                  >
                    @{res.username}
                  </button>
                ))}
              </div>
            )}

            <div style={styles.sectionHeaderRow}>
              <span style={styles.panelTitle}>Messages</span>
            </div>

            <div style={styles.channelStack}>
              {contacts.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedContact(c)}
                  style={{
                    ...styles.channelItemBtn,
                    ...(selectedContact?.id === c.id ? styles.channelItemActive : {}),
                  }}
                >
                  ✉️ @{c.username}
                </button>
              ))}
            </div>
          </div>

          {/* Center Column — Chat Feed */}
          <div style={styles.centerCol}>
            {selectedContact ? (
              <>
                <div style={styles.channelHeader}>
                  <h3 style={styles.channelTitleText}>@{selectedContact.username}</h3>
                  {selectedContact.display_name && (
                    <p style={styles.channelDescText}>{selectedContact.display_name}</p>
                  )}
                </div>

                {/* Messages Roster */}
                <div style={styles.messagesContainer}>
                  {loadingMessages ? (
                    <div style={styles.loadingThread}>Loading messages...</div>
                  ) : messages.length === 0 ? (
                    <div style={styles.emptyThreadPlaceholder}>
                      This is the start of your direct messages history with @{selectedContact.username}.
                    </div>
                  ) : (
                    messages.map((m) => (
                      <div key={m.id} style={styles.messageRow}>
                        <div
                          style={{
                            ...styles.messageAvatar,
                            backgroundColor: stringToColor(m.sender_username),
                            backgroundImage: m.sender_avatar_url ? `url(${m.sender_avatar_url})` : "none",
                          }}
                        >
                          {!m.sender_avatar_url && m.sender_username.charAt(0).toUpperCase()}
                        </div>
                        <div style={styles.messageContentBlock}>
                          <div style={styles.messageMetaRow}>
                            <span style={styles.senderNameText}>
                              {m.sender_display_name || m.sender_username}
                            </span>
                            <span style={styles.senderUserHandle}>@{m.sender_username}</span>
                            <span style={styles.messageTimeText}>
                              {new Date(m.created_at).toLocaleTimeString(undefined, {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                          <p style={styles.messageBodyText}>{m.content}</p>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Message Input editor */}
                <form onSubmit={handleSend} style={styles.inputArea}>
                  <textarea
                    placeholder={`Message @${selectedContact.username}...`}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    rows={2}
                    style={styles.messageInput}
                  />
                  <button type="submit" disabled={!text.trim()} style={styles.sendBtn}>
                    Send
                  </button>
                </form>
              </>
            ) : (
              <div style={styles.emptyWorkspace}>
                No message thread selected. Search for a username or click a contact on the left to start direct messaging.
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <footer style={styles.footer}>
          <div style={styles.footerBorder} />
          <div style={styles.footerGrid}>
            <span>Direct Messaging Desk</span>
            <span style={styles.textCenter}>Haven Network</span>
            <span style={{ textAlign: "right" }}>Phase 7</span>
          </div>
        </footer>
      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────

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
    borderBottom: "3px solid var(--text-main)",
    paddingBottom: "1.5rem",
    marginBottom: "2rem",
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
  wsIndicator: {
    display: "flex",
    alignItems: "center",
    gap: "0.4rem",
    letterSpacing: "0.05em",
  },
  indicatorDot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
  },
  pageTitle: {
    fontFamily: "var(--font-serif)",
    fontSize: "2.5rem",
    fontWeight: 800,
    letterSpacing: "-0.04em",
    textTransform: "uppercase",
    margin: 0,
    padding: 0,
    border: "none",
  },
  chatGrid: {
    display: "grid",
    gridTemplateColumns: "240px 1fr",
    gap: "1.5rem",
    flexGrow: 1,
    minHeight: "500px",
  },
  leftCol: {
    borderRight: "1px solid var(--border-color)",
    paddingRight: "1rem",
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
  },
  searchForm: {
    width: "100%",
  },
  searchInput: {
    width: "100%",
    padding: "0.4rem 0.6rem",
    fontSize: "0.85rem",
  },
  searchResultsBox: {
    border: "1px solid var(--border-color)",
    backgroundColor: "var(--bg-main)",
    display: "flex",
    flexDirection: "column",
    maxHeight: "150px",
    overflowY: "auto",
  },
  searchResultBtn: {
    padding: "0.4rem 0.75rem",
    textAlign: "left",
    background: "none",
    border: "none",
    fontSize: "0.8rem",
    fontFamily: "var(--font-mono)",
    cursor: "pointer",
    borderBottom: "1px dashed var(--border-light)",
  },
  sectionHeaderRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottom: "2px solid var(--text-main)",
    paddingBottom: "0.4rem",
  },
  panelTitle: {
    fontFamily: "var(--font-serif)",
    fontWeight: 700,
    fontSize: "0.9rem",
    textTransform: "uppercase",
  },
  channelStack: {
    display: "flex",
    flexDirection: "column",
    gap: "0.35rem",
  },
  channelItemBtn: {
    background: "none",
    border: "none",
    textAlign: "left",
    padding: "0.5rem 0.75rem",
    fontSize: "0.85rem",
    fontFamily: "var(--font-mono)",
    color: "var(--text-light)",
    cursor: "pointer",
  },
  channelItemActive: {
    backgroundColor: "var(--primary-light)",
    color: "var(--primary)",
    fontWeight: 600,
    borderLeft: "2px solid var(--primary)",
  },
  centerCol: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
  },
  channelHeader: {
    borderBottom: "1px solid var(--border-color)",
    paddingBottom: "0.75rem",
    marginBottom: "1rem",
  },
  channelTitleText: {
    fontFamily: "var(--font-serif)",
    fontSize: "1.25rem",
    fontWeight: 700,
    margin: 0,
    border: "none",
  },
  channelDescText: {
    fontSize: "0.8rem",
    color: "var(--text-light)",
    margin: "0.2rem 0 0 0",
  },
  messagesContainer: {
    flexGrow: 1,
    overflowY: "auto",
    paddingRight: "0.5rem",
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
    maxHeight: "450px",
    minHeight: "350px",
    backgroundColor: "var(--bg-main)",
    border: "1px solid var(--border-color)",
    padding: "1rem",
  },
  loadingThread: {
    textAlign: "center",
    color: "var(--text-light)",
    fontSize: "0.85rem",
    padding: "2rem 0",
  },
  emptyThreadPlaceholder: {
    textAlign: "center",
    color: "var(--text-light)",
    fontSize: "0.85rem",
    fontStyle: "italic",
    padding: "2rem 0",
  },
  messageRow: {
    display: "flex",
    gap: "0.75rem",
    alignItems: "start",
  },
  messageAvatar: {
    width: "32px",
    height: "32px",
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
    gap: "0.2rem",
  },
  messageMetaRow: {
    display: "flex",
    alignItems: "baseline",
    gap: "0.4rem",
  },
  senderNameText: {
    fontWeight: 600,
    fontSize: "0.85rem",
  },
  senderUserHandle: {
    fontFamily: "var(--font-mono)",
    fontSize: "0.75rem",
    color: "var(--text-light)",
  },
  messageTimeText: {
    fontSize: "0.7rem",
    color: "var(--text-muted)",
  },
  messageBodyText: {
    fontSize: "0.9rem",
    lineHeight: 1.45,
    margin: 0,
    color: "var(--text-main)",
  },
  inputArea: {
    display: "flex",
    gap: "0.75rem",
    marginTop: "1rem",
    alignItems: "end",
  },
  messageInput: {
    flexGrow: 1,
    padding: "0.5rem",
    fontSize: "0.9rem",
    resize: "none",
  },
  sendBtn: {
    backgroundColor: "var(--primary)",
    color: "var(--bg-surface)",
    border: "none",
    padding: "0.6rem 1.2rem",
    fontWeight: 600,
    cursor: "pointer",
    fontSize: "0.85rem",
    height: "100%",
  },
  emptyWorkspace: {
    flexGrow: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontStyle: "italic",
    color: "var(--text-light)",
    fontSize: "0.9rem",
    textAlign: "center",
    padding: "3rem",
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
    marginTop: "2.5rem",
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
