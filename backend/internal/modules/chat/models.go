package chat

import (
	"time"
)


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

	SenderUsername    string `json:"sender_username,omitempty"`
	SenderDisplayName string `json:"sender_display_name,omitempty"`
	SenderAvatarURL   string `json:"sender_avatar_url,omitempty"`
}


type CreateChannelRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}


type WSFrame struct {
	Event   string                 `json:"event"`             
	Topic   string                 `json:"topic"`             
	Payload map[string]interface{} `json:"payload,omitempty"` 
}

func (r *CreateChannelRequest) Validate() map[string]string {
	errors := make(map[string]string)
	if len(r.Name) < 2 || len(r.Name) > 50 {
		errors["name"] = "channel name must be between 2 and 50 characters"
	}
	return errors
}
