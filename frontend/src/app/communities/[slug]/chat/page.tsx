"use client";

import React, { useState, useEffect, useRef, use, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "../../../../hooks/useAuth";
import { useCommunity, fetchMembers, type Membership } from "../../../../hooks/useCommunities";
import {
  useWebSocket,
  fetchChannels,
  fetchChannelMessages,
  createChannel,
  type Channel,
  type Message,
} from "../../../../hooks/useChat";

export default function CommunityChatPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const resolvedParams = use(params);
  const { user, isAuthenticated } = useAuth();
  const { community } = useCommunity(resolvedParams.slug);

  // States
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [members, setMembers] = useState<Membership[]>([]);
  const [onlineMembers, setOnlineMembers] = useState<Record<string, string>>({});
  const [userRole, setUserRole] = useState<string | null>(null);
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Modals & New Channel Form
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newChanName, setNewChanName] = useState("");
  const [newChanDesc, setNewChanDesc] = useState("");

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const typingTimeoutRef = useRef<any>(null);

  // Load Channels & Members list
  useEffect(() => {
    if (!community) return;
    fetchChannels(community.slug)
      .then((res) => {
        setChannels(res || []);
        if (res && res.length > 0) {
          setSelectedChannel(res[0]);
        }
      })
      .catch(() => {});

    fetchMembers(community.id)
      .then((res) => {
        setMembers(res.members || []);
        const myMem = (res.members || []).find((m) => m.user_id === user?.id);
        if (myMem) {
          setUserRole(myMem.role);
        }
      })
      .catch(() => {});
  }, [community, user]);

  // Load messages when selected channel shifts
  useEffect(() => {
    if (!selectedChannel) return;
    setLoadingMessages(true);
    fetchChannelMessages(selectedChannel.id)
      .then((res) => {
        setMessages(res || []);
        scrollToBottom();
      })
      .catch(() => {})
      .finally(() => setLoadingMessages(false));
  }, [selectedChannel]);

  // Handle incoming WS frames
  const handleIncomingFrame = useCallback((frame: { event: string; topic: string; payload: any }) => {
    if (!selectedChannel) return;

    if (frame.event === "chat:message" && frame.topic === `channel:${selectedChannel.id}`) {
      const msgPayload = frame.payload;
      setMessages((prev) => {
        // Prevent duplicate messages
        if (prev.some((m) => m.id === msgPayload.id)) return prev;
        return [...prev, msgPayload];
      });
      scrollToBottom();
    }

    if (frame.event === "chat:typing" && frame.topic === `channel:${selectedChannel.id}`) {
      if (frame.payload.userId !== user?.id) {
        setTypingUser(frame.payload.username);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
          setTypingUser(null);
        }, 3000);
      }
    }

    if (frame.event === "presence:update" && frame.topic === "presence") {
      setOnlineMembers((prev) => ({
        ...prev,
        [frame.payload.userId]: frame.payload.status,
      }));
    }
  }, [selectedChannel, user]);

  // Setup socket
  const { connected, sendFrame } = useWebSocket(handleIncomingFrame);

  // Subscribe to channel messages & presence topic
  useEffect(() => {
    if (connected && selectedChannel) {
      sendFrame("room:join", `channel:${selectedChannel.id}`);
      sendFrame("room:join", "presence");
      return () => {
        sendFrame("room:leave", `channel:${selectedChannel.id}`);
      };
    }
  }, [connected, selectedChannel, sendFrame]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !selectedChannel) return;

    sendFrame("chat:message", `channel:${selectedChannel.id}`, {
      channel_id: selectedChannel.id,
      content: text,
    });
    setText("");
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    } else {
      // Trigger typing indicator
      if (selectedChannel) {
        sendFrame("chat:typing", `channel:${selectedChannel.id}`);
      }
    }
  };

  const handleCreateChannelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!community || newChanName.trim().length < 2) return;
    try {
      const ch = await createChannel(community.id, {
        name: newChanName.replace(/\s+/g, "-").toLowerCase(),
        description: newChanDesc,
      });
      setChannels((prev) => [...prev, ch]);
      setSelectedChannel(ch);
      setShowCreateModal(false);
      setNewChanName("");
      setNewChanDesc("");
    } catch (err: any) {
      alert(err.message || "Failed to create channel");
    }
  };

  const isStaff =
    userRole === "owner" ||
    userRole === "admin" ||
    userRole === "moderator";

  if (!community) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner} />
        <p style={styles.loadingText}>Connecting to server rooms...</p>
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
              ← Return to /{community.slug}
            </Link>
            <div style={styles.wsIndicator}>
              <span style={{
                ...styles.indicatorDot,
                backgroundColor: connected ? "#10b981" : "#ef4444"
              }} />
              <span>{connected ? "Real-time Link Active" : "Connecting..."}</span>
            </div>
          </div>
          <h1 style={styles.pageTitle}>CHATROOM WORKSPACE</h1>
        </header>

        {/* Chat Interface Grid */}
        <div style={styles.chatGrid}>
          {/* Left Panel — Channels List */}
          <div style={styles.leftCol}>
            <div style={styles.sectionHeaderRow}>
              <span style={styles.panelTitle}>Rooms</span>
              {isStaff && (
                <button onClick={() => setShowCreateModal(true)} style={styles.addChannelBtn}>
                  + New
                </button>
              )}
            </div>
            <div style={styles.channelStack}>
              {channels.map((ch) => (
                <button
                  key={ch.id}
                  onClick={() => setSelectedChannel(ch)}
                  style={{
                    ...styles.channelItemBtn,
                    ...(selectedChannel?.id === ch.id ? styles.channelItemActive : {}),
                  }}
                >
                  # {ch.name}
                </button>
              ))}
            </div>
          </div>

          {/* Center Panel — Message Thread */}
          <div style={styles.centerCol}>
            {selectedChannel ? (
              <>
                {/* Channel Meta */}
                <div style={styles.channelHeader}>
                  <h3 style={styles.channelTitleText}>#{selectedChannel.name}</h3>
                  {selectedChannel.description && (
                    <p style={styles.channelDescText}>{selectedChannel.description}</p>
                  )}
                </div>

                {/* Messages Log */}
                <div style={styles.messagesContainer}>
                  {loadingMessages ? (
                    <div style={styles.loadingThread}>Loading message history...</div>
                  ) : messages.length === 0 ? (
                    <div style={styles.emptyThreadPlaceholder}>
                      This is the beginning of the #{selectedChannel.name} room.
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
                  {typingUser && (
                    <div style={styles.typingIndicator}>
                      ✍️ <em>{typingUser} is typing...</em>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Message Input Editor */}
                <form onSubmit={handleSend} style={styles.inputArea}>
                  <textarea
                    placeholder={isAuthenticated ? `Message #${selectedChannel.name}...` : "Sign in to send messages"}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={handleKeyPress}
                    disabled={!isAuthenticated}
                    rows={2}
                    style={styles.messageInput}
                  />
                  <button type="submit" disabled={!text.trim() || !isAuthenticated} style={styles.sendBtn}>
                    Send
                  </button>
                </form>
              </>
            ) : (
              <div style={styles.emptyWorkspace}>
                No room selected. Select a room to start messaging.
              </div>
            )}
          </div>

          {/* Right Panel — Online Presence Roster */}
          <div style={styles.rightCol}>
            <div style={styles.sectionHeaderRow}>
              <span style={styles.panelTitle}>Online Members</span>
            </div>
            <div style={styles.rosterList}>
              {members.map((m) => {
                const status = onlineMembers[m.user_id] || "offline";
                const isOnline = status === "online";

                return (
                  <div key={m.id} style={styles.rosterItem}>
                    <div style={styles.presenceIndicatorWrapper}>
                      <div
                        style={{
                          ...styles.rosterAvatar,
                          backgroundColor: stringToColor(m.username || "?"),
                          backgroundImage: m.avatar_url ? `url(${m.avatar_url})` : "none",
                        }}
                      >
                        {!m.avatar_url && (m.username || "?").charAt(0).toUpperCase()}
                      </div>
                      <span style={{
                        ...styles.statusDot,
                        backgroundColor: isOnline ? "#10b981" : "#9ca3af",
                      }} />
                    </div>
                    <div style={styles.rosterInfo}>
                      <span style={styles.rosterName}>{m.display_name || m.username}</span>
                      <span style={styles.rosterRoleText}>{m.role}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Modal: Create Channel */}
        {showCreateModal && (
          <div style={styles.modalOverlay}>
            <div style={styles.modalContent}>
              <h3 style={styles.modalHeader}>Create Chat Channel</h3>
              <form onSubmit={handleCreateChannelSubmit} style={styles.modalForm}>
                <div className="form-group">
                  <label htmlFor="chanName">Channel Name *</label>
                  <input
                    id="chanName"
                    type="text"
                    placeholder="e.g. general, announcements"
                    value={newChanName}
                    onChange={(e) => setNewChanName(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="chanDesc">Description</label>
                  <input
                    id="chanDesc"
                    type="text"
                    placeholder="Provide description of room topic..."
                    value={newChanDesc}
                    onChange={(e) => setNewChanDesc(e.target.value)}
                  />
                </div>
                <div style={styles.modalActions}>
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="btn btn-secondary"
                  >
                    Close
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Create Channel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer style={styles.footer}>
          <div style={styles.footerBorder} />
          <div style={styles.footerGrid}>
            <span>Active Server Rooms</span>
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
    gridTemplateColumns: "200px 1fr 220px",
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
  addChannelBtn: {
    background: "none",
    border: "none",
    fontSize: "0.75rem",
    fontWeight: 700,
    color: "var(--primary)",
    cursor: "pointer",
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
  typingIndicator: {
    fontSize: "0.75rem",
    color: "var(--text-light)",
    marginTop: "0.25rem",
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
  rightCol: {
    borderLeft: "1px solid var(--border-color)",
    paddingLeft: "1rem",
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
  },
  rosterList: {
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
  },
  rosterItem: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  },
  presenceIndicatorWrapper: {
    position: "relative",
    flexShrink: 0,
  },
  rosterAvatar: {
    width: "28px",
    height: "28px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "white",
    fontSize: "0.75rem",
    fontWeight: 700,
    backgroundSize: "cover",
  },
  statusDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    border: "1.5px solid var(--bg-surface)",
  },
  rosterInfo: {
    display: "flex",
    flexDirection: "column",
  },
  rosterName: {
    fontSize: "0.8rem",
    fontWeight: 500,
  },
  rosterRoleText: {
    fontSize: "0.65rem",
    color: "var(--text-light)",
    textTransform: "uppercase",
  },
  emptyWorkspace: {
    flexGrow: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontStyle: "italic",
    color: "var(--text-light)",
    fontSize: "0.9rem",
  },
  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    backgroundColor: "rgba(0,0,0,0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
  },
  modalContent: {
    backgroundColor: "var(--bg-surface)",
    border: "2px solid var(--text-main)",
    padding: "2rem",
    width: "100%",
    maxWidth: "400px",
    boxShadow: "var(--shadow-lg)",
  },
  modalHeader: {
    fontFamily: "var(--font-serif)",
    fontSize: "1.25rem",
    borderBottom: "2px solid var(--text-main)",
    paddingBottom: "0.5rem",
    marginBottom: "1.25rem",
    textTransform: "uppercase",
    border: "none",
    borderBottomWidth: "2px",
    borderBottomStyle: "solid",
    borderBottomColor: "var(--text-main)",
  },
  modalForm: {
    display: "flex",
    flexDirection: "column",
    gap: "1.25rem",
  },
  modalActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "0.75rem",
    borderTop: "1px solid var(--border-color)",
    paddingTop: "1.25rem",
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
