package events

import (
	"time"
)

// ── Domain Models ────────────────────────────────

// Event represents a community schedule meeting, virtual stream, AMA, or physical meetup.
type Event struct {
	ID          string     `json:"id"`
	CommunityID string     `json:"community_id"`
	Title       string     `json:"title"`
	Description string     `json:"description"`
	Location    string     `json:"location"`
	StartTime   time.Time  `json:"start_time"`
	EndTime     *time.Time `json:"end_time,omitempty"`
	CreatedBy   string     `json:"created_by"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`

	// RSVP Aggregates
	GoingCount      int `json:"going_count"`
	InterestedCount int `json:"interested_count"`
	DeclinedCount   int `json:"declined_count"`
	UserRSVPStatus  string `json:"user_rsvp_status,omitempty"` // The current user's RSVP status (going | interested | declined or empty)
}

// RSVP represents a user's RSVP record.
type RSVP struct {
	ID        string    `json:"id"`
	EventID   string    `json:"event_id"`
	UserID    string    `json:"user_id"`
	Status    string    `json:"status"` // going | interested | declined
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// ── Request Models ───────────────────────────────

// CreateEventRequest is the payload to schedule a new event.
type CreateEventRequest struct {
	Title       string     `json:"title"`
	Description string     `json:"description"`
	Location    string     `json:"location"`
	StartTime   time.Time  `json:"start_time"`
	EndTime     *time.Time `json:"end_time,omitempty"`
}

// UpdateEventRequest is the payload to edit details.
type UpdateEventRequest struct {
	Title       string     `json:"title"`
	Description string     `json:"description"`
	Location    string     `json:"location"`
	StartTime   time.Time  `json:"start_time"`
	EndTime     *time.Time `json:"end_time,omitempty"`
}

// RSVPRequest registers or shifts user response.
type RSVPRequest struct {
	Status string `json:"status"` // going | interested | declined (empty to revoke/remove)
}

// ── Validation ───────────────────────────────────

// Validate checks CreateEventRequest validation boundaries.
func (r *CreateEventRequest) Validate() map[string]string {
	errors := make(map[string]string)

	if len(r.Title) < 3 || len(r.Title) > 100 {
		errors["title"] = "title must be between 3 and 100 characters"
	}
	if r.StartTime.IsZero() {
		errors["start_time"] = "start_time is required"
	}
	if r.EndTime != nil && r.EndTime.Before(r.StartTime) {
		errors["end_time"] = "end_time cannot be before start_time"
	}

	return errors
}

// ValidRSVPStatuses holds allowed RSVP response values.
var ValidRSVPStatuses = map[string]bool{
	"going":      true,
	"interested": true,
	"declined":   true,
}
