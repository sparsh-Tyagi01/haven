package chat

import (
	"time"
)

// ── Domain Models ────────────────────────────────

type Channel struct {
	ID          string    `json:"id"`
	CommunityID string    `json:"community_id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type Message struct {
	ID              string    `json:"id"`
	ChannelID       *string   `json:"channel_id,omitempty"`
	RecipientUserID *string   `json:"recipient_user_id,omitempty"`
	SenderID        string    `json:"sender_id"`
	Content         string    `json:"content"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`

	// Joined attributes
	SenderUsername    string `json:"sender_username,omitempty"`
	SenderDisplayName string `json:"sender_display_name,omitempty"`
	SenderAvatarURL   string `json:"sender_avatar_url,omitempty"`
}

// ── Request Payloads ──────────────────────────────

type CreateChannelRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

// ── WS WebSocket Frames ──────────────────────────

// WSFrame defines the standard JSON payload structure exchanged over websocket.
type WSFrame struct {
	Event   string                 `json:"event"`             // e.g. "room:join", "room:leave", "chat:message", "chat:typing", "presence:update"
	Topic   string                 `json:"topic"`             // e.g. "channel:<id>", "dm:<user_id>", "presence:<community_id>"
	Payload map[string]interface{} `json:"payload,omitempty"` // Message details
}

// Validate CreateChannelRequest
func (r *CreateChannelRequest) Validate() map[string]string {
	errors := make(map[string]string)
	if len(r.Name) < 2 || len(r.Name) > 50 {
		errors["name"] = "channel name must be between 2 and 50 characters"
	}
	return errors
}
