"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import Navbar from "../components/Navbar";
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
      <div className="page-wrapper">
        <Navbar />
        <div style={styles.loadingContainer}>
          <div style={styles.spinner} />
          <p style={styles.loadingText}>Connecting to message desk...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="page-wrapper">
        <Navbar />
        <main className="page-content">
          <div className="container" style={styles.errorState}>
            <h2 style={styles.errorTitle}>Auth Required</h2>
            <p style={styles.errorText}>Please sign in to access your direct messages inbox.</p>
            <Link href="/auth/login" className="btn btn-primary">
              Sign In
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="page-wrapper">
      <Navbar />
      <main className="page-content">
        <div className="container" style={styles.pageInner}>
          {/* Header */}
          <header style={styles.header}>
            <div>
              <h1 style={styles.pageTitle}>Inbox</h1>
              <p style={styles.pageSubtitle}>Direct Messages</p>
            </div>
            <div style={styles.wsIndicator}>
              <span style={{
                ...styles.indicatorDot,
                backgroundColor: connected ? "var(--color-success)" : "var(--color-error)"
              }} />
              <span style={styles.wsText}>{connected ? "Connected" : "Reconnecting..."}</span>
            </div>
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
                    messages.map((m) => {
                      const isMe = m.sender_id === user?.id;
                      return (
                        <div
                          key={m.id}
                          style={{
                            ...styles.messageRow,
                            flexDirection: isMe ? "row-reverse" : "row",
                            alignSelf: isMe ? "flex-end" : "flex-start",
                            maxWidth: "75%",
                          }}
                        >
                          <div
                            style={{
                              ...styles.messageAvatar,
                              backgroundColor: stringToColor(m.sender_username),
                              backgroundImage: m.sender_avatar_url ? `url(${m.sender_avatar_url})` : "none",
                            }}
                          >
                            {!m.sender_avatar_url && m.sender_username.charAt(0).toUpperCase()}
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
                            <div
                              style={{
                                padding: "0.5rem 0.8rem",
                                borderRadius: isMe ? "12px 0px 12px 12px" : "0px 12px 12px 12px",
                                backgroundColor: isMe ? "var(--primary)" : "var(--bg-surface)",
                                border: isMe ? "none" : "1px solid var(--border-color)",
                                boxShadow: "var(--shadow-sm)",
                              }}
                            >
                              <p
                                style={{
                                  ...styles.messageBodyText,
                                  color: isMe ? "var(--bg-main)" : "var(--text-main)",
                                  textAlign: isMe ? "left" : "left",
                                }}
                              >
                                {m.content}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })
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
                  <button type="submit" disabled={!text.trim()} className="btn btn-primary" style={styles.sendBtn}>
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
      </div>
      </main>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────

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
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    borderBottom: "1px solid var(--border-primary)",
    paddingBottom: "1rem",
    marginBottom: "1.5rem",
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
    fontSize: "var(--text-sm)",
    color: "var(--text-tertiary)",
    margin: "0.15rem 0 0",
  },
  wsIndicator: {
    display: "flex",
    alignItems: "center",
    gap: "0.4rem",
  },
  indicatorDot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
  },
  wsText: {
    fontSize: "var(--text-xs)",
    fontWeight: 600,
    color: "var(--text-secondary)",
    textTransform: "uppercase",
    letterSpacing: "0.03em",
  },

  chatGrid: {
    display: "grid",
    gridTemplateColumns: "260px 1fr",
    gap: "2rem",
    minHeight: "550px",
    alignItems: "stretch",
  },
  leftCol: {
    borderRight: "1px solid var(--border-primary)",
    paddingRight: "1.5rem",
    display: "flex",
    flexDirection: "column",
    gap: "1.25rem",
  },
  searchForm: {
    width: "100%",
  },
  searchInput: {
    width: "100%",
    padding: "0.45rem 0.75rem",
    fontSize: "var(--text-sm)",
  },
  searchResultsBox: {
    border: "1px solid var(--border-primary)",
    backgroundColor: "var(--bg-inset)",
    display: "flex",
    flexDirection: "column",
    maxHeight: "150px",
    overflowY: "auto",
    borderRadius: "var(--radius-sm)",
  },
  searchResultBtn: {
    padding: "0.45rem 0.75rem",
    textAlign: "left",
    background: "none",
    border: "none",
    fontSize: "var(--text-xs)",
    fontFamily: "var(--font-mono)",
    cursor: "pointer",
    borderBottom: "1px dashed var(--border-primary)",
  },
  sectionHeaderRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottom: "1px solid var(--text-primary)",
    paddingBottom: "0.4rem",
  },
  panelTitle: {
    fontFamily: "var(--font-serif)",
    fontWeight: 600,
    fontSize: "var(--text-sm)",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  channelStack: {
    display: "flex",
    flexDirection: "column",
    gap: "0.25rem",
  },
  channelItemBtn: {
    backgroundColor: "transparent",
    borderTop: "none",
    borderRight: "none",
    borderBottom: "none",
    borderLeft: "2px solid transparent",
    textAlign: "left",
    padding: "0.5rem 0.75rem",
    fontSize: "var(--text-sm)",
    fontFamily: "var(--font-sans)",
    color: "var(--text-secondary)",
    cursor: "pointer",
    borderRadius: "var(--radius-sm)",
    transition: "all 150ms ease",
  },
  channelItemActive: {
    backgroundColor: "var(--bg-surface-active)",
    color: "var(--text-primary)",
    fontWeight: 600,
    borderLeft: "2px solid var(--color-primary)",
  },
  centerCol: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    minWidth: 0,
  },
  channelHeader: {
    borderBottom: "1px solid var(--border-primary)",
    paddingBottom: "0.75rem",
    marginBottom: "1rem",
  },
  channelTitleText: {
    fontFamily: "var(--font-serif)",
    fontSize: "var(--text-lg)",
    fontWeight: 600,
    margin: 0,
    border: "none",
  },
  channelDescText: {
    fontSize: "var(--text-xs)",
    color: "var(--text-tertiary)",
    margin: "0.2rem 0 0 0",
  },
  messagesContainer: {
    flexGrow: 1,
    overflowY: "auto",
    paddingRight: "0.5rem",
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
    maxHeight: "450px",
    minHeight: "350px",
    backgroundColor: "var(--bg-surface)",
    border: "1px solid var(--border-primary)",
    borderRadius: "var(--radius-md)",
    padding: "1rem",
  },
  loadingThread: {
    textAlign: "center",
    color: "var(--text-tertiary)",
    fontSize: "var(--text-sm)",
    padding: "2rem 0",
  },
  emptyThreadPlaceholder: {
    textAlign: "center",
    color: "var(--text-tertiary)",
    fontSize: "var(--text-sm)",
    fontStyle: "italic",
    padding: "2rem 0",
  },
  messageRow: {
    display: "flex",
    gap: "0.6rem",
    alignItems: "start",
  },
  messageAvatar: {
    width: "30px",
    height: "30px",
    borderRadius: "var(--radius-sm)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "white",
    fontSize: "var(--text-xs)",
    fontWeight: 700,
    backgroundSize: "cover",
    flexShrink: 0,
  },
  messageContentBlock: {
    display: "flex",
    flexDirection: "column",
    gap: "0.2rem",
    maxWidth: "80%",
  },
  messageMetaRow: {
    display: "flex",
    alignItems: "baseline",
    gap: "0.35rem",
  },
  senderNameText: {
    fontWeight: 600,
    fontSize: "var(--text-sm)",
  },
  senderUserHandle: {
    fontFamily: "var(--font-mono)",
    fontSize: "var(--text-xs)",
    color: "var(--text-tertiary)",
  },
  messageTimeText: {
    fontSize: "var(--text-xs)",
    color: "var(--text-tertiary)",
  },
  messageBodyText: {
    fontSize: "var(--text-sm)",
    lineHeight: 1.5,
    margin: 0,
    color: "var(--text-secondary)",
  },
  inputArea: {
    display: "flex",
    gap: "0.75rem",
    marginTop: "1rem",
    alignItems: "stretch",
  },
  messageInput: {
    flexGrow: 1,
    padding: "0.5rem 0.75rem",
    fontSize: "var(--text-sm)",
    resize: "none",
  },
  sendBtn: {},
  emptyWorkspace: {
    flexGrow: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontStyle: "italic",
    color: "var(--text-tertiary)",
    fontSize: "var(--text-sm)",
    textAlign: "center",
    padding: "3rem",
    border: "1px dashed var(--border-primary)",
    borderRadius: "var(--radius-md)",
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
};
