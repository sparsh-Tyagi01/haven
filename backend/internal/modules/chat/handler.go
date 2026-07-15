package chat

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/golang-jwt/jwt/v5"
	"github.com/gorilla/websocket"
	"github.com/redis/go-redis/v9"
	"github.com/sparsh-Tyagi01/haven/backend/internal/config"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		// In production, tighten this up to match configuration
		return true
	},
}

// Handler holds dependencies for all chat and direct messaging endpoints.
type Handler struct {
	db  *sql.DB
	rdb *redis.Client
	cfg *config.Config
	Hub *Hub
}

// NewHandler creates a new chat Handler and executes the Hub runner.
func NewHandler(db *sql.DB, rdb *redis.Client, cfg *config.Config) *Handler {
	hub := NewHub(rdb)
	go hub.Run()

	return &Handler{
		db:  db,
		rdb: rdb,
		cfg: cfg,
		Hub: hub,
	}
}

// ── WebSocket Upgrade Handler ────────────────────

// UpgradeWS upgrades HTTP to real-time WebSockets connection.
// GET /api/v1/ws?token=...
func (h *Handler) UpgradeWS(w http.ResponseWriter, r *http.Request) {
	tokenStr := r.URL.Query().Get("token")
	if tokenStr == "" {
		tokenStr = r.Header.Get("Sec-WebSocket-Protocol")
	}

	if tokenStr == "" {
		http.Error(w, "Unauthorized: token is required", http.StatusUnauthorized)
		return
	}

	// Verify JWT
	token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method")
		}
		return []byte(h.cfg.JWTSecret), nil
	})
	if err != nil || !token.Valid {
		log.Printf("[WS] JWT validation failed: %v", err)
		http.Error(w, "Unauthorized: invalid token", http.StatusUnauthorized)
		return
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		http.Error(w, "Unauthorized: invalid claims", http.StatusUnauthorized)
		return
	}

	userID, ok := claims["user_id"].(string)
	if !ok || userID == "" {
		http.Error(w, "Unauthorized: invalid user identifier", http.StatusUnauthorized)
		return
	}

	// Upgrade
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("failed to upgrade websocket connection: %v", err)
		return
	}

	client := &Client{
		Hub:    h.Hub,
		Conn:   conn,
		UserID: userID,
		Send:   make(chan []byte, 256),
		Rooms:  make(map[string]bool),
	}

	h.Hub.register <- client

	// Start reading/writing pumps
	go client.writePump()
	go client.readPump(h)

	// Set presence status to Online in Redis
	h.setUserPresence(userID, "online")
}

// ── REST Chat Endpoints ──────────────────────────

// CreateChannel creates a community chat channel.
// POST /api/v1/communities/{id}/channels
func (h *Handler) CreateChannel(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value("userID").(string)
	if !ok || userID == "" {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	communityID := chi.URLParam(r, "id")
	if communityID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "community id is required"})
		return
	}

	// Verify permissions (owner, admin, moderator only)
	role := h.getUserRole(r, userID, communityID)
	if role != "owner" && role != "admin" && role != "moderator" {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "insufficient permissions"})
		return
	}

	var req CreateChannelRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	if errs := req.Validate(); len(errs) > 0 {
		writeJSON(w, http.StatusUnprocessableEntity, map[string]interface{}{"errors": errs})
		return
	}

	var c Channel
	err := h.db.QueryRowContext(r.Context(),
		`INSERT INTO channels (community_id, name, description)
		 VALUES ($1, $2, $3)
		 RETURNING id, community_id, name, description, created_at, updated_at`,
		communityID, req.Name, req.Description,
	).Scan(&c.ID, &c.CommunityID, &c.Name, &c.Description, &c.CreatedAt, &c.UpdatedAt)
	if err != nil {
		log.Printf("error creating channel: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	writeJSON(w, http.StatusCreated, c)
}

// ListChannels returns all channels in a community.
// GET /api/v1/communities/{slug}/channels
func (h *Handler) ListChannels(w http.ResponseWriter, r *http.Request) {
	communitySlug := chi.URLParam(r, "slug")
	if communitySlug == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "community slug is required"})
		return
	}

	userID, _ := r.Context().Value("userID").(string)

	// Fetch community meta
	var communityID string
	var visibility string
	err := h.db.QueryRowContext(r.Context(),
		`SELECT id, visibility FROM communities WHERE slug = $1`, communitySlug,
	).Scan(&communityID, &visibility)
	if err == sql.ErrNoRows {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "community not found"})
		return
	}

	if visibility != "public" {
		if userID == "" {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "this community is private"})
			return
		}
		var isMember bool
		h.db.QueryRowContext(r.Context(),
			`SELECT EXISTS(SELECT 1 FROM memberships WHERE user_id = $1 AND community_id = $2)`,
			userID, communityID,
		).Scan(&isMember)
		if !isMember {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "you must join this community to view channels"})
			return
		}
	}

	rows, err := h.db.QueryContext(r.Context(),
		`SELECT id, community_id, name, description, created_at, updated_at
		 FROM channels
		 WHERE community_id = $1
		 ORDER BY name ASC`,
		communityID,
	)
	if err != nil {
		log.Printf("error listing channels: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}
	defer rows.Close()

	channelsList := []Channel{}
	for rows.Next() {
		var c Channel
		if err := rows.Scan(&c.ID, &c.CommunityID, &c.Name, &c.Description, &c.CreatedAt, &c.UpdatedAt); err == nil {
			channelsList = append(channelsList, c)
		}
	}

	writeJSON(w, http.StatusOK, channelsList)
}

// ListChannelMessages returns message logs of a channel.
// GET /api/v1/channels/{channelId}/messages
func (h *Handler) ListChannelMessages(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value("userID").(string)
	if !ok || userID == "" {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	channelID := chi.URLParam(r, "channelId")
	if channelID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "channel id is required"})
		return
	}

	// Verify membership on community containing the channel
	var communityID string
	err := h.db.QueryRowContext(r.Context(),
		`SELECT community_id FROM channels WHERE id = $1`, channelID,
	).Scan(&communityID)
	if err == sql.ErrNoRows {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "channel not found"})
		return
	}

	var isMember bool
	h.db.QueryRowContext(r.Context(),
		`SELECT EXISTS(SELECT 1 FROM memberships WHERE user_id = $1 AND community_id = $2)`,
		userID, communityID,
	).Scan(&isMember)
	if !isMember {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "you must join this community to view messages"})
		return
	}

	rows, err := h.db.QueryContext(r.Context(),
		`SELECT m.id, m.channel_id, m.sender_id, m.content, m.created_at, m.updated_at,
		        u.username, COALESCE(u.display_name, ''), COALESCE(u.avatar_url, '')
		 FROM messages m
		 JOIN users u ON m.sender_id = u.id
		 WHERE m.channel_id = $1
		 ORDER BY m.created_at ASC
		 LIMIT 100`,
		channelID,
	)
	if err != nil {
		log.Printf("error listing channel messages: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}
	defer rows.Close()

	messages := []Message{}
	for rows.Next() {
		var m Message
		var chID string
		err := rows.Scan(&m.ID, &chID, &m.SenderID, &m.Content, &m.CreatedAt, &m.UpdatedAt, &m.SenderUsername, &m.SenderDisplayName, &m.SenderAvatarURL)
		if err == nil {
			m.ChannelID = &chID
			messages = append(messages, m)
		}
	}

	writeJSON(w, http.StatusOK, messages)
}

// ListDirectMessages returns private direct messaging logs.
// GET /api/v1/direct/messages/{userId}
func (h *Handler) ListDirectMessages(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value("userID").(string)
	if !ok || userID == "" {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	recipientID := chi.URLParam(r, "userId")
	if recipientID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "recipient user id is required"})
		return
	}

	rows, err := h.db.QueryContext(r.Context(),
		`SELECT m.id, m.recipient_user_id, m.sender_id, m.content, m.created_at, m.updated_at,
		        u.username, COALESCE(u.display_name, ''), COALESCE(u.avatar_url, '')
		 FROM messages m
		 JOIN users u ON m.sender_id = u.id
		 WHERE (m.sender_id = $1 AND m.recipient_user_id = $2)
		    OR (m.sender_id = $2 AND m.recipient_user_id = $1)
		 ORDER BY m.created_at ASC
		 LIMIT 100`,
		userID, recipientID,
	)
	if err != nil {
		log.Printf("error listing direct messages: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}
	defer rows.Close()

	messages := []Message{}
	for rows.Next() {
		var m Message
		var recID string
		err := rows.Scan(&m.ID, &recID, &m.SenderID, &m.Content, &m.CreatedAt, &m.UpdatedAt, &m.SenderUsername, &m.SenderDisplayName, &m.SenderAvatarURL)
		if err == nil {
			m.RecipientUserID = &recID
			messages = append(messages, m)
		}
	}

	writeJSON(w, http.StatusOK, messages)
}

// ── WebSocket Client Read/Write Pumps ───────────────

func (c *Client) readPump(h *Handler) {
	log.Printf("[WS client] Starting readPump for user %s", c.UserID)
	defer func() {
		log.Printf("[WS client] Exiting readPump for user %s", c.UserID)
		h.Hub.unregister <- c
		c.Conn.Close()
		h.setUserPresence(c.UserID, "offline")
	}()

	c.Conn.SetReadLimit(4096)
	c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.Conn.SetPongHandler(func(string) error {
		c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		_, message, err := c.Conn.ReadMessage()
		if err != nil {
			log.Printf("[WS client] ReadMessage error for user %s: %v", c.UserID, err)
			break
		}

		var frame WSFrame
		if err := json.Unmarshal(message, &frame); err != nil {
			log.Printf("websocket unmarshal frame error: %v", err)
			continue
		}

		switch frame.Event {
		case "room:join":
			c.mu.Lock()
			c.Rooms[frame.Topic] = true
			c.mu.Unlock()

		case "room:leave":
			c.mu.Lock()
			delete(c.Rooms, frame.Topic)
			c.mu.Unlock()

		case "chat:typing":
			// Broadcast typing state back out
			var username string
			h.db.QueryRow(`SELECT username FROM users WHERE id = $1`, c.UserID).Scan(&username)
			payload := map[string]interface{}{"userId": c.UserID, "username": username}
			h.Hub.broadcast <- WSFrame{Event: "chat:typing", Topic: frame.Topic, Payload: payload}

		case "chat:message":
			content, _ := frame.Payload["content"].(string)
			if content == "" {
				continue
			}

			var chID *string
			var recID *string
			var topic string

			channelIDVal, hasChannel := frame.Payload["channel_id"].(string)
			recipientIDVal, hasRecipient := frame.Payload["recipient_user_id"].(string)

			if hasChannel && channelIDVal != "" {
				chID = &channelIDVal
				topic = "channel:" + channelIDVal

				// SQL Save
				var m Message
				err := h.db.QueryRowContext(context.Background(),
					`INSERT INTO messages (channel_id, sender_id, content) VALUES ($1, $2, $3)
					 RETURNING id, created_at, updated_at`,
					chID, c.UserID, content,
				).Scan(&m.ID, &m.CreatedAt, &m.UpdatedAt)
				if err != nil {
					log.Printf("error saving channel message: %v", err)
					continue
				}

				// Fetch sender meta
				h.db.QueryRowContext(context.Background(),
					`SELECT username, COALESCE(display_name, ''), COALESCE(avatar_url, '') FROM users WHERE id = $1`,
					c.UserID,
				).Scan(&m.SenderUsername, &m.SenderDisplayName, &m.SenderAvatarURL)
				m.SenderID = c.UserID
				m.ChannelID = chID
				m.Content = content

				// Broadcast
				payloadMap := map[string]interface{}{
					"id":                  m.ID,
					"channel_id":          m.ChannelID,
					"sender_id":           m.SenderID,
					"content":             m.Content,
					"created_at":          m.CreatedAt.Format(time.RFC3339),
					"updated_at":          m.UpdatedAt.Format(time.RFC3339),
					"sender_username":     m.SenderUsername,
					"sender_display_name": m.SenderDisplayName,
					"sender_avatar_url":   m.SenderAvatarURL,
				}
				h.Hub.broadcast <- WSFrame{Event: "chat:message", Topic: topic, Payload: payloadMap}

			} else if hasRecipient && recipientIDVal != "" {
				recID = &recipientIDVal

				// We want direct messaging room subscription keys to be matching regardless of sender/receiver.
				// Lexicographically sorting sender and receiver IDs ensures consistent topic key: "dm:userID1_userID2"
				topic = "dm:" + recipientIDVal // The payload uses recipient ID directly to inform individual listening clients

				var m Message
				err := h.db.QueryRowContext(context.Background(),
					`INSERT INTO messages (recipient_user_id, sender_id, content) VALUES ($1, $2, $3)
					 RETURNING id, created_at, updated_at`,
					recID, c.UserID, content,
				).Scan(&m.ID, &m.CreatedAt, &m.UpdatedAt)
				if err != nil {
					log.Printf("error saving direct message: %v", err)
					continue
				}

				h.db.QueryRowContext(context.Background(),
					`SELECT username, COALESCE(display_name, ''), COALESCE(avatar_url, '') FROM users WHERE id = $1`,
					c.UserID,
				).Scan(&m.SenderUsername, &m.SenderDisplayName, &m.SenderAvatarURL)
				m.SenderID = c.UserID
				m.RecipientUserID = recID
				m.Content = content

				payloadMap := map[string]interface{}{
					"id":                  m.ID,
					"recipient_user_id":   m.RecipientUserID,
					"sender_id":           m.SenderID,
					"content":             m.Content,
					"created_at":          m.CreatedAt.Format(time.RFC3339),
					"updated_at":          m.UpdatedAt.Format(time.RFC3339),
					"sender_username":     m.SenderUsername,
					"sender_display_name": m.SenderDisplayName,
					"sender_avatar_url":   m.SenderAvatarURL,
				}

				// Deliver frame to both recipient's private topic and sender's private topic
				h.Hub.broadcast <- WSFrame{Event: "chat:message", Topic: "dm:" + recipientIDVal, Payload: payloadMap}
				h.Hub.broadcast <- WSFrame{Event: "chat:message", Topic: "dm:" + c.UserID, Payload: payloadMap}
			}
		}
	}
}

func (c *Client) writePump() {
	ticker := time.NewTicker(30 * time.Second)
	defer func() {
		ticker.Stop()
		c.Conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.Send:
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.Conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			// Add queued frames to the same message
			n := len(c.Send)
			for i := 0; i < n; i++ {
				w.Write([]byte{'\n'})
				w.Write(<-c.Send)
			}

			if err := w.Close(); err != nil {
				return
			}

		case <-ticker.C:
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// ── Helpers ──────────────────────────────────────

func (h *Handler) getUserRole(r *http.Request, userID, communityID string) string {
	var role string
	err := h.db.QueryRowContext(r.Context(),
		`SELECT role FROM memberships WHERE user_id = $1 AND community_id = $2`,
		userID, communityID,
	).Scan(&role)
	if err != nil {
		return ""
	}
	return role
}

func (h *Handler) setUserPresence(userID, status string) {
	if h.rdb == nil {
		return
	}
	// Store presence status inside Redis hash keys
	h.rdb.HSet(context.Background(), "haven:presence", userID, status)
	h.rdb.Publish(context.Background(), "haven:chat", map[string]interface{}{
		"event": "presence:update",
		"topic": "presence",
		"payload": map[string]interface{}{
			"userId": userID,
			"status": status,
		},
	})
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}
